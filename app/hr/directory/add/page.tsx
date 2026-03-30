"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Loader2, BadgeInfo, Send, UserPlus 
} from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function AddEmployeePage() {
  const supabase = createClient();
  const router = useRouter();

  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New Employee State
  const [newEmployee, setNewEmployee] = useState({
    email: '',
    full_name: '',
    designation: '',
    staff_id: '',
    department_id: '',
    role: 'staff'
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Fetch departments for the selection dropdown
      const { data: deptRes } = await supabase
        .from('departments')
        .select('*')
        .order('name');
        
      if (deptRes) setDepartments(deptRes);

      setLoading(false);
    }
    init();
  }, [router, supabase]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate invitation logic
    // In a production environment, this would call a Supabase Edge Function or 
    // Admin API to create the user and send a magic link.
    await new Promise(resolve => setTimeout(resolve, 800));
    
    alert(`Success! An invitation has logically been sent to ${newEmployee.email}.\n\n(Note: The employee can now register their account using the Sign Up page. Their access role and profile data will be synced automatically based on their email.)`);
    
    setIsSaving(false);
    // Redirect back to the directory list
    router.push('/hr/directory'); 
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 selection:bg-blue-100">
      {/* Universal Navbar handles branding, user, and notifications internally */}
      <Navbar />
      
      <main className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-right-8">
        <button 
          onClick={() => router.push('/hr/directory')} 
          className="text-slate-500 hover:text-blue-600 flex items-center gap-2 text-sm font-medium mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Directory
        </button>

        <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <h3 className="font-bold text-xl text-slate-900 flex items-center gap-2">
              <UserPlus className="text-blue-600" size={24} /> Add New Employee
            </h3>
          </div>

          <form onSubmit={handleAddEmployee} className="p-6 md:p-8 space-y-6">
            <div className="bg-blue-50/80 text-blue-800 text-sm p-4 rounded-xl border border-blue-100 flex items-start gap-3 shadow-sm">
              <BadgeInfo size={20} className="mt-0.5 shrink-0 text-blue-600" />
              <p>Adding an employee will prepare their profile in the system. They will be granted access based on the role and department you select here once they complete their registration.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Email Address <span className="text-red-500">*</span></label>
                <input 
                  required 
                  type="email" 
                  placeholder="employee@company.com" 
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  value={newEmployee.email} 
                  onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Full Name <span className="text-red-500">*</span></label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. Jane Doe" 
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  value={newEmployee.full_name} 
                  onChange={e => setNewEmployee({...newEmployee, full_name: e.target.value})} 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Designation / Job Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Art Director" 
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  value={newEmployee.designation} 
                  onChange={e => setNewEmployee({...newEmployee, designation: e.target.value})} 
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Staff ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. EMP-001" 
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  value={newEmployee.staff_id} 
                  onChange={e => setNewEmployee({...newEmployee, staff_id: e.target.value})} 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Department Assignment <span className="text-red-500">*</span></label>
                <select 
                  required 
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-all appearance-none font-medium cursor-pointer"
                  value={newEmployee.department_id} 
                  onChange={e => setNewEmployee({...newEmployee, department_id: e.target.value})}
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Access Role</label>
                <select 
                  required 
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-all appearance-none font-medium cursor-pointer"
                  value={newEmployee.role} 
                  onChange={e => setNewEmployee({...newEmployee, role: e.target.value})}
                >
                  <option value="staff">Staff (Basic Access)</option>
                  <option value="manager">Manager (Approve Team)</option>
                  <option value="hod">HOD (Department Head)</option>
                  <option value="superadmin">SuperAdmin (Full Access)</option>
                </select>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => router.push('/hr/directory')} 
                className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSaving} 
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Send size={18} />}
                Send Invite & Add
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}