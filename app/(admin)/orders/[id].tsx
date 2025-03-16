"use client"

import React, { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Share,
  ScrollView,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import * as XLSX from "xlsx"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import { uiHelpers } from "@/lib/utils"
import { Database } from "@/types/database"

type DbOrder = Database["public"]["Tables"]["orders"]["Row"]
type DbCustomer = Database["public"]["Tables"]["customers"]["Row"]

interface Order extends DbOrder {
  customer?: DbCustomer | null
}

interface OrderItem {
  id: string
  item_id: string
  order_id: string
  quantity: number
  price: number
  items?: {
    id: string
    name: string
    code: string
  } | null
}

export default function OrderDetailsScreen() {
  const params = useLocalSearchParams()
  const orderId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    } else {
      Alert.alert("Error", "Order ID is missing")
      router.back()
    }
  }, [orderId])

  const fetchOrderDetails = async () => {
    setIsLoading(true)
    try {
      // Fetch order details with customer info
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          customer:customers (*)
        `)
        .eq("id", orderId)
        .single()

      if (orderError) throw orderError
      if (!orderData) throw new Error("Order not found")

      setOrder(orderData)

      // Fetch order items with item details
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          *,
          items (
            id,
            name,
            code
          )
        `)
        .eq("order_id", orderId)

      if (itemsError) throw itemsError
      setOrderItems(itemsData)

    } catch (error) {
      console.error("Error fetching order details:", error)
      Alert.alert("Error", "Failed to load order details")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    return uiHelpers.getStatusColor(status)
  }

  const formatDate = (dateString: string) => {
    return uiHelpers.formatDate(dateString)
  }

  const exportOrder = async () => {
    if (!order) return

    setIsExporting(true)
    try {
      const workbook = XLSX.utils.book_new()
      const orderDetails = [
        ["Order ID", `#${order.id}`],
        ["Customer", order.customer?.name || "Unknown Customer"],
        ["Date", formatDate(order.created_at)],
        ["Status", order.status],
        ["Total Amount", `₱${order.total_amount.toFixed(2)}`],
        [""],
        ["Item Code", "Item Name", "Quantity", "Price", "Total"],
      ]

      orderItems.forEach((item) => {
        orderDetails.push([
          item.items?.code || "",
          item.items?.name || "",
          String(item.quantity), // Convert to string to match expected type
          `₱${item.price.toFixed(2)}`,
          `₱${(item.price * item.quantity).toFixed(2)}`,
        ])
      })

      const worksheet = XLSX.utils.aoa_to_sheet(orderDetails)
      XLSX.utils.book_append_sheet(workbook, worksheet, "Order")

      const wbout = XLSX.write(workbook, { type: "base64", bookType: "xlsx" })
      const fileName = `order_${order.id}_${new Date().getTime()}.xlsx`
      const filePath = `${FileSystem.documentDirectory}${fileName}`

      await FileSystem.writeAsStringAsync(filePath, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      })

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath)
      } else {
        Alert.alert("Error", "Sharing is not available on this device")
      }
    } catch (error) {
      console.error("Error exporting order:", error)
      Alert.alert("Error", "Failed to export order")
    } finally {
      setIsExporting(false)
    }
  }

  const shareOrder = async () => {
    if (!order) return

    try {
      const message = `Order #${order.id}\nCustomer: ${order.customer?.name || "Unknown Customer"}\nDate: ${formatDate(order.created_at)}\nTotal: ₱${order.total_amount.toFixed(2)}`
      await Share.share({
        message,
      })
    } catch (error) {
      console.error("Error sharing order:", error)
      Alert.alert("Error", "Failed to share order")
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
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
          <Feather name="alert-circle" size={48} color="#ff4d4f" />
          <Text style={styles.errorText}>Order not found</Text>
          <TouchableOpacity style={styles.goBackButton} onPress={() => router.back()}>
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity style={styles.shareButton} onPress={shareOrder}>
          <Feather name="share-2" size={20} color="#4a6da7" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.orderSummary}>
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status).bg }]}>
            <Text style={[styles.statusText, { color: getStatusColor(order.status).text }]}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Text>
          </View>

          {/* Order ID */}
          <View style={styles.orderHeader}>
            <Text style={styles.orderIdLabel}>ORDER ID</Text>
            <Text style={styles.orderId}>#{order.id}</Text>
          </View>

          <View style={styles.divider} />

          {/* Order Details */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Customer</Text>
            <Text style={styles.customerName}>{order.customer?.name || "Unknown Customer"}</Text>
          </View>

          <View style={styles.divider} />

          {/* Order Items Title */}
          <Text style={styles.itemsTitle}>Order Items</Text>
        </View>

        {/* Order Items */}
        {orderItems.map((item) => (
          <View key={item.id} style={styles.orderItem}>
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.items?.name || ""}</Text>
              <Text style={styles.itemCode}>{item.items?.code || ""}</Text>
            </View>
            <View style={styles.quantityContainer}>
              <Text style={styles.quantityText}>{item.quantity} x ₱{item.price.toFixed(2)}</Text>
            </View>
            <View style={styles.itemTotal}>
              <Text style={styles.totalText}>₱{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          </View>
        ))}

        {/* Footer with Total and Export Button */}
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.grandTotal}>₱{order.total_amount.toFixed(2)}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.exportButton}
            onPress={exportOrder}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <React.Fragment>
                <Feather name="download" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.exportButtonText}>Export to Excel</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
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
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
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
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#333",
    marginTop: 12,
    marginBottom: 20,
  },
  goBackButton: {
    backgroundColor: "#4a6da7",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  orderSummary: {
    position: "relative",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  statusBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    zIndex: 10,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  orderHeader: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  orderIdLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
  },
  orderId: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4a6da7",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: "#666",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  orderItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  itemCode: {
    fontSize: 14,
    color: "#666",
  },
  quantityContainer: {
    marginHorizontal: 12,
    justifyContent: "center",
  },
  quantityText: {
    fontSize: 14,
    color: "#666",
  },
  itemTotal: {
    justifyContent: "center",
    minWidth: 80,
    alignItems: "flex-end",
  },
  totalText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  footer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  grandTotal: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4a6da7",
  },
  exportButton: {
    backgroundColor: "#4a6da7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  exportButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
})
