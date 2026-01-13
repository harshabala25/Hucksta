
import React, { useState, useEffect, useCallback } from 'react';
import { Tab, Category } from './types';
import Navigation from './components/Navigation';
import SellFlow from './components/SellFlow';
import Profile from './components/Profile';
import Marketplace from './components/Marketplace';
import Messages from './components/Messages';
import ItemDetail from './components/ItemDetail';
import Login from './components/Login';
import { supabase, isSupabaseConfigured } from './lib/supabase';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [viewingItem, setViewingItem] = useState<any>(null);
  const [openConversationId, setOpenConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        ensureProfileExists(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        ensureProfileExists(session.user);
      } else {
        setUserAvatar(undefined);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // "Self-Healing" Profile Logic: Ensures every auth user has a public profile
  const ensureProfileExists = async (user: any) => {
    try {
      // 1. Check if profile exists
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile && !error) {
        // 2. Provision new profile if missing
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'New Comet';
        const username = user.user_metadata?.username || user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-t0-9]/g, '') || `user${user.id.slice(0, 4)}`;
        const avatarUrl = user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: fullName,
          username: username,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        });
        
        setUserAvatar(avatarUrl);
      } else if (profile) {
        setUserAvatar(profile.avatar_url);
      }
    } catch (err) {
      console.error('Profile sync error:', err);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();
    
    if (data?.avatar_url) {
      setUserAvatar(data.avatar_url);
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('nav-avatar-sync')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${session.user.id}`
      }, (payload) => {
        if (payload.new.avatar_url) setUserAvatar(payload.new.avatar_url);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  const triggerMessageDot = useCallback(() => {
    setUnreadCount(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('global-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, async (payload) => {
        const newMessage = payload.new;
        if (newMessage.sender_id !== session.user.id) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, buyer_id, seller_id')
            .eq('id', newMessage.conversation_id)
            .single();

          if (conv && (conv.buyer_id === session.user.id || conv.seller_id === session.user.id)) {
            if (activeTab !== Tab.MESSAGES) {
              triggerMessageDot();
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, activeTab, triggerMessageDot]);

  useEffect(() => {
    if (activeTab === Tab.MESSAGES) {
      setUnreadCount(0);
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const renderContent = () => {
    if (viewingItem) {
      return (
        <ItemDetail 
          item={viewingItem} 
          session={session}
          onBack={() => setViewingItem(null)}
          onMessage={(convId) => {
            setViewingItem(null);
            setOpenConversationId(convId || null);
            setActiveTab(Tab.MESSAGES);
          }}
        />
      );
    }

    switch (activeTab) {
      case Tab.HOME:
        return (
          <Marketplace 
            session={session} 
            onSelectItem={setViewingItem} 
          />
        );
      case Tab.MESSAGES:
        return (
          <Messages 
            session={session} 
            initialConversationId={openConversationId} 
          />
        );
      case Tab.SELL:
        return (
          <SellFlow 
            category={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onCancel={() => setActiveTab(Tab.HOME)}
            onSuccess={() => {
              setSelectedCategory(null);
              setActiveTab(Tab.HOME);
            }}
            session={session}
          />
        );
      case Tab.PROFILE:
        return (
          <Profile 
            session={session} 
            onSelectItem={setViewingItem}
            onGoHome={() => setActiveTab(Tab.HOME)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-full max-md:max-w-md mx-auto bg-white relative shadow-2xl overflow-hidden flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        {renderContent()}
      </div>
      
      {!viewingItem && (
        <Navigation 
          activeTab={activeTab} 
          unreadCount={unreadCount}
          userAvatar={userAvatar}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setOpenConversationId(null);
          }} 
        />
      )}
    </div>
  );
};

export default App;
