import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

// Auth Guard Component
const RequireAuth = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="font-mono text-neon-cyan animate-pulse">Loading auth data...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * Nexus App - v1.9.5 with Onboarding
 * Checks if onboarding is complete, otherwise shows setup wizard
 */

function App() {
  const [socket, setSocket] = useState(null);
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const response = await axios.get('/api/onboarding/status');
      setOnboardingStatus(response.data);

      // Only connect socket if onboarding is complete
      if (response.data.completed) {
        connectSocket();
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      // On error, assume onboarding needed
      setOnboardingStatus({ completed: false });
    } finally {
      setLoading(false);
    }
  };

  const connectSocket = () => {
    const token = localStorage.getItem('token');
    const socketInstance = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token: token || '' }
    });

    socketInstance.on('connect', () => console.log('Connected to Nexus server'));
    socketInstance.on('disconnect', () => console.log('Disconnected from server'));
    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      // If auth fails, don't keep retrying with bad token
      if (error.message.includes('Authentication') || error.message.includes('Invalid') || error.message.includes('expired')) {
        socketInstance.disconnect();
      }
    });

    setSocket(socketInstance);
  };

  // Show loading screen while checking onboarding status
  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-background-dark flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🎯</div>
            <div className="font-mono text-neon-pink text-lg uppercase tracking-widest animate-pulse">
              Initializing Nexus...
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Show onboarding wizard if not completed
  if (!onboardingStatus?.completed) {
    return (
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/*" element={<Onboarding />} />
          </Routes>
        </Router>
      </ThemeProvider>
    );
  }

  // Show dashboard if onboarding is complete
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <RequireAuth>
                <Dashboard socket={socket} />
              </RequireAuth>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
