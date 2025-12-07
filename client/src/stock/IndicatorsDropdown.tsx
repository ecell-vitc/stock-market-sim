import { useState, useRef, useEffect } from 'react';

const indicators = [
  "SMA", "EMA", "DEMA", "TEMA", "RMA", "TRIX", "MMAX"
  // Add more later like "VWAP","BB","PSAR","Ichimoku"
];

const IndicatorsDropdown = ({ onSelect }: { onSelect: (indicator: string) => void }) => {
  const [selected, setSelected] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectHandler = (indicator: string) => {
    setSelected(indicator);
    setIsOpen(false);
    onSelect(indicator);              
  };

  // Close menu when clicked outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={dropdownRef} className="bg-gray-900/60 border border-gray-700 p-2 rounded-md w-60">
      <button
        onClick={()=>setIsOpen(!isOpen)}
        className="w-full bg-gray-800 py-2 text-sm text-white rounded-md border border-gray-500"
      >
        {selected || "Select Indicator"}
      </button>

      {isOpen && (
        <div className="mt-1 bg-gray-800 border border-gray-600 rounded-md max-h-60 overflow-y-auto absolute z-50 w-60">
          {indicators.map(ind=>(
            <div key={ind}
              onClick={()=>selectHandler(ind)}
              className="px-3 py-2 text-sm text-white border-b border-gray-700 hover:bg-gray-700 cursor-pointer"
            >
              {ind}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IndicatorsDropdown;

