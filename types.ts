
export type Category = 'Clothing' | 'Furniture' | 'Electronics';

export interface Listing {
  id: string;
  title: string;
  brand?: string;
  size?: string;
  gender?: 'Mens' | 'Womens' | 'Unisex';
  price: number;
  condition: string;
  category: Category;
  location: string;
  description?: string;
  image_url: string;
  seller_id: string;
  created_at: string;
}

export interface User {
  name: string;
  handle: string;
  rating: number;
  reviewsCount: number;
  joinedDate: string;
  avatar: string;
}

export enum Tab {
  HOME = 'home',
  MESSAGES = 'messages',
  SELL = 'sell',
  PROFILE = 'profile'
}