import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Header from './components/Header';
import NodesList from './components/NodesList';
import NodeDetails from './components/NodeDetails';
import Stats from './components/Stats';

function App() {
  const [socket, setSocket] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('Connected to Nexus server');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socketInstance.on('nodes:update', (updatedNodes) => {
      setNodes(updatedNodes);
      
      // Update selected node if it's in the list
      if (selectedNode) {
        const updated = updatedNodes.find(n => n.id === selectedNode.id);
        if (updated) {
          setSelectedNode(updated);
        }
      }
    });

    socketInstance.on('node:status', ({ nodeId, status }) => {
      setNodes(prevNodes => 
        prevNodes.map(node => 
          node.id === nodeId ? { ...node, status } : node
        )
      );
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-dark">
      <Header connected={connected} nodeCount={nodes.length} />
      
      <div className="container mx-auto px-4 py-6">
        <Stats nodes={nodes} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-1">
            <NodesList 
              nodes={nodes} 
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
            />
          </div>
          
          <div className="lg:col-span-2">
            {selectedNode ? (
              <NodeDetails 
                node={selectedNode} 
                socket={socket}
              />
            ) : (
              <div className="card">
                <div className="text-center py-12">
                  <svg 
                    className="mx-auto h-12 w-12 text-gray-500" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                    />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-300">No node selected</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Select a node from the list to view its details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
