
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface MarketplaceProps {
  session: any;
  onSelectItem?: (item: any) => void;
  onFavoriteChange?: (isSaved: boolean) => void;
}

const Marketplace: React.FC<MarketplaceProps> = ({ session, onSelectItem, onFavoriteChange }) => {
  const [activeCategory, setActiveCategory] = useState('Clothing');
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [burstingId, setBurstingId] = useState<string | null>(null);

  const categories = [
    { name: 'Clothing', icon: '👕' },
    { name: 'Furniture', icon: '🪑' },
    { name: 'Electronics', icon: '💻' }
  ];

  useEffect(() => {
    fetchListings();
    if (session?.user?.id) {
      fetchFavorites();
    }

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('marketplace-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => fetchListings())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session?.user?.id]);

  const fetchListings = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setListings(data);
    } catch (err: any) {
      console.error('Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('listing_id')
        .eq('user_id', session.user.id);
      if (error) throw error;
      if (data) setFavorites(new Set(data.map(f => f.listing_id)));
    } catch (err: any) {
      console.error('Error fetching favorites:', err.message);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, listingId: string) => {
    e.stopPropagation();
    if (!session?.user?.id) return;

    const isFavorited = favorites.has(listingId);
    setBurstingId(listingId);
    setTimeout(() => setBurstingId(null), 400);

    const nextFavorites = new Set(favorites);
    if (isFavorited) nextFavorites.delete(listingId);
    else nextFavorites.add(listingId);
    setFavorites(nextFavorites);

    onFavoriteChange?.(!isFavorited);

    try {
      if (isFavorited) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', session.user.id)
          .eq('listing_id', listingId);
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: session.user.id, listing_id: listingId });
      }
    } catch (err: any) {
      console.error('Error toggling favorite:', err.message);
    }
  };

  const displayedItems = listings.filter(item => {
    const matchesCategory = item.category === activeCategory;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = item.title.toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

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

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto no-scrollbar">
      {/* Brand Header */}
      <div className="pt-12 px-6 pb-2">
        <h1 className="text-[40px] font-[900] text-[#F15A24] tracking-tighter leading-none">Hucksta</h1>
      </div>

      {/* Search Bar */}
      <div className="px-6 mb-6 mt-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search campus items..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F6F7F9] rounded-2xl py-4 pl-12 pr-6 text-xs font-semibold focus:outline-none transition-all placeholder-gray-400 border border-transparent focus:border-orange-100"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex space-x-2 px-6 mb-6 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(cat.name)}
            className={`flex items-center space-x-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all active:scale-95 ${
              activeCategory === cat.name 
                ? 'bg-[#F15A24] text-white shadow-md shadow-orange-100' 
                : 'bg-[#F6F7F9] text-[#707E8C] font-black'
            }`}
          >
            <span className="text-lg">{cat.icon}</span>
            <span className="text-[10px] font-black uppercase tracking-widest">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Item Grid - Tighter grid matching Profile view */}
      <div className="px-4 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#F15A24] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : displayedItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {displayedItems.map((item) => {
              const isOwner = session?.user?.id === item.seller_id;
              return (
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

                    {/* Favorite Button */}
                    {!isOwner && (
                      <button 
                        onClick={(e) => toggleFavorite(e, item.id)}
                        className={`absolute top-2 right-2 p-1.5 rounded-full bg-white shadow-md transition-all active:scale-90 ${
                          burstingId === item.id ? 'animate-heart-burst' : ''
                        }`}
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className={`h-3.5 w-3.5 ${favorites.has(item.id) ? 'fill-[#F15A24] text-[#F15A24]' : 'text-[#F15A24]'}`} 
                          fill={favorites.has(item.id) ? "currentColor" : "none"} 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    )}
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
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No results found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
