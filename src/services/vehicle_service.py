from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.vehicle import Vehicle, VehicleCreate, VehicleUpdate

VEHICLE_COLLECTION = "vehicle"

def _doc_id(vehicle_id: str) -> str:
    return f"vehicle::{vehicle_id}"


class VehicleService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def create_vehicle(self, data: VehicleCreate) -> Vehicle:
        now = datetime.now(timezone.utc)
        vehicle_id = data.id or str(uuid.uuid4())

        vehicle = Vehicle(
            id=vehicle_id,
            **data.model_dump(exclude={"id"}),
            createdAt=now,
            updatedAt=now,
        )

        await self._cb.upsert_document(_doc_id(vehicle_id), vehicle.to_dict(), VEHICLE_COLLECTION)
        return vehicle

    async def get_vehicle(self, vehicle_id: str) -> Optional[Vehicle]:
        doc = await self._cb.get_document(_doc_id(vehicle_id), VEHICLE_COLLECTION)
        if not doc:
            return None
        return Vehicle.model_validate(doc)

    # async def list_vehicles(self, *, limit: int = 100, offset: int = 0) -> list[Vehicle]:
    #     scope_name = self._cb.scope.name if self._cb.scope else "default"
    #     statement = (
    #         f"SELECT v.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{VEHICLE_COLLECTION} v "
    #         "ORDER BY v.updatedAt DESC "
    #         "LIMIT $limit OFFSET $offset"
    #     )
    #
    #     try:
    #         result = await self._cb.query(statement, limit=limit, offset=offset)
    #         rows = await result.rows()
    #         return [Vehicle.model_validate(row) for row in rows]
    #     except CouchbaseException as e:
    #         print(f"Couchbase query failed: {e}")
    #         # If query isn't available in some envs, gracefully return empty.
    #         return []
    async def list_vehicles(self, *, limit: int = 100, offset: int = 0) -> list[Vehicle]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT v.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{VEHICLE_COLLECTION} v "
            "ORDER BY v.updatedAt DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            # Lấy tất cả rows từ result
            rows = list(result)
            return [Vehicle.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []


    async def update_vehicle(self, vehicle_id: str, patch: VehicleUpdate) -> Optional[Vehicle]:
        existing = await self.get_vehicle(vehicle_id)
        if existing is None:
            return None

        patch_dict = patch.model_dump(exclude_unset=True)
        updated = existing.model_copy(update=patch_dict)
        updated.updated_at = datetime.now(timezone.utc)

        await self._cb.upsert_document(_doc_id(vehicle_id), updated.to_dict(), VEHICLE_COLLECTION)
        return updated

    async def delete_vehicle(self, vehicle_id: str) -> bool:
        try:
            await self._cb.remove_document(_doc_id(vehicle_id), VEHICLE_COLLECTION)
            return True
        except CouchbaseException:
            return False
