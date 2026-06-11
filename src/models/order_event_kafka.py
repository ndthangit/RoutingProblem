from __future__ import annotations

import json
import time
import uuid

from confluent_kafka import Consumer, KafkaError, TopicPartition

from src.config.config import settings
from src.models.order import OrderEvent


def list_order_events_from_kafka(
    order_id: str,
    *,
    limit: int = 200,
    offset: int = 0,
    timeout_s: float = 10.0,
) -> list[OrderEvent]:
    """Read OrderEvent history from Kafka by scanning the order event topic.

    This keeps Kafka as the order event store. It is acceptable for small/dev
    topics; production-scale history queries should use a read model built from
    the Kafka stream.
    """
    topic = settings.KAFKA_TOPIC_ORDER_EVENTS
    consumer = Consumer(
        {
            "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "group.id": f"order-event-reader-{uuid.uuid4()}",
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
        }
    )

    try:
        metadata = consumer.list_topics(topic=topic, timeout=timeout_s)
        topic_metadata = metadata.topics.get(topic)
        if topic_metadata is None or topic_metadata.error is not None:
            return []

        partitions = list(topic_metadata.partitions.keys())
        if not partitions:
            return []

        assignments = [TopicPartition(topic, partition, 0) for partition in partitions]
        high_watermarks: dict[int, int] = {}
        for assignment in assignments:
            _, high = consumer.get_watermark_offsets(assignment, timeout=timeout_s)
            high_watermarks[assignment.partition] = high

        remaining = {
            partition
            for partition, high in high_watermarks.items()
            if high > 0
        }
        if not remaining:
            return []

        consumer.assign(assignments)
        deadline = time.monotonic() + timeout_s
        events: list[OrderEvent] = []

        while remaining and time.monotonic() < deadline:
            msg = consumer.poll(0.5)
            if msg is None:
                continue

            partition = msg.partition()
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    remaining.discard(partition)
                continue

            try:
                raw = json.loads(msg.value().decode("utf-8"))
                event = OrderEvent.model_validate(raw)
            except Exception:
                event = None

            if event is not None and event.order.id == order_id:
                events.append(event)

            if msg.offset() + 1 >= high_watermarks.get(partition, 0):
                remaining.discard(partition)

        events.sort(key=lambda event: event.timestamp, reverse=True)
        return events[offset : offset + limit]
    finally:
        consumer.close()
