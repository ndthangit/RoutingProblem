import types
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from src.models.routing import RouteType
from src.services.automation_routing_service import AutomationRoutingService


@pytest.mark.asyncio
async def test_tick_generates_weekly_route_and_marks_template_last_generated():
    # Minimal fake Couchbase client with attrs used by the service
    cb = types.SimpleNamespace()
    cb.bucket = types.SimpleNamespace(name="bucket")
    cb.scope = types.SimpleNamespace(name="scope")

    template_id = "tpl-1"
    template = {
        "id": template_id,
        "vehicleId": "veh-1",
        "origin": "A",
        "destination": "B",
        "routeType": RouteType.ONCE_PER_WEEK.value,
        # no lastGeneratedAt => should generate immediately
    }

    cb.query = AsyncMock(return_value=[template])
    cb.get_document = AsyncMock(return_value=template.copy())
    cb.upsert_document = AsyncMock()

    svc = AutomationRoutingService(cb, interval_seconds=1)
    svc._route_service.create_route = AsyncMock()

    await svc._tick()

    assert svc._route_service.create_route.await_count == 1
    assert cb.upsert_document.await_count == 1

    # upserted template should contain lastGeneratedAt
    args, _kwargs = cb.upsert_document.await_args
    _doc_id, upserted, _collection = args
    assert _doc_id == f"route::{template_id}"
    assert "lastGeneratedAt" in upserted


@pytest.mark.asyncio
async def test_tick_skips_when_last_generated_within_week():
    cb = types.SimpleNamespace()
    cb.bucket = types.SimpleNamespace(name="bucket")
    cb.scope = types.SimpleNamespace(name="scope")

    recent = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    template = {
        "id": "tpl-2",
        "vehicleId": "veh-1",
        "origin": "A",
        "destination": "B",
        "routeType": RouteType.ONCE_PER_WEEK.value,
        "lastGeneratedAt": recent,
    }

    cb.query = AsyncMock(return_value=[template])
    cb.get_document = AsyncMock(return_value=template.copy())
    cb.upsert_document = AsyncMock()

    svc = AutomationRoutingService(cb, interval_seconds=1)
    svc._route_service.create_route = AsyncMock()

    await svc._tick()

    assert svc._route_service.create_route.await_count == 0
    assert cb.upsert_document.await_count == 0

