"use client"

import React, { useState, useEffect, useRef } from "react"
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, Keyboard } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { dataUtils } from "@/lib/utils"

interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  barangay?: string
  town?: string
  province?: string
  contact_person?: string
  contact_number?: string
}

interface Order {
  id: string
  created_at: string
  total_amount: number
  status: string
}

export default function CustomerDetailsScreen() {
  const { id, search: searchParam } = useLocalSearchParams<{ id?: string, search?: string }>()
  const [customerNumber, setCustomerNumber] = useState<string>(id || searchParam || "")
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [totalSpent, setTotalSpent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [recentlySearched, setRecentlySearched] = useState<string[]>([])
  const inputRef = useRef<TextInput>(null)

  // Load recent searches on component mount
  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const savedSearches = await AsyncStorage.getItem("recent_customer_searches")
        if (savedSearches) {
          setRecentlySearched(JSON.parse(savedSearches))
        }
      } catch (error) {
        console.error("Error loading recent searches:", error)
      }
    }
    
    loadRecentSearches()
    
    // Auto-search if params provided
    if (id || searchParam) {
      fetchCustomerDetails()
    }
  }, [id, searchParam])

  const fetchCustomerDetails = async () => {
    if (!customerNumber.trim() && !id && !searchParam) {
      return
    }
    
    try {
      setLoading(true)
      
      let customer = null
      const searchTerm = customerNumber.trim() || id || searchParam
      
      // First try to get customer by direct ID match
      const { data: idData, error: idError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", searchTerm)
        
      if (!idError && idData && idData.length > 0) {
        customer = idData[0]
      } else {
        // Then try to search by name, phone, or email
        const { data: searchData, error: searchError } = await supabase
          .from("customers")
          .select("*")
          .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
          .limit(1)
          
        if (!searchError && searchData && searchData.length > 0) {
          customer = searchData[0]
        }
      }
      
      // Set customer if found
      setCustomer(customer)
      
      // Update recent searches
      if (customer) {
        // Create a new array with the current search at the beginning
        const updatedSearches = [customer.id]
        
        // Add previous searches, excluding the current one (to avoid duplicates)
        recentlySearched.forEach(id => {
          if (id !== customer.id && updatedSearches.length < 5) {
            updatedSearches.push(id)
          }
        })
        
        setRecentlySearched(updatedSearches)
        await AsyncStorage.setItem("recent_customer_searches", JSON.stringify(updatedSearches))
      }
      
      // Fetch orders and calculate total spent if customer found
      if (customer) {
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(10)
          
        if (orderError) throw orderError
        
        setOrders(orderData || [])
        
        // Calculate total spent
        const total = orderData ? orderData.reduce((sum, order) => sum + (order.total_amount || 0), 0) : 0
        setTotalSpent(total)
      } else {
        // Clear orders if no customer found
        setOrders([])
        setTotalSpent(0)
        if (searchTerm) {
          Alert.alert("Not Found", "No customer found with the provided details.")
        }
      }
    } catch (error) {
      console.error("Error fetching customer details:", error)
      Alert.alert("Error", "Failed to fetch customer details")
    } finally {
      setLoading(false)
    }
  }

  const handleRecentSearch = (id: string) => {
    setCustomerNumber(id)
    setTimeout(() => {
      fetchCustomerDetails()
    }, 100)
  }

  const clearSearch = () => {
    setCustomerNumber("")
    setCustomer(null)
    setOrders([])
    setTotalSpent(0)
    inputRef.current?.focus()
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return { bg: "#e6f7ee", text: "#10b981" }
      case "pending":
        return { bg: "#fff7e6", text: "#f59e0b" }
      case "cancelled":
        return { bg: "#fff1f0", text: "#ef4444" }
      default:
        return { bg: "#f0f5ff", text: "#3b82f6" }
    }
  }

  const viewOrderDetails = (orderId: string) => {
    router.push({
      pathname: "/(admin)/orders/[id]",
      params: { id: orderId }
    })
  }

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusColors = getStatusColor(item.status);
    const formattedDate = new Date(item.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    return (
      <TouchableOpacity
        style={styles.orderItem}
        onPress={() => viewOrderDetails(item.id)}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>Order #{item.id.slice(0, 8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status}
            </Text>
          </View>
        </View>
        
        <View style={styles.orderInfo}>
          <Text style={styles.orderDate}>{formattedDate}</Text>
          <Text style={styles.orderAmount}>₱{item.total_amount.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const renderRecentSearch = ({ item }: { item: string }) => (
    <TouchableOpacity 
      style={styles.recentSearchItem} 
      onPress={() => handleRecentSearch(item)}
    >
      <Feather name="clock" size={16} color="#666" />
      <Text style={styles.recentSearchText}>{item}</Text>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.inputWrapper}>
          <Feather name="search" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Enter customer ID"
            value={customerNumber}
            onChangeText={setCustomerNumber}
            keyboardType="default"
            returnKeyType="search"
            onSubmitEditing={fetchCustomerDetails}
            autoCapitalize="none"
          />
          {customerNumber.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Feather name="x" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.searchButton} 
          onPress={fetchCustomerDetails} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {!customer && recentlySearched.length > 0 && (
        <View style={styles.recentSearchesContainer}>
          <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
          <FlatList
            data={recentlySearched}
            renderItem={renderRecentSearch}
            keyExtractor={(item) => item}
            horizontal={false}
          />
        </View>
      )}

      {customer ? (
        <View style={styles.content}>
          <View style={styles.customerCard}>
            <View style={styles.customerHeader}>
              <View style={styles.customerAvatar}>
                <Text style={styles.avatarText}>
                  {customer.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{customer.name}</Text>
                <Text style={styles.customerNumber}>ID: {customer.id}</Text>
              </View>
            </View>
            
            <View style={styles.contactDetails}>
              {customer.phone && (
                <View style={styles.contactItem}>
                  <Feather name="phone" size={16} color="#666" />
                  <Text style={styles.customerContact}>{customer.phone}</Text>
                </View>
              )}
              {customer.email && (
                <View style={styles.contactItem}>
                  <Feather name="mail" size={16} color="#666" />
                  <Text style={styles.customerContact}>{customer.email}</Text>
                </View>
              )}
              
              <Text style={styles.contactSectionTitle}>Address</Text>
              {customer.address && (
                <View style={styles.contactItem}>
                  <Feather name="home" size={16} color="#666" />
                  <Text style={styles.customerContact}>{customer.address}</Text>
                </View>
              )}
              {customer.barangay && (
                <View style={styles.contactItem}>
                  <Feather name="map-pin" size={16} color="#666" />
                  <Text style={styles.customerContact}>Barangay: {customer.barangay}</Text>
                </View>
              )}
              {customer.town && (
                <View style={styles.contactItem}>
                  <Feather name="map-pin" size={16} color="#666" />
                  <Text style={styles.customerContact}>Town/City: {customer.town}</Text>
                </View>
              )}
              {customer.province && (
                <View style={styles.contactItem}>
                  <Feather name="map-pin" size={16} color="#666" />
                  <Text style={styles.customerContact}>Province: {customer.province}</Text>
                </View>
              )}
              
              <Text style={styles.contactSectionTitle}>Alternative Contact</Text>
              {customer.contact_person && (
                <View style={styles.contactItem}>
                  <Feather name="user" size={16} color="#666" />
                  <Text style={styles.customerContact}>Contact Person: {customer.contact_person}</Text>
                </View>
              )}
              {customer.contact_number && (
                <View style={styles.contactItem}>
                  <Feather name="phone" size={16} color="#666" />
                  <Text style={styles.customerContact}>Alt. Number: {customer.contact_number}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{orders.length}</Text>
              <Text style={styles.summaryLabel}>Total Orders</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>₱{totalSpent.toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>Total Spent</Text>
            </View>
          </View>

          <View style={styles.orderListHeader}>
            <Text style={styles.sectionTitle}>Order History</Text>
            {orders.length > 0 && (
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderOrderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <Feather name="user" size={64} color="#ccc" />
          <Text style={styles.placeholderText}>Enter a customer ID to view details</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  searchContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  inputWrapper: {
    flex: 1,
    height: 45,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fafafa",
    marginRight: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 45,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: "#4361ee",
    height: 45,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  recentSearchesContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  recentSearchesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  recentSearchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  recentSearchText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#333",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  customerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4361ee",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  customerNumber: {
    fontSize: 14,
    color: "#666",
  },
  contactDetails: {
    marginTop: 8,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  customerContact: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryDivider: {
    width: 1,
    backgroundColor: "#eee",
    marginHorizontal: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4361ee",
  },
  orderListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  viewAllText: {
    fontSize: 14,
    color: "#4361ee",
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 16,
  },
  orderItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4361ee",
  },
  orderInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderDate: {
    fontSize: 14,
    color: "#999",
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  statusBadge: {
    padding: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  placeholderText: {
    marginTop: 16,
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#999",
  },
  contactSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4361ee",
    marginTop: 16,
    marginBottom: 8,
  },
})