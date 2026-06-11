# models/consumer.py
from __future__ import annotations

import asyncio
import json
import logging
from io import BytesIO
from pathlib import Path
from typing import Optional

import avro.schema
from avro.io import BinaryDecoder, DatumReader
from confluent_kafka import Consumer, KafkaError
from confluent_kafka.serialization import StringDeserializer

from src.config.config import settings
from src.config.couchbase import CouchbaseClient
from src.models.order import OrderEvent, OrderEventType
from src.services.order_service import OrderService

logger = logging.getLogger(__name__)

SCHEMA_FILE_PATH = Path(__file__).resolve().parents[1] / "schema" / "message.avsc"


def _load_prompt_event_schema() -> avro.schema.Schema:
    with open(SCHEMA_FILE_PATH, "rb") as schema_file:
        return avro.schema.parse(schema_file.read().decode("utf-8"))


class KafkaAvroConsumer:
    def __init__(self):
        self._consumer: Optional[Consumer] = None
        self._avro_schema: Optional[avro.schema.Schema] = None
        self._datum_reader: Optional[DatumReader] = None
        self._string_deserializer = StringDeserializer("utf_8")
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._cb: Optional[CouchbaseClient] = None

    def connect(self, cb: Optional[CouchbaseClient] = None):
        """Initialize Kafka consumer and subscribe to prompt + order topics."""
        logger.info("Connecting Kafka consumer...")
        self._cb = cb

        if not getattr(settings, "KAFKA_CONSUMER_ENABLED", True):
            logger.warning("Kafka consumer is disabled by configuration")
            return

        try:
            self._avro_schema = _load_prompt_event_schema()
            self._datum_reader = DatumReader(self._avro_schema)

            consumer_config = {
                "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
                "group.id": getattr(settings, "KAFKA_CONSUMER_GROUP_ID", "fastapi-consumer-group"),
                "auto.offset.reset": "earliest",
                "enable.auto.commit": False,
            }

            self._consumer = Consumer(consumer_config)
            topics = [settings.KAFKA_TOPIC_PROMPT]
            if settings.KAFKA_TOPIC_ORDER_EVENTS not in topics:
                topics.append(settings.KAFKA_TOPIC_ORDER_EVENTS)
            self._consumer.subscribe(topics)

            logger.info(
                "Kafka consumer connected to %s, subscribed to topics %s",
                settings.KAFKA_BOOTSTRAP_SERVERS,
                topics,
            )
        except Exception as e:
            logger.error("Failed to connect Kafka consumer: %s", e, exc_info=True)
            raise

    def _deserialize_event(self, data: bytes) -> dict:
        if self._datum_reader is None:
            raise RuntimeError("Avro reader is not initialized. Call connect() first.")

        bytes_reader = BytesIO(data)
        decoder = BinaryDecoder(bytes_reader)
        return self._datum_reader.read(decoder)

    @staticmethod
    def _deserialize_json_event(data: bytes) -> dict:
        return json.loads(data.decode("utf-8"))

    def _process_prompt_message(self, msg) -> None:
        key = self._string_deserializer(msg.key()) if msg.key() else None
        value = self._deserialize_event(msg.value())

        logger.info(
            "Received prompt event topic=%s partition=%s offset=%s key=%s user=%s prompt=%s",
            msg.topic(),
            msg.partition(),
            msg.offset(),
            key,
            value.get("user_email"),
            value.get("prompt"),
        )

    async def _process_order_event_message(self, msg) -> None:
        if self._cb is None:
            raise RuntimeError("Couchbase client is not configured for Kafka order consumer")

        key = self._string_deserializer(msg.key()) if msg.key() else None
        value = self._deserialize_json_event(msg.value())
        event = OrderEvent.model_validate(value)

        logger.info(
            "Processing OrderEvent topic=%s partition=%s offset=%s key=%s event_type=%s order_id=%s event_id=%s",
            msg.topic(),
            msg.partition(),
            msg.offset(),
            key,
            event.event_type,
            event.order.id,
            event.event_id,
        )

        if event.event_type in {
            OrderEventType.ORDER_CREATED,
            OrderEventType.ORDER_UPDATED,
            OrderEventType.ORDER_DELETED,
        }:
            await OrderService(self._cb).apply_event(event)
            logger.info("Applied order event %s for order %s", event.event_id, event.order.id)
            return

        logger.warning("Skipping unsupported Kafka OrderEvent type %s", event.event_type)

    async def _process_message(self, msg) -> None:
        if msg.topic() == settings.KAFKA_TOPIC_ORDER_EVENTS:
            await self._process_order_event_message(msg)
            return

        if msg.topic() == settings.KAFKA_TOPIC_PROMPT:
            self._process_prompt_message(msg)
            return

        logger.warning("Skipping message from unhandled Kafka topic %s", msg.topic())

    async def _consume_loop(self):
        """Main consume loop."""
        if self._consumer is None:
            logger.warning("Kafka consumer is not connected; consume loop will not start")
            return

        logger.info("Consumer loop started")
        self._running = True
        message_count = 0

        while self._running:
            try:
                msg = self._consumer.poll(timeout=1.0)

                if msg is None:
                    await asyncio.sleep(0.01)
                    continue

                if msg.error():
                    if msg.error().code() != KafkaError._PARTITION_EOF:
                        logger.error("Consumer error: %s", msg.error())
                    continue

                message_count += 1
                logger.info("Processing Kafka message #%s", message_count)
                await self._process_message(msg)
                self._consumer.commit(message=msg, asynchronous=False)

            except Exception as e:
                logger.error("Error in consume loop: %s", e, exc_info=True)
                await asyncio.sleep(1)

        logger.info("Consumer loop ended. Total messages: %s", message_count)

    async def start(self):
        """Start the consumer background task."""
        logger.info("Starting consumer background task...")

        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._consume_loop())
            logger.info("Consumer background task created")

            await asyncio.sleep(1)
            logger.info("Task running: %s", not self._task.done())
        else:
            logger.warning("Consumer task already running")

    async def stop(self):
        """Stop the consumer gracefully."""
        logger.info("Stopping consumer...")
        self._running = False

        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
                logger.info("Consumer task cancelled")
            except asyncio.CancelledError:
                pass

        if self._consumer:
            self._consumer.close()
            logger.info("Consumer closed")


kafka_consumer = KafkaAvroConsumer()
