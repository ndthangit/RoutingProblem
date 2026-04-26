import asyncio
import json
import os
from typing import Any

import websockets


async def main() -> None:
    ws_url = os.environ.get("WS_URL", "ws://localhost:8000/ws/vehicles/locations")

    vehicle_ids = os.environ.get("VEHICLE_IDS", "demo-1,demo-2").split(",")
    vehicle_ids = [v.strip() for v in vehicle_ids if v.strip()]

    async with websockets.connect(ws_url) as ws:
        await ws.send(json.dumps({"action": "subscribe", "vehicleIds": vehicle_ids}))
        print(f"Subscribed to {vehicle_ids} on {ws_url}")

        while True:
            raw = await ws.recv()
            try:
                data: Any = json.loads(raw)
            except Exception:
                print(raw)
                continue
            print(json.dumps(data, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())

