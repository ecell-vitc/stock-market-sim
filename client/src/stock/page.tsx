import { useState, useEffect, useCallback } from "react"
import type { Stock as StockType, StockEntry } from "../types"
import { fetch_stocks, parse_entry } from "./logic"
import Stock from "./stock"

const Page = () => {
  const [stocks, setStocks] = useState<Record<string, StockType>>()
  const [entries, setEntries] = useState<Record<string, StockEntry[]>>()
  const [curr, setCurr] = useState("")
  const [balance, setBalance] = useState(0)

  const loadData = useCallback(() => {
    fetch_stocks()
      .then(parse_entry)
      .then((data) => {
        setEntries(data.data)
        setStocks(data.info)
        if (!curr) setCurr(Object.keys(data.info)[0])
      })

    fetch('http://localhost:8000/user/info', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    }).then(r => r.ok ? r.json() : Promise.reject())
      .then(u => setBalance(u.balance))
      .catch(() => {})
  }, [curr])

  useEffect(() => {
    loadData()
    const socket = new WebSocket("ws://localhost:8000/stocks")
    socket.onmessage = (ev: MessageEvent) => setEntries(prev => {
      const update: Record<string, StockEntry> = JSON.parse(ev.data)
      const res = JSON.parse(JSON.stringify(prev))
      Object.keys(update).forEach((stock_id) => {
        const last_idx = res[stock_id].length - 1
        if (res[stock_id][last_idx].time === update[stock_id].time)
          res[stock_id][last_idx] = update[stock_id]
        else
          res[stock_id].push(update[stock_id])
      })
      return res
    })
    socket.onclose = () => { alert("Connection interrupted! Please refresh!") }
    return () => { if (socket.readyState === WebSocket.OPEN) socket.close() }
  }, [loadData])

  return (
    stocks == undefined || entries == undefined ? <></> :
    <Stock balance={balance} stocks={stocks} entries={entries} curr={curr} onRefresh={loadData}>
      <select className='my-3' onChange={(ev) => setCurr(ev.currentTarget.value)}>
        {Object.keys(stocks).map((key, idx) =>
          <option key={idx} value={key}>{stocks[key].name}</option>
        )}
      </select>
    </Stock>
  )
}

export default Page