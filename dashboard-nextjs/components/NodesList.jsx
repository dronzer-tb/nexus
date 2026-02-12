'use client'

import React from 'react';
import { formatDistanceToNow } from 'date-fns';

function NodesList({ nodes, selectedNode, onSelectNode }) {
  const formatUptime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  if (nodes.length === 0) {
    return (
      <div className="card">
        <h2 className="card-header">Nodes</h2>
        <div className="text-center py-8">
          <p className="text-gray-400">No nodes connected</p>
          <p className="text-sm text-gray-500 mt-2">
            Start a node with: <code className="bg-dark-lightest px-2 py-1 rounded">npm run start:node</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="card-header">
        Nodes ({nodes.length})
      </h2>
      
      <div className="space-y-3">
        {nodes.map((node) => (
          <button
            key={node.id}
            onClick={() => onSelectNode(node)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selectedNode?.id === node.id
                ? 'bg-primary bg-opacity-20 border-primary'
                : 'bg-dark-lightest border-dark-lightest hover:border-gray-600'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span 
                    className={`status-dot ${
                      node.status === 'online' ? 'status-online' : 'status-offline'
                    }`}
                  />
                  <h3 className="font-semibold text-white truncate">
                    {node.hostname}
                  </h3>
                </div>
                
                <p className="text-xs text-gray-500 truncate mb-2">
                  {node.id}
                </p>
                
                {node.system_info?.os && (
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <span>{node.system_info.os.distro}</span>
                    <span>•</span>
                    <span>{node.system_info.cpu.cores} cores</span>
                  </div>
                )}
                
                {node.last_seen && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last seen: {formatUptime(node.last_seen)}
                  </p>
                )}
              </div>
              
              <div className="ml-2">
                <svg 
                  className="w-5 h-5 text-gray-500" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 5l7 7-7 7" 
                  />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default NodesList;
