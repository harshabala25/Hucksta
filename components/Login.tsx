
import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSupabaseConfigured) {
      setError("Marketplace configuration missing.");
      return;
    }

    setIsLoading(true);
    setError(null);

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });
      if (signUpError) setError(signUpError.message);
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) setError(authError.message);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="h-full bg-white flex flex-col px-8 py-16 animate-in fade-in duration-500 relative overflow-hidden">
      <div className="flex flex-col items-center justify-center mt-12 mb-10 text-center">
        <h1 className="text-6xl font-black text-[#FF8C42] tracking-tighter mb-8">
          Hucksta
        </h1>
        <div className="space-y-1">
          <h2 className="text-[#FF8C42] text-xl font-bold tracking-tight">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-[#FFB380] text-sm font-medium">Built for the UTD Community</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          {isSignUp && (
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              required
              className="w-full h-14 px-6 bg-gray-50 rounded-xl text-gray-800 border border-gray-100 outline-none focus:bg-white focus:ring-2 focus:ring-orange-200 transition-all placeholder-gray-300"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full h-14 px-6 bg-gray-50 rounded-xl text-gray-800 border border-gray-100 outline-none focus:bg-white focus:ring-2 focus:ring-orange-200 transition-all placeholder-gray-300"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full h-14 px-6 bg-gray-50 rounded-xl text-gray-800 border border-gray-100 outline-none focus:bg-white focus:ring-2 focus:ring-orange-200 transition-all placeholder-gray-300"
          />
        </div>
        
        {error && <p className="text-xs text-red-500 px-1 font-medium">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-14 bg-[#FF8C42] text-white font-bold rounded-xl active:scale-[0.98] transition-all hover:bg-[#e67a35] shadow-lg shadow-orange-100 disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : isSignUp ? 'Create Account' : 'Continue'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-xs font-bold text-orange-600 hover:underline"
        >
          {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </div>

      <div className="mt-auto mb-4 text-center">
        <p className="text-[11px] text-gray-400 leading-relaxed max-w-[280px] mx-auto">
          Secure campus marketplace for Comets
        </p>
      </div>
    </div>
  );
};

export default Login;
