"""
user_synchronization.py
=======================
Chương trình chạy độc lập, cứ 5 phút một lần:
  1. Lấy admin-token từ Keycloak (client_credentials).
  2. Truy vấn danh sách user được tạo trong 5 phút vừa qua.
  3. Upsert từng user vào Couchbase với key  "user::<sub>".

Chạy trực tiếp:
    python user_synchronization

Hoặc chỉ chạy 1 lần rồi thoát (dùng trong cron / Task Scheduler):
    python user_synchronization.py --once
"""

import argparse
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from dotenv import load_dotenv

from src.config.config import settings

load_dotenv()


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("user_sync")

# ---------------------------------------------------------------------------
# Couchbase (synchronous SDK – không cần event-loop)
# ---------------------------------------------------------------------------
from datetime import timedelta as td
from couchbase.cluster import Cluster
from couchbase.auth import PasswordAuthenticator
from couchbase.options import ClusterOptions, UpsertOptions
from couchbase.exceptions import CouchbaseException

SYNC_INTERVAL_SECONDS = 5 * 60   # 5 phút
LOOKBACK_SECONDS      = 5 * 60   # lấy user tạo trong 5 phút trước
USER_COLLECTION= "user"


# ──────────────────────────────────────────────────────────────────────────────
# Keycloak Admin Client
# ──────────────────────────────────────────────────────────────────────────────
class KeycloakAdminClient:
    """
    Thin wrapper around Keycloak Admin REST API.

    Token strategy (auto-detected from settings):
    • If KEYCLOAK_ADMIN_CLIENT_SECRET is set   → client_credentials grant.
    • Otherwise                                → password grant using
      KEYCLOAK_ADMIN_USERNAME / KEYCLOAK_ADMIN_PASSWORD (admin-cli style).
    """

    def __init__(self):
        self.base_url      = settings.KEYCLOAK_URL.rstrip("/")
        self.realm         = settings.KEYCLOAK_REALM
        self.client_id     = settings.KEYCLOAK_ADMIN_CLIENT_ID
        self.client_secret = settings.KEYCLOAK_ADMIN_CLIENT_SECRET
        self.admin_user    = settings.KEYCLOAK_ADMIN_USERNAME
        self.admin_pass    = settings.KEYCLOAK_ADMIN_PASSWORD
        self._token: Optional[str] = None
        self._token_expiry: float  = 0.0

    # ── token management ──────────────────────────────────────────────────────
    async def _get_admin_token(self, client: httpx.AsyncClient) -> str:
        """Obtain (or reuse) a valid admin access-token."""
        if self._token and time.time() < self._token_expiry - 30:
            return self._token

        url = f"{self.base_url}/auth/realms/{self.realm}/protocol/openid-connect/token"

        if self.client_secret:
            # ── client_credentials grant ──────────────────────────────────
            data = {
                "grant_type":    "client_credentials",
                "client_id":     self.client_id,
                "client_secret": self.client_secret,
            }
        else:
            # ── password grant (admin-cli) ────────────────────────────────
            data = {
                "grant_type": "password",
                "client_id":  self.client_id,
                "username":   self.admin_user,
                "password":   self.admin_pass,
            }

        resp = await client.post(url, data=data)
        resp.raise_for_status()
        payload = resp.json()

        self._token        = payload["access_token"]
        self._token_expiry = time.time() + payload.get("expires_in", 300)
        logger.debug("Obtained Keycloak admin token (expires in %ss)", payload.get("expires_in"))
        return self._token

    # ── user listing ──────────────────────────────────────────────────────────
    async def get_users_created_after(
        self,
        client: httpx.AsyncClient,
        after_ms: int,
        max_results: int = 500,
    ) -> list[dict]:
        """
        Return users whose *createdTimestamp* >= after_ms (epoch milliseconds).
        Keycloak does not expose a native "created after" filter, so we fetch
        all users ordered by *createdTimestamp* descending and stop as soon as
        we reach users that are older than our window.
        """
        token = await self._get_admin_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        url = (
            f"{self.base_url}/auth/admin/realms/{self.realm}/users"
        )

        # Fetch in pages of 100 until we have found all recent users or
        # we have iterated over max_results users.
        recent_users: list[dict] = []
        first = 0
        page_size = 100

        while first < max_results:
            params = {
                "first": first,
                "max":   page_size,
                "order": "createdTimestamp",
            }
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            page: list[dict] = resp.json()

            if not page:
                break  # no more users

            for user in page:
                created_ts = user.get("createdTimestamp", 0)
                if created_ts >= after_ms:
                    recent_users.append(user)

            # If the oldest user on this page was created BEFORE our window
            # then we don't need to fetch more pages.
            oldest_on_page = min(u.get("createdTimestamp", 0) for u in page)
            if oldest_on_page < after_ms:
                break

            if len(page) < page_size:
                break  # last page

            first += page_size

        return recent_users


# ──────────────────────────────────────────────────────────────────────────────
# Couchbase sync writer
# ──────────────────────────────────────────────────────────────────────────────
class CouchbaseSyncWriter:
    """Synchronous Couchbase client for the standalone script."""

    def __init__(self):
        self._cluster    = None
        self._collection = None

    def connect(self):
        auth    = PasswordAuthenticator(settings.COUCHBASE_USER, settings.COUCHBASE_PASSWORD)
        options = ClusterOptions(auth)

        if "cloud.couchbase.com" in settings.COUCHBASE_CONNECT_ENDPOINT:
            options.apply_profile("wan_development")

        self._cluster = Cluster.connect(settings.COUCHBASE_CONNECT_ENDPOINT, options)
        self._cluster.wait_until_ready(td(seconds=settings.COUCHBASE_CONNECTION_TIMEOUT))

        bucket = self._cluster.bucket(settings.COUCHBASE_BUCKET)

        try:
            if settings.COUCHBASE_SCOPE :
                scope = bucket.scope(settings.COUCHBASE_SCOPE)
                self._collection = scope.collection(USER_COLLECTION)
                logger.info(
                    "Couchbase connected → %s.%s",
                    settings.COUCHBASE_SCOPE,
                    USER_COLLECTION,
                )
            else:
                self._collection = bucket.default_collection()
                logger.info("Couchbase connected → default collection")
        except Exception as exc:
            logger.warning("Falling back to default collection: %s", exc)
            self._collection = bucket.default_collection()

    def upsert_user(self, user_doc: dict) -> bool:
        """Upsert a user document.  Returns True on success."""
        doc_id = f"user::{user_doc['sub']}"
        try:
            self._collection.upsert(doc_id, user_doc)
            logger.info("Upserted %s (%s)", doc_id, user_doc.get("email", "—"))
            return True
        except CouchbaseException as exc:
            logger.error("Failed to upsert %s: %s", doc_id, exc)
            return False

    def disconnect(self):
        if self._cluster:
            self._cluster.close()
            logger.info("Couchbase connection closed.")


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
def keycloak_user_to_doc(kc_user: dict) -> dict:
    """Convert a raw Keycloak user object to the Couchbase document format."""
    created_ts_ms = kc_user.get("createdTimestamp", 0)
    created_at    = datetime.fromtimestamp(created_ts_ms / 1000, tz=timezone.utc).isoformat()

    attributes = kc_user.get("attributes", {}) or {}

    return {
        "sub":        kc_user.get("id", ""),
        "username":   kc_user.get("username", ""),
        "email":      kc_user.get("email", ""),
        "firstName":  kc_user.get("firstName", ""),
        "lastName":   kc_user.get("lastName", ""),
        "phone":      (attributes.get("phone") or [None])[0],
        "enabled":    kc_user.get("enabled", True),
        "emailVerified": kc_user.get("emailVerified", False),
        "createdTimestamp": created_ts_ms,
        "createdAt":  created_at,
        "attributes": attributes,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Core sync job
# ──────────────────────────────────────────────────────────────────────────────
async def sync_new_users(keycloak: KeycloakAdminClient, couchbase: CouchbaseSyncWriter):
    """Fetch users created in the last LOOKBACK_SECONDS and upsert to Couchbase."""
    now_ms   = int(time.time() * 1000)
    after_ms = now_ms - LOOKBACK_SECONDS * 1000

    after_dt = datetime.fromtimestamp(after_ms / 1000, tz=timezone.utc)
    logger.info("🔍 Fetching users created after %s …", after_dt.strftime("%Y-%m-%d %H:%M:%S UTC"))

    async with httpx.AsyncClient(verify=False, timeout=30) as http:
        try:
            users = await keycloak.get_users_created_after(http, after_ms)
        except httpx.HTTPStatusError as exc:
            logger.error("Keycloak API error %s: %s", exc.response.status_code, exc.response.text)
            return
        except Exception as exc:
            logger.error("Unexpected error querying Keycloak: %s", exc)
            return

    if not users:
        logger.info("✅ No new users found in the last %d minutes.", LOOKBACK_SECONDS // 60)
        return

    logger.info("📥 Found %d new user(s).  Syncing to Couchbase …", len(users))
    success = 0
    for kc_user in users:
        doc = keycloak_user_to_doc(kc_user)
        if couchbase.upsert_user(doc):
            success += 1

    logger.info("✅ Sync complete: %d/%d user(s) written to Couchbase.", success, len(users))


# ──────────────────────────────────────────────────────────────────────────────
# Entry-point
# ──────────────────────────────────────────────────────────────────────────────
async def run_loop(run_once: bool = False):
    keycloak  = KeycloakAdminClient()
    couchbase = CouchbaseSyncWriter()

    logger.info("🚀 User-sync service starting …")
    # logger.info(
    #     "   Keycloak : %s  (realm=%s, client=%s)",
    #     settings.KEYCLOAK_URL, settings.KEYCLOAK_REALM, settings.KEYCLOAK_CLIENT_ID,
    # )
    # logger.info(
    #     "   Couchbase: %s  (bucket=%s)",
    #     settings.COUCHBASE_CONNECT_ENDPOINT, settings.COUCHBASE_BUCKET,
    # )
    if not run_once:
        logger.info("   Interval : every %d seconds (%d minutes)", SYNC_INTERVAL_SECONDS, SYNC_INTERVAL_SECONDS // 60)

    try:
        couchbase.connect()
    except Exception as exc:
        logger.critical("Cannot connect to Couchbase: %s", exc)
        return

    try:
        if run_once:
            await sync_new_users(keycloak, couchbase)
        else:
            while True:
                start = time.monotonic()
                await sync_new_users(keycloak, couchbase)
                elapsed = time.monotonic() - start
                sleep_for = max(0, SYNC_INTERVAL_SECONDS - elapsed)
                logger.info("⏳ Next sync in %.0f seconds …", sleep_for)
                await asyncio.sleep(sleep_for)
    except asyncio.CancelledError:
        logger.info("Sync loop cancelled.")
    except KeyboardInterrupt:
        logger.info("Interrupted by user.")
    finally:
        couchbase.disconnect()
        logger.info("👋 User-sync service stopped.")


def main():
    global SYNC_INTERVAL_SECONDS, LOOKBACK_SECONDS
    parser = argparse.ArgumentParser(description="Sync new Keycloak users into Couchbase.")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single sync cycle and exit (useful for cron / Task Scheduler).",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=SYNC_INTERVAL_SECONDS,
        metavar="SECONDS",
        help=f"Override the sync interval in seconds (default: {SYNC_INTERVAL_SECONDS}).",
    )
    parser.add_argument(
        "--lookback",
        type=int,
        default=LOOKBACK_SECONDS,
        metavar="SECONDS",
        help=f"How far back to look for new users in seconds (default: {LOOKBACK_SECONDS}).",
    )
    args = parser.parse_args()


    SYNC_INTERVAL_SECONDS = args.interval
    LOOKBACK_SECONDS      = args.lookback

    asyncio.run(run_loop(run_once=args.once))


if __name__ == "__main__":
    main()


