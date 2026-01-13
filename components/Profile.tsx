
import React, { useState, useEffect } from 'react';
import EditProfile from './EditProfile';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ProfileProps {
  session: any;
  onSelectItem?: (item: any) => void;
  onGoHome?: () => void;
}

const Profile: React.FC<ProfileProps> = ({ session, onSelectItem, onGoHome }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'favorites'>('active');
  const [isEditing, setIsEditing] = useState(false);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [favoriteListings, setFavoriteListings] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<'none' | 'table_missing' | 'other'>('none');

  const setupSQL = `
-- 1. Ensure Profiles table exists with all columns
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    username TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add columns if they were missed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 3. Fix Security Policies (Unified ALL policy for upsert)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  `.trim();

  useEffect(() => {
    fetchAllData();

    if (isSupabaseConfigured && session?.user?.id) {
      const channel = supabase
        .channel('user-profile-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'listings', filter: `seller_id=eq.${session.user.id}` }, () => fetchMyListings())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${session.user.id}` }, () => fetchFavorites())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, (payload) => setProfile(payload.new))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session?.user?.id]);

  const fetchAllData = async () => {
    if (!isSupabaseConfigured || !session?.user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorType('none');
    await Promise.all([fetchMyListings(), fetchFavorites(), fetchProfile()]);
    setLoading(false);
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        if (error.code === '42P01' || error.message.includes('column')) {
          setErrorType('table_missing');
        }
        throw error;
      }
      if (data) setProfile(data);
    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
    }
  };

  const fetchMyListings = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') setErrorType('table_missing');
        throw error;
      }
      if (data) setMyListings(data);
    } catch (err: any) {
      console.error('Error fetching my listings:', err.message);
    }
  };

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('listing_id')
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const listingIds = data.map(f => f.listing_id);
        const { data: items } = await supabase
          .from('listings')
          .select('*')
          .in('id', listingIds);
        setFavoriteListings(items || []);
      } else {
        setFavoriteListings([]);
      }
    } catch (err: any) {
      console.error('Error fetching favorites:', err.message);
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  };

  const getThumbnail = (imageUrl: string) => {
    if (!imageUrl) return 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=400';
    try {
      if (imageUrl.startsWith('[') && imageUrl.endsWith(']')) {
        return JSON.parse(imageUrl)[0];
      }
      return imageUrl;
    } catch (e) {
      return imageUrl;
    }
  };

  const displayName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Hucksta User';
  const displayUsername = profile?.username || session?.user?.email?.split('@')[0] || 'student';
  const displayAvatar = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.user?.id || 'default'}`;

  const userData = {
    firstName: displayName.split(' ')[0],
    lastName: displayName.split(' ').slice(1).join(' '),
    username: displayUsername,
    avatar: displayAvatar
  };

  if (isEditing) {
    return <EditProfile user={userData} session={session} onBack={() => setIsEditing(false)} />;
  }

  const itemsToDisplay = activeTab === 'active' ? myListings : favoriteListings;

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="relative h-64 bg-gradient-to-br from-orange-500 via-orange-600 to-emerald-600 p-6 flex flex-col justify-end">
        <button 
          onClick={handleLogout}
          className="absolute top-12 right-6 bg-white/20 p-2 rounded-xl text-white backdrop-blur-md hover:bg-white/30 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
        
        <div className="flex items-center space-x-4">
          <div className="relative group cursor-pointer" onClick={() => setIsEditing(true)}>
            <img 
              src={displayAvatar} 
              alt={displayName} 
              className="w-24 h-24 rounded-3xl border-4 border-white object-cover shadow-lg bg-orange-100 transition-transform active:scale-95" 
            />
            <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-xl shadow-md border border-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </div>
          </div>
          <div className="text-white overflow-hidden">
            <h2 className="text-2xl font-bold truncate pr-4">{displayName}</h2>
            <div className="flex items-center space-x-2 text-white/80 font-medium text-xs">
              <span>@{displayUsername}</span>
            </div>
          </div>
        </div>
      </div>

      {errorType === 'table_missing' ? (
        <div className="flex-1 p-6 flex flex-col justify-center bg-gray-50 overflow-hidden">
          <div className="bg-white rounded-[2.5rem] p-8 flex flex-col items-center text-center space-y-4 shadow-xl border border-orange-100 h-full max-h-[500px] overflow-y-auto no-scrollbar">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Sync Database</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest px-4">Missing columns detected. Paste and RUN this in your Supabase SQL Editor:</p>
            <div className="w-full relative group">
              <pre className="bg-gray-900 text-emerald-400 p-4 rounded-2xl text-[8px] overflow-x-auto whitespace-pre font-mono h-40 no-scrollbar border border-white/10 shadow-inner select-all w-full text-left">{setupSQL}</pre>
            </div>
            <button onClick={() => fetchAllData()} className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest shadow-lg shadow-orange-100 flex-shrink-0">Refresh Sync Status</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex border-b border-gray-100 px-2 sticky top-0 bg-white z-10">
            <button onClick={() => setActiveTab('active')} className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-wider relative transition-colors ${activeTab === 'active' ? 'text-orange-600' : 'text-gray-400'}`}>
              Active ({myListings.length})
              {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600 rounded-t-full"></div>}
            </button>
            <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-wider relative transition-colors ${activeTab === 'favorites' ? 'text-orange-600' : 'text-gray-400'}`}>
              Favorites ({favoriteListings.length})
              {activeTab === 'favorites' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600 rounded-t-full"></div>}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-4 bg-gray-50/30">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest text-center">Refreshing Campus Feed...</p>
              </div>
            ) : itemsToDisplay.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 pb-24">
                {itemsToDisplay.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => onSelectItem?.(item)} 
                    className="flex flex-col group active:scale-[0.98] transition-all cursor-pointer bg-white rounded-[1.75rem] p-1.5 border border-gray-100 shadow-sm hover:border-[#F15A24] hover:shadow-lg hover:shadow-orange-100/30"
                  >
                    <div className="relative aspect-[4/5] rounded-[1.5rem] overflow-hidden mb-2 bg-gray-50">
                      <img 
                        src={getThumbnail(item.image_url)} 
                        alt={item.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                      
                      {/* Feature: Condition Badge */}
                      <div className="absolute top-2 left-2 bg-white/95 backdrop-blur px-2 py-1 rounded-lg border border-orange-100 shadow-sm">
                        <span className="text-[7px] font-black text-[#F15A24] uppercase tracking-wider">{item.condition}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-0.5 px-1.5 pb-1.5">
                      {/* Feature: Brand */}
                      <span className="text-[7px] font-black text-orange-400 uppercase tracking-[0.1em] truncate h-3">
                        {item.brand || item.category}
                      </span>
                      
                      {/* Feature: Name */}
                      <h3 className="font-bold text-[#1A1A1A] text-[10px] tracking-tight line-clamp-1 leading-tight mb-0.5">
                        {item.title}
                      </h3>

                      {/* Features: Price and Location (Truncated) */}
                      <div className="flex justify-between items-baseline pt-0.5 space-x-2">
                        <span className="text-xs font-black text-[#F15A24] tracking-tighter shrink-0">
                          ${Number(item.price).toFixed(2)}
                        </span>
                        <span className="text-[7px] font-black text-[#B0B0B0] uppercase tracking-wider text-right truncate flex-1">
                          {item.location}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center px-8">
                <div className="bg-white p-8 rounded-[3rem] mb-6 shadow-sm border border-gray-100">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <p className="font-black text-sm text-gray-800 uppercase tracking-tighter">No {activeTab} items yet</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 mb-8">Start exploring the campus feed!</p>
                <button onClick={onGoHome} className="bg-orange-600 text-white font-black px-8 py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-95 transition-transform">Browse Market</button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0 flex space-x-3 z-10">
        <button onClick={() => setIsEditing(true)} className="flex-1 bg-white border-2 border-orange-600 text-orange-600 font-black py-4 rounded-2xl active:scale-[0.98] transition-all uppercase tracking-widest text-xs">Edit Profile</button>
        <button onClick={() => onGoHome?.()} className="flex-1 bg-orange-600 text-white font-black py-4 rounded-2xl active:scale-[0.98] transition-all uppercase tracking-widest text-xs shadow-lg shadow-orange-100">Shop Campus</button>
      </div>
    </div>
  );
};

export default Profile;
