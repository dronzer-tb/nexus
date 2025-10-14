import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { AuthProvider, useAuth } from './context/AuthContext';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppContent() {
  const [socket, setSocket] = useState(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Initialize socket connection when authenticated
    if (isAuthenticated) {
      const token = localStorage.getItem('token');
      if (token) {
        const socketInstance = io(window.location.origin, {
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          auth: {
            token
          }
        });

        socketInstance.on('connect', () => {
          console.log('Connected to Nexus server');
        });

        socketInstance.on('disconnect', () => {
          console.log('Disconnected from server');
        });

        socketInstance.on('connect_error', (error) => {
          console.error('Connection error:', error);
        });

        setSocket(socketInstance);

        return () => {
          socketInstance.disconnect();
        };
      }
    } else {
      // Disconnect socket when not authenticated
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [isAuthenticated]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <Dashboard socket={socket} />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
