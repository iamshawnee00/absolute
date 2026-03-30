"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Plus, Eye, Loader2, Filter, Receipt, 
  CheckCircle2, Clock, AlertCircle, TrendingUp,
  Search, Calendar, Building2, User
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
  person: string;
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
  const [activeDepartment, setActiveDepartment] = useState('all'); // Global Switcher
  const [isDataLoading, setIsDataLoading] = useState(false);

  // --- MULTI-FILTER STATES ---
  const [filters, setFilters] = useState({
    person: '',
    department: '',
    date: '',
    status: ''
  });

  // 1. Initial Load: Auth & Master Data
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      // Fetch Profile & All Departments
      const [profileRes, deptsRes] = await Promise.all([
        supabase.from('profiles').select('*, departments(name)').eq('id', session.user.id).maybeSingle(),
        supabase.from('departments').select('*').order('name')
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
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
        .select('*') // Removed all joins to prevent {} foreign key errors
        .order('created_at', { ascending: false });

      // --- PERMISSION & VISIBILITY LOGIC ---
      const isFinance = profile.departments?.name?.toLowerCase() === 'finance';
      const hasWorkspaceSwitcher = profile.role === 'superadmin' || profile.role === 'hod';

      if (!hasWorkspaceSwitcher && !isFinance) {
        if (profile.role === 'staff') {
          query = query.eq('user_id', user.id);
        } else if (profile.role === 'manager') {
          query = query.eq('department_id', profile.department_id);
        }
      } else if (hasWorkspaceSwitcher && activeDepartment !== 'all') {
        query = query.eq('department_id', activeDepartment);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching claims:", error);
      } else if (data) {
        
        // Manually fetch names to bypass Supabase schema relationship errors
        const userIds = [...new Set(data.map((c: any) => c.user_id).filter(Boolean))];
        const companyIds = [...new Set(data.map((c: any) => c.company_id).filter(Boolean))];
        const deptIds = [...new Set(data.map((c: any) => c.department_id).filter(Boolean))];

        const [profilesRes, companiesRes, deptsRes] = await Promise.all([
          userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] }),
          companyIds.length ? supabase.from('companies').select('id, name').in('id', companyIds) : Promise.resolve({ data: [] }),
          deptIds.length ? supabase.from('departments').select('id, name').in('id', deptIds) : Promise.resolve({ data: [] })
        ]);

        let profileMap: Record<string, string> = {};
        profilesRes.data?.forEach((p: any) => profileMap[p.id] = p.full_name);

        let companyMap: Record<string, string> = {};
        companiesRes.data?.forEach((c: any) => companyMap[c.id] = c.name);

        let deptMap: Record<string, string> = {};
        deptsRes.data?.forEach((d: any) => deptMap[d.id] = d.name);

        setClaimsList(data.map((c: any) => ({
          dbId: c.id,
          displayId: c.id.substring(0, 8).toUpperCase(),
          date: c.claim_date,
          company: companyMap[c.company_id] || 'Unknown Entity',
          amount: c.total_amount,
          status: c.status,
          purpose: c.purpose,
          department: deptMap[c.department_id] || 'Unassigned',
          person: profileMap[c.user_id] || 'Unknown User'
        })));
      }
      setIsDataLoading(false);
    };
    
    fetchClaims();
  }, [user, profile, activeDepartment, supabase]);

  // --- APPLY LOCAL MULTI-FILTERS ---
  const filteredClaims = claimsList.filter(c => {
    if (filters.status && c.status !== filters.status) return false;
    if (filters.department && c.department !== filters.department) return false;
    if (filters.date && c.date !== filters.date) return false;
    if (filters.person && !c.person.toLowerCase().includes(filters.person.toLowerCase())) return false;
    return true;
  });

  const stats = {
    pending: filteredClaims.filter(c => c.status === 'Pending').length,
    reviewed: filteredClaims.filter(c => c.status === 'Reviewed').length,
    approved: filteredClaims.filter(c => c.status === 'Approved' || c.status === 'Paid').length,
    totalAmount: filteredClaims.reduce((acc, curr) => acc + curr.amount, 0)
  };

  const isFinance = profile?.departments?.name?.toLowerCase() === 'finance';

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <Navbar 
        showSwitcher={profile?.role === 'superadmin' || profile?.role === 'hod'}
        departments={departments}
        activeDepartment={activeDepartment}
        onDepartmentChange={setActiveDepartment}
      />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              Expenses Dashboard
              {isFinance && <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Finance Global View</span>}
            </h1>
            <p className="text-slate-500 mt-1">
              {profile?.role === 'staff' && !isFinance ? 'Track and manage your personal claims.' : 'Monitor, review, and approve expenditures.'}
            </p>
          </div>
          
          <button 
            onClick={() => router.push('/claims/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
          >
            <Plus size={20} />
            New Claim
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Clock size={20} /></div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Pending</p>
                <p className="text-xl font-bold text-slate-900">{stats.pending}</p>
              </div>
           </div>
           
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Eye size={20} /></div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Reviewed (Fin)</p>
                <p className="text-xl font-bold text-slate-900">{stats.reviewed}</p>
              </div>
           </div>

           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl"><CheckCircle2 size={20} /></div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Approved / Paid</p>
                <p className="text-xl font-bold text-slate-900">{stats.approved}</p>
              </div>
           </div>

           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={20} /></div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Filtered Value</p>
                <p className="text-xl font-bold text-slate-900">
                  <span className="text-xs text-slate-400 mr-1">MYR</span>
                  {stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
           </div>
        </div>

        {/* MULTI-FILTER BAR */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><User size={14}/> Person</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input 
                type="text" placeholder="Search name..." 
                className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm"
                value={filters.person} onChange={e => setFilters({...filters, person: e.target.value})}
              />
            </div>
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Building2 size={14}/> Department</label>
            <select 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm appearance-none"
              value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})}
            >
              <option value="">All Departments</option>
              {departments.filter(d => d.id !== 'all').map(d => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Filter size={14}/> Status</label>
            <select 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm appearance-none"
              value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Approved">Approved</option>
              <option value="Paid">Paid</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Calendar size={14}/> Exact Date</label>
            <input 
              type="date" 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm"
              value={filters.date} onChange={e => setFilters({...filters, date: e.target.value})}
            />
          </div>
          
          <button 
            onClick={() => setFilters({ person: '', department: '', date: '', status: '' })}
            className="p-2.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold transition-colors shrink-0"
            title="Clear Filters"
          >
            Clear
          </button>
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
                  <th className="px-6 py-4">ID & Date</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Entity / Department</th>
                  <th className="px-6 py-4 text-right">Amount (MYR)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClaims.map((claim) => (
                  <tr 
                    key={claim.dbId} 
                    className="hover:bg-slate-50 transition-colors group cursor-pointer" 
                    onClick={() => router.push(`/claims/${claim.dbId}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-blue-600 group-hover:underline">{claim.displayId}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{claim.date}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{claim.person}</td>
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
                        claim.status === 'Reviewed' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
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
                
                {filteredClaims.length === 0 && !isDataLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircle size={32} strokeWidth={1.5} />
                        <p className="italic">No expense claims match your filters.</p>
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