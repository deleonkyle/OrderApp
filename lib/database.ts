import { supabase } from "./supabase"
import { Database } from "@/types/database"
import { perfMonitor } from "./utils"
import { CACHE_DURATION, DATABASE, PERFORMANCE } from "@/constants/config"
import { dataUtils } from "./utils"

// Type definitions for database entities
type Customer = Database["public"]["Tables"]["customers"]["Row"]
type Order = Database["public"]["Tables"]["orders"]["Row"]
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"]
type Item = Database["public"]["Tables"]["items"]["Row"]

// Cache management for frequently accessed data
const cache = {
  items: new Map<string, Item>(),
  customers: new Map<string, Customer>(),
  recentOrders: null as Order[] | null,
  itemsLastFetch: 0,
  customersLastFetch: 0,
  ordersLastFetch: 0,
  cacheTTL: CACHE_DURATION.MEDIUM, // Use our centralized cache duration
  
  clear() {
    this.items.clear()
    this.customers.clear()
    this.recentOrders = null
    this.itemsLastFetch = 0
    this.customersLastFetch = 0
    this.ordersLastFetch = 0
  }
}

/**
 * Customer-related database operations
 */
export const customerService = {
  /**
   * Get a customer by ID with caching
   */
  async getById(id: string): Promise<Customer | null> {
    try {
      // Check cache first
      if (cache.customers.has(id)) {
        return cache.customers.get(id) || null
      }
      
      perfMonitor.startTimer('getCustomerById')
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()
      
      const queryTime = perfMonitor.endTimer('getCustomerById')
      if (queryTime > PERFORMANCE.DB_OPERATION_THRESHOLD) {
        console.warn(`getCustomerById took ${queryTime}ms, which exceeds the threshold of ${PERFORMANCE.DB_OPERATION_THRESHOLD}ms`)
      }
      
      if (error) {
        console.error('Error fetching customer:', error)
        return null
      }
      
      // Update cache
      if (data) {
        cache.customers.set(id, data)
      }
      
      return data
    } catch (error) {
      console.error('Error in getCustomerById:', error)
      return null
    }
  },
  
  /**
   * Create a new customer
   */
  async create(customer: Database["public"]["Tables"]["customers"]["Insert"]): Promise<Customer | null> {
    try {
      perfMonitor.startTimer('createCustomer')
      const { data, error } = await supabase
        .from('customers')
        .insert([customer])
        .select()
        .single()
      
      perfMonitor.endTimer('createCustomer')
      
      if (error) {
        console.error('Error creating customer:', error)
        return null
      }
      
      // Update cache and reset collections that might contain this customer
      if (data) {
        cache.customers.set(data.id, data)
      }
      
      return data
    } catch (error) {
      console.error('Error in createCustomer:', error)
      return null
    }
  },
  
  /**
   * Update a customer
   */
  async update(id: string, updates: Partial<Database["public"]["Tables"]["customers"]["Update"]>): Promise<Customer | null> {
    try {
      perfMonitor.startTimer('updateCustomer')
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      perfMonitor.endTimer('updateCustomer')
      
      if (error) {
        console.error('Error updating customer:', error)
        return null
      }
      
      // Update cache
      if (data) {
        cache.customers.set(id, data)
      }
      
      return data
    } catch (error) {
      console.error('Error in updateCustomer:', error)
      return null
    }
  },
  
  /**
   * Search for customers by query
   */
  async search(query: string): Promise<Customer[]> {
    try {
      perfMonitor.startTimer('searchCustomers')
      
      // Build search query for multiple fields
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .order('name', { ascending: true })
        .limit(20)
      
      perfMonitor.endTimer('searchCustomers')
      
      if (error) {
        console.error('Error searching customers:', error)
        return []
      }
      
      // Update cache for individual customers
      if (data) {
        data.forEach(customer => {
          cache.customers.set(customer.id, customer)
        })
      }
      
      return data || []
    } catch (error) {
      console.error('Error in searchCustomers:', error)
      return []
    }
  },
  
  /**
   * Get customers with optional filtering
   */
  async getCustomers(search?: string, limit: number = 50) {
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      
      if (limit > 0) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
  }
}

/**
 * Order-related database operations
 */
export const orderService = {
  /**
   * Get an order by ID
   */
  async getById(id: string): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Extract the customer from array
      if (data) {
        data.customer = dataUtils.getRelatedEntity(data.customers);
        // Make sure both the array and direct access are available
        if (data.customer && !data.customer_name) {
          data.customer_name = data.customer.name;
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching order by ID:', error);
      return null;
    }
  },
  
  /**
   * Get all orders for a customer
   */
  async getByCustomerId(customerId: string, limit: number = DATABASE.DEFAULT_QUERY_LIMIT): Promise<Order[]> {
    try {
      perfMonitor.startTimer('getOrdersByCustomerId')
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      const queryTime = perfMonitor.endTimer('getOrdersByCustomerId')
      if (queryTime > PERFORMANCE.DB_OPERATION_THRESHOLD) {
        console.warn(`getOrdersByCustomerId took ${queryTime}ms, which exceeds the threshold of ${PERFORMANCE.DB_OPERATION_THRESHOLD}ms`)
      }
      
      if (error) {
        console.error('Error fetching customer orders:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error in getOrdersByCustomerId:', error)
      return []
    }
  },
  
  /**
   * Get recent orders with limit
   */
  async getRecent(limit: number = DATABASE.DEFAULT_QUERY_LIMIT): Promise<Order[]> {
    try {
      // Use cached recent orders if available and fresh
      const now = Date.now()
      if (cache.recentOrders && now - cache.ordersLastFetch < cache.cacheTTL) {
        return cache.recentOrders.slice(0, limit)
      }
      
      perfMonitor.startTimer('getRecentOrders')
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, DATABASE.MAX_QUERY_LIMIT))
      
      const queryTime = perfMonitor.endTimer('getRecentOrders')
      if (queryTime > PERFORMANCE.DB_OPERATION_THRESHOLD) {
        console.warn(`getRecentOrders took ${queryTime}ms, which exceeds the threshold of ${PERFORMANCE.DB_OPERATION_THRESHOLD}ms`)
      }
      
      if (error) {
        console.error('Error fetching recent orders:', error)
        return []
      }
      
      // Update cache
      cache.recentOrders = data || []
      cache.ordersLastFetch = now
      
      return data || []
    } catch (error) {
      console.error('Error in getRecentOrders:', error)
      return []
    }
  },
  
  /**
   * Create a new order
   */
  async create(order: Database["public"]["Tables"]["orders"]["Insert"], orderItems: Omit<Database["public"]["Tables"]["order_items"]["Insert"], "order_id">[]): Promise<Order | null> {
    try {
      // Begin transaction for order creation
      perfMonitor.startTimer('createOrder')
      
      // Create the order first
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([order])
        .select()
        .single()
      
      if (orderError) {
        console.error('Error creating order:', orderError)
        return null
      }
      
      // Add the order_id to each order item
      const orderItemsWithId = orderItems.map(item => ({
        ...item,
        order_id: orderData.id
      }))
      
      // Create the order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsWithId)
      
      if (itemsError) {
        console.error('Error creating order items:', itemsError)
        // Ideally would rollback the order here in a real transaction
        return null
      }
      
      perfMonitor.endTimer('createOrder')
      
      // Clear the recent orders cache since we added a new one
      cache.recentOrders = null
      cache.ordersLastFetch = 0
      
      return orderData
    } catch (error) {
      console.error('Error in createOrder:', error)
      return null
    }
  },
  
  /**
   * Update an order's status
   */
  async updateStatus(id: string, status: string): Promise<boolean> {
    try {
      perfMonitor.startTimer('updateOrderStatus')
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
      
      perfMonitor.endTimer('updateOrderStatus')
      
      if (error) {
        console.error('Error updating order status:', error)
        return false
      }
      
      // Clear caches that might contain this order
      cache.recentOrders = null
      cache.ordersLastFetch = 0
      
      return true
    } catch (error) {
      console.error('Error in updateOrderStatus:', error)
      return false
    }
  }
}

/**
 * Item-related database operations
 */
export const itemService = {
  /**
   * Get all items with caching
   */
  async getAll(limit: number = DATABASE.MAX_QUERY_LIMIT): Promise<Item[]> {
    try {
      // Use cached items if available and fresh
      const now = Date.now()
      if (cache.items.size > 0 && now - cache.itemsLastFetch < cache.cacheTTL) {
        return Array.from(cache.items.values()).slice(0, limit)
      }
      
      perfMonitor.startTimer('getAllItems')
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name', { ascending: true })
        .limit(limit)
      
      const queryTime = perfMonitor.endTimer('getAllItems')
      if (queryTime > PERFORMANCE.DB_OPERATION_THRESHOLD) {
        console.warn(`getAllItems took ${queryTime}ms, which exceeds the threshold of ${PERFORMANCE.DB_OPERATION_THRESHOLD}ms`)
      }
      
      if (error) {
        console.error('Error fetching items:', error)
        return []
      }
      
      // Update cache
      cache.items.clear()
      if (data) {
        data.forEach(item => {
          cache.items.set(item.id, item)
        })
      }
      cache.itemsLastFetch = now
      
      return data || []
    } catch (error) {
      console.error('Error in getAllItems:', error)
      return []
    }
  },
  
  /**
   * Get an item by ID with caching
   */
  async getById(id: string): Promise<Item | null> {
    try {
      // Check cache first
      if (cache.items.has(id)) {
        return cache.items.get(id) || null
      }
      
      perfMonitor.startTimer('getItemById')
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()
      
      perfMonitor.endTimer('getItemById')
      
      if (error) {
        console.error('Error fetching item:', error)
        return null
      }
      
      // Update cache
      if (data) {
        cache.items.set(id, data)
      }
      
      return data
    } catch (error) {
      console.error('Error in getItemById:', error)
      return null
    }
  },
  
  /**
   * Create a new item
   */
  async create(item: Database["public"]["Tables"]["items"]["Insert"]): Promise<Item | null> {
    try {
      perfMonitor.startTimer('createItem')
      const { data, error } = await supabase
        .from('items')
        .insert([item])
        .select()
        .single()
      
      perfMonitor.endTimer('createItem')
      
      if (error) {
        console.error('Error creating item:', error)
        return null
      }
      
      // Update cache
      if (data) {
        cache.items.set(data.id, data)
      }
      
      return data
    } catch (error) {
      console.error('Error in createItem:', error)
      return null
    }
  },
  
  /**
   * Update an item
   */
  async update(id: string, updates: Partial<Database["public"]["Tables"]["items"]["Update"]>): Promise<Item | null> {
    try {
      perfMonitor.startTimer('updateItem')
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      const queryTime = perfMonitor.endTimer('updateItem')
      if (queryTime > PERFORMANCE.DB_OPERATION_THRESHOLD) {
        console.warn(`updateItem took ${queryTime}ms, which exceeds the threshold of ${PERFORMANCE.DB_OPERATION_THRESHOLD}ms`)
      }
      
      if (error) {
        console.error('Error updating item:', error)
        return null
      }
      
      // Update cache
      if (data) {
        cache.items.set(id, data)
      }
      
      return data
    } catch (error) {
      console.error('Error in updateItem:', error)
      return null
    }
  },
  
  /**
   * Search for items by query with improved performance
   */
  async search(query: string): Promise<Item[]> {
    try {
      perfMonitor.startTimer('searchItems')
      
      // Try to search from cache first for better performance
      if (cache.items.size > 0 && Date.now() - cache.itemsLastFetch < cache.cacheTTL) {
        const lowerQuery = query.toLowerCase()
        const results = Array.from(cache.items.values()).filter(item => 
          item.name.toLowerCase().includes(lowerQuery) || 
          item.code.toLowerCase().includes(lowerQuery) ||
          (item.category && item.category.toLowerCase().includes(lowerQuery))
        )
        
        // If we found results in cache, return them
        if (results.length > 0) {
          return results
        }
      }
      
      // If not in cache or no results, perform a database search
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .or(`name.ilike.%${query}%,code.ilike.%${query}%,category.ilike.%${query}%`)
        .order('name', { ascending: true })
        .limit(20)
      
      perfMonitor.endTimer('searchItems')
      
      if (error) {
        console.error('Error searching items:', error)
        return []
      }
      
      // Update cache for individual items
      if (data) {
        data.forEach(item => {
          cache.items.set(item.id, item)
        })
      }
      
      return data || []
    } catch (error) {
      console.error('Error in searchItems:', error)
      return []
    }
  },
  
  /**
   * Get items by category
   */
  async getByCategory(category: string): Promise<Item[]> {
    try {
      // Try to filter from cache first for better performance
      if (cache.items.size > 0 && Date.now() - cache.itemsLastFetch < cache.cacheTTL) {
        const results = Array.from(cache.items.values()).filter(item => 
          item.category === category
        )
        
        // If we found results in cache, return them
        if (results.length > 0) {
          return results
        }
      }
      
      // If not in cache or no results, perform a database query
      perfMonitor.startTimer('getItemsByCategory')
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('category', category)
        .order('name', { ascending: true })
      
      perfMonitor.endTimer('getItemsByCategory')
      
      if (error) {
        console.error('Error fetching items by category:', error)
        return []
      }
      
      // Update cache
      if (data) {
        data.forEach(item => {
          cache.items.set(item.id, item)
        })
      }
      
      return data || []
    } catch (error) {
      console.error('Error in getItemsByCategory:', error)
      return []
    }
  }
}

/**
 * Helper function to clear all caches
 */
export const clearDatabaseCache = () => {
  cache.clear()
} 