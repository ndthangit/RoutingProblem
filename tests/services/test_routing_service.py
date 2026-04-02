import pytest
import pytest_asyncio
from src.services.routing_service import RoutingService, OsrmError
from src.models.routing import Coordinate

def test_routing_service_creation():
    service = RoutingService()
    assert service is not None

@pytest.mark.asyncio
async def test_geocode_address():
    service = RoutingService()
    address = "huyện Hậu Lộc, Thanh Hóa, Việt Nam"
    try:
        location = await service.geocode_address(address)
        print(location)
        assert isinstance(location, Coordinate)
        # Check if the coordinates are within a reasonable range for Thanh Hoa, Vietnam
        assert 15.0 < location.lat < 25.5
        assert 105.0 < location.lon < 106.0
    except OsrmError as e:
        pytest.fail(f"Geocoding failed with error: {e}")

@pytest.mark.asyncio
async def test_geocode_address_invalid():
    service = RoutingService()
    address = "an invalid address that does not exist"
    with pytest.raises(OsrmError):
        await service.geocode_address(address)
