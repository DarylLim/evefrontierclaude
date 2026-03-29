'use client';

interface FuelGaugeProps {
  pct: number;
  unitsRemaining?: number;
  maxCapacity?: number;
}

export default function FuelGauge({ pct, unitsRemaining, maxCapacity }: FuelGaugeProps) {
  const color = pct < 20 ? 'bg-ghost-danger' : pct < 50 ? 'bg-ghost-warning' : 'bg-ghost-safe';

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>FUEL</span>
        <span className={pct < 20 ? 'text-ghost-danger font-bold' : ''}>{pct}%</span>
      </div>
      <div className="h-2 bg-ghost-border rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {unitsRemaining != null && maxCapacity != null && (
        <div className="text-xs text-gray-500 text-center mt-2">
          {unitsRemaining} / {maxCapacity} units
        </div>
      )}
    </div>
  );
}
