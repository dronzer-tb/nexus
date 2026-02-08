import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VariantPicker from './pages/VariantPicker';
import { AuthProvider, useAuth } from './context/AuthContext';

// Variant imports
import { OverviewV1, NodeDetailV1 } from './variants/v1/TerminalNoir';
import { OverviewV2, NodeDetailV2 } from './variants/v2/CelestialObservatory';
import { OverviewV3, NodeDetailV3 } from './variants/v3/RetroSynthwave';
import { OverviewV4, NodeDetailV4 } from './variants/v4/PaperInk';
import { OverviewV5, NodeDetailV5 } from './variants/v5/NeoBrutalist';

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
    if (isAuthenticated) {
      const token = localStorage.getItem('token');
      if (token) {
        const socketInstance = io(window.location.origin, {
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          auth: { token }
        });

        socketInstance.on('connect', () => console.log('Connected to Nexus server'));
        socketInstance.on('disconnect', () => console.log('Disconnected from server'));
        socketInstance.on('connect_error', (error) => console.error('Connection error:', error));

        setSocket(socketInstance);
        return () => socketInstance.disconnect();
      }
    } else {
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

        {/* Variant Picker */}
        <Route path="/variants" element={<ProtectedRoute><VariantPicker /></ProtectedRoute>} />

        {/* V1 — Terminal Noir */}
        <Route path="/v1" element={<ProtectedRoute><OverviewV1 socket={socket} /></ProtectedRoute>} />
        <Route path="/v1/nodes" element={<ProtectedRoute><OverviewV1 socket={socket} /></ProtectedRoute>} />
        <Route path="/v1/nodes/:agentId" element={<ProtectedRoute><NodeDetailV1 socket={socket} /></ProtectedRoute>} />

        {/* V2 — Celestial Observatory */}
        <Route path="/v2" element={<ProtectedRoute><OverviewV2 socket={socket} /></ProtectedRoute>} />
        <Route path="/v2/nodes" element={<ProtectedRoute><OverviewV2 socket={socket} /></ProtectedRoute>} />
        <Route path="/v2/nodes/:agentId" element={<ProtectedRoute><NodeDetailV2 socket={socket} /></ProtectedRoute>} />

        {/* V3 — Retro Synthwave */}
        <Route path="/v3" element={<ProtectedRoute><OverviewV3 socket={socket} /></ProtectedRoute>} />
        <Route path="/v3/nodes" element={<ProtectedRoute><OverviewV3 socket={socket} /></ProtectedRoute>} />
        <Route path="/v3/nodes/:agentId" element={<ProtectedRoute><NodeDetailV3 socket={socket} /></ProtectedRoute>} />

        {/* V4 — Paper & Ink Editorial */}
        <Route path="/v4" element={<ProtectedRoute><OverviewV4 socket={socket} /></ProtectedRoute>} />
        <Route path="/v4/nodes" element={<ProtectedRoute><OverviewV4 socket={socket} /></ProtectedRoute>} />
        <Route path="/v4/nodes/:agentId" element={<ProtectedRoute><NodeDetailV4 socket={socket} /></ProtectedRoute>} />

        {/* V5 — Neo Brutalist */}
        <Route path="/v5" element={<ProtectedRoute><OverviewV5 socket={socket} /></ProtectedRoute>} />
        <Route path="/v5/nodes" element={<ProtectedRoute><OverviewV5 socket={socket} /></ProtectedRoute>} />
        <Route path="/v5/nodes/:agentId" element={<ProtectedRoute><NodeDetailV5 socket={socket} /></ProtectedRoute>} />

        {/* Original Dashboard */}
        <Route path="/*" element={<ProtectedRoute><Dashboard socket={socket} /></ProtectedRoute>} />
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
