"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Plus, Eye, Loader2, Filter, Receipt, 
  CheckCircle2, Clock, AlertCircle, TrendingUp
} from 'lucide-react';
import Navbar from '@/components/Navbar';

interface Claim {
  dbId: string;
  displayId: string;
  date: string;
  company: string;
  amount: number;
  status: string;
  purpose: string;
  department: string;
}

export default function ClaimsDashboard() {
  const supabase = createClient();
  const router = useRouter();
  
  // --- AUTH & PROFILE STATE ---
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // --- DATA STATES ---
  const [claimsList, setClaimsList] = useState<Claim[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [activeDepartment, setActiveDepartment] = useState('all');
  const [isDataLoading, setIsDataLoading] = useState(false);

  // 1. Initial Load: Auth & Master Data
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      // Fetch Profile & All Departments (for the switcher)
      const [profileRes, deptsRes] = await Promise.all([
        supabase.from('profiles').select('*, departments(name)').eq('id', session.user.id).maybeSingle(),
        supabase.from('departments').select('*').order('name')
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        // Initially set the switcher to their own department if they aren't a SuperAdmin
        if (profileRes.data.role !== 'superadmin' && profileRes.data.department_id) {
          setActiveDepartment(profileRes.data.department_id);
        }
      }
      
      if (deptsRes.data) {
        setDepartments([{ id: 'all', name: 'Agency OS (All)' }, ...deptsRes.data]);
      }

      setLoading(false);
    }
    init();
  }, [router, supabase]);

  // 2. Fetch Claims based on Active Department and User Role
  useEffect(() => {
    if (!user || !profile) return;

    const fetchClaims = async () => {
      setIsDataLoading(true);
      
      let query = supabase
        .from('claims')
        .select('*, companies(name), departments(name)')
        .order('created_at', { ascending: false });

      // --- PERMISSION & FILTER LOGIC ---
      if (profile.role === 'staff') {
        // Staff: Only see personal claims
        query = query.eq('user_id', user.id);
      } else if (profile.role === 'manager') {
        // Manager: Only see their department's claims
        query = query.eq('department_id', profile.department_id);
      } else {
        // HOD/SuperAdmin: Filter by the Switcher selection
        if (activeDepartment !== 'all') {
          query = query.eq('department_id', activeDepartment);
        }
      }
      
      const { data, error } = await query;
      
      if (data) {
        setClaimsList(data.map((c: any) => ({
          dbId: c.id,
          displayId: c.id.substring(0, 8).toUpperCase(),
          date: c.claim_date,
          company: c.companies?.name || 'Unknown Entity',
          amount: c.total_amount,
          status: c.status,
          purpose: c.purpose,
          department: c.departments?.name || 'Unassigned'
        })));
      }
      setIsDataLoading(false);
    };
    
    fetchClaims();
  }, [user, profile, activeDepartment, supabase]);

  const stats = {
    pending: claimsList.filter(c => c.status === 'Pending').length,
    approved: claimsList.filter(c => c.status === 'Approved' || c.status === 'Paid').length,
    totalAmount: claimsList.reduce((acc, curr) => acc + curr.amount, 0)
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <Navbar 
        showSwitcher={true}
        departments={departments}
        activeDepartment={activeDepartment}
        onDepartmentChange={setActiveDepartment}
      />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Expenses Dashboard
            </h1>
            <p className="text-slate-500 mt-1">
              {profile?.role === 'staff' ? 'Track and manage your personal claims.' : 'Monitor and approve department expenditures.'}
            </p>
          </div>
          
          <button 
            onClick={() => router.push('/claims/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Plus size={20} />
            New Claim
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pending Approval</p>
                <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
              </div>
           </div>
           
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Processed</p>
                <p className="text-2xl font-bold text-slate-900">{stats.approved}</p>
              </div>
           </div>

           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Value (View)</p>
                <p className="text-2xl font-bold text-slate-900">
                  <span className="text-sm text-slate-400 mr-1">MYR</span>
                  {stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
           </div>
        </div>

        {/* Expense Log Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest">
              <Receipt size={16} className="text-blue-600" />
              Expense Log
            </h2>
            {isDataLoading && <Loader2 className="animate-spin text-blue-600" size={18} />}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Entity / Department</th>
                  <th className="px-6 py-4 text-right">Amount (MYR)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claimsList.map((claim) => (
                  <tr 
                    key={claim.dbId} 
                    className="hover:bg-slate-50 transition-colors group cursor-pointer" 
                    onClick={() => router.push(`/claims/${claim.dbId}`)}
                  >
                    <td className="px-6 py-4 font-bold text-blue-600 group-hover:underline">
                      {claim.displayId}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{claim.date}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{claim.company}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                         {claim.department}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-right text-slate-900">
                      {claim.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        claim.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                        claim.status === 'Paid' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                        claim.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-300 group-hover:text-blue-600 transition-colors">
                        <Eye size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
                
                {claimsList.length === 0 && !isDataLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircle size={32} strokeWidth={1.5} />
                        <p className="italic">No expense claims found for this view.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}