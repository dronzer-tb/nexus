import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function CommandConsole({ socket }) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [executing, setExecuting] = useState(false);
  const outputRef = useRef(null);

  useEffect(() => {
    fetchAgents();
    fetchHistory();

    if (socket) {
      socket.on('command:output', (data) => {
        setOutput(prev => [...prev, {
          type: 'output',
          content: data.output,
          timestamp: new Date().toLocaleTimeString()
        }]);
      });

      socket.on('command:error', (data) => {
        setOutput(prev => [...prev, {
          type: 'error',
          content: data.error,
          timestamp: new Date().toLocaleTimeString()
        }]);
        setExecuting(false);
      });

      socket.on('command:complete', () => {
        setExecuting(false);
      });
    }

    return () => {
      if (socket) {
        socket.off('command:output');
        socket.off('command:error');
        socket.off('command:complete');
      }
    };
  }, [socket]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/agents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgents(response.data.filter(a => a.status === 'online'));
      if (response.data.length > 0) {
        setSelectedAgent(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/commands/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch command history:', error);
    }
  };

  const handleExecute = async () => {
    if (!command.trim() || !selectedAgent) return;

    setExecuting(true);
    setOutput(prev => [...prev, {
      type: 'command',
      content: `$ ${command}`,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/agents/${selectedAgent}/execute`, 
        { command },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setHistory(prev => [command, ...prev.slice(0, 49)]);
      setCommand('');
      setHistoryIndex(-1);
    } catch (error) {
      setOutput(prev => [...prev, {
        type: 'error',
        content: error.response?.data?.message || 'Command execution failed',
        timestamp: new Date().toLocaleTimeString()
      }]);
      setExecuting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const clearOutput = () => {
    setOutput([]);
  };

  return (
    <main className="flex-1 p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Command Console</h2>
          <p className="text-white/60">Execute commands on remote agents</p>
        </div>
        
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="bg-background-dark/70 border border-primary/30 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={executing}
        >
          <option value="">Select Agent</option>
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.hostname || agent.id}
            </option>
          ))}
        </select>
      </header>

      <div className="bg-background-dark/70 rounded-xl border border-primary/20 p-6 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Output</h3>
          <button
            onClick={clearOutput}
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Clear
          </button>
        </div>
        
        <div
          ref={outputRef}
          className="bg-black/50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm"
        >
          {output.length === 0 ? (
            <div className="text-gray-500">No output yet. Execute a command to see results.</div>
          ) : (
            output.map((line, index) => (
              <div key={index} className="mb-2">
                <span className="text-gray-500 mr-2">[{line.timestamp}]</span>
                <span className={
                  line.type === 'command' ? 'text-primary' :
                  line.type === 'error' ? 'text-red-400' :
                  'text-gray-300'
                }>
                  {line.content}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-background-dark/70 rounded-xl border border-primary/20 p-6">
        <div className="flex gap-4">
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={executing || !selectedAgent}
            className="flex-grow bg-black/50 border-white/20 rounded-lg p-3 text-white font-mono focus:ring-2 focus:ring-primary focus:outline-none transition-shadow duration-200 border disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={selectedAgent ? "> Enter command..." : "Select an agent first"}
            type="text"
          />
          <button
            onClick={handleExecute}
            disabled={executing || !command.trim() || !selectedAgent}
            className="bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors duration-200 glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executing ? 'Executing...' : 'Execute'}
          </button>
        </div>
      </div>
    </main>
  );
}

export default CommandConsole;
