'use client'

function MetricCard({ title, value, change }) {
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div className="bg-background-light/10 p-6 rounded-xl border border-tx/10 transform hover:-translate-y-1 transition-transform duration-300">
      <h3 className="text-lg font-medium text-tx/90">{title}</h3>
      <p className="text-4xl font-bold text-tx my-2">{value}</p>
      <div className="flex items-center text-sm">
        {change !== 0 && (
          <>
            <span className={`mr-2 ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400'}`}>
              {isPositive && '+'}{change.toFixed(1)}%
            </span>
            <span className="text-tx/60">Last 24 Hours</span>
          </>
        )}
        {change === 0 && (
          <span className="text-gray-400">No change</span>
        )}
      </div>
      <div className="h-24 mt-4 -mb-2">
        {/* Placeholder for future chart implementation */}
      </div>
    </div>
  );
}

export default MetricCard;
