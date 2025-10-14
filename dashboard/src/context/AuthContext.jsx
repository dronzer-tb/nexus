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
    console.log('CheckAuth: Token exists?', !!token);
    if (token) {
      try {
        const response = await axios.get('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('CheckAuth: Token valid, user:', response.data.user);
        setUser(response.data.user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('CheckAuth: Token verification failed:', error.response?.status);
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      }
    } else {
      console.log('CheckAuth: No token found');
    }
    setLoading(false);
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      const { token, user } = response.data;
      
      // Store token in localStorage
      localStorage.setItem('token', token);
      
      // Verify the token works before updating state
      try {
        const verifyResponse = await axios.get('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Token is valid, update state
        setUser(verifyResponse.data.user);
        setIsAuthenticated(true);
        
        return { success: true };
      } catch (verifyError) {
        // Token verification failed, remove it
        localStorage.removeItem('token');
        return { 
          success: false, 
          error: 'Authentication verification failed' 
        };
      }
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
