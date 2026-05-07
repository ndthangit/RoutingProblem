from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from src.config.couchbase import CouchbaseClient
from src.models.driver import Driver, DriverEvent, DriverEventType
from src.models.vehicle import VehicleEvent, VehicleEventType
from src.services.driver_service import DriverService
from src.services.vehicle_service import VehicleService


class DriverVehicleService:
	"""Handle driver domain events that require cross-aggregate updates.

	Currently supported:
	  - DRIVER.VEHICLE.ASSIGNED

	This service keeps Driver.assigned_vehicle_id/license_plate and
	Vehicle.driver_id/employee_code in sync.
	"""

	def __init__(self, cb: CouchbaseClient):
		self._cb = cb
		self._drivers = DriverService(cb)
		self._vehicles = VehicleService(cb)

	async def handle_driver_vehicle_assigned(self, event: DriverEvent) -> Optional[Driver]:
		"""Process event DRIVER.VEHICLE.ASSIGNED.

		Expected snapshot in event.driver:
		  - driver.id (path param should be trusted by API)
		  - driver.assigned_vehicle_id (assignedVehicleId)

		Side effects:
		  1) Unassign previous vehicle of this driver (if any)
		  2) If target vehicle is assigned to another driver, unassign that driver
		  3) Assign target vehicle -> driverId + employeeCode
		  4) Update driver -> assignedVehicleId + licensePlate
		"""

		if event.event_type != DriverEventType.DRIVER_VEHICLE_ASSIGNED:
			raise ValueError(
				f"Invalid eventType: expected {DriverEventType.DRIVER_VEHICLE_ASSIGNED}, got {event.event_type}"
			)

		driver_id = event.driver.id
		target_vehicle_id = event.driver.assigned_vehicle_id
		if not target_vehicle_id:
			raise ValueError("assignedVehicleId is required for DRIVER.VEHICLE.ASSIGNED")

		existing_driver = await self._drivers.get_driver(driver_id)
		if existing_driver is None:
			return None

		# Load target vehicle
		target_vehicle = await self._vehicles.get_vehicle(target_vehicle_id)
		if target_vehicle is None:
			raise ValueError(f"Invalid assignedVehicleId: vehicle '{target_vehicle_id}' not found")

		now = datetime.now(timezone.utc)
		owner_email = event.owner_email

		# 1) If driver had previous vehicle, unassign it (best-effort)
		prev_vehicle_id = existing_driver.assigned_vehicle_id
		if prev_vehicle_id and prev_vehicle_id != target_vehicle_id:
			prev_vehicle = await self._vehicles.get_vehicle(prev_vehicle_id)
			if prev_vehicle and prev_vehicle.driver_id == driver_id:
				await self._vehicles.update_vehicle(
					VehicleEvent(
						event_id=str(uuid.uuid4()),
						timestamp=now,
						ownerEmail=owner_email,
						eventType=VehicleEventType.VEHICLE_UPDATED,
						vehicle=prev_vehicle.model_copy(update={"driver_id": None, "employee_code": None}),
					)
				)

		# 2) If vehicle already assigned to another driver, unassign that driver (best-effort)
		if target_vehicle.driver_id and target_vehicle.driver_id != driver_id:
			other_driver = await self._drivers.get_driver(target_vehicle.driver_id)
			if other_driver and other_driver.assigned_vehicle_id == target_vehicle_id:
				await self._drivers.update_driver(
					DriverEvent(
						event_id=str(uuid.uuid4()),
						timestamp=now,
						ownerEmail=owner_email,
						eventType=DriverEventType.DRIVER_UPDATED,
						driver=other_driver.model_copy(update={"assigned_vehicle_id": None, "license_plate": None}),
					)
				)

		# 3) Assign vehicle
		updated_vehicle = target_vehicle.model_copy(
			update={
				"driver_id": driver_id,
				"employee_code": existing_driver.employee_code,
			}
		)
		await self._vehicles.update_vehicle(
			VehicleEvent(
				event_id=str(uuid.uuid4()),
				timestamp=now,
				ownerEmail=owner_email,
				eventType=VehicleEventType.VEHICLE_UPDATED,
				vehicle=updated_vehicle,
			)
		)

		# 4) Update driver assignment + licensePlate from vehicle
		updated_driver = existing_driver.model_copy(
			update={
				"assigned_vehicle_id": target_vehicle_id,
				"license_plate": target_vehicle.license_plate,
			}
		)

		return await self._drivers.update_driver(
			DriverEvent(
				event_id=event.event_id,
				timestamp=event.timestamp,
				ownerEmail=owner_email,
				eventType=DriverEventType.DRIVER_UPDATED,
				driver=updated_driver,
			)
		)

	async def handle_driver_vehicle_unassigned(self, event: DriverEvent) -> Optional[Driver]:
		"""Process event DRIVER.VEHICLE.UNASSIGNED.

		Clears Driver.assignedVehicleId + licensePlate AND revokes the current vehicle's
		driverId/employeeCode (if the vehicle is currently assigned to this driver).

		Expected snapshot in event.driver:
		  - driver.id
		  - driver.assigned_vehicle_id MAY be present; if not, we use current stored driver state.
		"""

		if event.event_type != DriverEventType.DRIVER_VEHICLE_UNASSIGNED:
			raise ValueError(
				f"Invalid eventType: expected {DriverEventType.DRIVER_VEHICLE_UNASSIGNED}, got {event.event_type}"
			)

		driver_id = event.driver.id
		existing_driver = await self._drivers.get_driver(driver_id)
		if existing_driver is None:
			return None

		vehicle_id = event.driver.assigned_vehicle_id or existing_driver.assigned_vehicle_id
		owner_email = event.owner_email
		now = datetime.now(timezone.utc)

		# Best-effort revoke on vehicle side
		if vehicle_id:
			vehicle = await self._vehicles.get_vehicle(vehicle_id)
			if vehicle and vehicle.driver_id == driver_id:
				await self._vehicles.update_vehicle(
					VehicleEvent(
						event_id=str(uuid.uuid4()),
						timestamp=now,
						ownerEmail=owner_email,
						eventType=VehicleEventType.VEHICLE_UPDATED,
						vehicle=vehicle.model_copy(update={"driver_id": None, "employee_code": None}),
					)
				)

		# Clear driver assignment
		updated_driver = existing_driver.model_copy(update={"assigned_vehicle_id": None, "license_plate": None})
		return await self._drivers.update_driver(
			DriverEvent(
				event_id=event.event_id,
				timestamp=event.timestamp,
				ownerEmail=owner_email,
				eventType=DriverEventType.DRIVER_UPDATED,
				driver=updated_driver,
			)
		)


