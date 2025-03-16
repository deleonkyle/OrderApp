/**
 * Global app configuration settings
 */

// Cache durations in milliseconds
export const CACHE_DURATION = {
  SHORT: 2 * 60 * 1000, // 2 minutes
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  USER_SESSION: 24 * 60 * 60 * 1000, // 24 hours
}

// Performance thresholds for monitoring
export const PERFORMANCE = {
  // Maximum acceptable time for DB operations
  DB_OPERATION_THRESHOLD: 500, // ms
  // Maximum acceptable time for rendering screens
  RENDER_THRESHOLD: 300, // ms
  // Maximum acceptable time for data fetch operations
  FETCH_THRESHOLD: 2000, // ms
  // Image loading timeout
  IMAGE_LOAD_TIMEOUT: 10000, // ms
}

// UI configuration
export const UI = {
  // For animation performance
  DEFAULT_ANIMATION_DURATION: 250, // ms
  // For increased performance on lower-end devices
  LIST_WINDOW_SIZE: 5,
  // Initial number of items to render in lists
  LIST_INITIAL_ITEMS: 10,
  // Maximum number of items to render in memory
  LIST_MAX_TO_RENDER: 20,
  // Batch size for update operations
  BATCH_SIZE: 20,
}

// Network configuration
export const NETWORK = {
  // Request timeout
  REQUEST_TIMEOUT: 10000, // ms
  // Retry count for failed requests
  MAX_RETRIES: 3,
  // Delay between retries (ms)
  RETRY_DELAY: 1000,
  // Maximum concurrent requests
  MAX_CONCURRENT_REQUESTS: 4,
}

// Database operation configuration
export const DATABASE = {
  // Maximum items to fetch in a single query
  MAX_QUERY_LIMIT: 100,
  // Default items to fetch in a list query
  DEFAULT_QUERY_LIMIT: 20,
}

// Feature flags for progressive enhancement
export const FEATURES = {
  ENABLE_OFFLINE_MODE: true,
  ENABLE_ANALYTICS: true,
  ENABLE_CACHE: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_ERROR_REPORTING: true,
}

// Environment-specific settings
export const ENV = {
  IS_DEV: process.env.NODE_ENV === 'development',
  IS_PROD: process.env.NODE_ENV === 'production',
  API_BASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
}

// Helper function to get a value based on environment
export function getEnvValue<T>(devValue: T, prodValue: T): T {
  return ENV.IS_DEV ? devValue : prodValue
}

// Global app settings
export const APP = {
  VERSION: '1.0.0',
  NAME: 'Order Management App',
  // Increase performance in production
  DEBOUNCE_TIME: getEnvValue(300, 150), // ms
  THROTTLE_TIME: getEnvValue(500, 300), // ms
} 