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
// Added 'key' to perfectly match your MASTER_APPS from the Access Settings Matrix
const DEPARTMENT_APPS = {
  marketing: [
    { key: 'claims', title: 'Expense Claims', icon: Receipt, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Submit and track marketing expenses' },
    { key: 'calendar', title: 'Content Calendar', icon: Calendar, href: '#', color: 'bg-fuchsia-50 text-fuchsia-600', desc: 'Manage social media scheduling' },
    { key: 'analytics', title: 'Campaign Analytics', icon: PieChart, href: '#', color: 'bg-purple-50 text-purple-600', desc: 'View ROAS and ad performance' },
    { key: 'assets', title: 'Media Assets', icon: MonitorPlay, href: '#', color: 'bg-indigo-50 text-indigo-600', desc: 'Access approved creative files' },
  ],
  finance: [
    { key: 'claims', title: 'Global Claims', icon: FileCheck, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Review and approve agency claims' },
    { key: 'billing', title: 'Invoices & Billing', icon: FileSpreadsheet, href: '#', color: 'bg-emerald-50 text-emerald-600', desc: 'Manage client billing' },
    { key: 'payroll', title: 'Payroll', icon: Wallet, href: '#', color: 'bg-amber-50 text-amber-600', desc: 'Process monthly payroll' },
  ],
  hr: [
    { key: 'claims', title: 'Expense Claims', icon: Receipt, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Submit and track expenses' },
    { key: 'directory', title: 'Employee Directory', icon: Users, href: '/hr/directory', color: 'bg-rose-50 text-rose-600', desc: 'Manage staff profiles' },
    { key: 'leave', title: 'Leave Management', icon: Calendar, href: '#', color: 'bg-teal-50 text-teal-600', desc: 'Approve PTO and sick leave' },
  ],
  operations: [
    { key: 'claims', title: 'Expense Claims', icon: Receipt, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Submit and track expenses' },
    { key: 'tracking', title: 'Asset Tracking', icon: Settings, href: '#', color: 'bg-slate-100 text-slate-600', desc: 'Manage laptops and equipment' },
  ],
  default: [
    { key: 'claims', title: 'Expense Claims', icon: Receipt, href: '/claims', color: 'bg-blue-50 text-blue-600', desc: 'Submit and track expenses' },
  ]
};

// Helper function to map Database names to Configuration keys robustly
const getDeptKey = (deptName: string) => {
  const name = deptName.toLowerCase();
  if (name.includes('human resources') || name === 'hr') return 'hr';
  if (name.includes('marketing')) return 'marketing';
  if (name.includes('finance')) return 'finance';
  if (name.includes('operations')) return 'operations';
  return 'default'; 
};

export default function AppDashboard() {
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeDepartment, setActiveDepartment] = useState('marketing');
  
  // NEW: State to hold the granular access matrix rules for the logged-in user
  const [appAccess, setAppAccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      // Fetch Profile, Departments, AND the Access Matrix rules simultaneously
      const [profileRes, deptsRes, accessRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase.from('departments').select('*').order('name'),
        supabase.from('user_app_access').select('*').eq('user_id', session.user.id)
      ]);

      const fetchedDepts = deptsRes.data || [];
      const currentProfile = profileRes.data;
      
      if (currentProfile) {
        const userDeptName = fetchedDepts.find(d => d.id === currentProfile.department_id)?.name;
        currentProfile.departments = { name: userDeptName || 'Agency OS' };
        setProfile(currentProfile);
      }

      setDepartments(fetchedDepts);

      // Map the access rules into a clean object: { "claims": true, "assets": false }
      const accessMap: Record<string, boolean> = {};
      if (accessRes.data) {
        accessRes.data.forEach((rule: any) => {
          accessMap[rule.app_key] = rule.is_enabled;
        });
      }
      setAppAccess(accessMap);

      setAuthLoading(false);
    }
    init();
  }, [router, supabase]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  if (!user || !profile) return <div className="p-8 text-center text-red-500 font-bold mt-20">Failed to load profile. Please check database connectivity.</div>;

  // --- 1. PROCESS GRANULAR ACCESS RULES ---
  let allowedDeptIds = new Set<string>();
  let allAllowedApps = new Map(); 
  const isSuperAdmin = profile.role === 'superadmin';

  departments.forEach(dept => {
    const deptKey = getDeptKey(dept.name);
    const appsInDept = DEPARTMENT_APPS[deptKey as keyof typeof DEPARTMENT_APPS] || DEPARTMENT_APPS.default;

    let hasAtLeastOneApp = false;

    appsInDept.forEach(app => {
      let isEnabled = false;
      
      if (isSuperAdmin) {
        isEnabled = true; // SuperAdmins are immune to restrictions
      } else if (appAccess[app.key] !== undefined) {
        isEnabled = appAccess[app.key]; // Explicit Override from Matrix
      } else {
        isEnabled = profile.department_id === dept.id; // Default: Only see home dept
      }

      if (isEnabled) {
        hasAtLeastOneApp = true;
        // Deduplicate apps for the "Agency OS (All)" view
        const uniqueKey = app.href !== '#' && app.href !== '' ? app.href : app.title;
        if (!allAllowedApps.has(uniqueKey)) {
          allAllowedApps.set(uniqueKey, app);
        }
      }
    });

    // If they have access to at least ONE app in this department, unlock the department!
    if (hasAtLeastOneApp || isSuperAdmin) {
      allowedDeptIds.add(dept.id);
    }
  });

  // 2. Add 'All' view for power users OR anyone with cross-department access
  if (profile.role === 'hod' || profile.role === 'superadmin' || allowedDeptIds.size > 1) {
    allowedDeptIds.add('all');
  }

  // 3. Build the final array of allowed departments for the Navbar switcher
  const filteredDepartments = departments.filter(d => allowedDeptIds.has(d.id));
  if (allowedDeptIds.has('all')) {
    filteredDepartments.unshift({ id: 'all', name: 'Agency OS (All)' });
  }

  // Auto-correct active department if they are routed to a locked one
  if (allowedDeptIds.size > 0 && !allowedDeptIds.has(activeDepartment)) {
      if (allowedDeptIds.has(profile.department_id)) setActiveDepartment(profile.department_id);
      else if (allowedDeptIds.has('all')) setActiveDepartment('all');
      else setActiveDepartment(Array.from(allowedDeptIds)[0] as string);
  }

  // 4. Filter the specific grid apps based on the currently selected tab
  let gridApps: any[] = [];
  if (activeDepartment === 'all') {
    gridApps = Array.from(allAllowedApps.values());
  } else {
    const rawDeptName = departments.find(d => d.id === activeDepartment)?.name || '';
    const deptKey = getDeptKey(rawDeptName);
    const appsInActiveDept = DEPARTMENT_APPS[deptKey as keyof typeof DEPARTMENT_APPS] || DEPARTMENT_APPS.default;
    
    gridApps = appsInActiveDept.filter(app => {
      if (isSuperAdmin) return true;
      if (appAccess[app.key] !== undefined) return appAccess[app.key];
      return profile.department_id === activeDepartment;
    });
  }

  const activeDeptName = filteredDepartments.find(d => d.id === activeDepartment)?.name || 'Unknown Department';
  const showSwitcher = filteredDepartments.length > 1;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      <Navbar 
        showSwitcher={showSwitcher}
        departments={filteredDepartments}
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
              ? <span>You are viewing the <strong className="text-slate-700">Bird's-Eye View</strong>. Access tools across all authorized departments.</span>
              : <span>Access your tools and applications for the <strong className="text-slate-700">{activeDeptName}</strong> workspace.</span>
            }
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {gridApps.map((app, index) => {
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