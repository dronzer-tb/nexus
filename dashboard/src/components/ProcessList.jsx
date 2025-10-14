import React from 'react';

function ProcessList({ currentMetrics }) {
  const processes = currentMetrics?.processes;

  if (!processes || !processes.list || processes.list.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">Top Processes</h3>
        <p className="text-gray-500">No process information available</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-header">Top Processes (by CPU)</h3>
      
      <div className="mb-4 grid grid-cols-4 gap-2 text-xs text-gray-400">
        <div className="bg-dark-lightest rounded p-2 text-center">
          <p className="text-lg font-semibold text-white">{processes.all}</p>
          <p>Total</p>
        </div>
        <div className="bg-dark-lightest rounded p-2 text-center">
          <p className="text-lg font-semibold text-green-400">{processes.running}</p>
          <p>Running</p>
        </div>
        <div className="bg-dark-lightest rounded p-2 text-center">
          <p className="text-lg font-semibold text-yellow-400">{processes.sleeping}</p>
          <p>Sleeping</p>
        </div>
        <div className="bg-dark-lightest rounded p-2 text-center">
          <p className="text-lg font-semibold text-red-400">{processes.blocked}</p>
          <p>Blocked</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-lightest">
              <th className="text-left py-2 px-2 text-gray-400 font-medium">PID</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">Name</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">CPU %</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">MEM %</th>
            </tr>
          </thead>
          <tbody>
            {processes.list.map((proc, index) => (
              <tr 
                key={`${proc.pid}-${index}`}
                className="border-b border-dark-lightest last:border-0 hover:bg-dark-lightest"
              >
                <td className="py-2 px-2 text-gray-300">{proc.pid}</td>
                <td className="py-2 px-2 text-white truncate max-w-xs" title={proc.name}>
                  {proc.name}
                </td>
                <td className="py-2 px-2 text-right">
                  <span className={`font-medium ${
                    proc.cpu > 50 ? 'text-red-400' :
                    proc.cpu > 25 ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {proc.cpu}%
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-blue-400 font-medium">
                  {proc.mem}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {processes.list.length === 0 && (
        <p className="text-center text-gray-500 py-4">No processes to display</p>
      )}
    </div>
  );
}

export default ProcessList;
