import AsyncStorage from '@react-native-async-storage/async-storage'; // ← ADD THIS
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';
import { Database } from '../types/supabase';

// Get config from app.config.js
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration in app.config.js');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // ← ADD THIS LINE (MOST IMPORTANT)
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});