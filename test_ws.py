import asyncio
import websockets

async def test():
    async with websockets.connect('ws://localhost:8000/ws/orders/all') as ws:
        print('Connected!')
        await ws.send('ping')
        print(await ws.recv())

asyncio.run(test())
