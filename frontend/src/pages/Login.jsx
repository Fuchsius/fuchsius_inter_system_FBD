import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Lock, Shield
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Loading from '../components/Loading';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const THEME = {
  gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  gradientText: "bg-clip-text text-transparent bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
};

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const [error, setError] = useState('');

  const isLoading = loadingCount > 0;

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    startLoading();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || 'Login failed');
        setLoading(false);
        stopLoading();
        return;
      }

      // Check if user status is active
      if (data.data.user.status !== 'active') {
        setError('Your account is not active. Please contact administrator.');
        setLoading(false);
        stopLoading();
        return;
      }

      onLogin(data.data.user, data.data.accessToken, data.data.refreshToken);
    } catch (err) {
      setError('Failed to connect to server');
      setLoading(false);
      stopLoading();
    } finally {
      stopLoading();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      {/* <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-[#7E006C]/20 rounded-full blur-xl"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-96 h-96 bg-[#C4009A]/20 rounded-full blur-xl"></div> */}
      
      <Card className="w-full max-w-md p-8 shadow-xl border-t-4 border-[#C4009A] relative z-10">
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold ${THEME.gradientText} mb-2`}>Fuchsius</h1>
          <p className="text-slate-500 text-sm">Internal Management System</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@fuchsius.com" 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <div className="pt-4 space-y-3">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              icon={Shield}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
          
          <div className="text-center pt-4 border-t border-slate-200">
            <p className="text-slate-600">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="text-[#C4009A] hover:text-[#7E006C] font-medium transition-colors"
              >
                Sign Up
              </button>
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Login;
