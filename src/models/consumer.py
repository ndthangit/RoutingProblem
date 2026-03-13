# models/consumer.py
import logging
import asyncio
from io import BytesIO
from pathlib import Path
from typing import Optional
from confluent_kafka import Consumer, KafkaError
from confluent_kafka.serialization import StringDeserializer
import avro.schema
from avro.io import BinaryDecoder, DatumReader

from src.config.config import settings

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

    def connect(self):
        """Initialize Kafka consumer and Avro schema."""
        logger.info("🔄 Connecting Kafka consumer...")

        if not getattr(settings, 'KAFKA_CONSUMER_ENABLED', True):
            logger.warning("⚠️ Kafka consumer is disabled by configuration")
            return

        try:
            self._avro_schema = _load_prompt_event_schema()
            self._datum_reader = DatumReader(self._avro_schema)
            logger.info("✅ Avro schema loaded successfully")

            consumer_config = {
                "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
                "group.id": getattr(settings, 'KAFKA_CONSUMER_GROUP_ID', 'fastapi-consumer-group'),
                "auto.offset.reset": "earliest",
                "enable.auto.commit": True,
                "auto.commit.interval.ms": 5000,
            }

            logger.info(f"Consumer config: {consumer_config}")

            self._consumer = Consumer(consumer_config)
            self._consumer.subscribe([settings.KAFKA_TOPIC_PROMPT])

            logger.info(
                "✅ Kafka consumer connected to %s, subscribed to topic %s",
                settings.KAFKA_BOOTSTRAP_SERVERS,
                settings.KAFKA_TOPIC_PROMPT,
            )
        except Exception as e:
            logger.error(f"❌ Failed to connect Kafka consumer: {e}", exc_info=True)
            raise

    def _deserialize_event(self, data: bytes) -> dict:
        bytes_reader = BytesIO(data)
        decoder = BinaryDecoder(bytes_reader)
        return self._datum_reader.read(decoder)

    def _process_message(self, msg):
        """Process a single Kafka message."""
        try:
            key = self._string_deserializer(msg.key()) if msg.key() else None
            value = self._deserialize_event(msg.value())

            logger.info(
                "\n" + "=" * 60 +
                "\n📥 RECEIVED PROMPT EVENT" +
                "\n" + "=" * 60 +
                f"\n📍 Topic: {msg.topic()}" +
                f"\n🔑 Partition: {msg.partition()}" +
                f"\n📌 Offset: {msg.offset()}" +
                f"\n🆔 Event ID: {key}" +
                f"\n👤 User: {value.get('user_email')}" +
                f"\n💬 Prompt: {value.get('prompt')}" +
                "\n" + "=" * 60
            )
        except Exception as e:
            logger.error(f"❌ Error processing message: {str(e)}", exc_info=True)

    async def _consume_loop(self):
        """Main consume loop."""
        logger.info("🚀 Consumer loop started")
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
                        logger.error(f"Consumer error: {msg.error()}")
                else:
                    message_count += 1
                    logger.info(f"📨 Processing message #{message_count}")
                    self._process_message(msg)

            except Exception as e:
                logger.error(f"Error in consume loop: {e}", exc_info=True)
                await asyncio.sleep(1)

        logger.info(f"Consumer loop ended. Total messages: {message_count}")

    async def start(self):
        """Start the consumer background task."""
        logger.info("🚀 Starting consumer background task...")

        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._consume_loop())
            logger.info("✅ Consumer background task created")

            # Give it a moment to start
            await asyncio.sleep(1)
            logger.info(f"Task running: {not self._task.done()}")
        else:
            logger.warning("Consumer task already running")

    async def stop(self):
        """Stop the consumer gracefully."""
        logger.info("🛑 Stopping consumer...")
        self._running = False

        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
                logger.info("✅ Consumer task cancelled")
            except asyncio.CancelledError:
                pass

        if self._consumer:
            self._consumer.close()
            logger.info("✅ Consumer closed")


# Singleton instance
kafka_consumer = KafkaAvroConsumer()