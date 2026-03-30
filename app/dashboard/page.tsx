"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Receipt, Calendar, PieChart, Users, Settings, 
  FileSpreadsheet, MonitorPlay, Wallet, FileCheck, Loader2
} from 'lucide-react';
import Navbar from '@/components/Navbar';

interface Department {
  id: string;
  name: string;
}

// --- APP CONFIGURATION ---
const DEPARTMENT_APPS = {
  marketing: [
    { title: 'Expense Claims', icon: Receipt, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Submit and track marketing expenses' },
    { title: 'Content Calendar', icon: Calendar, href: '#', color: 'bg-fuchsia-50 text-fuchsia-600', desc: 'Manage social media scheduling' },
    { title: 'Campaign Analytics', icon: PieChart, href: '#', color: 'bg-purple-50 text-purple-600', desc: 'View ROAS and ad performance' },
    { title: 'Media Assets', icon: MonitorPlay, href: '#', color: 'bg-indigo-50 text-indigo-600', desc: 'Access approved creative files' },
  ],
  finance: [
    { title: 'Global Claims', icon: FileCheck, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Review and approve agency claims' },
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
  const [activeDepartment, setActiveDepartment] = useState('marketing');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      const [profileRes, deptsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase.from('departments').select('*').order('name')
      ]);

      const fetchedDepts = deptsRes.data || [];

      const currentProfile = profileRes.data || {
        role: 'staff',
        full_name: session.user.email?.split('@')[0] || 'Team',
        department_id: 'marketing'
      };

      const userDeptName = fetchedDepts.find(d => d.id === currentProfile.department_id)?.name;
      currentProfile.departments = { name: userDeptName || 'Agency OS' };

      setProfile(currentProfile);

      if (currentProfile.department_id) {
        setActiveDepartment(currentProfile.department_id);
      }
      
      if (fetchedDepts.length > 0) {
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

  if (!user) return null;
  if (!profile) return <div className="p-8 text-center text-red-500 font-bold mt-20">Failed to load profile. Please check database connectivity.</div>;

  // --- DYNAMIC APPS LOGIC (Handles the "All" Bird's-Eye View) ---
  let availableApps = [];
  
  if (activeDepartment === 'all') {
    // Combine ALL apps from all departments
    const allAppsRaw = Object.values(DEPARTMENT_APPS).flat();
    
    // Deduplicate overlapping apps (like standard Expense Claims) using a Map
    const uniqueApps = new Map();
    allAppsRaw.forEach(app => {
      // Use the href as the unique key, unless it's a placeholder '#', then use the title
      const key = app.href !== '#' && app.href !== '' ? app.href : app.title;
      if (!uniqueApps.has(key)) {
        uniqueApps.set(key, app);
      }
    });
    
    availableApps = Array.from(uniqueApps.values());
  } else {
    // Standard Dept View: Match active department ID to the config key
    const rawDeptName = departments.find(d => d.id === activeDepartment)?.name || '';
    const normalizedKey = rawDeptName.toLowerCase();
    availableApps = DEPARTMENT_APPS[normalizedKey as keyof typeof DEPARTMENT_APPS] || DEPARTMENT_APPS.default;
  }

  const activeDeptName = departments.find(d => d.id === activeDepartment)?.name || 'Unknown Department';
  const isSuperAdminOrHOD = profile.role === 'superadmin' || profile.role === 'hod';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      <Navbar 
        showSwitcher={isSuperAdminOrHOD}
        departments={departments}
        activeDepartment={activeDepartment}
        onDepartmentChange={setActiveDepartment}
      />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4">
        
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, {profile.full_name?.split(' ')[0] || 'Team'}
          </h1>
          <p className="text-slate-500 text-lg">
            {activeDepartment === 'all' 
              ? <span>You are viewing the <strong className="text-slate-700">Bird's-Eye View</strong>. Access tools across all departments.</span>
              : <span>Access your tools and applications for the <strong className="text-slate-700">{activeDeptName}</strong> workspace.</span>
            }
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {availableApps.map((app, index) => {
            const Icon = app.icon;
            return (
              <button
                key={index}
                onClick={() => router.push(app.href)}
                className="group flex flex-col items-start p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left h-full"
              >
                <div className={`p-4 rounded-xl mb-4 transition-transform group-hover:scale-110 ${app.color}`}>
                  <Icon size={28} strokeWidth={2} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {app.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mt-auto">
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