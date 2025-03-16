import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { authService, UserSession } from './auth'
import { customerService, orderService, itemService } from './database'
import { Database } from '@/types/database'
import { perfMonitor } from './utils'
import { CACHE_DURATION, PERFORMANCE, FEATURES } from '@/constants/config'

// Define the types for our app state
type Customer = Database['public']['Tables']['customers']['Row']
type Order = Database['public']['Tables']['orders']['Row']
type Item = Database['public']['Tables']['items']['Row']

// Define the context shape
interface AppContextType {
  // Auth state
  isAuthenticated: boolean
  isAdmin: boolean
  userSession: UserSession | null
  isLoading: boolean
  
  // Data
  customer: Customer | null
  recentOrders: Order[]
  items: Item[]
  
  // Performance flags
  isOfflineMode: boolean
  
  // Actions
  login: (email: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<{ success: boolean; error?: string }>
  refreshCustomerData: () => Promise<void>
  refreshOrders: () => Promise<void>
  refreshItems: () => Promise<void>
  toggleOfflineMode: () => void
}

// Create the context with a default value
const AppContext = createContext<AppContextType>({
  isAuthenticated: false,
  isAdmin: false,
  userSession: null,
  isLoading: true,
  
  customer: null,
  recentOrders: [],
  items: [],
  
  isOfflineMode: false,
  
  login: async () => ({ success: false, error: 'AppContext not initialized' }),
  logout: async () => ({ success: false, error: 'AppContext not initialized' }),
  refreshCustomerData: async () => {},
  refreshOrders: async () => {},
  refreshItems: async () => {},
  toggleOfflineMode: () => {},
})

// Create a provider component
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userSession, setUserSession] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Data state
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [items, setItems] = useState<Item[]>([])
  
  // Performance state
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [lastDataRefresh, setLastDataRefresh] = useState<Record<string, number>>({})
  
  // Toggle offline mode
  const toggleOfflineMode = useCallback(() => {
    if (FEATURES.ENABLE_OFFLINE_MODE) {
      setIsOfflineMode(prev => !prev)
    }
  }, [])
  
  // Determine if data refresh is needed based on cache duration
  const isRefreshNeeded = useCallback((key: string) => {
    const lastRefresh = lastDataRefresh[key] || 0
    const now = Date.now()
    return (now - lastRefresh) > CACHE_DURATION.MEDIUM
  }, [lastDataRefresh])
  
  // Update last refresh time
  const updateRefreshTime = useCallback((key: string) => {
    setLastDataRefresh(prev => ({
      ...prev,
      [key]: Date.now()
    }))
  }, [])
  
  // Initialize app state
  useEffect(() => {
    const initializeAppState = async () => {
      try {
        perfMonitor.startTimer('initializeAppState')
        
        // Check authentication state
        const authenticated = await authService.isAuthenticated()
        setIsAuthenticated(authenticated)
        
        if (authenticated) {
          // Get user session
          const session = await authService.getSession()
          setUserSession(session)
          
          // Check if admin
          const admin = await authService.isAdmin()
          setIsAdmin(admin)
          
          // Fetch customer data if customer
          if (!admin && session) {
            await refreshCustomerData()
            await refreshOrders()
          }
        }
        
        const initTime = perfMonitor.endTimer('initializeAppState')
        if (initTime > PERFORMANCE.RENDER_THRESHOLD) {
          console.warn(`App initialization took ${initTime}ms, which exceeds the threshold of ${PERFORMANCE.RENDER_THRESHOLD}ms`)
        }
      } catch (error) {
        console.error('Error initializing app state:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    initializeAppState()
  }, [])
  
  // Login function
  const login = async (email: string) => {
    try {
      perfMonitor.startTimer('loginAction')
      
      // Use auth service to sign in
      const result = await authService.signInWithEmail(email)
      
      const loginTime = perfMonitor.endTimer('loginAction')
      if (loginTime > PERFORMANCE.FETCH_THRESHOLD) {
        console.warn(`Login took ${loginTime}ms, which exceeds the threshold of ${PERFORMANCE.FETCH_THRESHOLD}ms`)
      }
      
      return result
    } catch (error: any) {
      console.error('Login error:', error)
      return { 
        success: false,
        error: error.message || 'Failed to sign in. Please try again.'
      }
    }
  }
  
  // Logout function
  const logout = async () => {
    try {
      perfMonitor.startTimer('logoutAction')
      
      // Clear app state first
      setIsAuthenticated(false)
      setIsAdmin(false)
      setUserSession(null)
      setCustomer(null)
      setRecentOrders([])
      
      // Use auth service to sign out
      const result = await authService.signOut()
      
      perfMonitor.endTimer('logoutAction')
      return result
    } catch (error: any) {
      console.error('Logout error:', error)
      return { 
        success: false,
        error: error.message || 'Failed to sign out. Please try again.'
      }
    }
  }
  
  // Refresh customer data
  const refreshCustomerData = async () => {
    try {
      if (!userSession || (isOfflineMode && !isRefreshNeeded('customer'))) return
      
      perfMonitor.startTimer('refreshCustomerData')
      
      const customerData = await customerService.getById(userSession.id)
      if (customerData) {
        setCustomer(customerData)
        updateRefreshTime('customer')
      }
      
      const refreshTime = perfMonitor.endTimer('refreshCustomerData')
      if (refreshTime > PERFORMANCE.DB_OPERATION_THRESHOLD) {
        console.warn(`Customer data refresh took ${refreshTime}ms, which exceeds the threshold of ${PERFORMANCE.DB_OPERATION_THRESHOLD}ms`)
      }
    } catch (error) {
      console.error('Error refreshing customer data:', error)
    }
  }
  
  // Refresh orders
  const refreshOrders = async () => {
    try {
      if (!userSession || (isOfflineMode && !isRefreshNeeded('orders'))) return
      
      perfMonitor.startTimer('refreshOrders')
      
      const ordersData = await orderService.getByCustomerId(userSession.id)
      setRecentOrders(ordersData)
      updateRefreshTime('orders')
      
      const refreshTime = perfMonitor.endTimer('refreshOrders')
      if (refreshTime > PERFORMANCE.DB_OPERATION_THRESHOLD) {
        console.warn(`Orders refresh took ${refreshTime}ms, which exceeds the threshold of ${PERFORMANCE.DB_OPERATION_THRESHOLD}ms`)
      }
    } catch (error) {
      console.error('Error refreshing orders:', error)
    }
  }
  
  // Refresh items
  const refreshItems = async () => {
    try {
      if (isOfflineMode && !isRefreshNeeded('items')) return
      
      perfMonitor.startTimer('refreshItems')
      
      const itemsData = await itemService.getAll()
      setItems(itemsData)
      updateRefreshTime('items')
      
      const refreshTime = perfMonitor.endTimer('refreshItems')
      if (refreshTime > PERFORMANCE.DB_OPERATION_THRESHOLD) {
        console.warn(`Items refresh took ${refreshTime}ms, which exceeds the threshold of ${PERFORMANCE.DB_OPERATION_THRESHOLD}ms`)
      }
    } catch (error) {
      console.error('Error refreshing items:', error)
    }
  }
  
  // Create the context value
  const contextValue: AppContextType = {
    isAuthenticated,
    isAdmin,
    userSession,
    isLoading,
    
    customer,
    recentOrders,
    items,
    
    isOfflineMode,
    
    login,
    logout,
    refreshCustomerData,
    refreshOrders,
    refreshItems,
    toggleOfflineMode,
  }
  
  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

// Create a custom hook to use the context
export const useAppContext = () => useContext(AppContext)

// Export a way to wrap the app with the provider
export const withAppProvider = (Component: React.ComponentType) => {
  return function WithAppProvider(props: any) {
    return (
      <AppProvider>
        <Component {...props} />
      </AppProvider>
    )
  }
} 