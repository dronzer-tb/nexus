import { Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Overview from './Overview';
import AgentsList from './AgentsList';
import AgentDetails from './AgentDetails';
import ProcessManager from './ProcessManager';
import CommandConsole from './CommandConsole';
import Logs from './Logs';

function Dashboard({ socket }) {
  return (
    <div className="flex min-h-screen bg-background-dark">
      <Sidebar />
      
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Overview socket={socket} />} />
          <Route path="/nodes" element={<AgentsList socket={socket} />} />
          <Route path="/nodes/:agentId" element={<AgentDetails socket={socket} />} />
          <Route path="/processes" element={<ProcessManager socket={socket} />} />
          <Route path="/console" element={<CommandConsole socket={socket} />} />
          <Route path="/logs" element={<Logs socket={socket} />} />
        </Routes>
      </main>
    </div>
  );
}

export default Dashboard;
