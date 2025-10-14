import { Link } from 'react-router-dom';

function AgentCard({ agent }) {
  const isOnline = agent.status === 'online';

  return (
    <Link
      to={`/agents/${agent.id}`}
      className="bg-background-dark/70 p-6 rounded-xl border border-primary/20 backdrop-blur-sm transform hover:scale-[1.02] transition-transform duration-300 flex flex-col"
    >
      <div className="flex justify-between items-start mb-4">
        <h4 className="text-lg font-bold text-white">
          {agent.hostname || agent.id}
        </h4>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          isOnline 
            ? 'text-green-400 bg-green-400/10' 
            : 'text-red-400 bg-red-400/10'
        }`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      
      {isOnline ? (
        <>
          <div className="flex-1 flex justify-center items-center flex-col py-4">
            <div className="cpu-chart" style={{ 
              '--chart-value': agent.metrics?.cpu || 0, 
              '--chart-color': '#0d8bf2'
            }}>
              <div className="absolute inset-0 flex items-center justify-center flex-col mt-[-20px]">
                <span className="text-4xl font-bold text-white">
                  {agent.metrics?.cpu?.toFixed(0) || 0}%
                </span>
                <span className="text-sm text-white/60">CPU</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/80">RAM</span>
                <span className="text-white/60">
                  {agent.metrics?.memoryUsed || '0'}/{agent.metrics?.memoryTotal || '0'} GB
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full glow" 
                  style={{ width: `${agent.metrics?.memory || 0}%` }}
                ></div>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/80">Storage</span>
                <span className="text-white/60">
                  {agent.metrics?.diskUsed || '0'}/{agent.metrics?.diskTotal || '0'} GB
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full glow" 
                  style={{ width: `${agent.metrics?.disk || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex justify-center items-center flex-col py-4">
          <div className="text-gray-500 text-center">
            <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
              <path d="M232,128a104,104,0,1,1-104-104A104.13,104.13,0,0,1,232,128ZM128,40a88,88,0,1,0,88,88A88.1,88.1,0,0,0,128,40Zm0,112a24,24,0,1,0-24-24A24,24,0,0,0,128,152Z"></path>
            </svg>
            <p className="text-sm">Agent Offline</p>
          </div>
        </div>
      )}
    </Link>
  );
}

export default AgentCard;
