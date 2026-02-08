function ProcessTable({ processes, onKillProcess, showAgent = false }) {
  if (!processes || processes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        No processes found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b border-tx/10">
          <tr>
            <th className="p-4 text-sm font-semibold text-tx/70">Process Name</th>
            {showAgent && <th className="p-4 text-sm font-semibold text-tx/70">Agent</th>}
            <th className="p-4 text-sm font-semibold text-tx/70">PID</th>
            <th className="p-4 text-sm font-semibold text-tx/70">CPU %</th>
            <th className="p-4 text-sm font-semibold text-tx/70">Memory</th>
            <th className="p-4 text-sm font-semibold text-tx/70">Status</th>
            <th className="p-4 text-sm font-semibold text-tx/70">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {processes.map((process, index) => (
            <tr key={index} className="hover:bg-primary/10 transition-colors duration-200">
              <td className="p-4 text-tx font-medium">{process.name || 'Unknown'}</td>
              {showAgent && <td className="p-4 text-tx/60">{process.agentId || process.hostname || 'N/A'}</td>}
              <td className="p-4 text-tx/60">{process.pid}</td>
              <td className="p-4 text-tx/90">{process.cpu?.toFixed(1) || 0}%</td>
              <td className="p-4 text-tx/90">
                {process.memory 
                  ? `${(process.memory / 1024 / 1024).toFixed(0)} MB`
                  : 'N/A'
                }
              </td>
              <td className="p-4">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  process.status === 'running' || process.state === 'running'
                    ? 'bg-green-500/20 text-green-300'
                    : process.status === 'sleeping' || process.state === 'sleeping'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-gray-500/20 text-gray-300'
                }`}>
                  {process.status || process.state || 'Unknown'}
                </span>
              </td>
              <td className="p-4">
                <button
                  onClick={() => onKillProcess(process.pid, process.agentId)}
                  className="text-red-400 hover:text-red-300 font-semibold transition-colors duration-200 text-sm"
                >
                  Kill
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProcessTable;
