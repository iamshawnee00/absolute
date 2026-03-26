"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Building, LogOut, ArrowLeft, Search, Plus, 
  Edit, Trash2, ShieldAlert, Loader2, X, BadgeInfo,
  CheckCircle2, User
} from 'lucide-react';

// Wrapper to handle Next.js useSearchParams properly
export default function DirectoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}>
      <EmployeeDirectory />
    </Suspense>
  );
}

function EmployeeDirectory() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetEditUserId = searchParams.get('editUser');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [targetEditUserId]); // Re-run if the URL param changes

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    setCurrentUser(session.user);

    // Fetch all profiles and departments
    const [profilesRes, deptsRes] = await Promise.all([
      supabase.from('profiles').select('*, departments(name)').order('created_at', { ascending: false }),
      supabase.from('departments').select('*').order('name')
    ]);

    if (deptsRes.data) setDepartments(deptsRes.data);
    
    if (profilesRes.data) {
      setProfiles(profilesRes.data);
      
      // AUTO-OPEN MODAL LOGIC:
      // If we came from a notification, find that user and open the modal instantly
      if (targetEditUserId) {
        const userToEdit = profilesRes.data.find(p => p.id === targetEditUserId);
        if (userToEdit) {
          setEditingProfile(userToEdit);
          // Clean up the URL so refreshing doesn't keep popping it open
          window.history.replaceState(null, '', '/hr/directory'); 
        }
      }
    }
    setLoading(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editingProfile.full_name,
        designation: editingProfile.designation, // <-- Added Designation
        staff_id: editingProfile.staff_id,
        role: editingProfile.role,
        department_id: editingProfile.department_id
      })
      .eq('id', editingProfile.id);

    if (error) {
      alert("Error updating profile: " + error.message);
    } else {
      // Refresh the list locally to show updates immediately
      setProfiles(profiles.map(p => p.id === editingProfile.id ? { 
        ...editingProfile, 
        departments: { name: departments.find(d => d.id === editingProfile.department_id)?.name } 
      } : p));
      setEditingProfile(null);
    }
    setIsSaving(false);
  };

  const handleDeleteProfile = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}? This will revoke their app access.`)) return;
    
    // Note: This deletes the profile row. (Deleting auth.users requires backend admin rights).
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      alert("Error deleting profile: " + error.message);
    } else {
      setProfiles(profiles.filter(p => p.id !== id));
    }
  };

  // Filter list based on search bar (now includes designation)
  const filteredProfiles = profiles.filter(p => 
    (p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.staff_id?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.designation?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <Navbar onSignOut={() => { supabase.auth.signOut(); router.push('/login'); }} />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-right-8">
        <button onClick={() => router.push('/dashboard')} className="text-slate-500 hover:text-blue-600 flex items-center gap-2 text-sm font-medium mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Employee Directory</h1>
            <p className="text-slate-500 mt-1">Manage staff profiles, roles, and access permissions.</p>
          </div>
          <button className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm">
            <Plus size={18} /> Add Employee
          </button>
        </div>

        {/* CONTROLS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, email, job title, or staff ID..." 
              className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* DIRECTORY TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Staff ID</th>
                  <th className="px-6 py-4">Department & Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                          {p.full_name?.charAt(0).toUpperCase() || <User size={18}/>}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{p.full_name || 'Unnamed User'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {p.designation ? (
                        <span className="font-semibold text-slate-700">{p.designation}</span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {p.staff_id ? (
                        <span className="font-medium text-slate-700">{p.staff_id}</span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{p.departments?.name || 'No Dept'}</div>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          p.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                          p.role === 'hod' ? 'bg-blue-100 text-blue-700' :
                          p.role === 'manager' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {p.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingProfile({...p})} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors tooltip" title="Edit User">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDeleteProfile(p.id, p.full_name)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors tooltip" title="Revoke Access">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProfiles.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* EDIT MODAL OVERLAY */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <ShieldAlert className="text-blue-600" size={20} /> Manage Employee Access
              </h3>
              <button onClick={() => setEditingProfile(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                <BadgeInfo size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <p>Editing profile for <strong>{editingProfile.email}</strong>. Assigning HOD or Manager roles grants them access to approve claims for their selected department.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Full Name</label>
                  <input required type="text" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                    value={editingProfile.full_name || ''} onChange={e => setEditingProfile({...editingProfile, full_name: e.target.value})} />
                </div>

                {/* NEW FIELD: DESIGNATION */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Designation / Job Title</label>
                  <input type="text" placeholder="e.g. Graphic Designer" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                    value={editingProfile.designation || ''} onChange={e => setEditingProfile({...editingProfile, designation: e.target.value})} />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Staff ID</label>
                  <input type="text" placeholder="e.g. EMP-001" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                    value={editingProfile.staff_id || ''} onChange={e => setEditingProfile({...editingProfile, staff_id: e.target.value})} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Department Assignment</label>
                  <select required className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
                    value={editingProfile.department_id || ''} onChange={e => setEditingProfile({...editingProfile, department_id: e.target.value})}>
                    <option value="" disabled>Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Access Role</label>
                  <select required className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
                    value={editingProfile.role || 'staff'} onChange={e => setEditingProfile({...editingProfile, role: e.target.value})}>
                    <option value="staff">Staff (Basic Access)</option>
                    <option value="manager">Manager (Approve Team)</option>
                    <option value="hod">HOD (Department Head)</option>
                    <option value="superadmin">SuperAdmin (God Mode)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingProfile(null)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70">
                  {isSaving ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple stripped down Navbar just for the directory
function Navbar({ onSignOut }: any) {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 text-white p-2 rounded-lg"><Building size={20} /></div>
          <span className="font-bold text-lg tracking-tight">Agency OS</span>
        </div>
        <button onClick={onSignOut} className="text-slate-400 hover:text-red-600 flex items-center gap-1.5 p-2 rounded-md hover:bg-red-50 transition-colors font-bold">
          <LogOut size={18} /> <span className="text-xs uppercase tracking-wider">Sign Out</span>
        </button>
      </div>
    </nav>
  );
}