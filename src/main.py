# main.py
import logging
from contextlib import asynccontextmanager, AsyncExitStack
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_keycloak_middleware import setup_keycloak_middleware


from src.config.config import settings
from src.config.couchbase import get_couchbase_lifespan
from src.config.keycloak import keycloak_config, map_user
from src.models.consumer import kafka_consumer
from src.models.producer import kafka_producer
from src.api.vehicles import router as vehicles_router
from src.api.drivers import router as drivers_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def app_lifespan(app: FastAPI):
    logger.info("🚀 Application starting up...")

    async with AsyncExitStack() as stack:
        # Register infrastructure lifespans
        await stack.enter_async_context(get_couchbase_lifespan(app))
        logger.info("✅ Couchbase lifespans initialized.")

        # Kafka producer - connect
        try:
            kafka_producer.connect()
            logger.info("✅ Kafka producer connected")
        except Exception as e:
            logger.error(f"❌ Failed to connect Kafka producer: {e}")

        # Kafka consumer - connect AND start
        try:
            if settings.KAFKA_CONSUMER_ENABLED:
                kafka_consumer.connect()
                await kafka_consumer.start()
                logger.info("✅ Kafka consumer connected and started")
            else:
                logger.info("⏸️ Kafka consumer is disabled")
        except Exception as e:
            logger.error(f"❌ Failed to start Kafka consumer: {e}")

        yield

        logger.info("🛑 Application shutting down...")

        try:
            if settings.KAFKA_CONSUMER_ENABLED:
                await kafka_consumer.stop()
                logger.info("✅ Kafka consumer stopped")
        except Exception as e:
            logger.error(f"❌ Error stopping Kafka consumer: {e}")

        try:
            kafka_producer.close()
            logger.info("✅ Kafka producer closed")
        except Exception as e:
            logger.error(f"❌ Error closing Kafka producer: {e}")

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=app_lifespan,
)




# Keycloak authentication middleware
# All routes are protected by default.  Pass exclude_patterns to skip paths:
# exclude_patterns=[r"^/health$", r"^/docs", r"^/openapi\\.json"]
setup_keycloak_middleware(
    app,
    keycloak_configuration=keycloak_config,
    user_mapper=map_user,
    exclude_patterns=[
        r"^/health$",
        r"^/docs",
        r"^/redoc",
        r"^/openapi.json$",
        r"^/v1/retrieval/sse/.*",
    ],
)

# CORS middleware
# IMPORTANT: CORS should be registered BEFORE auth middleware so browser
# preflight (OPTIONS) can be answered without being blocked by auth.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.HOST_FRONTEND],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],


)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    consumer_status = "running" if (hasattr(kafka_consumer, '_running') and kafka_consumer._running) else "stopped"
    producer_status = "connected" if (
                hasattr(kafka_producer, '_producer') and kafka_producer._producer) else "disconnected"

    return {
        "status": "ok",
        "kafka_producer": producer_status,
        "kafka_consumer": consumer_status
    }


@app.get("/debug/consumer")
async def debug_consumer():
    """Debug endpoint to check consumer status."""
    status = {
        "consumer_exists": hasattr(kafka_consumer, '_consumer'),
        "consumer_connected": kafka_consumer._consumer is not None if hasattr(kafka_consumer, '_consumer') else False,
        "is_running": kafka_consumer._running if hasattr(kafka_consumer, '_running') else False,
        "task_exists": kafka_consumer._task is not None if hasattr(kafka_consumer, '_task') else False,
        "task_done": kafka_consumer._task.done() if (
                    hasattr(kafka_consumer, '_task') and kafka_consumer._task) else None,
        "settings": {
            "enabled": settings.KAFKA_CONSUMER_ENABLED if hasattr(settings, 'KAFKA_CONSUMER_ENABLED') else "not set",
            "bootstrap_servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "topic": settings.KAFKA_TOPIC_PROMPT,
        }
    }

    # Add assignment info if consumer exists
    if hasattr(kafka_consumer, '_consumer') and kafka_consumer._consumer:
        try:
            assignment = kafka_consumer._consumer.assignment()
            status["assignment"] = str(assignment)
            status["subscription"] = kafka_consumer._consumer.subscription()
        except Exception as e:
            status["assignment_error"] = str(e)

    return status


# API routers
app.include_router(vehicles_router, prefix=settings.API_V1_PREFIX)
app.include_router(drivers_router, prefix=settings.API_V1_PREFIX)
