
import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface Message {
  id: string;
  text: string;
  sender_id: string;
  created_at: string;
}

interface Conversation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  other_user_id: string;
}

interface MessagesProps {
  session: any;
  initialConversationId?: string | null;
}

const Messages: React.FC<MessagesProps> = ({ session, initialConversationId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<'none' | 'table_missing'>('none');
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentUserId = session?.user?.id;

  const chatSetupSQL = `
-- Create Conversations Table
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  listing_id uuid references public.listings(id) on delete cascade,
  buyer_id uuid not null,
  seller_id uuid not null
);

-- Create Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  text text not null
);

-- Enable RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Policies
create policy "Users see conversations" on public.conversations for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "Users start conversations" on public.conversations for insert with check (auth.uid() = buyer_id);
create policy "Users see messages" on public.messages for select using (exists (select 1 from public.conversations where id = conversation_id and (buyer_id = auth.uid() or seller_id = auth.uid())));
create policy "Users send messages" on public.messages for insert with check (auth.uid() = sender_id);
  `.trim();

  useEffect(() => {
    if (currentUserId) {
      fetchConversations(currentUserId);
    } else {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!initialConversationId || conversations.length === 0) return;
    const match = conversations.find((c) => c.id === initialConversationId);
    if (match) setSelectedConversation(match);
  }, [initialConversationId, conversations]);

  const fetchConversations = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, listing_id, buyer_id, seller_id, created_at
        `)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        if ((error as any).code === '42P01') setErrorType('table_missing');
        throw error;
      }

      if (data) {
        // Group by user ID to ensure true 1:1 DMs (one thread per person pair)
        const grouped = data.reduce((acc: Conversation[], conv: any) => {
          const otherId = conv.buyer_id === userId ? conv.seller_id : conv.buyer_id;
          if (otherId === userId) return acc;

          const alreadyExists = acc.find(c => c.other_user_id === otherId);
          if (!alreadyExists) {
            acc.push({ ...conv, other_user_id: otherId });
          }
          return acc;
        }, []);

        setConversations(grouped);
        grouped.forEach((conv: any) => fetchAndCacheUserProfile(conv.other_user_id));
      }
    } catch (err: any) {
      console.error('Error fetching conversations:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAndCacheUserProfile = async (userId: string) => {
    if (!userId) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, username')
        .eq('id', userId)
        .maybeSingle();
        
      if (profile) {
        const identity = profile.full_name || (profile.username ? `@${profile.username}` : `Student ${userId.slice(0, 4).toUpperCase()}`);
        setUserNames((s) => ({ ...s, [userId]: identity }));
        if (profile.avatar_url) {
          setUserAvatars((s) => ({ ...s, [userId]: profile.avatar_url }));
        }
      } else {
        // If profile is missing, keep a generic placeholder
        setUserNames((s) => ({ ...s, [userId]: `Student ${userId.slice(0, 4).toUpperCase()}` }));
      }
    } catch (err) {}
  };

  const fetchMessages = async (convId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (error) console.error('Error fetching messages:', error.message || error);
    else setMessages(data || []);
  };

  useEffect(() => {
    if (!selectedConversation) return;
    fetchMessages(selectedConversation.id);
    const channel = supabase
      .channel(`chat-${selectedConversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConversation.id}`
      }, (payload) => {
        setMessages((prev) => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Message];
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedConversation || !currentUserId) return;
    const text = inputValue.trim();
    setInputValue('');
    await supabase.from('messages').insert({
      conversation_id: selectedConversation.id,
      sender_id: currentUserId,
      text: text
    });
  };

  const getUserDisplayName = (userId: string) => {
    return userNames[userId] || 'Syncing...';
  };

  const getAvatar = (userId: string) => {
    return userAvatars[userId] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
  };

  if (errorType === 'table_missing') {
    return (
      <div className="flex flex-col h-full bg-white p-8 justify-center items-center text-center space-y-4">
        <div className="bg-orange-50 p-6 rounded-[2rem] text-orange-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-gray-900">Setup Messaging</h2>
        <pre className="bg-gray-900 text-emerald-400 p-4 rounded-2xl text-[8px] overflow-x-auto whitespace-pre font-mono h-48 no-scrollbar border border-white/10 shadow-inner select-all w-full">{chatSetupSQL}</pre>
        <button onClick={() => window.location.reload()} className="w-full bg-orange-600 text-white py-3 rounded-2xl font-bold">Check Again</button>
      </div>
    );
  }

  if (selectedConversation) {
    return (
      <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="pt-12 pb-4 px-6 flex items-center border-b border-gray-100 space-x-4 bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <button onClick={() => setSelectedConversation(null)} className="p-2 -ml-2 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center space-x-3">
            <img 
              src={getAvatar(selectedConversation.other_user_id)} 
              className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 object-cover shadow-sm" 
              alt="Avatar" 
            />
            <div className="overflow-hidden">
              <h3 className="text-sm font-black text-gray-900 tracking-tight truncate">
                {getUserDisplayName(selectedConversation.other_user_id)}
              </h3>
            </div>
          </div>
        </div>

        {/* Message List */}
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
        >
          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in zoom-in duration-200`}>
                <div className={`max-w-[80%] px-5 py-3 rounded-[1.5rem] text-sm shadow-sm ${
                  isMe ? 'bg-orange-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none font-medium'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input bar */}
        <div className="p-4 pb-28 bg-white border-t border-gray-100">
          <div className="flex items-center space-x-2 max-w-md mx-auto">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Message..." 
              className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-orange-100 transition-all outline-none"
            />
            <button onClick={handleSendMessage} className="bg-orange-500 text-white p-3.5 rounded-2xl shadow-lg shadow-orange-100 active:scale-90 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="pt-16 pb-6 px-8 border-b border-gray-50">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Messages</h1>
        <div className="flex items-center space-x-2 mt-1">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">UTD Campus Network</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-24 p-4 space-y-3 bg-gray-50/30">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Syncing Inbox...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-300 text-center px-8">
            <div className="bg-white p-8 rounded-[3rem] mb-6 shadow-sm border border-gray-100 opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-gray-900 font-bold mb-1 text-lg uppercase tracking-tight">Inbox Empty</h3>
            <p className="text-xs font-medium text-gray-400">Message a student to start a chat</p>
          </div>
        ) : (
          conversations.map((chat) => (
            <div 
              key={chat.id} 
              onClick={() => setSelectedConversation(chat)}
              className="p-5 flex items-center space-x-4 bg-white rounded-[2rem] border border-gray-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:shadow-md hover:border-orange-200 group"
            >
              <div className="relative">
                <img 
                  src={getAvatar(chat.other_user_id)} 
                  className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 object-cover shadow-inner group-hover:scale-105 transition-transform" 
                  alt="Avatar" 
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-black text-gray-900 text-lg tracking-tight truncate">
                  {getUserDisplayName(chat.other_user_id)}
                </h3>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Student</span>
                </div>
              </div>
              <div className="text-orange-500 opacity-30 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Messages;
