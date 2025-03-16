"use client"

import React, { useEffect, useState, useCallback } from "react"
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { authService } from "@/lib/auth"
import { customerService, orderService } from "@/lib/database"
import { dateUtils, perfMonitor, uiHelpers } from "@/lib/utils"
import { Database } from "@/types/database"
import { LinearGradient, LinearGradientProps } from "expo-linear-gradient"

type GradientColors = readonly [string, string]

const NEW_ORDER_GRADIENT = ['#4361ee', '#3a0ca3'] as const
const ORDERS_GRADIENT = ['#10b981', '#059669'] as const
const PROFILE_GRADIENT = ['#f59e0b', '#d97706'] as const

type Customer = Database["public"]["Tables"]["customers"]["Row"]
type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: Array<{
    id: string
    quantity: number
    price: number
    item?: {
      name: string
    }
  }>
}

const { width } = Dimensions.get("window")
const CARD_WIDTH = width * 0.28

export default function CustomerHomeScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomerData()
  }, [])

  const fetchCustomerData = async () => {
    try {
      perfMonitor.startTimer('fetchCustomerData')
      setLoading(true)

      const userId = await authService.getUserId()
      if (!userId) {
        router.replace("/(auth)/customer/login")
        return
      }

      const customerData = await customerService.getById(userId)
      if (!customerData) {
        throw new Error("Failed to fetch customer data")
      }
      
      setCustomer(customerData)

      const recentOrders = await orderService.getByCustomerId(userId)
      setOrders(recentOrders)

      perfMonitor.endTimer('fetchCustomerData')
    } catch (error) {
      console.error("Error fetching customer data:", error)
      Alert.alert("Error", "Failed to load customer data. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchCustomerData()
  }, [])

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          try {
            const result = await authService.logout()
            if (!result.success) {
              throw new Error(result.error)
            }
            router.replace("/")
          } catch (error: any) {
            console.error("Logout error:", error)
            Alert.alert("Error", "Failed to logout. Please try again.")
          }
        },
      },
    ])
  }

  const navigateToOrderDetails = (orderId: string) => {
    router.push({
      pathname: "/(customer)/orders/[id]",
      params: { id: orderId }
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return ['#f59e0b', '#d97706'];
      case 'processing':
        return ['#3b82f6', '#2563eb'];
      case 'completed':
        return ['#10b981', '#059669'];
      case 'cancelled':
        return ['#ef4444', '#dc2626'];
      default:
        return ['#6b7280', '#4b5563'];
    }
  }

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header with user info */}
      <View style={styles.header}>
        <View style={styles.userInfoContainer}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(customer?.name || "")}</Text>
          </View>
          <View style={styles.userTextContainer}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{customer?.name || "Customer"}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push("/(customer)/profile")}
        >
          <Feather name="bell" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A90E2"]} />
        }
      >
        {/* Quick Actions Cards */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionCardsContainer}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(customer)/orders/new")}
            >
              {/* @ts-ignore - LinearGradient types are incorrect */}
              <LinearGradient
                colors={NEW_ORDER_GRADIENT}
                style={styles.actionCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.actionIconContainer}>
                  <Feather name="shopping-bag" size={24} color="#fff" />
                </View>
                <Text style={styles.actionTitle}>New Order</Text>
                <Text style={styles.actionSubtitle}>Browse products</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(customer)/orders/history")}
            >
              {/* @ts-ignore - LinearGradient types are incorrect */}
              <LinearGradient
                colors={ORDERS_GRADIENT}
                style={styles.actionCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.actionIconContainer}>
                  <Feather name="list" size={24} color="#fff" />
                </View>
                <Text style={styles.actionTitle}>Orders</Text>
                <Text style={styles.actionSubtitle}>View history</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(customer)/profile")}
            >
              {/* @ts-ignore - LinearGradient types are incorrect */}
              <LinearGradient
                colors={PROFILE_GRADIENT}
                style={styles.actionCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.actionIconContainer}>
                  <Feather name="user" size={24} color="#fff" />
                </View>
                <Text style={styles.actionTitle}>Profile</Text>
                <Text style={styles.actionSubtitle}>Your account</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Orders Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity 
              style={styles.seeAllButton}
              onPress={() => router.push("/(customer)/orders/history")}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <Feather name="chevron-right" size={16} color="#4A90E2" />
            </TouchableOpacity>
          </View>

          {orders.length > 0 ? (
            orders.slice(0, 3).map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => navigateToOrderDetails(order.id)}
                activeOpacity={0.7}
              >
                <View style={styles.orderCardContent}>
                  <View style={styles.orderIconContainer}>
                    <LinearGradient
                      colors={getStatusColor(order.status)}
                      style={styles.orderIconGradient}
                    >
                      <Feather 
                        name={
                          order.status.toLowerCase() === 'completed' 
                            ? "check" 
                            : order.status.toLowerCase() === 'cancelled'
                            ? "x"
                            : "clock"
                        } 
                        size={18} 
                        color="#fff" 
                      />
                    </LinearGradient>
                  </View>
                  
                  <View style={styles.orderInfo}>
                    <View style={styles.orderTopRow}>
                      <Text style={styles.orderNumber}>Order #{order.id.substring(0, 8)}</Text>
                      <Text style={styles.orderAmount}>₱{order.total_amount.toFixed(2)}</Text>
                    </View>
                    
                    <View style={styles.orderBottomRow}>
                      <Text style={styles.orderDate}>
                        {dateUtils.format(order.created_at, "MMM d, yyyy")}
                      </Text>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: uiHelpers.getStatusColorString(order.status) }
                      ]}>
                        <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <Feather name="chevron-right" size={20} color="#ccc" />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Feather name="package" size={32} color="#a1a1aa" />
              </View>
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySubtext}>Your recent orders will appear here</Text>
              <TouchableOpacity 
                style={styles.createOrderButton}
                onPress={() => router.push("/(customer)/orders/new")}
              >
                <Text style={styles.createOrderButtonText}>Create New Order</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity
            style={styles.accountOption}
            onPress={() => router.push("/(customer)/profile")}
          >
            <View style={[styles.accountIconContainer, { backgroundColor: '#e0f2fe' }]}>
              <Feather name="user" size={18} color="#0284c7" />
            </View>
            <View style={styles.accountOptionTextContainer}>
              <Text style={styles.accountOptionTitle}>Profile & Settings</Text>
              <Text style={styles.accountOptionSubtitle}>Manage your account details</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.accountOption}
            onPress={() => router.push("/(customer)/profile")}
          >
            <View style={[styles.accountIconContainer, { backgroundColor: '#f0fdf4' }]}>
              <Feather name="help-circle" size={18} color="#16a34a" />
            </View>
            <View style={styles.accountOptionTextContainer}>
              <Text style={styles.accountOptionTitle}>Help & Support</Text>
              <Text style={styles.accountOptionSubtitle}>Get assistance with your orders</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.accountOption}
            onPress={handleLogout}
          >
            <View style={[styles.accountIconContainer, { backgroundColor: '#fef2f2' }]}>
              <Feather name="log-out" size={18} color="#dc2626" />
            </View>
            <View style={styles.accountOptionTextContainer}>
              <Text style={styles.accountOptionTitle}>Sign Out</Text>
              <Text style={styles.accountOptionSubtitle}>Log out of your account</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
        
        {/* App Version */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  userTextContainer: {
    justifyContent: "center",
  },
  welcomeText: {
    fontSize: 14,
    color: "#64748b",
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  actionCardsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.2,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  actionCardGradient: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 'auto',
  },
  actionSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  seeAllText: {
    fontSize: 14,
    color: "#4A90E2",
    fontWeight: "500",
    marginRight: 4,
  },
  orderCard: {
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  orderCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  orderIconContainer: {
    marginRight: 16,
  },
  orderIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  orderInfo: {
    flex: 1,
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  orderBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderDate: {
    fontSize: 13,
    color: "#64748b",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  createOrderButton: {
    backgroundColor: "#4A90E2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createOrderButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  accountOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  accountIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  accountOptionTextContainer: {
    flex: 1,
  },
  accountOptionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  accountOptionSubtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 16,
  },
})