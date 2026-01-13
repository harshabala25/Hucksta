
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Hardcoded Supabase credentials provided by the user
const supabaseUrl: string = 'https://ueeraardwqehsrgfbrii.supabase.co';
const supabaseAnonKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZXJhYXJkd3FlaHNyZ2ZicmlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNDY0ODgsImV4cCI6MjA4MjYyMjQ4OH0.gsVPBXMG2IkLa41sIQpZPsuKddBnc5vk5Mau7oE8JSg';

// A simple check to see if we have the credentials
export const isSupabaseConfigured = supabaseUrl !== '' && 
                                    supabaseAnonKey !== '' && 
                                    !supabaseUrl.includes('placeholder') &&
                                    supabaseAnonKey.startsWith('eyJ');

// Initialize client
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-please-set-secrets.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
