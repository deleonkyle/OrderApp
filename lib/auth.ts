import { supabase, signOut } from "@/lib/supabase"
import { storage } from "./utils"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { perfMonitor } from "./utils"
import { clearDatabaseCache } from "./database"
import { CACHE_DURATION } from "@/constants/config"

// Store current session information to avoid redundant calls
let currentSessionData: UserSession | null = null

// Define user session type
export interface UserSession {
  id: string
  email?: string
  phone?: string
  name: string
  role: "customer" | "admin"
}

/**
 * Authentication service with optimized methods
 */
export const authService = {
  /**
   * Get the current user session with caching
   */
  async getSession(): Promise<UserSession | null> {
    try {
      // Return cached session if available
      if (currentSessionData) {
        return currentSessionData
      }
      
      // Get session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session?.user?.id) return null
      
      // First check if this is an admin
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('name, email, phone')
        .eq('id', session.user.id)
        .single()
      
      if (!adminError && adminData) {
        // Admin user
        currentSessionData = {
          id: session.user.id,
          name: adminData.name,
          email: adminData.email,
          phone: adminData.phone || undefined,
          role: "admin"
        }
        return currentSessionData
      }
      
      // Otherwise, check if this is a customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('name, email, phone')
        .eq('id', session.user.id)
        .single()
      
      if (customerError || !customerData) return null
      
      // Customer user
      currentSessionData = {
        id: session.user.id,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone || undefined,
        role: "customer"
      }
      
      return currentSessionData
    } catch (error) {
      console.error("Error getting session:", error)
      return null
    }
  },

  /**
   * Check if the user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession()
    return !!session
  },

  /**
   * Check if the user is an admin
   */
  async isAdmin(): Promise<boolean> {
    try {
      // First check via RPC to the is_admin function
      try {
        const { data, error } = await supabase.rpc('is_admin')
        if (!error) return !!data
      } catch (e) {
        // If RPC fails, fall back to database query
        console.warn("is_admin RPC failed, falling back to direct query", e)
      }
      
      const session = await this.getSession()
      if (!session) return false

      // Check admins table
      const { data, error } = await supabase
        .from('admins')
        .select('id')
        .eq('id', session.id)
        .single()

      return !!data && !error
    } catch (error) {
      console.error("Error checking admin status:", error)
      return false
    }
  },

  /**
   * Sign in with email OTP
   */
  async signInWithEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      perfMonitor.startTimer("signInWithEmail")
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      })

      perfMonitor.endTimer("signInWithEmail")

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      console.error("Error signing in with email:", error)
      return { success: false, error: error.message || "Failed to send login link" }
    }
  },

  /**
   * Sign in with phone OTP
   */
  async signInWithPhone(phone: string): Promise<{ success: boolean; error?: string }> {
    try {
      perfMonitor.startTimer("signInWithPhone")
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: false,
        },
      })
      
      perfMonitor.endTimer("signInWithPhone")

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      console.error("Error signing in with phone:", error)
      return { success: false, error: error.message || "Failed to send verification code" }
    }
  },

  /**
   * Verify OTP for email login
   */
  async verifyEmailOtp(email: string, token: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      perfMonitor.startTimer("verifyEmailOtp")
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      })

      perfMonitor.endTimer("verifyEmailOtp")

      if (error) {
        throw error
      }

      // Create and store session
      const userSession: UserSession = {
        id: data.user?.id || "",
        email: email,
        name: data.user?.user_metadata?.name || email.split("@")[0],
        role: "customer", // Default role
      }

      await storage.setItem("userSession", userSession)
      currentSessionData = userSession

      return { success: true, user: data.user }
    } catch (error: any) {
      console.error("Error verifying email OTP:", error)
      return { success: false, error: error.message || "Invalid verification code" }
    }
  },

  /**
   * Verify OTP for phone login
   */
  async verifyPhoneOtp(phone: string, token: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      perfMonitor.startTimer("verifyPhoneOtp")
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      })

      perfMonitor.endTimer("verifyPhoneOtp")

      if (error) {
        throw error
      }

      // Create and store session
      const userSession: UserSession = {
        id: data.user?.id || "",
        phone: phone,
        name: data.user?.user_metadata?.name || "User",
        role: "customer", // Default role
      }

      await storage.setItem("userSession", userSession)
      currentSessionData = userSession

      return { success: true, user: data.user }
    } catch (error: any) {
      console.error("Error verifying phone OTP:", error)
      return { success: false, error: error.message || "Invalid verification code" }
    }
  },

  /**
   * Register a new user
   */
  async register(userData: {
    email: string
    password: string
    name: string
    phone: string
    address: string
    barangay?: string
    town?: string
    province?: string
    contact_person?: string
    contact_number?: string
  }): Promise<{ success: boolean; error?: string }> {
    try {
      perfMonitor.startTimer("register")
      
      // Store the registration data for use after email verification
      await storage.setItem("pendingRegistration", userData)

      // Sign up the user
      const { error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
          },
        },
      })

      perfMonitor.endTimer("register")

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      console.error("Error registering user:", error)
      return { success: false, error: error.message || "Registration failed" }
    }
  },

  /**
   * Request a password reset
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      perfMonitor.startTimer("resetPassword")
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "ordermanagementapp:///auth/callback?type=recovery",
      })

      perfMonitor.endTimer("resetPassword")

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      console.error("Error requesting password reset:", error)
      return { success: false, error: error.message || "Failed to send reset email" }
    }
  },

  /**
   * Update user password
   */
  async updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      perfMonitor.startTimer("updatePassword")
      const { error } = await supabase.auth.updateUser({
        password,
      })

      perfMonitor.endTimer("updatePassword")

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      console.error("Error updating password:", error)
      return { success: false, error: error.message || "Failed to update password" }
    }
  },

  /**
   * Sign out the current user with optimized cleanup
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      perfMonitor.startTimer("signOut")

      // Clear cached session first
      currentSessionData = null
      
      // Clear all auth-related items from storage
      await storage.multiRemoveByPrefix("supabase.")
      await storage.removeItem("userSession")
      await storage.removeItem("pendingRegistration")
      
      // Clear database cache to ensure fresh data on next login
      clearDatabaseCache()
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      
      perfMonitor.endTimer("signOut")

      if (error) {
        console.warn("Warning signing out from Supabase:", error)
        // Continue even if there's an error with Supabase signout
        // since we've already cleared local storage
      }

      return { success: true }
    } catch (error: any) {
      console.error("Error during sign out process:", error)
      // Even if there's an error, we'll consider it successful since local data is cleared
      return { success: true }
    }
  },

  /**
   * Store a user session manually (for admin users)
   */
  async storeSession(session: UserSession): Promise<boolean> {
    try {
      await storage.setItem("userSession", session)
      currentSessionData = session
      return true
    } catch (error) {
      console.error("Error storing session:", error)
      return false
    }
  },

  /**
   * Get current user ID
   */
  async getUserId(): Promise<string | null> {
    const session = await this.getSession()
    return session?.id || null
  },

  /**
   * Register a new admin account
   * Only the first admin can be registered without being authorized
   * Subsequent admins require an existing admin to create them
   */
  async registerAdmin(userData: {
    email: string
    password: string
    name: string
    phone: string
    token?: string // We'll keep this for backward compatibility
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if this is a valid invited user
      const isInvited = await this.isUserInvited(userData.email)
      const isSetupComplete = await this.isAdminSetupComplete()
      
      // If admin setup is complete, only allow invited users
      if (isSetupComplete && !isInvited) {
        return {
          success: false,
          error: "Only invited users can register as admins"
        }
      }

      // Register user with Supabase auth
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      })

      if (error) throw error

      const userId = data?.user?.id
      if (!userId) {
        throw new Error("Failed to create user account.")
      }
      
      // If user was invited, update their role to admin
      // Otherwise (first admin) insert a new admin record
      if (isInvited) {
        await this.markInvitationAsUsed(userId, userData.email)
      } else {
        // Insert admin record for first admin
        const { error: insertError } = await supabase
          .from('admins')
          .insert({
            id: userId,
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            role: 'admin',
            created_at: new Date().toISOString(),
          })
        
        if (insertError) throw insertError
      }
      
      return { success: true }
    } catch (error: any) {
      console.error("Error registering admin:", error)
      return { 
        success: false, 
        error: error.message || "Failed to register admin account." 
      }
    }
  },
  
  /**
   * Check if the admin setup has been completed
   */
  async isAdminSetupComplete(): Promise<boolean> {
    try {
      // Check local storage for setup complete flag
      const setupComplete = await AsyncStorage.getItem('ADMIN_SETUP_COMPLETE')
      if (setupComplete === 'true') return true
      
      // If no flag, check if any admins exist
      const { data, error } = await supabase
        .from('admins')
        .select('id')
        .limit(1)
        
      if (error) throw error
      
      const hasAdmins = !!data && data.length > 0
      
      // If admins exist, set flag for future checks
      if (hasAdmins) {
        await AsyncStorage.setItem('ADMIN_SETUP_COMPLETE', 'true')
      }
      
      return hasAdmins
    } catch (error) {
      console.error("Error checking admin setup:", error)
      return false
    }
  },

  /**
   * Handles user logout
   */
  logout: async (): Promise<{ success: boolean, error?: string }> => {
    try {
      perfMonitor.startTimer('logout')

      // Clear cached session first
      currentSessionData = null
      
      // Clear all auth-related items from storage
      await storage.multiRemoveByPrefix("supabase.")
      await storage.removeItem("userSession")
      await storage.removeItem("pendingRegistration")
      
      // Clear database cache
      clearDatabaseCache()
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }

      perfMonitor.endTimer('logout')
      return { success: true }
    } catch (error: any) {
      console.error("Logout error:", error)
      return { 
        success: false, 
        error: error.message || "Failed to log out. Please try again."
      }
    }
  },

  /**
   * Sign in with email and password
   */
  async signInWithEmailAndPassword(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      perfMonitor.startTimer("signInWithEmailAndPassword")
      
      // Sign in with Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Check if this user exists in our customers table
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (customerError || !customerData) {
        // If not a customer, sign out and return error
        await supabase.auth.signOut()
        throw new Error("Account not found. Please register first.")
      }

      // Create and store session
      const userSession: UserSession = {
        id: data.user.id,
        email: email,
        name: customerData.name,
        role: "customer",
      }

      await storage.setItem("userSession", userSession)
      currentSessionData = userSession

      perfMonitor.endTimer("signInWithEmailAndPassword")
      return { success: true }
    } catch (error: any) {
      console.error("Error signing in:", error)
      return { 
        success: false, 
        error: error.message || "Failed to sign in. Please try again." 
      }
    }
  },

  // Remove the custom invitation methods
  async validateInvitationToken(email: string, token: string): Promise<boolean> {
    try {
      // With Supabase invitations, we validate based on the email and invite status
      // Check if the user is in the admins table with role 'invited'
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("role", "invited")
        .single()

      if (error || !data) {
        console.error("Invitation validation error:", error)
        return false
      }

      return true
    } catch (error) {
      console.error("Error validating invitation:", error)
      return false
    }
  },

  // Update this method to set the user role to 'admin' instead of using tokens
  async markInvitationAsUsed(userId: string, email: string): Promise<boolean> {
    try {
      // Update the admin record role from 'invited' to 'admin'
      const { error } = await supabase
        .from("admins")
        .update({ 
          role: "admin",
          updated_at: new Date().toISOString() 
        })
        .eq("email", email.toLowerCase())
        .eq("role", "invited")

      if (error) {
        console.error("Error updating invitation status:", error)
        return false
      }

      return true
    } catch (error) {
      console.error("Error updating invitation:", error)
      return false
    }
  },

  // Replace this with an admin check function
  async isUserInvited(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("role", "invited")
        .single()

      if (error || !data) {
        return false
      }

      return true
    } catch (error) {
      console.error("Error checking invitation status:", error)
      return false
    }
  },

  // Add a new method to create admin invitations
  async createAdminInvitation(email: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const adminId = await this.getUserId()
      if (!adminId) {
        return { success: false, error: "Not authorized to create invitations" }
      }

      // Generate a token and set expiration
      const token = Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15)
      const now = new Date()
      const expiresAt = new Date(now.setDate(now.getDate() + 7)).toISOString() // 7 days from now

      // Insert the invitation
      const { data, error } = await supabase
        .from("admin_invitations")
        .insert({
          email: email.toLowerCase(),
          token,
          created_by: adminId,
          expires_at: expiresAt,
          used: false
        })
        .select()

      if (error) throw error

      return { success: true, token }
    } catch (error) {
      console.error("Error creating invitation:", error)
      return { success: false, error: "Failed to create invitation" }
    }
  },

  // Add a method to get admin invitations
  async getAdminInvitations(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("admin_invitations")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error("Error fetching invitations:", error)
      return []
    }
  },
} 