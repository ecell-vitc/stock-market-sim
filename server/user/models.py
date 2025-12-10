import sqlmodel as sql
import bcrypt, uuid
from data.db import BaseModel, BaseTimestampModel

class User(BaseModel, table=True):
    username: str = sql.Field(unique=True)
    password: str
    balance: float

    def __init__(self, username: str, password: str, balance: float):
        hashed_pass = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        super().__init__(username=username, password=hashed_pass, balance=balance) # type: ignore

    def verify(self, password: str): return bcrypt.checkpw(password.encode(), self.password.encode())


class Transaction(BaseTimestampModel, table=True):
    num_units: int
    price: float
    stock: uuid.UUID = sql.Field(foreign_key='stock.uid', ondelete='CASCADE')
    user: uuid.UUID = sql.Field(foreign_key='user.uid', ondelete='CASCADE')


class Holding(BaseModel, table=True):
    stock: uuid.UUID = sql.Field(foreign_key='stock.uid', ondelete='CASCADE')
    user: uuid.UUID = sql.Field(foreign_key='user.uid', ondelete='CASCADE')
    quantity: int
    entry_price: float
    trade_type: str  # "long" or "short"
    
    def calculate_pnl(self, current_price: float) -> float:
        if self.trade_type == "long":
            return (current_price - self.entry_price) * self.quantity
        else:
            return (self.entry_price - current_price) * self.quantity