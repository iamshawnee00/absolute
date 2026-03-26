"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Building, AlertCircle, Mail, Lock, Loader2, User, Briefcase, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  
  // Data & Status States
  const [departments, setDepartments] = useState<any[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // If user is already logged in, redirect them to the dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      }
    });

    // Fetch departments for the Sign Up dropdown
    const fetchDepartments = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('departments')
          .select('*')
          .order('name');
        
        if (fetchError) {
          console.error("Supabase Error fetching departments:", fetchError);
        } else if (data) {
          setDepartments(data);
        }
      } catch (err) {
        console.error("Critical error fetching departments:", err);
      } finally {
        setIsInitialLoad(false);
      }
    };

    fetchDepartments();
  }, [router, supabase]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // --- LOG IN FLOW ---
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push('/dashboard'); 
      } else {
        // --- SIGN UP FLOW ---
        if (!fullName || !departmentId) {
          throw new Error("Please fill in your full name and select a department.");
        }

        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        if (data.user) {
          // 1. Create the Profile
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            email: email,
            full_name: fullName,
            department_id: departmentId,
            role: 'staff' 
          });
          
          if (profileError) throw profileError;

          // 2. Notify HOD/Admin regarding role assignment
          const selectedDept = departments.find(d => d.id === departmentId)?.name || 'Unknown Department';
          await supabase.from('notifications').insert({
            type: 'role_request',
            user_id: data.user.id,
            message: `New user registration: ${fullName} (${email}) has joined the ${selectedDept} department and requires role assignment.`,
            is_read: false
          });
        }

        alert('Account successfully created! Please check your email for a confirmation link (if enabled) or sign in now.');
        setIsLogin(true); 
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-900">
      <div className="mb-8 flex items-center gap-2">
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-sm">
          <Building size={28} />
        </div>
        <span className="font-bold text-2xl tracking-tight text-slate-900">Agency OS</span>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 animate-in fade-in zoom-in-95 duration-300">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h2>
        
        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2 border border-red-100">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> 
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          
          {!isLogin && (
            <>
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-semibold text-slate-700">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User size={18} />
                  </div>
                  <input 
                    type="text" required placeholder="Your Full Name"
                    className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900"
                    value={fullName} onChange={e => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-semibold text-slate-700">Department</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Briefcase size={18} />
                  </div>
                  <select 
                    required 
                    className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 appearance-none disabled:bg-slate-100"
                    value={departmentId} 
                    onChange={e => setDepartmentId(e.target.value)}
                    disabled={isInitialLoad}
                  >
                    {isInitialLoad ? (
                      <option value="" disabled>Loading departments...</option>
                    ) : departments.length === 0 ? (
                      <option value="" disabled>No departments available</option>
                    ) : (
                      <option value="" disabled>Select your department...</option>
                    )}
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail size={18} />
              </div>
              <input 
                type="email" required placeholder="you@agency.com"
                className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input 
                type="password" required placeholder="••••••••"
                className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {!isLogin && (
            <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-100 flex items-start gap-2 mt-4">
              <Info size={14} className="mt-0.5 shrink-0 text-blue-600" />
              <p>Your account will be created with basic <strong>Staff</strong> permissions. Your HOD will be notified to assign your access role.</p>
            </div>
          )}

          <button 
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white py-3 rounded-lg font-bold transition-colors shadow-sm flex items-center justify-center gap-2 mt-6"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
            className="font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}