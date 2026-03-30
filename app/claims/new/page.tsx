"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, FileText, Plus, 
  Trash2, CheckCircle2, Image as ImageIcon, X, Upload, ChevronRight, Loader2, File as FileIcon
} from 'lucide-react';
import Navbar from '@/components/Navbar';

// --- TYPES & INTERFACES ---
interface Company {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface LineItem {
  id: number;
  date: string;
  receiptNo: string;
  vendor: string;
  remarks: string;
  amount: string;
  isForeign: boolean;
  originalCurrency: string;
  originalAmount: string;
  receiptFile: File | null;
  conversionFile: File | null;
}

export default function NewClaimPage() {
  const supabase = createClient();
  const router = useRouter();
  
  // --- AUTH & ROLES ---
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // --- MASTER DATA ---
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // --- APP STATE ---
  const [activeDepartment, setActiveDepartment] = useState('all');
  const [formData, setFormData] = useState({ companyId: '', purpose: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModalItemId, setActiveModalItemId] = useState<number | null>(null);
  
  // Initialize with 5 empty rows
  const [items, setItems] = useState<LineItem[]>(
    Array.from({ length: 5 }).map((_, i) => ({
      id: Date.now() + i, date: '', receiptNo: '', vendor: '', remarks: '', amount: '', 
      isForeign: false, originalCurrency: 'USD', originalAmount: '', 
      receiptFile: null, conversionFile: null
    }))
  );

  // --- INITIALIZATION ---
  useEffect(() => {
    async function initializeApp() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);

      try {
        // Fetch User Profile for Initial Department
        const { data: profile } = await supabase
          .from('profiles')
          .select('department_id')
          .eq('id', session.user.id)
          .maybeSingle();
          
        if (profile?.department_id) setActiveDepartment(profile.department_id);
        
        // Fetch Companies (Entities)
        const { data: companiesData } = await supabase.from('companies').select('id, name');
        if (companiesData) setCompanies(companiesData);

        // Fetch Departments for Switcher
        const { data: deptData } = await supabase.from('departments').select('id, name').order('name');
        if (deptData) {
          setDepartments([{ id: 'all', name: 'Agency OS (All)' }, ...deptData]);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsInitializing(false);
      }
    }

    initializeApp();
  }, [router, supabase]);

  // --- HELPERS ---
  const calculateTotal = () => items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  
  const addItem = () => setItems([...items, { 
    id: Date.now(), date: '', receiptNo: '', vendor: '', remarks: '', amount: '', 
    isForeign: false, originalCurrency: 'USD', originalAmount: '', receiptFile: null, conversionFile: null 
  }]);
  
  const updateItem = (id: number, field: keyof LineItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const removeItem = (id: number) => { 
    if (items.length > 1) setItems(items.filter(item => item.id !== id)); 
  };

  // --- SUBMISSION LOGIC ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyId || !formData.purpose) { 
      alert("Please fill in all header details."); 
      return; 
    }
    
    const validItems = items.filter(item => item.amount || item.vendor || item.receiptNo || item.receiptFile);
    if (validItems.length === 0) { 
      alert("Please enter at least one valid expense line item."); 
      return; 
    }

    setIsSubmitting(true);

    try {
      // 1. Insert Claim Header
      const { data: claimData, error: claimError } = await supabase.from('claims').insert({
        user_id: user.id, 
        company_id: formData.companyId, 
        department_id: activeDepartment === 'all' ? null : activeDepartment,
        claim_date: new Date().toISOString().split('T')[0],
        purpose: formData.purpose, 
        status: 'Pending', 
        total_amount: calculateTotal()
      }).select().single();

      if (claimError) throw new Error(`Claim header error: ${claimError.message}`);

      // 2. Insert Line Items & Upload Receipts
      for (const item of validItems) {
        const { data: itemData, error: itemError } = await supabase.from('claim_items').insert({
          claim_id: claimData.id, 
          expense_date: item.date || new Date().toISOString().split('T')[0],
          receipt_no: item.receiptNo, 
          vendor_name: item.vendor, 
          remarks: item.remarks,
          is_foreign_currency: item.isForeign, 
          original_currency: item.originalCurrency,
          original_amount: item.originalAmount ? parseFloat(item.originalAmount) : null,
          claim_currency: 'MYR', 
          claim_amount: parseFloat(item.amount) || 0
        }).select().single();

        if (itemError) throw new Error(`Item insertion error: ${itemError.message}`);

        const uploadFile = async (file: File, fileType: string) => {
          if (!file) return;
          const fileExt = file.name.split('.').pop();
          const filePath = `${user.id}/${claimData.id}/${itemData.id}_${fileType.replace(/\s+/g, '')}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
          if (uploadError) throw new Error(`File upload error: ${uploadError.message}`);
          
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
          
          await supabase.from('receipts').insert({ 
            claim_item_id: itemData.id, 
            file_url: urlData.publicUrl, 
            file_type: fileType 
          });
        };

        if (item.receiptFile) await uploadFile(item.receiptFile, 'Original');
        if (item.conversionFile) await uploadFile(item.conversionFile, 'Conversion Proof');
      }
      
      router.push('/claims'); 
    } catch (error: any) {
      console.error("Submission failed:", error);
      alert(`Submission failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeModalItem = items.find(i => i.id === activeModalItemId);

  if (isInitializing || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900 font-sans">
      <Navbar 
        showSwitcher={true}
        departments={departments}
        activeDepartment={activeDepartment}
        onDepartmentChange={setActiveDepartment}
      />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-right-8">
        
        <button onClick={() => router.push('/claims')} className="text-slate-500 hover:text-blue-600 flex items-center gap-2 text-sm font-medium mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* HEADER CARD */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Billing Entity *</label>
                <select 
                  required 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium"
                  value={formData.companyId} 
                  onChange={e => setFormData({...formData, companyId: e.target.value})}
                >
                  <option value="" disabled>Select Entity...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Claim Purpose *</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g., Meta Ads March 2026" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                  value={formData.purpose} 
                  onChange={e => setFormData({...formData, purpose: e.target.value})} 
                />
              </div>
            </div>
          </div>

          {/* SPREADSHEET GRID CARD */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" /> Expense Line Items
              </h2>
              <button 
                type="button" 
                onClick={addItem} 
                className="text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5"
              >
                <Plus size={16} /> Add Row
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
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
                    <tr key={item.id} className="hover:bg-slate-50/50 group transition-colors">
                      <td className="p-0 border-r border-slate-100">
                        <input type="date" className="w-full p-3 bg-transparent outline-none text-sm text-slate-900 font-medium" value={item.date} onChange={e => updateItem(item.id, 'date', e.target.value)} />
                      </td>
                      <td className="p-0 border-r border-slate-100">
                        <input type="text" placeholder="INV-001" className="w-full p-3 bg-transparent outline-none text-sm text-slate-900 font-medium" value={item.receiptNo} onChange={e => updateItem(item.id, 'receiptNo', e.target.value)} />
                      </td>
                      <td className="p-0 border-r border-slate-100">
                        <input type="text" placeholder="Vendor Name" className="w-full p-3 bg-transparent outline-none text-sm text-slate-900 font-medium" value={item.vendor} onChange={e => updateItem(item.id, 'vendor', e.target.value)} />
                      </td>
                      <td className="p-0 border-r border-slate-100">
                        <input type="text" placeholder="Optional notes" className="w-full p-3 bg-transparent outline-none text-sm text-slate-900 font-medium" value={item.remarks} onChange={e => updateItem(item.id, 'remarks', e.target.value)} />
                      </td>
                      <td className="p-0 border-r border-slate-100">
                        <input type="number" step="0.01" placeholder="0.00" className={`w-full p-3 bg-transparent outline-none font-bold ${item.isForeign ? 'text-amber-600 bg-amber-50/30' : 'text-slate-900'}`} value={item.amount} onChange={e => updateItem(item.id, 'amount', e.target.value)} />
                      </td>
                      <td className="p-2 border-r border-slate-100 text-center">
                        <button type="button" onClick={() => setActiveModalItemId(item.id)} className={`w-full py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors ${item.receiptFile ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                          {item.receiptFile ? <><CheckCircle2 size={14} /> Attached</> : <><ImageIcon size={14} /> Upload</>}
                        </button>
                      </td>
                      <td className="p-0 text-center">
                        <button type="button" onClick={() => removeItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FLOATING ACTION BAR */}
          <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none z-10 flex justify-center">
            <div className="bg-slate-900 rounded-2xl shadow-2xl p-4 md:px-8 text-white flex justify-between items-center pointer-events-auto w-full max-w-4xl border border-slate-800">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Total Rows</p>
                  <div className="text-xl font-bold">{items.filter(i => i.amount || i.vendor).length}</div>
                </div>
                <div className="h-8 w-px bg-slate-700"></div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Total Claim</p>
                  <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                    <span className="text-blue-400 text-lg">MYR</span> {calculateTotal().toFixed(2)}
                  </div>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md"
              >
                {isSubmitting ? <><Loader2 className="animate-spin" size={18}/> Saving...</> : <>Submit Claim <ChevronRight size={18}/></>}
              </button>
            </div>
          </div>
        </form>

        {/* RECEIPT UPLOAD MODAL */}
        {activeModalItemId !== null && activeModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              
              <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileText className="text-blue-600" size={20} /> 
                  Attach Receipt <span className="text-slate-400 text-sm font-normal">(Row {items.findIndex(i => i.id === activeModalItemId) + 1})</span>
                </h3>
                <button onClick={() => setActiveModalItemId(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-700 flex justify-between">
                    Original Receipt <span className="text-red-500 font-normal text-xs">*Required</span>
                  </label>
                  <FileUploadZone file={activeModalItem.receiptFile} onFileSelect={(f: File | null) => updateItem(activeModalItem.id, 'receiptFile', f)} />
                  
                  <div className="pt-4 border-t border-slate-100">
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-amber-50 rounded-lg border border-amber-100 hover:bg-amber-100/50 transition-colors">
                      <input type="checkbox" className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer" checked={activeModalItem.isForeign} onChange={(e) => updateItem(activeModalItem.id, 'isForeign', e.target.checked)} />
                      <span className="font-semibold text-amber-900 text-sm">Foreign Currency Expense</span>
                    </label>
                  </div>
                  
                  {activeModalItem.isForeign && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-3 mt-4">
                      <label className="text-sm font-semibold text-slate-700">Bank Conversion Proof</label>
                      <FileUploadZone file={activeModalItem.conversionFile} onFileSelect={(f: File | null) => updateItem(activeModalItem.id, 'conversionFile', f)} compact={true} />
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 h-fit">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Verify Row Details</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Receipt No.</label>
                      <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" value={activeModalItem.receiptNo} onChange={e => updateItem(activeModalItem.id, 'receiptNo', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Vendor</label>
                      <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" value={activeModalItem.vendor} onChange={e => updateItem(activeModalItem.id, 'vendor', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">Final Amount (MYR)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-medium">MYR</span>
                      <input 
                        type="number" step="0.01" className="w-full pl-12 p-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 outline-none font-bold text-xl text-slate-900" 
                        value={activeModalItem.amount} 
                        onChange={e => updateItem(activeModalItem.id, 'amount', e.target.value)} 
                      />
                    </div>
                  </div>
                </div>

              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button onClick={() => setActiveModalItemId(null)} className="bg-slate-900 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-slate-800 shadow-sm">
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

function FileUploadZone({ file, onFileSelect, compact = false }: { file: any, onFileSelect: (f: File | null) => void, compact?: boolean }) {
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
        {file.type?.startsWith('image/') ? (
          <img src={file.preview} alt="Preview" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center">
            <FileIcon size={48} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-700 px-4 truncate">{file.name}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
          <button type="button" onClick={(e) => { e.stopPropagation(); onFileSelect(null); }} className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-red-50 flex items-center gap-2">
            <Trash2 size={16} /> Remove File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed border-slate-300 rounded-xl hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 ${compact ? 'h-32' : 'h-64'}`}>
      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="image/*,.pdf" />
      <Upload size={24} className="mb-2" />
      <p className="font-semibold">Click to upload document</p>
      <p className="text-xs text-slate-400 mt-1 font-normal">PNG, JPG or PDF up to 5MB</p>
    </div>
  );
}