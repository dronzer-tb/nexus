import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Set up axios interceptor to include token in all requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Set up axios interceptor to handle 401 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on 401 for auth verification endpoint
    // Let the component handle it
    const isAuthVerify = error.config?.url?.includes('/api/auth/verify');
    const isLoginRequest = error.config?.url?.includes('/api/auth/login');
    
    if (error.response?.status === 401 && !isAuthVerify && !isLoginRequest) {
      // Token is invalid or expired
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await axios.get('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data.user);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      }
    }
    setLoading(false);
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setUser(user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
