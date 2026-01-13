
import React from 'react';
import { Category } from '../types';
import ClothingListingForm from './ClothingListingForm';
import FurnitureListingForm from './FurnitureListingForm';
import ElectronicsListingForm from './ElectronicsListingForm';

interface SellFlowProps {
  category: Category | null;
  onSelectCategory: (cat: Category | null) => void;
  onCancel: () => void;
  onSuccess: () => void;
  session: any;
}

const SellFlow: React.FC<SellFlowProps> = ({ 
  category, 
  onSelectCategory, 
  onCancel, 
  onSuccess,
  session
}) => {
  if (category === 'Clothing') {
    return (
      <ClothingListingForm 
        onBack={() => onSelectCategory(null)} 
        onSuccess={onSuccess}
        session={session}
      />
    );
  }
  if (category === 'Furniture') {
    return (
      <FurnitureListingForm 
        onBack={() => onSelectCategory(null)} 
        onSuccess={onSuccess}
        session={session}
      />
    );
  }
  if (category === 'Electronics') {
    return (
      <ElectronicsListingForm 
        onBack={() => onSelectCategory(null)} 
        onSuccess={onSuccess}
        session={session}
      />
    );
  }
  return (
    <div className="h-full bg-orange-600 flex flex-col">
      <div className="p-6 pt-14 flex items-start space-x-4">
        <button onClick={onCancel} className="bg-white/20 p-2 rounded-full text-white active:scale-95 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-white text-xl font-bold leading-tight">What are you selling?</h1>
          <p className="text-white/80 text-sm">Choose a category to get started</p>
        </div>
      </div>
      <div className="flex-1 bg-orange-600 p-6 space-y-4 pb-32 overflow-y-auto no-scrollbar">
        <button onClick={() => onSelectCategory('Clothing')} className="w-full bg-white rounded-3xl p-6 flex items-center justify-between text-left transition-transform active:scale-[0.98] shadow-lg">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Clothing</h2>
              <p className="text-sm text-gray-500">Shirts, Jackets, Hoodies & More</p>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <button onClick={() => onSelectCategory('Furniture')} className="w-full bg-white rounded-3xl p-6 flex items-center justify-between text-left transition-transform active:scale-[0.98] shadow-lg">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M10 14h4M4 18h16" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Furniture</h2>
              <p className="text-sm text-gray-500">Desks, Chairs, Beds & More</p>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <button onClick={() => onSelectCategory('Electronics')} className="w-full bg-white rounded-3xl p-6 flex items-center justify-between text-left transition-transform active:scale-[0.98] shadow-lg">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Electronics</h2>
              <p className="text-sm text-gray-500">Laptops, Phones, & More</p>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
};

export default SellFlow;
