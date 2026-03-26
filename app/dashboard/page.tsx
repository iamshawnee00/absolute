"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Building, LogOut, ChevronDown, Check, 
  Receipt, Calendar, PieChart, Users, Settings, 
  FileSpreadsheet, MonitorPlay, Wallet, FileCheck, Loader2,
  Bell
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

// --- APP CONFIGURATION ---
// Here we define which "Apps" or "Functions" belong to which department.
const DEPARTMENT_APPS = {
  marketing: [
    { title: 'Expense Claims', icon: Receipt, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Submit and track marketing expenses' },
    { title: 'Content Calendar', icon: Calendar, href: '#', color: 'bg-fuchsia-50 text-fuchsia-600', desc: 'Manage social media scheduling' },
    { title: 'Campaign Analytics', icon: PieChart, href: '#', color: 'bg-purple-50 text-purple-600', desc: 'View ROAS and ad performance' },
    { title: 'Media Assets', icon: MonitorPlay, href: '#', color: 'bg-indigo-50 text-indigo-600', desc: 'Access approved creative files' },
  ],
  finance: [
    { title: 'Claim Verification', icon: FileCheck, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Review and approve agency claims' },
    { title: 'Invoices & Billing', icon: FileSpreadsheet, href: '#', color: 'bg-emerald-50 text-emerald-600', desc: 'Manage client billing' },
    { title: 'Payroll', icon: Wallet, href: '#', color: 'bg-amber-50 text-amber-600', desc: 'Process monthly payroll' },
  ],
  hr: [
    { title: 'Expense Claims', icon: Receipt, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Submit and track expenses' },
    { title: 'Employee Directory', icon: Users, href: '/hr/directory', color: 'bg-rose-50 text-rose-600', desc: 'Manage staff profiles' },
    { title: 'Leave Management', icon: Calendar, href: '#', color: 'bg-teal-50 text-teal-600', desc: 'Approve PTO and sick leave' },
  ],
  operations: [
    { title: 'Expense Claims', icon: Receipt, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Submit and track expenses' },
    { title: 'Asset Tracking', icon: Settings, href: '#', color: 'bg-slate-100 text-slate-600', desc: 'Manage laptops and equipment' },
  ],
  // Fallback for unassigned or newly created departments
  default: [
    { title: 'Expense Claims', icon: Receipt, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Submit and track expenses' },
  ]
};

export default function AppDashboard() {
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeDepartment, setActiveDepartment] = useState('marketing'); // Default fallback

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      // Fetch Profile & Departments safely (Removed the inner join to prevent silent Supabase errors)
      const [profileRes, deptsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase.from('departments').select('*').order('name')
      ]);

      if (profileRes.error) {
        console.error("Error fetching profile:", profileRes.error.message || profileRes.error);
      }

      const fetchedDepts = deptsRes.data || [];

      // If profile exists, use it. Otherwise, create a safe fallback to prevent blank screens
      const currentProfile = profileRes.data || {
        role: 'staff',
        full_name: session.user.email?.split('@')[0] || 'Team',
        department_id: 'marketing'
      };

      // Manually map the department name to bypass database join issues
      const userDeptName = fetchedDepts.find(d => d.id === currentProfile.department_id)?.name;
      currentProfile.departments = { name: userDeptName || 'Agency OS' };

      setProfile(currentProfile);

      // Set their active department to their home department initially
      if (currentProfile.department_id) {
        setActiveDepartment(currentProfile.department_id);
      }
      
      if (fetchedDepts.length > 0) {
        // We include "all" so SuperAdmins have a global workspace option
        setDepartments([{ id: 'all', name: 'Agency OS (All)' }, ...fetchedDepts]);
      }

      setAuthLoading(false);
    }
    init();
  }, [router, supabase]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  // Graceful error state instead of a blank null screen
  if (!user) return null;
  if (!profile) return <div className="p-8 text-center text-red-500 font-bold mt-20">Failed to load profile. Please check database connectivity.</div>;

  // Get the apps for the currently selected department in the switcher
  const availableApps = DEPARTMENT_APPS[activeDepartment as keyof typeof DEPARTMENT_APPS] || DEPARTMENT_APPS.default;
  const activeDeptName = departments.find(d => d.id === activeDepartment)?.name || 'Unknown Department';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar 
        user={user} 
        profile={profile} 
        departments={departments}
        activeDepartment={activeDepartment}
        onDepartmentChange={setActiveDepartment}
        onSignOut={() => { supabase.auth.signOut(); router.push('/login'); }} 
      />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Welcome Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, {profile.full_name?.split(' ')[0] || 'Team'}
          </h1>
          <p className="text-slate-500">
            Access your tools and applications for the <span className="font-bold text-slate-700">{activeDeptName}</span> workspace.
          </p>
        </div>

        {/* Apps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableApps.map((app, index) => {
            const Icon = app.icon;
            return (
              <button
                key={index}
                onClick={() => router.push(app.href)}
                className="group flex flex-col items-start p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left"
              >
                <div className={`p-4 rounded-xl mb-4 transition-transform group-hover:scale-110 ${app.color}`}>
                  <Icon size={28} strokeWidth={2} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {app.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {app.desc}
                </p>
              </button>
            )
          })}
        </div>

      </main>
    </div>
  );
}

// --- SHARED NAVBAR COMPONENT ---

function Navbar({ user, profile, departments, activeDepartment, onDepartmentChange, onSignOut }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const activeDeptName = departments?.find((d: any) => d.id === activeDepartment)?.name || 'Agency OS';
  
  // Only HOD and SuperAdmin can switch departments
  const canSwitch = profile?.role === 'hod' || profile?.role === 'superadmin';
  // Staff shouldn't see system notifications for role requests
  const canSeeNotifs = profile?.role !== 'staff';

  useEffect(() => {
    if (!canSeeNotifs) return;

    // Fetch initial unread notifications
    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Failed to load notifications:", error);
      } else if (data) {
        setNotifications(data);
      }
    };

    fetchNotifs();

    // Set up Realtime Subscription
    // This makes the notification pop up instantly when someone signs up!
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log("Realtime notification received!", payload);
          // Insert the new notification at the top of the list
          setNotifications((currentNotifs) => [payload.new, ...currentNotifs]);
        }
      )
      .subscribe();

    // Cleanup subscription when the component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [canSeeNotifs, supabase]);

  const handleMarkAsRead = async (notifId: string, targetUserId: string) => {
    // Optimistic UI update
    setNotifications(notifications.filter(n => n.id !== notifId));
    
    // Update DB
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    
    // Redirect to the HR Directory page with the target user ID!
    if (targetUserId) {
      router.push(`/hr/directory?editUser=${targetUserId}`);
    } else {
      router.push('/hr/directory');
    }
    
    setIsNotifOpen(false);
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 text-white p-2 rounded-lg shadow-sm flex items-center justify-center">
            <Building size={20} />
          </div>
          
          {/* Department Switcher */}
          <div className="relative ml-2">
            <button 
              disabled={!canSwitch}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
              className={`flex items-center gap-2 font-bold text-lg tracking-tight px-3 py-1.5 rounded-lg transition-colors text-slate-900 ${canSwitch ? 'hover:bg-slate-100' : 'cursor-default'}`}
            >
              {canSwitch ? activeDeptName : (profile?.departments?.name || 'Agency OS')}
              {canSwitch && (
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              )}
            </button>
            
            {isDropdownOpen && canSwitch && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-xl py-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">
                    Department Workspace
                  </div>
                  {departments?.map((dept: any) => (
                    <button 
                      key={dept.id}
                      onClick={() => { onDepartmentChange(dept.id); setIsDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center justify-between transition-colors"
                    >
                      <span className={activeDepartment === dept.id ? 'font-bold text-blue-600' : 'font-medium text-slate-700'}>
                        {dept.name}
                      </span>
                      {activeDepartment === dept.id && <Check size={16} className="text-blue-600" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
          
          {/* Notifications Dropdown */}
          {canSeeNotifs && (
            <div className="relative flex items-center">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>

              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsNotifOpen(false)}></div>
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 shadow-xl rounded-xl py-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-2 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 flex justify-between items-center">
                      Notifications
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px]">{notifications.length}</span>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-slate-400 text-sm">
                          You're all caught up!
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div key={notif.id} className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors">
                            <p className="text-sm text-slate-700 mb-2 leading-tight">{notif.message}</p>
                            <button 
                              onClick={() => handleMarkAsRead(notif.id, notif.user_id)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800"
                            >
                              Mark as Read & Manage
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          <div className="hidden md:flex flex-col items-end leading-tight">
             <div className="flex items-center gap-2">
               {profile?.role === 'superadmin' && (
                <span className="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  SuperAdmin
                </span>
               )}
               {profile?.role === 'hod' && (
                <span className="bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  HOD
                </span>
               )}
               {profile?.role === 'manager' && (
                <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Manager
                </span>
               )}
               <span className="text-slate-900 font-bold">{profile?.full_name || user?.email}</span>
             </div>
             <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{profile?.departments?.name || 'Agency OS'}</span>
          </div>
          
          <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>
          
          <button 
            onClick={onSignOut} 
            className="text-slate-400 hover:text-red-600 flex items-center gap-1.5 p-2 rounded-md hover:bg-red-50 transition-colors font-bold"
          >
            <LogOut size={18} /> 
            <span className="hidden sm:inline text-xs uppercase tracking-wider">Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}