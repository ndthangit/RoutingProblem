import logging
from datetime import timedelta
from contextlib import asynccontextmanager
from typing import Optional, AsyncGenerator

from couchbase.cluster import Cluster
from couchbase.auth import PasswordAuthenticator
from couchbase.options import ClusterOptions
from couchbase.exceptions import CouchbaseException, DocumentNotFoundException
from couchbase.bucket import Bucket
from couchbase.collection import Collection
from fastapi import FastAPI

from src.config.config import settings

logger = logging.getLogger(__name__)


class CouchbaseClient:
    def __init__(self):
        self._cluster: Optional[Cluster] = None
        self._bucket: Optional[Bucket] = None
        self._collection: Optional[Collection] = None
        self._scope = None

    async def connect(self):
        """Initialize Couchbase connection"""
        try:

            # Tạo authenticator
            auth = PasswordAuthenticator(
                settings.COUCHBASE_USER,
                settings.COUCHBASE_PASSWORD
            )

            # Cluster options
            options = ClusterOptions(auth)

            # Áp dụng WAN profile nếu là cloud connection
            if "cloud.couchbase.com" in settings.COUCHBASE_CONNECT_ENDPOINT:
                options.apply_profile('wan_development')

            # Kết nối
            self._cluster = Cluster.connect(settings.COUCHBASE_CONNECT_ENDPOINT, options)

            # Wait for cluster ready
            self._cluster.wait_until_ready(timedelta(seconds=settings.COUCHBASE_CONNECTION_TIMEOUT))

            # Get bucket
            self._bucket = self._cluster.bucket(settings.COUCHBASE_BUCKET)

            # Get collection (với fallback)
            try:
                if settings.COUCHBASE_SCOPE and settings.COUCHBASE_COLLECTION:
                    self._scope = self._bucket.scope(settings.COUCHBASE_SCOPE)
                    self._collection = self._scope.collection(settings.COUCHBASE_COLLECTION)
                    logger.info(f"Connected to {settings.COUCHBASE_SCOPE}.{settings.COUCHBASE_COLLECTION}")
                else:
                    self._collection = self._bucket.default_collection()
                    logger.info("Connected to default collection")
            except Exception as e:
                logger.warning(f"Could not connect to specific scope/collection: {e}")
                self._collection = self._bucket.default_collection()
                logger.info("Falling back to default collection")

            logger.info("Successfully connected to Couchbase")

        except CouchbaseException as e:
            logger.error(f"Failed to connect to Couchbase: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error connecting to Couchbase: {e}")
            raise

    async def disconnect(self):
        """Close Couchbase connection"""
        if self._cluster:
            self._cluster.close()
            logger.info("Disconnected from Couchbase")

    @property
    def cluster(self) -> Cluster:
        if not self._cluster:
            raise RuntimeError("Couchbase cluster not initialized")
        return self._cluster

    @property
    def bucket(self) -> Bucket:
        if not self._bucket:
            raise RuntimeError("Couchbase bucket not initialized")
        return self._bucket

    @property
    def collection(self) -> Collection:
        if not self._collection:
            raise RuntimeError("Couchbase collection not initialized")
        return self._collection

    @property
    def scope(self):
        return self._scope

    # Helper methods
    async def get_document(self, doc_id: str):
        """Get document by ID"""
        try:
            result = self.collection.get(doc_id)
            return result.content_as[dict]
        except DocumentNotFoundException:
            return None
        except CouchbaseException as e:
            logger.error(f"Error getting document {doc_id}: {e}")
            raise

    async def upsert_document(self, doc_id: str, doc: dict):
        """Upsert document"""
        try:
            result = self.collection.upsert(doc_id, doc)
            return result.cas
        except CouchbaseException as e:
            logger.error(f"Error upserting document {doc_id}: {e}")
            raise

    async def remove_document(self, doc_id: str):
        """Remove document"""
        try:
            self.collection.remove(doc_id)
            return True
        except DocumentNotFoundException:
            return False
        except CouchbaseException as e:
            logger.error(f"Error removing document {doc_id}: {e}")
            raise

    async def query(self, statement: str, *args, **kwargs):
        """Execute N1QL query"""
        try:
            if self._scope:
                return self._scope.query(statement, *args, **kwargs)
            else:
                return self.cluster.query(statement, *args, **kwargs)
        except CouchbaseException as e:
            logger.error(f"Error executing query: {e}")
            raise


# Singleton instance
couchbase_client = CouchbaseClient()


@asynccontextmanager
async def get_couchbase_lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Lifespan context manager for FastAPI
    Nhận app parameter từ FastAPI
    """
    # Startup
    logger.info("Starting up - connecting to Couchbase...")
    await couchbase_client.connect()

    # Lưu client vào app state để có thể truy cập từ các phần khác
    app.state.couchbase = couchbase_client

    yield

    # Shutdown
    logger.info("Shutting down - disconnecting from Couchbase...")
    await couchbase_client.disconnect()