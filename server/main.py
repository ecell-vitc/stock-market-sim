import data.db as db
from user import models as user_models
from stock import models as stock_models
db.sql.SQLModel.metadata.create_all(db.engine)


from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from user.views import router as user_routes
from stock.views import router as stock_routes


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(user_routes, prefix='/user')
app.include_router(stock_routes, prefix='/stocks')

from data.socket_pool import SocketPool
import asyncio
from typing import Dict
NEWS_POOL = SocketPool()

@app.websocket('/news/')
async def connect_websocket(websocket: WebSocket):
    try:
        await websocket.accept()
        NEWS_POOL.add(websocket)
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        NEWS_POOL.remove(websocket)

from middleware import check_admin

@app.post('/news/')
def broadcast_news(
    data: Dict[str, str],
    _: None = Depends(check_admin),
):
    asyncio.run(NEWS_POOL.broadcast(data))
    return {"detail": "News broadcasted"}