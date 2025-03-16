"use client"

import React, { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { authService } from "@/lib/auth"
import { uiHelpers } from "@/lib/utils"
import { Database } from "@/types/database"

type DbOrder = Database["public"]["Tables"]["orders"]["Row"]

interface Order extends DbOrder {
  formatted_date?: string
}

export default function CustomerOrderHistoryScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      
      // Get current user ID
      const userId = await authService.getUserId()
      if (!userId) {
        router.replace("/(auth)/customer/login")
        return
      }

      // Fetch orders for current user
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      // Process orders with formatted dates
      const processedOrders = (ordersData || []).map(order => ({
        ...order,
        formatted_date: format(new Date(order.created_at), "MMM dd, yyyy")
      }))

      setOrders(processedOrders)
    } catch (error) {
      console.error("Error fetching orders:", error)
      Alert.alert("Error", "Failed to load orders")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchOrders()
  }

  const viewOrderDetails = (orderId: string) => {
    router.push({
      pathname: "/(customer)/orders/[id]",
      params: { id: orderId }
    })
  }

  const getStatusColor = (status: string) => {
    return uiHelpers.getStatusColor(status)
  }

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusColors = getStatusColor(item.status)

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => viewOrderDetails(item.id)}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>Order #{item.id.slice(0, 8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderDate}>{item.formatted_date}</Text>
            {item.delivery_option && (
              <View style={styles.deliveryInfo}>
                <Feather 
                  name={uiHelpers.getDeliveryIcon(item.delivery_option)} 
                  size={14} 
                  color="#666" 
                  style={styles.deliveryIcon} 
                />
                <Text style={styles.deliveryText}>
                  {item.delivery_option} (₱{item.delivery_fee?.toFixed(2) || "0.00"})
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.orderAmount}>₱{item.total_amount.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a6da7" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Feather name="shopping-bag" size={40} color="#fff" />
          </View>
          <Text style={styles.emptyText}>No orders yet</Text>
          <Text style={styles.emptySubtext}>
            Your order history will appear here
          </Text>
          <TouchableOpacity
            style={styles.newOrderButton}
            onPress={() => router.push("/(customer)/orders/new")}
          >
            <Feather name="plus" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.newOrderButtonText}>Place New Order</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#4a6da7"]}
            />
          }
        />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4a6da7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  newOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4a6da7",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  newOrderButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  orderDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  orderInfo: {
    flex: 1,
  },
  orderDate: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  deliveryInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  deliveryIcon: {
    marginRight: 4,
  },
  deliveryText: {
    fontSize: 14,
    color: "#666",
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
}) 