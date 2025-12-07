import { useState } from "react"

type HoldingInfo = { units: number, entry_price: number }

type TransactProps = {
  stockId: string
  price: number
  balance: number
  long?: HoldingInfo
  short?: HoldingInfo
  owned?: number
  onComplete: () => void
}

const defaultHolding: HoldingInfo = { units: 0, entry_price: 0 }

const Transact = (props: TransactProps) => {
  const long = props.long ?? defaultHolding
  const short = props.short ?? defaultHolding

  const [units, setUnits] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buyCost = units * props.price * 1.005
  const sellProceeds = units * props.price * 0.995

  const onUnitsChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(ev.currentTarget.value)
    setUnits(isNaN(v) || v <= 0 ? 1 : v)
  }

  const request = async (url: string, payload: unknown) => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:8000${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        let msg = 'Request failed'
        try { const data = await res.json(); msg = data.detail || msg } catch {}
        setError(msg)
      } else {
        props.onComplete()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const buy = () => request(`/stocks/${props.stockId}`, { units })
  const sell = () => request(`/stocks/${props.stockId}`, { units: -units })
  const exitLong = () => request(`/stocks/${props.stockId}/exit`, { trade_type: 'long' })
  const exitShort = () => request(`/stocks/${props.stockId}/exit`, { trade_type: 'short' })

  return (
    <div className="p-4">
      <div className="mb-3 text-sm">
        <div>Balance: ₹{props.balance.toFixed(2)}</div>
        <div>Long: {long.units} @ ₹{long.entry_price.toFixed(2)}</div>
        <div>Short: {short.units} @ ₹{short.entry_price.toFixed(2)}</div>
      </div>

      {error && <div className="mb-3 text-red-600">{error}</div>}

      <input
        type="number"
        min={1}
        value={units}
        onChange={onUnitsChange}
        disabled={loading}
        className="border p-2 w-full mb-3"
      />

     <div className="flex gap-2 mb-3">
        <button
          onClick={buy}
          // allow buying even if there is an active short; this lets you buy back (cover) partially
          disabled={loading || (buyCost > props.balance && short.units === 0)}
          className="p-2 bg-green-600 text-white flex-1 disabled:opacity-50"
        >
          {short.units > 0 ? `Buy to Cover (₹${buyCost.toFixed(2)})` : `Buy (₹${buyCost.toFixed(2)})`}
        </button>
        <button
          onClick={sell}
          disabled={loading}
          className="p-2 bg-red-600 text-white flex-1 disabled:opacity-50"
        >
          Sell (₹{sellProceeds.toFixed(2)})
        </button>
      </div>

      <div className="flex gap-2">
        {long.units > 0 && (
          <button
            onClick={exitLong}
            disabled={loading}
            className="p-2 bg-orange-600 text-white flex-1 disabled:opacity-50"
          >
            Square Off ({long.units})
          </button>
        )}
        {short.units > 0 && (
          <button
            onClick={exitShort}
            disabled={loading}
            className="p-2 bg-purple-600 text-white flex-1 disabled:opacity-50"
          >
            Square Off ({short.units})
          </button>
        )}
      </div>
    </div>
  )
}

export default Transact