import "react-native-url-polyfill/auto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"
import { Database } from "@/types/database"
import type { Session, User } from "@supabase/supabase-js"
import * as Linking from 'expo-linking'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase configuration. Please check your environment variables.")
}

// Get the scheme from app.config.ts
const scheme = 'ordermanagementapp'
const redirectUrl = Linking.createURL('auth/callback')

// Configure localStorage with AsyncStorage to improve caching
const customStorage = {
  getItem: async (key: string) => {
    const value = await AsyncStorage.getItem(key)
    return value || null
  },
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value)
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key)
  },
}

// Create the Supabase client with optimized settings
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: __DEV__,
  },
  global: {
    headers: {
      'X-App-Version': '1.0.0',
    },
  },
  db: {
    schema: 'public',
  },
  // Add performance realtime settings
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Improved deep linking handler with error recovery
Linking.addEventListener('url', async ({ url }) => {
  if (url.includes('auth/callback')) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
        // Attempt recovery by redirecting to login
        try {
          await Linking.openURL('ordermanagementapp:///auth/customer-login')
        } catch (e) {
          console.error('Failed to open login URL:', e)
        }
      }
    } catch (e) {
      console.error('Deep linking error:', e)
    }
  }
})

// Helper function to get the current session with caching
let cachedSession: Session | null = null
let sessionCacheTime = 0
const SESSION_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const getCurrentSession = async () => {
  try {
    // Return cached session if it's still valid
    const now = Date.now()
    if (cachedSession && now - sessionCacheTime < SESSION_CACHE_DURATION) {
      return cachedSession
    }

    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    
    // Update cache
    cachedSession = session
    sessionCacheTime = now
    
    return session
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

// Helper function to get the current user with caching
let cachedUser: User | null = null
let userCacheTime = 0
const USER_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const getCurrentUser = async () => {
  try {
    // Return cached user if it's still valid
    const now = Date.now()
    if (cachedUser && now - userCacheTime < USER_CACHE_DURATION) {
      return cachedUser
    }

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    
    // Update cache
    cachedUser = user
    userCacheTime = now
    
    return user
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

// Improved sign out function with cleanup
export const signOut = async () => {
  try {
    // Clear the caches first
    cachedSession = null
    cachedUser = null
    
    // Remove all auth-related data from AsyncStorage
    const keys = await AsyncStorage.getAllKeys()
    const authKeys = keys.filter(key => 
      key.includes('supabase') || 
      key.includes('session') || 
      key.includes('user')
    )
    
    if (authKeys.length > 0) {
      await AsyncStorage.multiRemove(authKeys)
    }
    
    // Then sign out from Supabase
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out from Supabase:', error)
    }
  } catch (error) {
    console.error('Error during sign out process:', error)
  }
}

// Helper function to check if Supabase client has valid credentials
export const validateSupabaseCredentials = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase configuration. Please check your environment variables.");
    return false;
  }
  return true;
}

