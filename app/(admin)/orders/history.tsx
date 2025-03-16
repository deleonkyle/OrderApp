"use client"

import React, { useState, useEffect } from "react"
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import * as XLSX from "xlsx"
import type { Database } from "@/types/database"

type DbCustomer = Database["public"]["Tables"]["customers"]["Row"]
type DbOrder = Database["public"]["Tables"]["orders"]["Row"]

interface OrderData extends DbOrder {
  customers?: DbCustomer[] | null
}

interface Order {
  id: string
  date: string
  total_amount: number
  status: string
  customer_id: string
  customer_name: string
}

interface VisitLogData {
  id: string
  created_at: string
  travel_time: string
  fare_amount: number
  remarks: string | null
  customer?: {
    name: string
    address: string
  } | null
}

export default function OrderHistoryScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [customerSearch, setCustomerSearch] = useState("")
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  useEffect(() => {
    if (customerSearch.trim() === "") {
      setFilteredOrders(orders)
    } else {
      const filtered = orders.filter(
        (order) =>
          order.customer_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          order.customer_id.includes(customerSearch),
      )
      setFilteredOrders(filtered)
    }
  }, [customerSearch, orders])

  const fetchOrders = async () => {
    try {
      setLoading(true)

      // Fetch orders with customer data
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_amount,
          status,
          customers (
            id,
            name
          )
        `)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      // Process orders and handle customer data
      const processedOrders: Order[] = (ordersData || []).map((order) => {
        const customer = order.customers?.[0] as DbCustomer | undefined
        return {
          id: order.id,
          date: format(new Date(order.created_at), "MMM dd, yyyy"),
          total_amount: order.total_amount,
          status: order.status,
          customer_id: customer?.id?.toString() || "",
          customer_name: customer?.name || "Unknown Customer",
        }
      })

      setOrders(processedOrders)
      setFilteredOrders(processedOrders)
    } catch (error: any) {
      console.error("Error fetching orders:", error)
      Alert.alert("Error", `Failed to load orders: ${error.message || "Unknown error"}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchOrders()
  }

  const exportToExcel = async () => {
    try {
      setExporting(true)

      // Create a more detailed query that includes all customer data
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_amount,
          status,
          customers (
            id,
            name,
            email,
            phone,
            address,
            barangay,
            town,
            province,
            contact_person,
            contact_number
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) {
        Alert.alert("No Data", "There are no orders to export")
        return
      }

      // Create a workbook with styling options
      const workbook = XLSX.utils.book_new()

      // Define column widths for better presentation
      const colWidths = [
        { wch: 10 }, // Order ID
        { wch: 15 }, // Date
        { wch: 25 }, // Customer Name
        { wch: 25 }, // Customer Email
        { wch: 15 }, // Customer Phone
        { wch: 15 }, // Total Amount
        { wch: 12 }, // Status
        { wch: 30 }, // Address
        { wch: 20 }, // Contact Person
      ]

      // Format the data with proper customer information
      const ordersForExcel = data.map((order) => {
        // Extract customer info from the array
        const customer = order.customers && order.customers[0] ? order.customers[0] : null
        const customerName = customer ? customer.name : "Unknown Customer"
        const customerEmail = customer ? customer.email : "N/A"
        const customerPhone = customer ? customer.phone : "N/A"

        // Format address
        const address = customer
          ? [customer.address || "", customer.barangay || "", customer.town || "", customer.province || ""]
              .filter(Boolean)
              .join(", ")
          : "N/A"

        const contactPerson = customer ? customer.contact_person || "N/A" : "N/A"
        const contactNumber = customer ? customer.contact_number || "N/A" : "N/A"

        return {
          "Order ID": order.id,
          Date: format(new Date(order.created_at), "yyyy-MM-dd"),
          "Customer Name": customerName,
          "Customer Email": customerEmail,
          "Customer Phone": customerPhone,
          "Total Amount": `₱${order.total_amount.toFixed(2)}`,
          Status: order.status,
          Address: address,
          "Contact Person": contactPerson,
          "Contact Number": contactNumber,
        }
      })

      // Add orders worksheet to workbook with formatting
      const ordersWorksheet = XLSX.utils.json_to_sheet(ordersForExcel)

      // Set column widths
      ordersWorksheet["!cols"] = colWidths

      // Add header styling by creating a new range and applying styles
      const range = XLSX.utils.decode_range(ordersWorksheet["!ref"] || "A1:J1")
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1"
        if (!ordersWorksheet[address]) continue
        ordersWorksheet[address].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4A6DA7" } },
          alignment: { horizontal: "center" },
        }
      }

      XLSX.utils.book_append_sheet(workbook, ordersWorksheet, "Orders")

      // Fetch visit logs
      const { data: visitLogsData, error: visitLogsError } = await supabase
        .from("visit_log")
        .select(`
          id,
          visit_date,
          travel_time,
          fare_amount,
          remarks,
          customer_id
        `)
        .order("visit_date", { ascending: false })

      if (!visitLogsError && visitLogsData && visitLogsData.length > 0) {
        // Get all unique customer IDs
        const customerIds = [...new Set(visitLogsData.map((log) => log.customer_id))]

        // Fetch all customers in one query
        const { data: customersData, error: customersError } = await supabase
          .from("customers")
          .select("id, name, address, barangay, town, province, contact_person, contact_number")
          .in("id", customerIds)

        // Create a map for quick customer lookup
        const customerMap = new Map()
        if (!customersError && customersData) {
          customersData.forEach((customer) => {
            customerMap.set(customer.id, customer)
          })
        }

        // Format visit logs for Excel with better structure
        const visitLogsForExcel = visitLogsData.map((log) => {
          const customer = customerMap.get(log.customer_id)

          const customerName = customer ? customer.name : "Unknown"
          const address = customer
            ? [customer.address || "", customer.barangay || "", customer.town || "", customer.province || ""]
                .filter(Boolean)
                .join(", ")
            : "N/A"

          const contactPerson = customer ? customer.contact_person || "N/A" : "N/A"
          const contactNumber = customer ? customer.contact_number || "N/A" : "N/A"

          return {
            "Visit Date": format(new Date(log.visit_date), "yyyy-MM-dd"),
            Customer: customerName,
            Address: address,
            "Contact Person": contactPerson,
            "Contact Number": contactNumber,
            "Travel Time": log.travel_time,
            "Fare Amount": `₱${log.fare_amount.toFixed(2)}`,
            Remarks: log.remarks || "",
          }
        })

        // Define column widths for visit logs
        const visitLogColWidths = [
          { wch: 15 }, // Visit Date
          { wch: 25 }, // Customer
          { wch: 30 }, // Address
          { wch: 20 }, // Contact Person
          { wch: 15 }, // Contact Number
          { wch: 15 }, // Travel Time
          { wch: 15 }, // Fare Amount
          { wch: 30 }, // Remarks
        ]

        // Add visit logs worksheet to workbook with formatting
        const visitLogsWorksheet = XLSX.utils.json_to_sheet(visitLogsForExcel)
        visitLogsWorksheet["!cols"] = visitLogColWidths

        // Add header styling
        const vlRange = XLSX.utils.decode_range(visitLogsWorksheet["!ref"] || "A1:H1")
        for (let C = vlRange.s.c; C <= vlRange.e.c; ++C) {
          const address = XLSX.utils.encode_col(C) + "1"
          if (!visitLogsWorksheet[address]) continue
          visitLogsWorksheet[address].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4A6DA7" } },
            alignment: { horizontal: "center" },
          }
        }

        XLSX.utils.book_append_sheet(workbook, visitLogsWorksheet, "Visit Logs")
      }

      // Add a summary sheet
      const summaryData = [
        { Metric: "Total Orders", Value: orders.length },
        { Metric: "Completed Orders", Value: orders.filter((o) => o.status.toLowerCase() === "completed").length },
        { Metric: "Pending Orders", Value: orders.filter((o) => o.status.toLowerCase() === "pending").length },
        { Metric: "Cancelled Orders", Value: orders.filter((o) => o.status.toLowerCase() === "cancelled").length },
        { Metric: "Total Sales", Value: `₱${orders.reduce((sum, order) => sum + order.total_amount, 0).toFixed(2)}` },
      ]

      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData)
      summaryWorksheet["!cols"] = [{ wch: 20 }, { wch: 15 }]

      // Add header styling
      const sumRange = XLSX.utils.decode_range(summaryWorksheet["!ref"] || "A1:B1")
      for (let C = sumRange.s.c; C <= sumRange.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1"
        if (!summaryWorksheet[address]) continue
        summaryWorksheet[address].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4A6DA7" } },
          alignment: { horizontal: "center" },
        }
      }

      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary")

      // Generate Excel file
      const wbout = XLSX.write(workbook, { type: "base64", bookType: "xlsx" })

      // Create a temporary file path with date in filename
      const currentDate = format(new Date(), "yyyy-MM-dd")
      const fileName = `orders_report_${currentDate}.xlsx`
      const filePath = `${FileSystem.documentDirectory}${fileName}`

      // Write the file
      await FileSystem.writeAsStringAsync(filePath, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Share the file
      await Sharing.shareAsync(filePath, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Export Orders and Visit Logs",
      })
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      Alert.alert("Export Error", "Failed to export orders")
    } finally {
      setExporting(false)
    }
  }

  const viewOrderDetails = (orderId: string) => {
    router.push({
      pathname: "/(admin)/orders/[id]",
      params: { id: orderId },
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "#10b981"
      case "pending":
        return "#f59e0b"
      case "cancelled":
        return "#ef4444"
      case "processing":
        return "#3b82f6"
      default:
        return "#6b7280"
    }
  }

  const renderOrderItem = ({ item }: { item: Order }) => {
    return (
      <TouchableOpacity style={styles.orderItem} onPress={() => viewOrderDetails(item.id)} activeOpacity={0.7}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIdContainer}>
            <Feather name="file-text" size={16} color="#4a6da7" style={styles.orderIcon} />
            <Text style={styles.orderId} numberOfLines={1} ellipsizeMode="tail">
              Order #{item.id}
            </Text>
          </View>
          <Text style={styles.orderDate}>{item.date}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.orderDetailsRow}>
          <View style={styles.orderInfo}>
            <View style={styles.customerContainer}>
              <Feather name="user" size={14} color="#666" style={styles.customerIcon} />
              <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">
                {item.customer_name || "Unknown Customer"}
              </Text>
            </View>

            <View style={styles.amountContainer}>
              <Feather name="dollar-sign" size={14} color="#666" style={styles.amountIcon} />
              <Text style={styles.orderAmount}>₱{item.total_amount.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyComponent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a6da7" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      )
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Feather name="inbox" size={40} color="#fff" />
        </View>
        <Text style={styles.emptyText}>No orders found</Text>
        <Text style={styles.emptySubtext}>
          {customerSearch ? "Try a different search term" : "Your order history will appear here"}
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchOrders}>
          <Feather name="refresh-cw" size={16} color="#fff" style={styles.refreshIcon} />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order History</Text>
        <TouchableOpacity
          style={[styles.exportButton, exporting || loading ? styles.exportButtonDisabled : null]}
          onPress={exportToExcel}
          disabled={exporting || loading}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <React.Fragment>
              <Feather name="download" size={16} color="#fff" />
              <Text style={styles.exportButtonText}>Export</Text>
            </React.Fragment>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by customer name or ID"
          value={customerSearch}
          onChangeText={setCustomerSearch}
          placeholderTextColor="#999"
        />
        {customerSearch ? (
          <TouchableOpacity onPress={() => setCustomerSearch("")} style={styles.clearButton}>
            <Feather name="x" size={18} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={renderEmptyComponent}
        ListHeaderComponent={
          filteredOrders.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.resultCount}>
                {filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"} found
              </Text>
            </View>
          ) : null
        }
      />
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
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4a6da7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 1,
  },
  exportButtonDisabled: {
    backgroundColor: "#a0aec0",
  },
  exportButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: "#333",
  },
  clearButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  emptyContainer: {
    padding: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4a6da7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4a6da7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshIcon: {
    marginRight: 8,
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  listHeader: {
    marginBottom: 12,
  },
  resultCount: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  orderItem: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  orderIcon: {
    marginRight: 6,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  orderDate: {
    fontSize: 14,
    color: "#666",
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginBottom: 12,
  },
  orderDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderInfo: {
    flex: 1,
  },
  customerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  customerIcon: {
    marginRight: 6,
  },
  customerName: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
    maxWidth: "80%",
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  amountIcon: {
    marginRight: 6,
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
})

