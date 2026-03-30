"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Building, LogOut, ChevronDown, Check, Settings
} from 'lucide-react';
import NotificationBell from './NotificationBell';

interface NavbarProps {
  showSwitcher?: boolean;
  departments?: any[];
  activeDepartment?: string;
  onDepartmentChange?: (id: string) => void;
}

export default function Navbar({ 
  showSwitcher = false, 
  departments = [], 
  activeDepartment = '', 
  onDepartmentChange 
}: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [agencySettings, setAgencySettings] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    async function fetchNavData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);

      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*, departments(name)').eq('id', session.user.id).maybeSingle(),
        supabase.from('agency_settings').select('*').eq('id', 1).maybeSingle()
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (settingsRes.data) setAgencySettings(settingsRes.data);
    }
    fetchNavData();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const activeDeptName = departments?.find(d => d.id === activeDepartment)?.name || 'Agency OS';
  const canSwitch = profile?.role === 'hod' || profile?.role === 'superadmin';
  const canSeeSettings = profile && (profile.role === 'superadmin' || profile.role === 'hod');

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* LEFT SIDE: Branding & Switcher */}
        <div className="flex items-center gap-2">
          
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity mr-2" 
            onClick={() => router.push('/dashboard')}
          >
            {agencySettings?.logo_url ? (
              <img src={agencySettings.logo_url} alt="Company Logo" className="h-8 w-8 object-contain rounded" />
            ) : (
              <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-white p-2 rounded-xl shadow-sm">
                <Building size={20} />
              </div>
            )}
            <span className="font-bold text-lg tracking-tight text-slate-900 hidden sm:block">
              {agencySettings?.name || 'Agency OS'}
            </span>
          </div>
          
          {/* Department Switcher */}
          {showSwitcher && (
            <div className="relative border-l border-slate-200 pl-4">
              <button 
                disabled={!canSwitch}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                className={`flex items-center gap-2 font-bold text-sm sm:text-base tracking-tight px-3 py-1.5 rounded-lg transition-colors text-slate-900 ${canSwitch ? 'hover:bg-slate-100' : 'cursor-default'}`}
              >
                {activeDepartment === 'all' ? 'Agency OS (All)' : (canSwitch ? activeDeptName : (profile?.departments?.name || 'Agency OS'))}
                {canSwitch && <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />}
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
                        onClick={() => { onDepartmentChange && onDepartmentChange(dept.id); setIsDropdownOpen(false); }}
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
          )}
        </div>

        {/* RIGHT SIDE: Controls & Profile */}
        <div className="flex items-center gap-2 sm:gap-4 text-sm font-medium text-slate-600">
          
          {/* Global Settings Link */}
          {canSeeSettings && (
            <button 
              onClick={() => router.push('/settings')} 
              className="text-slate-500 hover:text-blue-600 flex items-center gap-1.5 p-2 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm tooltip"
              title="Global Settings"
            >
              <Settings size={18} /> <span className="hidden md:inline">Settings</span>
            </button>
          )}

          {/* NEW: Standalone Notification System! */}
          <NotificationBell />

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          {/* User Info */}
          <div className="hidden md:flex flex-col items-end leading-tight">
             <div className="flex items-center gap-2">
               {profile?.role === 'superadmin' && (
                <span className="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">SuperAdmin</span>
               )}
               {profile?.role === 'hod' && (
                <span className="bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">HOD</span>
               )}
               {profile?.role === 'manager' && (
                <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Manager</span>
               )}
               <span className="text-slate-900 font-bold">{profile?.full_name || user?.email?.split('@')[0]}</span>
             </div>
             <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{profile?.departments?.name || 'Agency OS'}</span>
          </div>
          
          <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>
          
          {/* Logout */}
          <button 
            onClick={handleSignOut} 
            className="text-slate-400 hover:text-red-600 flex items-center gap-1.5 p-2 rounded-md hover:bg-red-50 transition-colors font-bold"
          >
            <LogOut size={18} /> 
            <span className="hidden lg:inline text-xs uppercase tracking-wider">Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}