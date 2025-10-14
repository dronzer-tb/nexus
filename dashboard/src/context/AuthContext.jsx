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
    console.log('=== LOGIN FUNCTION CALLED ===');
    console.log('Username:', username, 'Password length:', password?.length);
    
    try {
      console.log('Login: Sending login request to /api/auth/login...');
      const response = await axios.post('/api/auth/login', { username, password });
      console.log('Login: Response received:', response.status);
      
      const { token, user } = response.data;
      console.log('Login: Token received (length):', token?.length);
      console.log('Login: User received:', user);
      
      // Store token in localStorage
      localStorage.setItem('token', token);
      console.log('Login: Token stored in localStorage');
      
      // Verify localStorage immediately
      const storedToken = localStorage.getItem('token');
      console.log('Login: Verification - token in localStorage?', !!storedToken, 'Length:', storedToken?.length);
      
      // Update state immediately without verification
      setUser(user);
      setIsAuthenticated(true);
      console.log('Login: State updated - isAuthenticated set to TRUE');
      
      // Give React time to update
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('Login: Returning success');
      
      return { success: true };
    } catch (error) {
      console.error('=== LOGIN ERROR ===');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
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
