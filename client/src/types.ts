import type { UTCTimestamp } from "lightweight-charts"

export type Stock = {
    name: string,
    category: string,
    owned?: number,
    long?: { units: number, entry_price: number },
    short?: { units: number, entry_price: number }
}

export type StockEntry = {
    time: UTCTimestamp, 
    open: number, close: number,
    low: number, high: number
}

export type StocksResponse = Record<string, Stock & { entries: StockEntry[] }>