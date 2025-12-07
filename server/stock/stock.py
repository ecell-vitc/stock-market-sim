import asyncio, random, threading, time
import sqlmodel as sql
from sqlmodel import func
from stock.models import Stock, StockEntry
from user.models import Transaction, User, Holding

from data.conn import SocketPool
from data.cache import Cache
from data.db import get_session


class StockProvider(threading.Thread):
    __value: float
    __update: int
    __trigger: int

    started: threading.Event

    def __init__(self, init_value: float, update: int, trigger: int):
        self.__value = init_value
        self.__update = update
        self.__trigger = trigger
        self.started = threading.Event()
        super().__init__()


    # Check for bankrupt user and close their positions if next price update does it
    def check_bankruptcy(
        self, session: sql.Session,
        cache: Cache):

        # Get each user and all their holdings
        users = list(session.exec(sql.select(User)).fetchall())
        price_map = {} # Current prices

        for user in users:
            # Get all holdings for user
            holdings = list(session.exec(sql.select(Holding).where(Holding.user == user.uid)).fetchall())
            if not holdings:
                continue

        total_profit_loss = 0.0

        for holding in holdings:
            current_price = price_map.get(holding.stock)
            if current_price is None:
                continue
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
                    pass #ignore if u cant close for now (or add logs time hai toh)

            user.balance = 0.0
            user.save(session)
            session.commit()


    def broadcast_updates(
        self,  stocks: list[Stock],
        cache: Cache, session: sql.Session
    ):
        updates = {}
                
        for stock in stocks:
            entry = StockEntry.from_json(stock.uid, cache.get(stock.uid.hex))
            
            value = entry.close

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
            # value += value * random.uniform(-0.001, 0.001)
            
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

            else: self.broadcast_updates(stocks, cache, session)


            time.sleep(self.__update)
            delta_time += self.__update


def execute_sell(
    session: sql.Session, user: User,
    stock: Stock, units: int
):
    """
    Sell logic:
    - First reduce long holdings
    - If <0 then it becomes short position, i.e. borrow kar lo
    """
    cache = Cache()
    current_price = StockEntry.from_json(stock.uid, cache.get(stock.uid.hex)).close
    price_adjusted = current_price * 0.995 
    
    # Get existing long holding
    long_holding = session.exec(
        sql.select(Holding).where(
            Holding.user == user.uid,
            Holding.stock == stock.uid,
            Holding.trade_type == "long"
        )
    ).first()
    
    long_qty = long_holding.quantity if long_holding else 0
    
    if units <= long_qty:   #ideal case
        user.balance += units * price_adjusted
        long_holding.quantity -= units
        
        if long_holding.quantity == 0:
            session.delete(long_holding)
        else:
            session.add(long_holding)
    else:
        # Sell all long, then open short for excess
        if long_holding and long_holding.quantity > 0:
            user.balance += long_holding.quantity * price_adjusted
            session.delete(long_holding)
        
        short_units = units - long_qty
        
        # Get or create short holding
        short_holding = session.exec(
            sql.select(Holding).where(
                Holding.user == user.uid,
                Holding.stock == stock.uid,
                Holding.trade_type == "short"
            )
        ).first()
        
        if short_holding:
            # Weighted average entry price for short
            total_qty = short_holding.quantity + short_units
            avg_price = ((short_holding.entry_price * short_holding.quantity) + (current_price * short_units)) / total_qty
            short_holding.quantity = total_qty
            short_holding.entry_price = avg_price
            session.add(short_holding)
        else:
            short_holding = Holding(
                user=user.uid,
                stock=stock.uid,
                quantity=short_units,
                entry_price=current_price,
                trade_type="short"
            )
            session.add(short_holding)
    
    # Record transaction
    Transaction(
        stock=stock.uid, user=user.uid,
        num_units=-units, price=units * price_adjusted
    ).save(session)
    
    user.save(session)
    session.commit()
    
    return {"message": "Sell executed", "units": units, "price": current_price}


def execute_buy(
    session: sql.Session, user: User,
    stock: Stock, units: int
):
    """
    Buy logic:
    - First reduces short holdings (cover)
    - Excess becomes long position
    """
    cache = Cache()
    current_price = StockEntry.from_json(stock.uid, cache.get(stock.uid.hex)).close
    price_adjusted = current_price * 1.005
    
    # Get existing short holding
    short_holding = session.exec(
        sql.select(Holding).where(
            Holding.user == user.uid,
            Holding.stock == stock.uid,
            Holding.trade_type == "short"
        )
    ).first()
    
    short_qty = short_holding.quantity if short_holding else 0
    
    if units <= short_qty:
        # Just cover short position
        pnl = (short_holding.entry_price - current_price) * units
        user.balance += pnl  # Add profit/loss
        short_holding.quantity -= units
        
        if short_holding.quantity == 0:
            session.delete(short_holding)
        else:
            session.add(short_holding)
    else:
        # Cover all short, then open long for excess
        if short_holding and short_holding.quantity > 0:
            pnl = (short_holding.entry_price - current_price) * short_holding.quantity
            user.balance += pnl
            session.delete(short_holding)
        
        long_units = units - short_qty
        cost = long_units * price_adjusted
        
        if user.balance < cost:
            raise ValueError("Insufficient balance")
        
        user.balance -= cost
        
        # Get or create long holding
        long_holding = session.exec(
            sql.select(Holding).where(
                Holding.user == user.uid,
                Holding.stock == stock.uid,
                Holding.trade_type == "long"
            )
        ).first()
        
        if long_holding:
            # Average the entry price
            total_qty = long_holding.quantity + long_units
            avg_price = ((long_holding.entry_price * long_holding.quantity) + (current_price * long_units)) / total_qty
            long_holding.quantity = total_qty
            long_holding.entry_price = avg_price
            session.add(long_holding)
        else:
            long_holding = Holding(
                user=user.uid,
                stock=stock.uid,
                quantity=long_units,
                entry_price=current_price,
                trade_type="long"
            )
            session.add(long_holding)
    
    # Record transaction
    Transaction(
        stock=stock.uid, user=user.uid,
        num_units=units, price=units * price_adjusted
    ).save(session)
    
    user.save(session)
    session.commit()
    
    return {"message": "Buy executed", "units": units, "price": current_price}



def exit_trade(
    session: sql.Session, user: User,
    stock: Stock, trade_type: str
):
    #Exit entire position (long or short)"""
    cache = Cache()
    current_price = StockEntry.from_json(stock.uid, cache.get(stock.uid.hex)).close
    
    holding = session.exec(
        sql.select(Holding).where(
            Holding.user == user.uid,
            Holding.stock == stock.uid,
            Holding.trade_type == trade_type
        )
    ).first()
    
    if not holding:
        raise ValueError(f"No {trade_type} position to exit")
    
    pnl = holding.calculate_pnl(current_price)
    units = holding.quantity
    
    if trade_type == "long":
        user.balance += units * current_price * 0.995
    else:
        user.balance += pnl
    
    # Record transaction
    Transaction(
        stock=stock.uid, user=user.uid,
        num_units=-units if trade_type == "long" else units,
        price=units * current_price
    ).save(session)
    
    session.delete(holding)
    user.save(session)
    session.commit()
    
    return {
        "message": f"{trade_type.capitalize()} position closed",
        "units": units,
        "pnl": pnl
    }