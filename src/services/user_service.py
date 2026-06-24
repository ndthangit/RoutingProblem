from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from src.config.couchbase import CouchbaseClient
from src.models.user import User, UserProfileUpdate

USER_COLLECTION = "user"


def _doc_id(user_sub: str) -> str:
    return f"user::{user_sub}"


class UserService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def get_user(self, user_sub: str) -> Optional[User]:
        doc = await self._cb.get_document(_doc_id(user_sub), USER_COLLECTION)
        if not doc:
            return None
        return User.model_validate(doc)

    async def upsert_profile(self, current_user: User, profile: UserProfileUpdate) -> User:
        existing = await self.get_user(current_user.sub)

        first_name = profile.firstName.strip()
        last_name = profile.lastName.strip()
        phone = profile.phone.strip() if profile.phone else None

        base = existing or current_user
        attributes = dict(base.attributes or {})
        if phone:
            attributes["phone"] = [phone]
        else:
            attributes.pop("phone", None)

        user = User(
            sub=current_user.sub,
            username=current_user.username or base.username,
            email=current_user.email or base.email,
            firstName=first_name,
            lastName=last_name,
            phone=phone,
            enabled=current_user.enabled,
            emailVerified=current_user.emailVerified,
            createdTimestamp=current_user.createdTimestamp or base.createdTimestamp,
            createdAt=base.createdAt or datetime.now(timezone.utc),
            attributes=attributes,
        )

        await self._cb.upsert_document(_doc_id(user.sub), user.to_dict(), USER_COLLECTION)
        return user
