"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, AlertCircle, Info, Check, Loader2 } from 'lucide-react';

export default function NotificationBell() {
  const supabase = createClient();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // 1. Close dropdown when clicking outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 2. Initialize and Subscribe to Real-time Updates
  useEffect(() => {
    let channel: any;

    async function initNotifications() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);

      // Fetch user profile to determine role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, department_id')
        .eq('id', session.user.id)
        .single();

      // Base query for unread notifications
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      // Logic: Staff only see notifications specifically targeting them.
      // Admins/HODs see role_requests OR notifications targeting them.
      if (profile?.role === 'staff') {
        query = query.eq('target_user_id', session.user.id);
      }

      const { data } = await query;
      if (data) setNotifications(data);
      setLoading(false);

      // Realtime Subscription
      channel = supabase.channel('realtime-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        }, (payload: any) => {
          // Filter incoming real-time events similarly
          const newNotif = payload.new;
          if (profile?.role === 'staff' && newNotif.target_user_id !== session.user.id) return;
          
          setNotifications((current) => [newNotif, ...current]);
        })
        .subscribe();
    }

    initNotifications();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  // 3. Mark Single Notification as Read & Navigate
  const handleMarkAsRead = async (notif: any) => {
    // Optimistic UI update (feels instant to the user)
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    setIsOpen(false);

    // Background DB update
    await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);

    // Deep-linking logic based on the Project Blueprint
    if (notif.type === 'role_request' && notif.user_id) {
      router.push(`/hr/directory?editUser=${notif.user_id}`);
    } else if (notif.claim_id) {
      router.push(`/claims/${notif.claim_id}`);
    } else {
      router.push('/dashboard');
    }
  };

  // 4. Mark All as Read
  const markAllAsRead = async () => {
    const ids = notifications.map(n => n.id);
    setNotifications([]); // Optimistic clear
    if (ids.length > 0) {
      await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    }
  };

  if (!user) return <div className="p-2 text-slate-300 animate-pulse"><Bell size={20} /></div>;

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 shadow-xl rounded-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              Notifications
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">{notifications.length} new</span>
            </h3>
            {notifications.length > 0 && (
              <button 
                onClick={markAllAsRead} 
                className="text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <Check size={12}/> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="px-4 py-8 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={24}/></div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-12 text-center flex flex-col items-center gap-2">
                <div className="bg-slate-50 p-3 rounded-full"><Bell className="text-slate-300" size={24}/></div>
                <p className="text-slate-500 text-sm font-medium mt-2">You're all caught up!</p>
                <p className="text-slate-400 text-xs">No new notifications right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map(notif => (
                  <div key={notif.id} className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => handleMarkAsRead(notif)}>
                    <div className="flex gap-3">
                      <div className="shrink-0 mt-0.5">
                        {notif.type === 'role_request' ? <AlertCircle size={18} className="text-amber-500"/> :
                         notif.type === 'claim_approved' || notif.type === 'claim_paid' ? <CheckCircle2 size={18} className="text-green-500"/> :
                         <Info size={18} className="text-blue-500"/>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-700 font-medium leading-tight group-hover:text-blue-600 transition-colors">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}