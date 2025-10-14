import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden p-4 bg-background-dark">
      <div className="absolute inset-0 bg-background-dark opacity-50 z-0"></div>
      <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary/10 rounded-full animate-pulse blur-3xl"></div>
      <div className="absolute -bottom-1/2 -right-1/2 w-3/4 h-3/4 bg-primary/20 rounded-full animate-pulse blur-3xl" style={{ animationDelay: '500ms' }}></div>
      
      <main className="relative z-10 w-full max-w-md p-8 space-y-8 bg-background-light/10 backdrop-blur-sm border border-primary/20 rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            <span className="text-primary">NEXUS</span>
          </h1>
          <p className="mt-2 text-gray-300">System Monitoring &amp; Management</p>
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          
          <div>
            <label htmlFor="username" className="sr-only">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
              placeholder="Username"
              disabled={loading}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
              placeholder="Password"
              disabled={loading}
            />
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-primary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed glow"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </main>
      
      <footer className="absolute bottom-4 text-center w-full text-gray-400 text-sm z-10">
        <p>Powered by Dronzer Studios</p>
      </footer>
    </div>
  );
}

export default Login;
