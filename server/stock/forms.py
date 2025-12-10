from pydantic import BaseModel

class AdminForm(BaseModel):
    username: str
    password: str

class TransactForm(BaseModel):
    units: int

class ExitForm(BaseModel):
    trade_type: str

class StockEventForm(BaseModel):
    username: str
    password: str
    to: float
    duration: int