"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { Building, LogOut, ArrowLeft, AlertCircle, Loader2, Image as ImageIcon, MessageSquare } from 'lucide-react';

export default function ViewClaimPage() {
  const params = useParams();
  const dbId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState('staff');
  const [claim, setClaim] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth Guard
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) router.push('/login');
      else {
        setUser(session.user);
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile?.role) setUserRole(profile.role);
      }
    });
  }, [router, supabase]);

  // Fetch specific claim details
  useEffect(() => {
    if (!user || !dbId) return;

    async function fetchClaimDetails() {
      const { data: claimData } = await supabase.from('claims').select('*, companies(name)').eq('id', dbId).single();
      if (claimData) setClaim(claimData);

      const { data: itemsData } = await supabase.from('claim_items').select('*, receipts(*)').eq('claim_id', dbId).order('expense_date', { ascending: true });
      if (itemsData) setItems(itemsData);
      
      setLoading(false);
    }

    fetchClaimDetails();
  }, [user, dbId, supabase]);

  // Bucket 2: Admin Updates Claim Status
  const handleStatusChange = async (newStatus: string) => {
    setClaim({ ...claim, status: newStatus }); // Optimistic UI update
    await supabase.from('claims').update({ status: newStatus }).eq('id', dbId);
  };

  // Bucket 2: Admin Leaves Comment on Line Item
  const handleCommentSave = async (itemId: string, newComment: string) => {
    await supabase.from('claim_items').update({ admin_comment: newComment }).eq('id', itemId);
  };

  if (!user || loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  if (!claim) return <div className="min-h-screen p-8 text-center text-red-500">Claim not found.</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <Navbar user={user} role={userRole} onSignOut={() => { supabase.auth.signOut(); router.push('/login'); }} />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-right-8">
        <button onClick={() => router.push('/claims')} className="text-slate-500 hover:text-slate-900 flex items-center gap-2 text-sm font-medium transition-colors mb-6">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* HEADER INFO */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{claim.id.substring(0,8).toUpperCase()}</h2>
              <p className="text-slate-500 mt-1">Submitted on {claim.claim_date}</p>
            </div>
            
            {/* Bucket 2: Admin Status Dropdown vs Staff Badge */}
            {userRole === 'admin' ? (
              <select 
                value={claim.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`font-bold p-2 rounded-lg border-2 outline-none ${
                  claim.status === 'Approved' ? 'bg-green-50 border-green-200 text-green-700' : 
                  claim.status === 'Paid' ? 'bg-blue-50 border-blue-200 text-blue-700' : 
                  claim.status === 'Rejected' ? 'bg-red-50 border-red-200 text-red-700' :
                  'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                <option value="Pending">🟡 Pending Review</option>
                <option value="Approved">🟢 Approved</option>
                <option value="Paid">🔵 Paid</option>
                <option value="Rejected">🔴 Rejected</option>
              </select>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                claim.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                claim.status === 'Paid' ? 'bg-blue-100 text-blue-700' : 
                claim.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                <AlertCircle size={16} /> {claim.status}
              </span>
            )}
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Billing Entity</p>
                <p className="text-lg font-medium text-slate-900 mt-1">{claim.companies?.name}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Purpose</p>
                <p className="text-lg font-medium text-slate-900 mt-1">{claim.purpose || 'General Expenses'}</p>
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col justify-center items-center md:items-end">
               <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Amount</p>
               <div className="text-4xl font-bold text-slate-900">
                  <span className="text-slate-400 text-2xl mr-2">MYR</span> {Number(claim.total_amount).toFixed(2)}
               </div>
            </div>
          </div>
        </div>
        
        {/* LINE ITEMS TABLE */}
        <h3 className="text-lg font-bold text-slate-900 mb-4">Expense Details & Receipts</h3>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No items found for this claim.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold border-r border-slate-100">Date & Files</th>
                    <th className="px-6 py-4 font-semibold border-r border-slate-100">Details</th>
                    <th className="px-6 py-4 font-semibold text-right border-r border-slate-100 w-40">Amount (MYR)</th>
                    <th className="px-6 py-4 font-semibold w-1/3">Admin/Treasury Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      {/* Date & Files Col */}
                      <td className="px-6 py-4 border-r border-slate-100 align-top">
                         <div className="font-semibold text-slate-700 mb-3">{item.expense_date}</div>
                         <div className="flex flex-col gap-2">
                          {item.receipts?.map((r: any) => (
                            <a 
                              key={r.id} href={r.file_url} target="_blank" rel="noopener noreferrer"
                              className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 text-xs font-medium w-fit"
                            >
                              <ImageIcon size={14} /> {r.file_type}
                            </a>
                          ))}
                        </div>
                      </td>
                      
                      {/* Details Col */}
                      <td className="px-6 py-4 border-r border-slate-100 align-top">
                        <div className="font-bold text-slate-900">{item.vendor_name}</div>
                        <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Receipt: {item.receipt_no}</div>
                        {item.remarks && <div className="mt-3 text-slate-600 italic border-l-2 border-slate-200 pl-2">"{item.remarks}"</div>}
                      </td>

                      {/* Amount Col */}
                      <td className="px-6 py-4 font-bold text-right text-slate-900 border-r border-slate-100 bg-slate-50/50 align-top">
                        <span className="text-lg">{Number(item.claim_amount).toFixed(2)}</span>
                        {item.is_foreign_currency && (
                          <div className="text-xs font-normal text-amber-600 mt-1 bg-amber-50 inline-block p-1 rounded border border-amber-100">
                            Orig: {item.original_amount} {item.original_currency}
                          </div>
                        )}
                      </td>

                      {/* Bucket 2: Admin Comment Col */}
                      <td className="px-6 py-4 align-top bg-red-50/30">
                        {userRole === 'admin' ? (
                          <div className="relative">
                            <textarea 
                              placeholder="Leave a note (e.g., 'Receipt blurry, please reupload')"
                              className="w-full text-sm p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-red-400 bg-white resize-none"
                              rows={2}
                              defaultValue={item.admin_comment || ''}
                              onBlur={(e) => handleCommentSave(item.id, e.target.value)}
                            />
                            <MessageSquare className="absolute top-3 right-3 text-slate-300" size={16} />
                          </div>
                        ) : (
                          <div className="text-sm">
                            {item.admin_comment ? (
                              <div className="bg-red-50 text-red-800 p-3 rounded-lg border border-red-200 flex items-start gap-2">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <span>{item.admin_comment}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No notes.</span>
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