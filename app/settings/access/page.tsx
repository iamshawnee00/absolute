"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Loader2, ShieldCheck, User, Search, CheckCircle2, Save, AlertTriangle
} from 'lucide-react';
import Navbar from '@/components/Navbar';

// Pulling in your master app list to define toggleable features
const MASTER_APPS = [
  { key: 'claims', title: 'Expense Claims', module: 'Finance' },
  { key: 'calendar', title: 'Content Calendar', module: 'Marketing' },
  { key: 'analytics', title: 'Campaign Analytics', module: 'Marketing' },
  { key: 'assets', title: 'Media Assets', module: 'Marketing' },
  { key: 'billing', title: 'Invoices & Billing', module: 'Finance' },
  { key: 'payroll', title: 'Payroll', module: 'Finance' },
  { key: 'directory', title: 'Employee Directory', module: 'HR' },
  { key: 'leave', title: 'Leave Management', module: 'HR' },
  { key: 'tracking', title: 'Asset Tracking', module: 'Operations' },
];

export default function AccessMatrixPage() {
  const supabase = createClient();
  const router = useRouter();

  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [profiles, setProfiles] = useState<any[]>([]);
  const [accessMatrix, setAccessMatrix] = useState<Record<string, Record<string, boolean>>>({});
  
  // Track changes to show the "Save Changes" button state
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Check current user's role
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*, departments(name)')
        .eq('id', session.user.id)
        .single();
        
      if (!userProfile || !['superadmin', 'hod', 'manager'].includes(userProfile.role)) {
        alert("Access Denied: You do not have permission to view the Access Matrix.");
        router.push('/dashboard');
        return;
      }
      
      setCurrentUserProfile(userProfile);

      // Fetch Profiles based on role
      // SuperAdmins & HODs see everyone. Managers see only their department.
      let query = supabase.from('profiles').select('*, departments(name)').order('full_name');
      if (userProfile.role === 'manager') {
        query = query.eq('department_id', userProfile.department_id);
      }
      
      const { data: profilesData } = await query;
      if (profilesData) setProfiles(profilesData);

      // Fetch existing access overrides
      const { data: accessData } = await supabase.from('user_app_access').select('*');
      
      // Build the matrix state. Default to TRUE (enabled) for everything unless explicitly set to false in DB.
      const initialMatrix: Record<string, Record<string, boolean>> = {};
      
      if (profilesData) {
        profilesData.forEach(p => {
          initialMatrix[p.id] = {};
          MASTER_APPS.forEach(app => {
            // Find if there's an explicit rule in DB
            const dbRule = accessData?.find(a => a.user_id === p.id && a.app_key === app.key);
            initialMatrix[p.id][app.key] = dbRule ? dbRule.is_enabled : true;
          });
        });
      }
      
      setAccessMatrix(initialMatrix);
      setLoading(false);
    }
    
    fetchData();
  }, [router, supabase]);

  const handleToggle = (userId: string, appKey: string) => {
    setAccessMatrix(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [appKey]: !prev[userId][appKey]
      }
    }));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    
    try {
      const updates = [];
      
      // Convert matrix object into a flat array for upserting
      for (const userId of Object.keys(accessMatrix)) {
        for (const appKey of Object.keys(accessMatrix[userId])) {
          updates.push({
            user_id: userId,
            app_key: appKey,
            is_enabled: accessMatrix[userId][appKey],
            updated_by: currentUserProfile.id
          });
        }
      }

      const { error } = await supabase
        .from('user_app_access')
        .upsert(updates, { onConflict: 'user_id, app_key' });

      if (error) throw error;
      
      alert("Success! Access permissions have been updated.");
      setHasChanges(false);
    } catch (err: any) {
      alert("Error saving permissions: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 selection:bg-blue-100">
      <Navbar />
      
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <button onClick={() => router.push('/dashboard')} className="text-slate-500 hover:text-blue-600 flex items-center gap-2 text-sm font-medium mb-4 transition-colors">
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3 tracking-tight">
              <ShieldCheck className="text-blue-600" size={32} /> Granular Access Matrix
            </h1>
            <p className="text-slate-500 mt-2">
              Toggle specific tools and applications for individual employees. 
              {currentUserProfile?.role === 'manager' && " (Restricted to your department)"}
            </p>
          </div>
          
          <button 
            onClick={handleSaveChanges}
            disabled={!hasChanges || isSaving}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Save Permissions
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex gap-3 mb-6">
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <div className="text-sm font-medium">
            <p><strong>Note:</strong> SuperAdmins cannot have their access restricted. Changes made here to SuperAdmins will be ignored by the system.</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-t-2xl border border-slate-200 border-b-0 shadow-sm flex items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search employee name or email..." 
              className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* The Matrix Table */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-b-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-700 sticky left-0 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10 w-64">
                  Employee
                </th>
                {MASTER_APPS.map(app => (
                  <th key={app.key} className="px-4 py-4 min-w-[140px] text-center">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{app.module}</div>
                    <div className="font-semibold text-slate-800">{app.title}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProfiles.map((p) => {
                const isImmune = p.role === 'superadmin';
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* User Info Column */}
                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50/50 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                          {p.full_name?.charAt(0).toUpperCase() || <User size={14}/>}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{p.full_name}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate mt-0.5">
                            {p.departments?.name} • <span className={`${
                              p.role === 'superadmin' ? 'text-purple-600' :
                              p.role === 'hod' ? 'text-blue-600' :
                              p.role === 'manager' ? 'text-amber-600' : ''
                            }`}>{p.role}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* App Checkboxes */}
                    {MASTER_APPS.map(app => {
                      const isEnabled = accessMatrix[p.id]?.[app.key] ?? true;
                      return (
                        <td key={app.key} className="px-4 py-4 text-center border-r border-slate-50 last:border-0">
                          <label className={`inline-flex items-center justify-center cursor-pointer ${isImmune ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <div className="relative">
                              <input 
                                type="checkbox" 
                                className="sr-only"
                                checked={isEnabled}
                                disabled={isImmune}
                                onChange={() => handleToggle(p.id, app.key)}
                              />
                              <div className={`block w-10 h-6 rounded-full transition-colors ${isEnabled ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
                              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isEnabled ? 'translate-x-4' : ''}`}></div>
                            </div>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              
              {filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={MASTER_APPS.length + 1} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No employees found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
      </main>
    </div>
  );
}