import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import io from 'socket.io-client';
import Dashboard from './pages/Dashboard';
import { ThemeProvider } from './context/ThemeContext';

/**
 * Nexus App - No Authentication
 * Direct access to dashboard - API key authentication only for backend API calls
 */

function App() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to WebSocket without authentication
    const socketInstance = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => console.log('Connected to Nexus server'));
    socketInstance.on('disconnect', () => console.log('Disconnected from server'));
    socketInstance.on('connect_error', (error) => console.error('Connection error:', error));

    setSocket(socketInstance);
    
    return () => socketInstance.disconnect();
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/*" element={<Dashboard socket={socket} />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
