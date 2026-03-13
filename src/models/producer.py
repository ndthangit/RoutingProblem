import logging
from io import BytesIO
from pathlib import Path
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional

from confluent_kafka import Producer
from confluent_kafka.serialization import StringSerializer

import avro.schema
from avro.io import BinaryEncoder, DatumWriter

from src.config.config import settings

logger = logging.getLogger(__name__)

SCHEMA_FILE_PATH = Path(__file__).resolve().parents[1] / "schema" / "message.avsc"


def _load_prompt_event_schema() -> avro.schema.Schema:
    with open(SCHEMA_FILE_PATH, "rb") as schema_file:
        return avro.schema.parse(schema_file.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Dataclass that maps 1-1 to the Avro schema
# ---------------------------------------------------------------------------
@dataclass
class PromptEvent:
    user_email: str
    prompt: str
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict:
        return {
            "session_id":  self.session_id,
            "user_email": self.user_email,
            "prompt":     self.prompt,
            "timestamp":  self.timestamp,
        }


# ---------------------------------------------------------------------------
# Producer
# ---------------------------------------------------------------------------
class KafkaAvroProducer:
    def __init__(self):
        self._producer: Optional[Producer] = None
        self._avro_schema: Optional[avro.schema.Schema] = None
        self._datum_writer: Optional[DatumWriter] = None
        self._string_serializer = StringSerializer("utf_8")

    def connect(self):
        """Initialize Kafka producer and Avro schema/serializer."""
        self._avro_schema = _load_prompt_event_schema()
        self._datum_writer = DatumWriter(self._avro_schema)

        self._producer = Producer(
            {
                "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
                "client.id": settings.KAFKA_PRODUCER_CLIENT_ID,
                "acks": "all",
                "retries": 3,
                "retry.backoff.ms": 500,
            }
        )
        logger.info(
            "KafkaAvroProducer connected to %s with schema %s",
            settings.KAFKA_BOOTSTRAP_SERVERS,
            SCHEMA_FILE_PATH,
        )

    def _serialize_event(self, event: PromptEvent) -> bytes:
        if self._datum_writer is None:
            raise RuntimeError("Avro writer is not initialized. Call connect() first.")

        output_buffer = BytesIO()
        encoder = BinaryEncoder(output_buffer)
        self._datum_writer.write(event.to_dict(), encoder)
        return output_buffer.getvalue()

    def _delivery_report(self, err, msg):
        if err:
            logger.error("Delivery failed for session %s: %s", msg.key(), err)
        else:
            logger.info(
                "Event delivered to %s [%d] @ offset %d",
                msg.topic(),
                msg.partition(),
                msg.offset(),
            )

    def send_prompt_event(self, event: PromptEvent) -> str:
        """
        Serialize *event* with Avro and produce it to the configured topic.
        Returns the session_id so callers can reference it.
        """
        if self._producer is None or self._datum_writer is None:
            raise RuntimeError("KafkaAvroProducer is not connected. Call connect() first.")

        topic = settings.KAFKA_TOPIC_PROMPT
        key = self._string_serializer(event.session_id)

        value = self._serialize_event(event)

        self._producer.produce(
            topic=topic,
            key=key,
            value=value,
            on_delivery=self._delivery_report,
        )
        # Non-blocking flush (at most 5 s before returning)
        self._producer.poll(0)
        return event.session_id

    def flush(self, timeout: float = 10.0):
        """Block until all outstanding messages are delivered."""
        if self._producer:
            self._producer.flush(timeout)

    def close(self):
        self.flush()
        logger.info("KafkaAvroProducer closed.")


# ---------------------------------------------------------------------------
# Singleton instance (initialised in lifespan)
# ---------------------------------------------------------------------------
kafka_producer = KafkaAvroProducer()
