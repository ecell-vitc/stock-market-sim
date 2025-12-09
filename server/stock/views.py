import sqlmodel as sql
from os import environ
from fastapi import APIRouter, HTTPException, status, Depends, WebSocket, WebSocketDisconnect
router = APIRouter()

import uuid
from . import models, forms
from user import models as user_models
from .stock import StockProvider
from .execute import execute_buy, execute_sell, exit_trade
import middleware

from data.db import get_session
from data.conn import SocketPool
from data.cache import Cache


PROVIDER = StockProvider(5000, 2, 10)


def check_admin(data: forms.AdminForm): return data.username == environ['ADMIN_USER'] and data.password == environ['ADMIN_PASSWORD']


@router.get('/stocks')
def get_stocks(
    session: sql.Session = Depends(get_session),
    user: user_models.User = Depends(middleware.get_user)
):
    rows = session.exec(
        sql.select(models.StockEntry, models.Stock)
           .join(models.Stock)
           .order_by(models.StockEntry.timestamp)  # type: ignore
    )
    res: dict[str, dict] = {}
    for entry, stock in rows:
        stock_id = entry.stock_id.hex

        if stock_id not in res:
            owned = session.exec(
                sql.select(sql.func.coalesce(sql.func.sum(user_models.Transaction.num_units), 0))
                  .where(
                      user_models.Transaction.stock == stock.uid,
                      user_models.Transaction.user == user.uid
                  )
            ).one()

            long_holding = session.exec(
                sql.select(user_models.Holding).where(
                    user_models.Holding.stock == stock.uid,
                    user_models.Holding.user == user.uid,
                    user_models.Holding.trade_type == "long"
                )
            ).first()

            short_holding = session.exec(
                sql.select(user_models.Holding).where(
                    user_models.Holding.stock == stock.uid,
                    user_models.Holding.user == user.uid,
                    user_models.Holding.trade_type == "short"
                )
            ).first()

            res[stock_id] = {
                'name': stock.name,
                'category': stock.category,
                'entries': [],
                'owned': owned or 0,
                'long': {
                    'units': long_holding.quantity if long_holding else 0,
                    'entry_price': long_holding.entry_price if long_holding else 0.0
                },
                'short': {
                    'units': short_holding.quantity if short_holding else 0,
                    'entry_price': short_holding.entry_price if short_holding else 0.0
                }
            }

        res[stock_id]['entries'].append(entry.to_dict())
    
    
    if PROVIDER.started.is_set():
        cache = Cache()
        for stock_id in res.keys():
            entry = models.StockEntry.from_json(uuid.UUID(stock_id), cache.get(stock_id))
            res[stock_id]['entries'].append(entry.to_dict())
        

    return res


@router.websocket('/stocks')
async def connect_websocket(websocket: WebSocket):
    try:
        await websocket.accept()
        SocketPool.add(websocket)
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        SocketPool.remove(websocket)


@router.post('/stocks/{stock_id}')
def transact(
    stock_id: str, data: forms.TransactForm, session: sql.Session = Depends(get_session),
    user: user_models.User = Depends(middleware.get_user)
):
    try:
        stock = session.exec(sql.select(models.Stock).where(models.Stock.uid == uuid.UUID(stock_id))).one()
    except:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Stock ID not found")
    
    units = abs(data.units)

    try:
        if data.units < 0:
            return execute_sell(session, user, stock, units)
        else:
            return execute_buy(session, user, stock, units)
        
    except ValueError as e:
        raise HTTPException(status.HTTP_412_PRECONDITION_FAILED, detail=str(e))


# Exit route - Use this for direct exit of that stock position(s). i.e. delete entire stock holding

@router.post('/stocks/{stock_id}/exit')
def exit_position(
    stock_id: str, data: forms.ExitForm, session: sql.Session = Depends(get_session),
    user: user_models.User = Depends(middleware.get_user)
):
    try:
        stock = session.exec(sql.select(models.Stock).where(models.Stock.uid == uuid.UUID(stock_id))).one()
    except:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Stock ID not found")
    
    try:
        return exit_trade(session, user, stock, data.trade_type)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post('/stocks')
def start_stock(data: forms.AdminForm):
    if not check_admin(data): raise HTTPException(status.HTTP_403_FORBIDDEN, detail='Invalid admin credentials')
    if PROVIDER.started.is_set(): return HTTPException(status.HTTP_428_PRECONDITION_REQUIRED, detail='Stock provider is already initialized')
    
    PROVIDER.start()
    return "Stock provider initialized"


@router.delete('/stocks')
def stop_stock(data: forms.AdminForm):
    if not check_admin(data): raise HTTPException(status.HTTP_403_FORBIDDEN, detail='Invalid admin credentials')
    if not PROVIDER.started.is_set(): return HTTPException(status.HTTP_428_PRECONDITION_REQUIRED, detail="Stock provider is not running!")

    PROVIDER.started.clear()
    PROVIDER.join()
    return "Stock provider stopped"