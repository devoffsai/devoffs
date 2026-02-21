import React, { useState } from 'react';
import { Mail, Lock, CheckCircle, AlertCircle, ArrowRight, Hexagon, Loader2, Eye, EyeOff, Compass } from 'lucide-react';
import { authService } from '../services/auth';
import { User } from '../types';

interface Props {
  onLogin: (user: User) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'signup'>('login');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSwitchView = (newView: 'login' | 'signup') => {
    setView(newView);
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
        const user = await authService.loginAsGuest();
        onLogin(user);
    } catch (e: any) {
        setError("Failed to initialize guest session. Please try regular signup.");
        setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 1. Validation Logic
    if (!email.trim()) {
      setError("Email cannot be empty.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Password cannot be empty.");
      return;
    }

    if (view === 'signup') {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    // 2. Auth Execution
    setIsLoading(true);

    try {
      let user: User;
      
      if (view === 'login') {
        user = await authService.login(email, password);
        setSuccess("Login attempt successful ✅. Redirecting...");
      } else {
        user = await authService.register(email, password);
        setSuccess("Account created successfully ✅. Redirecting...");
      }

      // Small delay to show success message before routing
      setTimeout(() => {
        onLogin(user);
      }, 1000);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const isLogin = view === 'login';

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl mb-4 text-cyan-500">
            <Hexagon size={40} className="fill-cyan-500/20" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isLogin ? 'Welcome Back' : 'Join the Network'}
          </h1>
          <p className="text-slate-400">
            {isLogin 
              ? 'Sign in to access your verified Skill DNA.' 
              : 'Create an account to start benchmarking your engineering skills.'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 shadow-xl backdrop-blur-sm relative overflow-hidden">
          
          {/* Top colored accent line */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${isLogin ? 'from-cyan-500 to-blue-500' : 'from-purple-500 to-pink-500'}`}></div>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-10 text-white placeholder-slate-600 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-cyan-400 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Signup Only) */}
            {!isLogin && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-sm font-medium text-slate-300">Confirm Password</label>
                <div className="relative group">
                  <CheckCircle className="absolute left-3 top-3 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={18} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-10 text-white placeholder-slate-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-cyan-400 transition-colors focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* Feedback Messages */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-sm text-red-400 animate-fade-in">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2 text-sm text-green-400 animate-fade-in">
                <CheckCircle size={16} className="shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !!success}
              className={`w-full font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-white
                ${isLogin 
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-900/20' 
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/20'
                }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> {isLogin ? 'Verifying...' : 'Creating Account...'}
                </>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          {/* Toggle View */}
          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm mb-4">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button 
                onClick={() => handleSwitchView(isLogin ? 'signup' : 'login')}
                className={`ml-2 font-medium transition-colors ${isLogin ? 'text-cyan-400 hover:text-cyan-300' : 'text-purple-400 hover:text-purple-300'}`}
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
            
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase">or</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <button 
              onClick={handleGuestLogin}
              disabled={isLoading}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all text-sm font-medium"
            >
              <Compass size={18} />
              Explore as Guest
            </button>
          </div>
        </div>
      
      <p className="mt-8 text-center text-xs text-slate-600">
        Securely powered by LocalStorage (Mock) or Supabase (Live).
      </p>
    </div>
  </div>
);
};