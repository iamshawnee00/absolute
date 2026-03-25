"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Building, LogOut, ArrowLeft, FileText, Plus, 
  Trash2, CheckCircle2, Image as ImageIcon, X, Upload, ChevronRight, Loader2, File as FileIcon 
} from 'lucide-react';

export default function NewClaimPage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState('staff');
  const [companies, setCompanies] = useState<any[]>([]);
  const [formData, setFormData] = useState({ companyId: '', purpose: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [items, setItems] = useState(
    Array.from({ length: 5 }).map((_, i) => ({
      id: Date.now() + i, date: '', receiptNo: '', vendor: '', remarks: '', amount: '', 
      isForeign: false, originalCurrency: 'USD', originalAmount: '', 
      receiptFile: null as any, conversionFile: null as any
    }))
  );
  const [activeModalItemId, setActiveModalItemId] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) router.push('/login');
      else {
        setUser(session.user);
        
        // Fetch User Role
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile?.role) setUserRole(profile.role);
        
        supabase.from('companies').select('*').then(({ data }) => setCompanies(data || []));
      }
    });
  }, [router, supabase]);

  const calculateTotal = () => items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const addItem = () => setItems([...items, { id: Date.now(), date: '', receiptNo: '', vendor: '', remarks: '', amount: '', isForeign: false, originalCurrency: 'USD', originalAmount: '', receiptFile: null, conversionFile: null }]);
  const updateItem = (id: number, field: string, value: any) => setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  const removeItem = (id: number) => { if (items.length > 1) setItems(items.filter(item => item.id !== id)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyId || !formData.purpose) { alert("Fill in header details."); return; }
    
    const validItems = items.filter(item => item.amount || item.vendor || item.receiptNo || item.receiptFile);
    if (validItems.length === 0) { alert("Enter at least one expense."); return; }

    setIsSubmitting(true);
    try {
      // 0. Defensive Profile Check
      // Ensure the user has a profile record, otherwise the foreign key constraint on claims.user_id will fail
      const { data: profileCheck } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
      if (!profileCheck) {
        const { error: profileError } = await supabase.from('profiles').insert({ 
          id: user.id, 
          email: user.email, 
          role: 'staff' 
        });
        if (profileError) console.error("Profile creation error:", profileError);
      }

      // 1. Insert Header
      const { data: claimData, error: claimError } = await supabase.from('claims').insert({
        user_id: user.id, company_id: formData.companyId, claim_date: new Date().toISOString().split('T')[0],
        purpose: formData.purpose, status: 'Pending', total_amount: calculateTotal()
      }).select().single();

      if (claimError) throw claimError;

      // 2. Insert Items & Upload Files
      for (const item of validItems) {
        const { data: itemData, error: itemError } = await supabase.from('claim_items').insert({
          claim_id: claimData.id, expense_date: item.date || new Date().toISOString().split('T')[0],
          receipt_no: item.receiptNo, vendor_name: item.vendor, remarks: item.remarks,
          is_foreign_currency: item.isForeign, original_currency: item.originalCurrency,
          original_amount: item.originalAmount ? parseFloat(item.originalAmount) : null,
          claim_currency: 'MYR', claim_amount: parseFloat(item.amount) || 0
        }).select().single();

        if (itemError) throw itemError;

        const uploadFile = async (file: File, fileType: string) => {
          if (!file) return;
          const fileExt = file.name.split('.').pop();
          const filePath = `${user.id}/${claimData.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
          await supabase.from('receipts').insert({ claim_item_id: itemData.id, file_url: urlData.publicUrl, file_type: fileType });
        };

        if (item.receiptFile) await uploadFile(item.receiptFile, 'Original');
        if (item.conversionFile) await uploadFile(item.conversionFile, 'Conversion Proof');
      }
      
      router.push('/claims'); // Success! Redirect to dashboard.
    } catch (error: any) {
      alert(`Submission failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeModalItem = items.find(i => i.id === activeModalItemId);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Navbar user={user} role={userRole} onSignOut={() => { supabase.auth.signOut(); router.push('/login'); }} />
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-right-8">
        
        <button onClick={() => router.push('/claims')} className="text-slate-500 hover:text-slate-900 flex items-center gap-2 text-sm font-medium mb-6">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* HEADER */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Billing Entity *</label>
                <select required className="w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium"
                  value={formData.companyId} onChange={e => setFormData({...formData, companyId: e.target.value})}>
                  <option value="" disabled>Select Entity...</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Claim Purpose *</label>
                <input required type="text" placeholder="e.g., Meta Ads March 2026" className="w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                  value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} />
              </div>
            </div>
          </div>

          {/* GRID */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800">Expense Line Items</h2>
              <button type="button" onClick={addItem} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"><Plus size={16} /> Add Row</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white text-xs uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-36 border-r border-slate-100">Date</th>
                    <th className="p-3 w-40 border-r border-slate-100">Receipt No</th>
                    <th className="p-3 w-48 border-r border-slate-100">Vendor</th>
                    <th className="p-3 min-w-[150px] border-r border-slate-100">Remarks</th>
                    <th className="p-3 w-36 border-r border-slate-100">Amount (MYR)</th>
                    <th className="p-3 w-28 text-center border-r border-slate-100">Receipt</th>
                    <th className="p-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 group">
                      <td className="p-0 border-r border-slate-100"><input type="date" className="w-full p-3 bg-transparent outline-none text-sm text-slate-900 font-medium placeholder:text-slate-400" value={item.date} onChange={e => updateItem(item.id, 'date', e.target.value)} /></td>
                      <td className="p-0 border-r border-slate-100"><input type="text" placeholder="INV-001" className="w-full p-3 bg-transparent outline-none text-sm text-slate-900 font-medium placeholder:text-slate-400" value={item.receiptNo} onChange={e => updateItem(item.id, 'receiptNo', e.target.value)} /></td>
                      <td className="p-0 border-r border-slate-100"><input type="text" placeholder="Vendor Name" className="w-full p-3 bg-transparent outline-none text-sm text-slate-900 font-medium placeholder:text-slate-400" value={item.vendor} onChange={e => updateItem(item.id, 'vendor', e.target.value)} /></td>
                      <td className="p-0 border-r border-slate-100"><input type="text" placeholder="Optional notes" className="w-full p-3 bg-transparent outline-none text-sm text-slate-900 font-medium placeholder:text-slate-400" value={item.remarks} onChange={e => updateItem(item.id, 'remarks', e.target.value)} /></td>
                      <td className="p-0 border-r border-slate-100"><input type="number" step="0.01" placeholder="0.00" className={`w-full p-3 bg-transparent outline-none font-bold placeholder:text-slate-400 ${item.isForeign ? 'text-amber-600 bg-amber-50/30' : 'text-slate-900'}`} value={item.amount} onChange={e => updateItem(item.id, 'amount', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100 text-center">
                        <button type="button" onClick={() => setActiveModalItemId(item.id)} className={`w-full py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border ${item.receiptFile ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                          {item.receiptFile ? <><CheckCircle2 size={14} /> Attached</> : <><ImageIcon size={14} /> Upload</>}
                        </button>
                      </td>
                      <td className="p-0 text-center"><button type="button" onClick={() => removeItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FLOATING SUBMIT BAR */}
          <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none z-10 flex justify-center">
            <div className="bg-slate-900 rounded-2xl shadow-2xl p-4 md:px-8 text-white flex justify-between pointer-events-auto w-full max-w-4xl">
              <div className="flex items-center gap-6">
                <div><p className="text-slate-400 text-xs">Total Rows</p><div className="text-xl font-semibold">{items.filter(i => i.amount || i.vendor).length}</div></div>
                <div className="h-8 w-px bg-slate-700"></div>
                <div><p className="text-slate-400 text-xs">Total Claim</p><div className="text-2xl font-bold">MYR {calculateTotal().toFixed(2)}</div></div>
              </div>
              <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                {isSubmitting ? <><Loader2 className="animate-spin" size={18}/> Saving...</> : <>Submit <ChevronRight size={18}/></>}
              </button>
            </div>
          </div>
        </form>

        {/* MODAL */}
        {activeModalItemId && activeModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-slate-50 border-b">
                <h3 className="font-bold">Attach Receipt</h3>
                <button onClick={() => setActiveModalItemId(null)} className="p-2 text-slate-400 hover:text-slate-700"><X size={20} /></button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* LEFT SIDE: FILE UPLOADS */}
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-700 flex justify-between">Original Receipt *</label>
                  <FileUploadZone file={activeModalItem.receiptFile} onFileSelect={(f: any) => updateItem(activeModalItem.id, 'receiptFile', f)} />
                  
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-amber-50 rounded-lg border border-amber-100 mt-4">
                    <input type="checkbox" className="w-4 h-4 text-amber-600 rounded" checked={activeModalItem.isForeign} onChange={(e) => updateItem(activeModalItem.id, 'isForeign', e.target.checked)} />
                    <span className="font-semibold text-amber-900 text-sm">Foreign Currency Expense</span>
                  </label>
                  
                  {activeModalItem.isForeign && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-2 mt-4">
                      <label className="text-sm font-semibold text-slate-700 flex justify-between">Bank Conversion Proof</label>
                      <FileUploadZone file={activeModalItem.conversionFile} onFileSelect={(f: any) => updateItem(activeModalItem.id, 'conversionFile', f)} compact={true} />
                    </div>
                  )}
                </div>

                {/* RIGHT SIDE: VERIFY DETAILS */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Verify Row Details</h4>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Receipt No.</label>
                      <input type="text" className="w-full p-2 border rounded text-sm" value={activeModalItem.receiptNo} onChange={e => updateItem(activeModalItem.id, 'receiptNo', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Vendor</label>
                      <input type="text" className="w-full p-2 border rounded text-sm" value={activeModalItem.vendor} onChange={e => updateItem(activeModalItem.id, 'vendor', e.target.value)} />
                    </div>
                  </div>

                  {/* RESTORED: FOREIGN CURRENCY INPUTS */}
                  {activeModalItem.isForeign && (
                    <div className="grid grid-cols-2 gap-4 mb-4 bg-amber-100/50 p-3 rounded-lg border border-amber-200 animate-in fade-in">
                      <div>
                        <label className="text-xs font-semibold text-amber-800 block mb-1">Orig. Currency</label>
                        <select 
                          className="w-full p-2 bg-white border border-amber-300 rounded text-sm outline-none focus:ring-2 focus:ring-amber-500"
                          value={activeModalItem.originalCurrency} 
                          onChange={e => updateItem(activeModalItem.id, 'originalCurrency', e.target.value)}
                        >
                          <option value="USD">USD - US Dollar</option>
                          <option value="SGD">SGD - Sing Dollar</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="GBP">GBP - British Pound</option>
                          <option value="AUD">AUD - Aus Dollar</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-amber-800 block mb-1">Orig. Amount</label>
                        <input 
                          type="number" step="0.01" placeholder="0.00"
                          className="w-full p-2 bg-white border border-amber-300 rounded text-sm outline-none focus:ring-2 focus:ring-amber-500"
                          value={activeModalItem.originalAmount} 
                          onChange={e => updateItem(activeModalItem.id, 'originalAmount', e.target.value)} 
                        />
                      </div>
                    </div>
                  )}

                  <label className="text-xs font-bold text-slate-800 block mb-1">Final Amount (MYR)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-medium">MYR</span>
                    <input 
                      type="number" step="0.01" 
                      className="w-full pl-12 p-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 font-bold text-lg outline-none" 
                      value={activeModalItem.amount} 
                      onChange={e => updateItem(activeModalItem.id, 'amount', e.target.value)} 
                    />
                  </div>
                </div>

              </div>
              <div className="p-4 border-t bg-slate-50 flex justify-end">
                <button onClick={() => setActiveModalItemId(null)} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Navbar({ user, role, onSignOut }: any) {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 text-white p-2 rounded-lg"><Building size={20} /></div>
          <span className="font-bold text-lg tracking-tight">Agency OS</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
          <div className="hidden sm:flex items-center gap-3">
             {role === 'admin' && (
              <span className="bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                Admin
              </span>
            )}
            <span>{user?.email}</span>
          </div>
          <button onClick={onSignOut} className="text-slate-400 hover:text-red-500 flex items-center gap-1.5 p-2 rounded-md hover:bg-red-50">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}

function FileUploadZone({ file, onFileSelect, compact = false }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile: any = e.target.files[0];
      selectedFile.preview = URL.createObjectURL(selectedFile);
      onFileSelect(selectedFile);
    }
  };

  if (file) {
    return (
      <div className={`relative rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center group ${compact ? 'h-32' : 'h-64'}`}>
        {file.type?.startsWith('image/') ? <img src={file.preview} alt="Preview" className="w-full h-full object-contain" /> : <div className="text-center"><FileIcon size={48} className="mx-auto text-slate-400 mb-2" /><p className="text-sm font-medium text-slate-700">{file.name}</p></div>}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <button type="button" onClick={(e) => { e.stopPropagation(); onFileSelect(null); }} className="bg-white text-red-600 px-4 py-2 rounded-lg font-medium shadow-lg hover:bg-red-50 flex items-center gap-2"><Trash2 size={16} /> Remove</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed border-slate-300 rounded-xl hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer flex flex-col items-center justify-center text-slate-500 ${compact ? 'h-32' : 'h-64'}`}>
      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="image/*,.pdf" />
      <Upload size={24} className="text-blue-500 mb-2" />
      <p className="font-medium text-slate-700">Click to upload receipt</p>
    </div>
  );
}