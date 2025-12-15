import Graph from "./graph";
import Transact from "./transact";
import PortfolioSummary from "./PortfolioSummary";
import type { Stock as StockType, StockEntry } from "../../types";
import { useUserStore } from "../../lib/store";

const Stock = ({
  stocks,
  entries,
  curr,
  setCurr,
}: {
  stocks: Record<string, StockType>;
  entries: Record<string, StockEntry[]>;
  curr: string;
  setCurr: (v: string) => void;
  }) => {
  const data: StockEntry[] = entries[curr] ?? [];
  const last = data.length - 1;

  const owned = useUserStore(state => state.stocks[curr])

  const price = last >= 0 ? data[last].close : 0;
  const prevClose = last > 0 ? data[last - 1].close : price;

  const candleChange = price - prevClose;
  const candlePct = prevClose ? (candleChange / prevClose) * 100 : 0;

  const pnl = (
    owned === undefined ? 0 :
    (data[last].close - owned.avg_price) * owned.quantity
  )

  return (
    <section className="max-w-[1400px] mx-auto px-6 py-12 space-y-10">
      {/* ================= GRAPH ================= */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0b123a] to-[#070d2d] border border-[#1e2a6b] shadow-xl">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <select
            value={curr}
            onChange={(e) => setCurr(e.target.value)}
            className="bg-[#0b123a] border border-[#1e2a6b] text-white text-2xl font-semibold px-3 py-1 rounded-lg"
          >
            {Object.keys(stocks).map((id) => (
              <option key={id} value={id}>
                {stocks[id].name}
              </option>
            ))}
          </select>

          <div className="text-right">
            <div className="text-2xl font-bold">
              ₹{price.toFixed(2)}
            </div>
            <div
              className={`text-sm ${
                candleChange >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {candleChange >= 0 ? "+" : ""}
              {candleChange.toFixed(2)} ({candlePct.toFixed(2)}%)
            </div>
          </div>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
          <Metric label="P&L"
            value={(pnl < 0 ? "-" : "") + '₹' + Math.abs(pnl).toFixed(2)}
            positive={ owned.quantity == 0 ? undefined : pnl >= 0 } />
          <Metric label="High" value={`₹${data[last].high.toFixed(2)}`} />
          <Metric label="Low" value={`₹${data[last].low.toFixed(2)}`} />
          <Metric
            label="Prev Candle"
            value={`${candleChange >= 0 ? "+" : ""}${candleChange.toFixed(
              2
            )} (${candlePct.toFixed(2)}%)`}
            positive={candleChange >= 0}
          />
        </div>

        <Graph data={data} curr={curr} indicatorData={null} />
      </div>

      {/* ================= TRADE + INFO ================= */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0b123a] to-[#070d2d] border border-[#1e2a6b] shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6">
          {/* LEFT — TRANSACT */}
          <Transact
            stockId={curr}
            stockName={stocks[curr].name}
            price={price}
          />

          {/* RIGHT — TIPS + SUMMARY (STACKED) */}
          <div className="flex flex-col gap-6">
            {/* TRADING TIPS */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0c3a4e] to-[#083042] border border-[#1e6b6b]">
              <h4 className="text-lg font-semibold mb-3">
                Trading Tips
              </h4>
              <ul className="space-y-2 text-sm text-gray-200">
                <li>• Always research before trading</li>
                <li>• Avoid over-leveraging</li>
                <li>• Use stop-loss orders</li>
                <li>• Trade with a plan</li>
                <li>• Control emotions</li>
              </ul>
            </div>

            {/* SUMMARY — ONLY HERE */}
            <PortfolioSummary
              stocks={stocks}
              currentStockId={curr}
              entries={entries}
            />

          </div>
        </div>
      </div>
    </section>
  );
};

const Metric = ({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) => (
  <div>
    <div className="text-gray-400">{label}</div>
    <div
      className={`font-medium ${
        positive === undefined
          ? "text-white"
          : positive
          ? "text-green-400"
          : "text-red-400"
      }`}
    >
      {value}
    </div>
  </div>
);

export default Stock;
