import asyncio, random, threading, time
import sqlmodel as sql
from sqlmodel import func
from stock.models import Stock, StockEntry
from user.models import Transaction, User, Holding

from data.conn import SocketPool
from data.cache import Cache
from data.db import get_session

from .execute import exit_trade


class Event:
    _curr: int
    _prev: float
    num_candles: int
    ends: tuple[float, float]

    def __init__(self, num_candles: int, data_from: float, data_to: float):
        if num_candles < 1: raise ValueError("Number of candles for transition should be atleast 1")

        self._curr = 0
        self._prev = data_from
        self.num_candles = num_candles
        self.ends = (data_from, data_to)

    def is_finished(self) -> bool:
        return self._curr == self.num_candles

    def get_next(self) -> float:
        self._curr += 1
        if self._curr > self.num_candles: raise IndexError("Exceeded the number of candles")
        if self._curr == self.num_candles: return self.ends[1]
        lin_value = self.ends[0] + self._curr * (self.ends[1] - self.ends[0]) / self.num_candles
        
        value = random.uniform(self._prev, lin_value)
        self._prev = value
        return value


class StockProvider(threading.Thread):
    __value: float
    __update: int
    __trigger: int

    __events: dict[str, list[Event]]

    started: threading.Event

    def __init__(self, init_value: float, update: int, trigger: int):
        self.__value = init_value
        self.__update = update
        self.__trigger = trigger
        self.__events = {}
        self.started = threading.Event()
        super().__init__()

    def add_pattern(self, stock_uid: str, events: list[Event]):
        self.__events[stock_uid] = events

    # Check for bankrupt user and close their positions if next price update does it
    def check_bankruptcy(
        self, session: sql.Session,
        cache: Cache):

        # make a dict of all users with their holdings
        results = session.exec(
            sql.select(User, Holding)
            .join(Holding, User.uid == Holding.user)
        ).all()

        if not results:
            return

        # har user ka holding 
        user_holdings: dict[str, tuple[User, list[Holding]]] = {}
        for user, holding in results:
            if user.uid.hex not in user_holdings:
                user_holdings[user.uid.hex] = (user, [])
            user_holdings[user.uid.hex][1].append(holding)

        # Process each user
        for uid_hex, (user, holdings) in user_holdings.items():
            total_profit_loss = 0.0

            for holding in holdings:
                # Get current price from cache
                current_price = StockEntry.from_json(
                    holding.stock, 
                    cache.get(holding.stock.hex)
                ).close
                total_profit_loss += holding.calculate_pnl(current_price)

            if total_profit_loss < 0 and abs(total_profit_loss) >= user.balance:
                # User is bankrupt, close all positions
                for holding in holdings:
                    stock = session.get(Stock, holding.stock)
                    if not stock:
                        continue
                    try:
                        exit_trade(session, user, stock, holding.trade_type)
                    except Exception:
                        pass

                user.balance = 0.0
                user.save(session)
                session.commit()


    def broadcast_updates(
        self,  stocks: list[Stock],
        cache: Cache, session: sql.Session,
        last_candle_update: bool
    ):
        updates = {}
                
        for stock in stocks:
            entry = StockEntry.from_json(stock.uid, cache.get(stock.uid.hex))
            
            value = entry.close

            if last_candle_update and len(self.__events[stock.uid.hex]) > 0:
                value = self.__events[stock.uid.hex][0].get_next()
                if self.__events[stock.uid.hex][0].is_finished():
                    self.__events[stock.uid.hex].pop(0)
            else:
                # new transactions for this stock after the current entry timestamp
                txs = session.exec(
                    sql.select(Transaction)   #txs mtlb transactions
                    .where(
                        Transaction.stock == stock.uid,
                        Transaction.timestamp > entry.timestamp
                    )
                    .order_by(Transaction.timestamp)
                ).all()

                if txs:
                    last = txs[-1]    # last transaction
                    # per-unit execution price
                    per_unit = (last.price / abs(last.num_units)) if last.num_units else value
                    value = max(0.01, per_unit)
                    try:
                        print(f"[tick] {stock.uid.hex}: {len(txs)} new tx(s); last per-unit={per_unit:.2f} -> price={value:.2f}")
                    except Exception:
                        pass

                # randomizer off kara hai
                value += value * random.uniform(-0.01, 0.01)
            
            entry.set_value(value)
            updates[stock.uid.hex] = entry.to_dict()
            cache.set(stock.uid.hex, str(entry))


        # Check for bankrupt users after price updates
        self.check_bankruptcy(session, cache)
        
        asyncio.run(SocketPool.broadcast(updates))

    

    def run(self):
        if self.started.is_set(): return None
        self.started.set()

        cache = Cache()
        session = next(get_session())
        stocks = list(session.exec(sql.select(Stock)).fetchall())

        for stock in stocks:
            cache.set(stock.uid.hex, str(StockEntry(stock_id=stock.uid, value=self.__value)))
            self.__events[stock.uid.hex] = []

        delta_time = 0
        while self.started.is_set():
                        
            if delta_time == self.__trigger:
                delta_time = 0
                new_data = {}
                for stock in stocks:
                    entry = StockEntry.from_json(stock.uid, cache.get(stock.uid.hex))
                    entry.save(session)

                    value = entry.close + abs(entry.open - entry.close) * random.uniform(-0.01, 0.01)
                    new_entry = StockEntry(stock_id=stock.uid, open=value, close=value, high=value, low=value)
                    cache.set(stock.uid.hex, str(new_entry))
                    new_data[stock.uid.hex] = new_entry.to_dict()

                asyncio.run(SocketPool.broadcast(new_data))

            else: self.broadcast_updates(
                stocks, cache, session,
                last_candle_update=(delta_time + self.__update == self.__trigger)
            )


            time.sleep(self.__update)
            delta_time += self.__update