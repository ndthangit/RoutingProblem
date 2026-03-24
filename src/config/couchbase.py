import asyncio
import logging
from datetime import timedelta
from contextlib import asynccontextmanager
from typing import Optional, AsyncGenerator

from couchbase.cluster import Cluster
from couchbase.auth import PasswordAuthenticator
from couchbase.options import ClusterOptions, ClusterTimeoutOptions
from couchbase.exceptions import CouchbaseException, DocumentNotFoundException
from couchbase.bucket import Bucket
from fastapi import FastAPI

from src.config.config import settings

logger = logging.getLogger(__name__)


class CouchbaseClient:
    def __init__(self):
        self._cluster: Optional[Cluster] = None
        self._bucket: Optional[Bucket] = None
        self._scope = None

    async def connect(self):
        """Initialize Couchbase connection"""
        try:

            # Tạo authenticator
            auth = PasswordAuthenticator(
                settings.COUCHBASE_USER,
                settings.COUCHBASE_PASSWORD
            )
            timeout_options = ClusterTimeoutOptions(
                kv_timeout=timedelta(seconds=10),  # Tăng lên 10s
                kv_durable_timeout=timedelta(seconds=10),  # 10s
                query_timeout=timedelta(seconds=75),  # 75s
                analytics_timeout=timedelta(seconds=75),  # 75s
                search_timeout=timedelta(seconds=75),  # 75s
                management_timeout=timedelta(seconds=75),  # 75s
                connect_timeout=timedelta(seconds=10),  # 10s
                resolve_timeout=timedelta(seconds=10),  # 10s
            )



            # Cluster options
            options = ClusterOptions(
                auth,
                timeout_options = timeout_options
            )

            # Áp dụng WAN profile nếu là cloud connection
            if "cloud.couchbase.com" in settings.COUCHBASE_CONNECT_ENDPOINT:
                options.apply_profile('wan_development')

            # Kết nối
            self._cluster = Cluster.connect(settings.COUCHBASE_CONNECT_ENDPOINT, options)

            # Wait for cluster ready
            self._cluster.wait_until_ready(timedelta(seconds=settings.COUCHBASE_CONNECTION_TIMEOUT))

            # Get bucket
            self._bucket = self._cluster.bucket(settings.COUCHBASE_BUCKET)

            # Get scope (nếu có chỉ định)
            if settings.COUCHBASE_SCOPE:
                self._scope = self._bucket.scope(settings.COUCHBASE_SCOPE)
                logger.info(f"Connected to scope: {settings.COUCHBASE_SCOPE}")
            else:
                self._scope = self._bucket.default_scope()
                logger.info("Connected to default scope")

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
    def scope(self):
        if not self._scope:
            raise RuntimeError("Couchbase scope not initialized")
        return self._scope

    # Helper methods - yêu cầu truyền collection name
    async def get_document(self, doc_id: str, collection_name: str = None):
        """Get document by ID from specified collection"""
        try:
            if collection_name:
                collection = self.scope.collection(collection_name)
            else:
                collection = self.scope.collection("_default")  # hoặc collection mặc định

            result = collection.get(doc_id)
            return result.content_as[dict]
        except DocumentNotFoundException:
            return None
        except CouchbaseException as e:
            logger.error(f"Error getting document {doc_id} from collection {collection_name}: {e}")
            raise

    async def upsert_document(self, doc_id: str, doc: dict, collection_name: str = None):
        """Upsert document to specified collection"""
        try:
            if collection_name:
                collection = self.scope.collection(collection_name)
            else:
                collection = self.scope.collection("_default")

            result = collection.upsert(doc_id, doc)
            return result.cas
        except CouchbaseException as e:
            logger.error(f"Error upserting document {doc_id} to collection {collection_name}: {e}")
            raise

    async def remove_document(self, doc_id: str, collection_name: str = None):
        """Remove document from specified collection"""
        try:
            if collection_name:
                collection = self.scope.collection(collection_name)
            else:
                collection = self.scope.collection("_default")

            collection.remove(doc_id)
            return True
        except DocumentNotFoundException:
            return False
        except CouchbaseException as e:
            logger.error(f"Error removing document {doc_id} from collection {collection_name}: {e}")
            raise

    # async def query(self, statement: str, *args, **kwargs):
    #     """Execute N1QL query within scope"""
    #     try:
    #         return self.scope.query(statement, *args, **kwargs)
    #     except CouchbaseException as e:
    #         logger.error(f"Error executing query: {e}")
    #         raise

    async def query(self, statement: str, *args, **kwargs):
        """Execute N1QL query within scope using thread pool"""
        try:
            # Chạy synchronous query trong thread pool
            result = await asyncio.to_thread(self.scope.query, statement, *args, **kwargs)
            return result
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