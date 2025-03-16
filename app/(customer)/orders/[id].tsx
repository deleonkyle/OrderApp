"use client"

import React, { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { uiHelpers } from "@/lib/utils"
import { Database } from "@/types/database"

type DbOrder = Database["public"]["Tables"]["orders"]["Row"]
type DbOrderItem = Database["public"]["Tables"]["order_items"]["Row"]
type DbItem = Database["public"]["Tables"]["items"]["Row"]

interface Order extends DbOrder {
  items?: Array<DbOrderItem & { items: DbItem }>
}

export default function CustomerOrderDetailsScreen() {
  const params = useLocalSearchParams()
  const orderId = params.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId])

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)

      // Fetch order details with items
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          items:order_items (
            *,
            items (
              id,
              name,
              code
            )
          )
        `)
        .eq("id", orderId)
        .single()

      if (orderError) throw orderError
      if (!orderData) throw new Error("Order not found")

      setOrder(orderData)
    } catch (error) {
      console.error("Error fetching order details:", error)
      Alert.alert("Error", "Failed to load order details")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a6da7" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  const statusColors = uiHelpers.getStatusColor(order.status)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.orderSummary}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {order.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.orderInfo}>
            <Text style={styles.orderDate}>
              {format(new Date(order.created_at), "MMM dd, yyyy")}
            </Text>
            {order.delivery_option && (
              <View style={styles.deliveryInfo}>
                <Feather 
                  name={uiHelpers.getDeliveryIcon(order.delivery_option)} 
                  size={16} 
                  color="#666" 
                />
                <Text style={styles.deliveryText}>
                  {order.delivery_option} (₱{order.delivery_fee?.toFixed(2) || "0.00"})
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.itemsContainer}>
          <Text style={styles.itemsTitle}>Order Items</Text>
          {order.items?.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.items?.name}</Text>
                <Text style={styles.itemCode}>{item.items?.code}</Text>
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
                <Text style={styles.itemTotal}>
                  ₱{(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totalContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              ₱{(order.total_amount - (order.delivery_fee || 0)).toFixed(2)}
            </Text>
          </View>
          {order.delivery_fee && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery Fee</Text>
              <Text style={styles.totalValue}>₱{order.delivery_fee.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total Amount</Text>
            <Text style={styles.grandTotalValue}>₱{order.total_amount.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#666",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  orderSummary: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  orderInfo: {
    gap: 4,
  },
  orderDate: {
    fontSize: 14,
    color: "#666",
  },
  deliveryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deliveryText: {
    fontSize: 14,
    color: "#666",
  },
  itemsContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  itemCode: {
    fontSize: 12,
    color: "#666",
  },
  itemDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemQuantity: {
    fontSize: 14,
    color: "#666",
  },
  itemPrice: {
    fontSize: 14,
    color: "#666",
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  totalContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: "#666",
  },
  totalValue: {
    fontSize: 14,
    color: "#333",
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4a6da7",
  },
}) 