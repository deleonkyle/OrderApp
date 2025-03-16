import AsyncStorage from "@react-native-async-storage/async-storage"
import { format, parseISO } from "date-fns"
import { CACHE_DURATION, PERFORMANCE, APP } from '@/constants/config'

/**
 * Optimized storage utilities with error handling and caching
 */
export const storage = {
  // In-memory cache for frequently accessed items
  _cache: new Map<string, { value: any; timestamp: number }>(),
  _cacheTTL: CACHE_DURATION.MEDIUM, // Use our centralized cache duration

  /**
   * Get an item from storage with optional cache support
   */
  async getItem<T>(key: string, useCache = true): Promise<T | null> {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cached = this._cache.get(key)
        const now = Date.now()
        if (cached && now - cached.timestamp < this._cacheTTL) {
          return cached.value as T
        }
      }

      // Fetch from AsyncStorage
      const value = await AsyncStorage.getItem(key)
      if (!value) return null

      // Parse and update cache
      const parsed = JSON.parse(value) as T
      if (useCache) {
        this._cache.set(key, { value: parsed, timestamp: Date.now() })
      }
      
      return parsed
    } catch (error) {
      console.error(`Failed to get item: ${key}`, error)
      return null
    }
  },

  /**
   * Set an item in storage with cache update
   */
  async setItem(key: string, value: any): Promise<boolean> {
    try {
      const jsonValue = JSON.stringify(value)
      await AsyncStorage.setItem(key, jsonValue)
      
      // Update cache
      this._cache.set(key, { value, timestamp: Date.now() })
      return true
    } catch (error) {
      console.error(`Failed to set item: ${key}`, error)
      return false
    }
  },

  /**
   * Remove an item from storage and cache
   */
  async removeItem(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key)
      this._cache.delete(key)
      return true
    } catch (error) {
      console.error(`Failed to remove item: ${key}`, error)
      return false
    }
  },

  /**
   * Clear multiple items from storage by prefix
   */
  async multiRemoveByPrefix(prefix: string): Promise<boolean> {
    try {
      const keys = await AsyncStorage.getAllKeys()
      const matchingKeys = keys.filter(key => key.startsWith(prefix))
      
      if (matchingKeys.length > 0) {
        await AsyncStorage.multiRemove(matchingKeys)
        
        // Clear from cache too
        matchingKeys.forEach(key => this._cache.delete(key))
      }
      return true
    } catch (error) {
      console.error(`Failed to remove items with prefix: ${prefix}`, error)
      return false
    }
  },
  
  /**
   * Clear all storage data including cache
   */
  async clearAll(): Promise<boolean> {
    try {
      await AsyncStorage.clear()
      this._cache.clear()
      return true
    } catch (error) {
      console.error("Failed to clear storage", error)
      return false
    }
  }
}

/**
 * Debounce function to limit frequent function calls
 */
export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number = APP.DEBOUNCE_TIME
): ((...args: Parameters<F>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<F>): void => {
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), waitFor)
  }
}

/**
 * Throttle function to limit the rate of function calls
 */
export const throttle = <F extends (...args: any[]) => any>(
  func: F,
  limit: number = APP.THROTTLE_TIME
): ((...args: Parameters<F>) => void) => {
  let lastCall = 0
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<F>): void => {
    const now = Date.now()
    if (now - lastCall < limit && timeout === null) {
      timeout = setTimeout(() => {
        lastCall = now
        func(...args)
        timeout = null
      }, limit - (now - lastCall))
    } else if (timeout === null) {
      lastCall = now
      func(...args)
    }
  }
}

/**
 * Validation functions
 */
export const validation = {
  email: (email: string): boolean => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return regex.test(email)
  },
  
  phone: (phone: string): boolean => {
    const regex = /^\+?[0-9]{10,14}$/
    return regex.test(phone.replace(/[\s-()]/g, ''))
  },
  
  password: (password: string): { isValid: boolean; message: string } => {
    if (password.length < 8) {
      return { isValid: false, message: "Password must be at least 8 characters" }
    }
    
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      return { 
        isValid: false, 
        message: "Password must contain uppercase, lowercase and numbers" 
      }
    }
    
    return { isValid: true, message: "" }
  }
}

/**
 * Date formatting and manipulation utilities
 */
export const dateUtils = {
  /**
   * Format a date string
   */
  format: (date: string, formatString: string = "MMMM d, yyyy"): string => {
    try {
      return format(parseISO(date), formatString)
    } catch (error) {
      console.error("Error formatting date:", error)
      return date
    }
  },
  
  /**
   * Get relative time (e.g., "2 days ago")
   */
  getRelativeTime: (dateString: string): string => {
    try {
      const date = parseISO(dateString)
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
      
      if (diffInSeconds < 60) {
        return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`
      }
      
      const diffInMinutes = Math.floor(diffInSeconds / 60)
      if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
      }
      
      const diffInHours = Math.floor(diffInMinutes / 60)
      if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
      }
      
      const diffInDays = Math.floor(diffInHours / 24)
      if (diffInDays < 30) {
        return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
      }
      
      const diffInMonths = Math.floor(diffInDays / 30)
      if (diffInMonths < 12) {
        return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`
      }
      
      const diffInYears = Math.floor(diffInMonths / 12)
      return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`
    } catch (error) {
      console.error("Error calculating relative time:", error)
      return dateString
    }
  }
}

/**
 * Performance monitoring utilities
 */
export const perfMonitor = {
  timings: new Map<string, number>(),
  history: new Map<string, number[]>(),
  maxHistorySize: 10,
  
  startTimer: (label: string): void => {
    perfMonitor.timings.set(label, performance.now())
  },
  
  endTimer: (label: string): number => {
    const start = perfMonitor.timings.get(label)
    if (!start) {
      console.warn(`No timer found for: ${label}`)
      return 0
    }
    
    const duration = performance.now() - start
    console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`)
    perfMonitor.timings.delete(label)
    
    // Store in history for performance tracking
    perfMonitor.addToHistory(label, duration)
    
    return duration
  },
  
  addToHistory: (label: string, duration: number): void => {
    const history = perfMonitor.history.get(label) || []
    history.push(duration)
    
    // Keep only the most recent entries
    if (history.length > perfMonitor.maxHistorySize) {
      history.shift()
    }
    
    perfMonitor.history.set(label, history)
  },
  
  getAverage: (label: string): number => {
    const history = perfMonitor.history.get(label)
    if (!history || history.length === 0) return 0
    
    const sum = history.reduce((acc, val) => acc + val, 0)
    return sum / history.length
  },
  
  isPerformanceCritical: (label: string): boolean => {
    const avg = perfMonitor.getAverage(label)
    
    // Check against appropriate threshold based on operation type
    if (label.includes('DB') || label.includes('database')) {
      return avg > PERFORMANCE.DB_OPERATION_THRESHOLD
    } else if (label.includes('render') || label.includes('initialize')) {
      return avg > PERFORMANCE.RENDER_THRESHOLD
    } else if (label.includes('fetch') || label.includes('network')) {
      return avg > PERFORMANCE.FETCH_THRESHOLD
    }
    
    // Default threshold
    return avg > PERFORMANCE.RENDER_THRESHOLD
  },
  
  getPerformanceReport: (): Record<string, { 
    average: number; 
    isCritical: boolean; 
    samples: number 
  }> => {
    const report: Record<string, { 
      average: number; 
      isCritical: boolean; 
      samples: number 
    }> = {}
    
    perfMonitor.history.forEach((durations, label) => {
      const average = perfMonitor.getAverage(label)
      report[label] = {
        average,
        isCritical: perfMonitor.isPerformanceCritical(label),
        samples: durations.length
      }
    })
    
    return report
  }
}

/**
 * Memoization helper for expensive calculations
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  maxCacheSize: number = 100,
  resolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>()
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = resolver ? resolver(...args) : JSON.stringify(args)
    const now = Date.now()
    
    // Check if we have a valid cached value
    const cached = cache.get(key)
    if (cached && (now - cached.timestamp < CACHE_DURATION.SHORT)) {
      return cached.value
    }
    
    // Compute new value
    const result = fn(...args)
    
    // Manage cache size
    if (cache.size >= maxCacheSize) {
      // Remove oldest entry
      const oldestKey = Array.from(cache.keys())[0]
      cache.delete(oldestKey)
    }
    
    // Store new result
    cache.set(key, { value: result, timestamp: now })
    return result
  }) as T
}

// UI Helper functions - Centralized to avoid redundancy
export const uiHelpers = {
  // Get color for order status
  getStatusColor: (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return { bg: "#e6f7ee", text: "#10b981" }
      case "pending":
        return { bg: "#fff7e6", text: "#f59e0b" }
      case "cancelled":
        return { bg: "#fff1f0", text: "#ef4444" }
      case "processing":
        return { bg: "#f0f5ff", text: "#3b82f6" }
      default:
        return { bg: "#f0f5ff", text: "#3b82f6" }
    }
  },
  
  // Get simple status color string
  getStatusColorString: (status: string): string => {
    switch (status.toLowerCase()) {
      case "completed":
        return "#e6f7ee"
      case "pending":
        return "#fff7e6"
      case "cancelled":
        return "#fff1f0"
      case "processing":
        return "#f0f5ff"
      default:
        return "#f0f5ff"
    }
  },
  
  // Get delivery icon
  getDeliveryIcon: (option: string) => {
    switch (option.toLowerCase()) {
      case "pickup":
        return "package"
      case "standard":
        return "truck"
      case "express":
        return "zap"
      default:
        return "truck"
    }
  },
  
  // Format date consistently
  formatDate: (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch (e) {
      return "Invalid date"
    }
  }
}

// Data handling utilities
export const dataUtils = {
  /**
   * Safely extracts a related entity from Supabase query results
   * Handles cases where related data might be an array or undefined
   */
  getRelatedEntity: <T>(relatedData: T[] | T | null | undefined): T | null => {
    if (!relatedData) return null;
    
    // If it's an array, get the first item
    if (Array.isArray(relatedData)) {
      return relatedData[0] || null;
    }
    
    // Otherwise return as is
    return relatedData;
  }
} 