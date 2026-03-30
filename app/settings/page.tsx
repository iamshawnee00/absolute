"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Building, LogOut, ArrowLeft, Loader2, Save, Image as ImageIcon, CheckCircle2, LayoutDashboard
} from 'lucide-react';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userRole, setUserRole] = useState('staff');
  
  // Settings State
  const [settings, setSettings] = useState({
    name: 'Agency OS',
    logo_url: ''
  });
  
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Check if user is SuperAdmin
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile) setUserRole(profile.role);
      
      if (profile?.role !== 'superadmin' && profile?.role !== 'hod') {
        alert("Access Denied: You must be an Administrator to access global settings.");
        router.push('/dashboard');
        return;
      }

      // Fetch Current Settings
      const { data: settingsData } = await supabase.from('agency_settings').select('*').eq('id', 1).maybeSingle();
      if (settingsData) {
        setSettings({ name: settingsData.name || 'Agency OS', logo_url: settingsData.logo_url || '' });
        setLogoPreview(settingsData.logo_url);
      }
      
      setLoading(false);
    }
    init();
  }, [router, supabase]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let finalLogoUrl = settings.logo_url;

      // 1. Upload new logo to storage if selected
      if (newLogoFile) {
        const fileExt = newLogoFile.name.split('.').pop();
        const filePath = `logo_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('branding').upload(filePath, newLogoFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('branding').getPublicUrl(filePath);
        finalLogoUrl = urlData.publicUrl;
      }

      // 2. Update Database
      const { error } = await supabase.from('agency_settings').upsert({
        id: 1,
        name: settings.name,
        logo_url: finalLogoUrl,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;
      
      alert("Settings saved successfully! The app branding has been updated.");
      setNewLogoFile(null); // Reset file input state
      
      // Force refresh to update navbars everywhere
      window.location.reload(); 
      
    } catch (err: any) {
      alert("Error saving settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 selection:bg-blue-100">
      
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="h-8 w-8 object-contain rounded" />
            ) : (
              <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-white p-2 rounded-xl"><Building size={20} /></div>
            )}
            <span className="font-bold text-lg tracking-tight text-slate-900">{settings.name}</span>
          </div>
          <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} className="text-slate-400 hover:text-red-600 flex items-center gap-1.5 p-2 rounded-lg hover:bg-red-50 transition-colors font-bold">
            <LogOut size={18} /> <span className="text-xs uppercase tracking-wider hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </nav>
      
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4">
        <button onClick={() => router.push('/dashboard')} className="text-slate-500 hover:text-blue-600 flex items-center gap-2 text-sm font-medium mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <LayoutDashboard className="text-blue-600" size={28} /> Global Settings
          </h1>
          <p className="text-slate-500 mt-2">Customize the basic view, overall feel, logo, and company name.</p>
        </div>

        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          
          <div className="p-6 md:p-8 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Company Profile & Branding</h2>
            
            <div className="space-y-8">
              {/* Company Name */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Official Company Name</label>
                <input 
                  type="text" required 
                  className="w-full max-w-md p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-lg font-medium"
                  value={settings.name} 
                  onChange={e => setSettings({...settings, name: e.target.value})} 
                />
                <p className="text-xs text-slate-500">This name will appear on the top navigation bar and reports.</p>
              </div>

              {/* Logo Upload */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">Company Logo</label>
                
                <div className="flex items-center gap-6">
                  <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Preview" className="h-full w-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="text-slate-400" size={32} />
                    )}
                  </div>
                  
                  <div>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/svg+xml" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleLogoChange}
                    />
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      Upload New Logo
                    </button>
                    <p className="text-xs text-slate-500 mt-2 max-w-xs">Recommended size: 256x256px. Transparent PNG or SVG works best.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 flex justify-end">
            <button 
              type="submit" 
              disabled={isSaving || (!newLogoFile && settings.name === 'Agency OS')} 
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}
              Save Branding Changes
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}