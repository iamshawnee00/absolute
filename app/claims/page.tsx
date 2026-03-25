"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Building, Plus, AlertCircle, Eye, Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ClaimsDashboard() {
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState('staff');
  const [authLoading, setAuthLoading] = useState(true);
  const [claimsList, setClaimsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
        
        // Fetch User Role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
          
        if (profile?.role) setUserRole(profile.role);
        setAuthLoading(false);
      }
    });
  }, [router, supabase]);

  useEffect(() => {
    if (!user) return;
    const fetchClaims = async () => {
      setIsLoading(true);
      
      // Bucket 2 Logic: Admins see all, Staff see only theirs
      let query = supabase
        .from('claims')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });
        
      if (userRole !== 'admin') {
        query = query.eq('user_id', user.id);
      }
      
      const { data } = await query;
      
      if (data) {
        setClaimsList(data.map((c: any) => ({
          id: c.id.substring(0, 8).toUpperCase(),
          dbId: c.id,
          date: c.claim_date,
          company: c.companies?.name || 'Unknown Entity',
          amount: c.total_amount,
          status: c.status
        })));
      }
      setIsLoading(false);
    };
    
    fetchClaims();
  }, [user, userRole, supabase]);

  if (authLoading || isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar user={user} role={userRole} onSignOut={() => { supabase.auth.signOut(); router.push('/login'); }} />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {userRole === 'admin' ? 'All Agency Claims' : 'My Claims'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">Manage and track expense reimbursements.</p>
          </div>
          <button 
            onClick={() => router.push('/claims/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-sm"
          >
            <Plus size={18} /> Submit New Claim
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Claim ID</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Entity</th>
                <th className="px-6 py-4 font-semibold text-right">Amount (MYR)</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claimsList.map((claim: any) => (
                <tr 
                  key={claim.id} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer group" 
                  onClick={() => router.push(`/claims/${claim.dbId}`)}
                >
                  <td className="px-6 py-4 font-medium text-blue-600 group-hover:underline">{claim.id}</td>
                  <td className="px-6 py-4 text-slate-600">{claim.date}</td>
                  <td className="px-6 py-4 text-slate-600">{claim.company}</td>
                  <td className="px-6 py-4 font-medium text-right">{Number(claim.amount).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      claim.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                      claim.status === 'Paid' ? 'bg-blue-100 text-blue-700' : 
                      claim.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      <AlertCircle size={14} /> {claim.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-blue-600 transition-colors"><Eye size={18} /></button>
                  </td>
                </tr>
              ))}
              {claimsList.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No claims found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function Navbar({ user, role, onSignOut }: any) {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 text-white p-2 rounded-lg"><Building size={20} /></div>
          <span className="font-bold text-lg tracking-tight">Agency OS</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
          <div className="hidden sm:flex items-center gap-3">
             {role === 'admin' && (
              <span className="bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                Admin
              </span>
            )}
            <span>{user?.email}</span>
          </div>
          <button onClick={onSignOut} className="text-slate-400 hover:text-red-500 flex items-center gap-1.5 p-2 rounded-md hover:bg-red-50">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}