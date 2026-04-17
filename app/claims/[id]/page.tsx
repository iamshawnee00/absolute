"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { Building, LogOut, ArrowLeft, AlertCircle, Loader2, Image as ImageIcon, MessageSquare, FileText } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function ViewClaimPage() {
  const params = useParams();
  const dbId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [claim, setClaim] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Auth & Profile
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) router.push('/login');
      else {
        setUser(session.user);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*, departments(name)')
          .eq('id', session.user.id)
          .single();
        if (profileData) setProfile(profileData);
      }
    });
  }, [router, supabase]);

  // Fetch specific claim details
  useEffect(() => {
    if (!user || !dbId) return;

    async function fetchClaimDetails() {
      const { data: claimData, error: claimError } = await supabase
        .from('claims')
        .select('*')
        .eq('id', dbId)
        .single();
        
      if (claimError) {
        console.error("Error fetching claim details:", claimError);
      } else if (claimData) {
        
        // Manually fetch the user's profile and company to avoid Foreign Key join issues
        const [profileRes, companyRes] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', claimData.user_id).maybeSingle(),
          supabase.from('companies').select('name').eq('id', claimData.company_id).maybeSingle()
        ]);

        setClaim({
          ...claimData,
          profiles: profileRes.data || { full_name: 'Unknown User' },
          companies: companyRes.data || { name: 'Unknown Entity' }
        });
      }

      const { data: itemsData } = await supabase
        .from('claim_items')
        .select('*, receipts(*)')
        .eq('claim_id', dbId)
        .order('expense_date', { ascending: true });
        
      if (itemsData) setItems(itemsData);
      
      setLoading(false);
    }

    fetchClaimDetails();
  }, [user, dbId, supabase]);

  // Handle Workflow Status Update
  const handleStatusChange = async (newStatus: string) => {
    setClaim({ ...claim, status: newStatus }); // Optimistic UI update
    await supabase.from('claims').update({ status: newStatus }).eq('id', dbId);
  };

  // Handle Admin/Finance Notes
  const handleCommentSave = async (itemId: string, newComment: string) => {
    await supabase.from('claim_items').update({ admin_comment: newComment }).eq('id', itemId);
  };

  if (!user || loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  if (!claim) return <div className="min-h-screen p-8 text-center text-red-500">Claim not found.</div>;

  // Permissions: SuperAdmin, HOD, Manager, and Finance Dept can change statuses and leave notes.
  const isFinance = profile?.departments?.name?.toLowerCase() === 'finance';
  const canManageWorkflow = isFinance || profile?.role === 'superadmin' || profile?.role === 'hod' || profile?.role === 'manager';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <Navbar />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-right-8">
        <button onClick={() => router.push('/claims')} className="text-slate-500 hover:text-slate-900 flex items-center gap-2 text-sm font-medium transition-colors mb-6">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* HEADER INFO */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                {claim.id.substring(0,8).toUpperCase()}
                <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded-md uppercase tracking-wider font-bold">
                  {claim.profiles?.full_name || 'Staff Member'}
                </span>
              </h2>
              <p className="text-slate-500 mt-1">Submitted on {claim.claim_date}</p>
            </div>
            
            {/* Status Manager */}
            {canManageWorkflow ? (
              <select 
                value={claim.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`font-bold p-2.5 rounded-xl border-2 outline-none cursor-pointer transition-colors ${
                  claim.status === 'Approved' ? 'bg-green-50 border-green-200 text-green-700' : 
                  claim.status === 'Paid' ? 'bg-blue-50 border-blue-200 text-blue-700' : 
                  claim.status === 'Reviewed' ? 'bg-purple-50 border-purple-200 text-purple-700' : 
                  claim.status === 'Rejected' ? 'bg-red-50 border-red-200 text-red-700' :
                  'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                <option value="Pending">🟡 Pending Submission</option>
                <option value="Reviewed">🟣 Reviewed (Finance Check)</option>
                <option value="Approved">🟢 Approved (Manager/HOD)</option>
                <option value="Paid">🔵 Paid (Finance Disbursed)</option>
                <option value="Rejected">🔴 Rejected</option>
              </select>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold tracking-wide border ${
                claim.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                claim.status === 'Paid' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                claim.status === 'Reviewed' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                claim.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <AlertCircle size={16} /> {claim.status}
              </span>
            )}
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Billing Entity</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{claim.companies?.name}</p>
              </div>

              {/* Display the Claim Type */}
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Claim Type</p>
                <div className="mt-1">
                  {claim.has_receipts !== false ? (
                    <span className="inline-flex items-center gap-2 text-slate-700 font-bold">
                      <FileText size={18} className="text-blue-500"/> WITH RECEIPT
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-amber-700 font-bold bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 w-fit">
                      <AlertCircle size={18} className="text-amber-500"/> WITHOUT RECEIPT
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Purpose</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{claim.purpose || 'General Expenses'}</p>
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col justify-center items-center md:items-end">
               <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Amount</p>
               <div className="text-4xl font-black text-slate-900">
                  <span className="text-slate-400 text-2xl mr-2 font-bold">MYR</span> {Number(claim.total_amount).toFixed(2)}
               </div>
            </div>
          </div>
        </div>
        
        {/* LINE ITEMS TABLE */}
        <h3 className="text-lg font-bold text-slate-900 mb-4">Expense Details & Receipts</h3>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No items found for this claim.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                  <tr>
                    <th className="px-6 py-4 border-r border-slate-100">Date & Files</th>
                    <th className="px-6 py-4 border-r border-slate-100">Details</th>
                    <th className="px-6 py-4 text-right border-r border-slate-100 w-40">Amount (MYR)</th>
                    <th className="px-6 py-4 w-1/3">Finance / Manager Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      {/* Date & Files Col */}
                      <td className="px-6 py-4 border-r border-slate-100 align-top">
                         <div className="font-bold text-slate-800 mb-3">{item.expense_date}</div>
                         {claim.has_receipts !== false && (
                           <div className="flex flex-col gap-2">
                            {item.receipts?.map((r: any) => (
                              <a 
                                key={r.id} href={r.file_url} target="_blank" rel="noopener noreferrer"
                                className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold w-fit"
                              >
                                <ImageIcon size={14} /> {r.file_type}
                              </a>
                            ))}
                            {(!item.receipts || item.receipts.length === 0) && (
                              <span className="text-xs text-red-500 font-bold italic flex items-center gap-1">
                                <AlertCircle size={12}/> Missing Receipt
                              </span>
                            )}
                          </div>
                         )}
                         {claim.has_receipts === false && (
                           <span className="text-xs text-slate-400 font-medium italic">WITHOUT RECEIPT</span>
                         )}
                      </td>
                      
                      {/* Details Col */}
                      <td className="px-6 py-4 border-r border-slate-100 align-top">
                        <div className="font-bold text-slate-900 text-base">{item.vendor_name}</div>
                        {claim.has_receipts !== false && (
                          <div className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-wider">Receipt: {item.receipt_no}</div>
                        )}
                        {item.remarks && <div className="mt-3 text-slate-600 italic border-l-2 border-slate-300 pl-3">"{item.remarks}"</div>}
                      </td>

                      {/* Amount Col */}
                      <td className="px-6 py-4 font-black text-right text-slate-900 border-r border-slate-100 bg-slate-50/50 align-top">
                        <span className="text-lg">{Number(item.claim_amount).toFixed(2)}</span>
                        {item.is_foreign_currency && claim.has_receipts !== false && (
                          <div className="text-[10px] font-bold text-amber-700 mt-2 bg-amber-100 inline-block px-2 py-1 rounded uppercase tracking-wider border border-amber-200">
                            Orig: {item.original_amount} {item.original_currency}
                          </div>
                        )}
                      </td>

                      {/* Notes Col */}
                      <td className="px-6 py-4 align-top bg-purple-50/30">
                        {canManageWorkflow ? (
                          <div className="relative">
                            <textarea 
                              placeholder="Leave a note for revisions..."
                              className="w-full text-sm p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-400 bg-white resize-none font-medium"
                              rows={2}
                              defaultValue={item.admin_comment || ''}
                              onBlur={(e) => handleCommentSave(item.id, e.target.value)}
                            />
                            <MessageSquare className="absolute top-3 right-3 text-slate-300 pointer-events-none" size={16} />
                          </div>
                        ) : (
                          <div className="text-sm">
                            {item.admin_comment ? (
                              <div className="bg-purple-50 text-purple-800 p-3 rounded-xl border border-purple-200 flex items-start gap-2 font-medium shadow-sm">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <span>{item.admin_comment}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic font-medium">No notes added.</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}