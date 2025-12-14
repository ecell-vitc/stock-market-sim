import { useState, useRef, useEffect } from "react";

const indicators = [
  "SMA", "EMA", "DEMA", "TEMA", "RMA", "TRIX", "MMAX",
  "APO", "ARRON", "BOP", "CCI", "MI", "MACD", "PSAR",
  "QSTICK", "KDJ", "TYP", "VWMA",
  "VORTEX", "AO", "CMO", "ICHIMOKU", "PPO", "PVO",
  "ROC", "RSI", "STOCH", "AB", "ATR", "BB", "BBW", "CE",
  "DC", "KC", "PO", "TR", "UI",
  "AD", "CMF", "EMV", "FI", "MFI", "NVI", "OBV", "VPT", "VWAP",
];

type Props = {
  onSelect: (indicator: string | null) => void;
};

const IndicatorsDropdown = ({ onSelect }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = indicators.filter((i) =>
    i.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={dropdownRef} className="relative w-56">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#070d2d] border border-[#1e2a6b] rounded-lg px-3 py-2 text-sm text-gray-200"
      >
        {selected ?? "Select Indicator"}
      </button>

      {isOpen && (
        <div className="absolute mt-2 w-full bg-[#070d2d] border border-[#1e2a6b] rounded-lg max-h-60 overflow-y-auto z-50">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-transparent border-b border-[#1e2a6b] px-3 py-2 text-sm outline-none"
          />

          <div
            onClick={() => {
              setSelected(null);
              onSelect(null);
              setIsOpen(false);
            }}
            className="px-3 py-2 text-sm text-gray-400 hover:bg-[#0b123a] cursor-pointer"
          >
            None
          </div>

          {filtered.map((i) => (
            <div
              key={i}
              onClick={() => {
                setSelected(i);
                onSelect(i);
                setIsOpen(false);
              }}
              className="px-3 py-2 text-sm hover:bg-[#0b123a] cursor-pointer"
            >
              {i}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IndicatorsDropdown;
