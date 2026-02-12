'use client'

import React from 'react';

function Header({ connected, nodeCount }) {
  return (
    <header className="bg-dark-lighter border-b border-dark-lightest shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              NEXUS
            </div>
            <div className="text-sm text-gray-400">
              by Dronzer Studios
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">Nodes:</span>
              <span className="text-tx font-semibold">{nodeCount}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span 
                className={`status-dot ${connected ? 'status-online' : 'status-offline'} ${connected ? 'animate-pulse-slow' : ''}`}
              />
              <span className="text-sm text-gray-400">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
