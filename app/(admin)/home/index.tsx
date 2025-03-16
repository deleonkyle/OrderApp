"use client"

import type React from "react"

import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, Animated } from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { formatDistanceToNow } from "date-fns"
import { authService } from "@/lib/auth"
import { uiHelpers } from "@/lib/utils"
import type { AppRoutes } from "app/_layout"

type OrderStatus = "Pending" | "Completed" | "Cancelled" | "Processing"
type FeatherIconName = React.ComponentProps<typeof Feather>["name"]

interface Order {
  id: string
  customer: string
  date: string
  amount: string
  status: OrderStatus
}

interface MenuItem {
  title: string
  icon: FeatherIconName
  color: string
  route: keyof AppRoutes
  description: string
}

interface StatItem {
  icon: FeatherIconName
  label: string
  value: string | number
  color: string
}

export default function HomeScreen() {
  const [username, setUsername] = useState("User")
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [monthlySales, setMonthlySales] = useState("₱0.00")
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true)
      try {
        const storedUsername = await AsyncStorage.getItem("username")
        if (storedUsername) setUsername(storedUsername)

        await Promise.all([fetchRecentOrders(), fetchOrderStats()])
      } catch (error) {
        console.error("Initialization error:", error)
        Alert.alert("Error", "Failed to initialize data")
      } finally {
        setLoading(false)
        startAnimations()
      }
    }

    initializeData()
  }, [])

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const refreshData = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchRecentOrders(), fetchOrderStats()])
    } catch (error) {
      console.error("Refresh error:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const fetchOrderStats = async () => {
    try {
      // Get current date in UTC
      const now = new Date()
      const utcYear = now.getUTCFullYear()
      const utcMonth = now.getUTCMonth()

      // Create start of month in UTC
      const startOfMonthUTC = new Date(Date.UTC(utcYear, utcMonth, 1))

      // Get total orders count
      const { count: ordersCount, error: countError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })

      if (countError) throw countError

      setTotalOrders(ordersCount || 0)

      // Get monthly sales
      const { data: salesData, error: salesError } = await supabase
        .from("orders")
        .select("total_amount")
        .gte("created_at", startOfMonthUTC.toISOString())
        .eq("status", "Completed")

      if (salesError) throw salesError

      const totalSales = salesData.reduce((sum, order) => {
        const amount = Number(order.total_amount)
        return sum + (isNaN(amount) ? 0 : amount)
      }, 0)

      setMonthlySales(
        new Intl.NumberFormat("en-PH", {
          style: "currency",
          currency: "PHP",
          minimumFractionDigits: 2,
        }).format(totalSales),
      )
    } catch (error) {
      console.error("Error fetching stats:", error)
      Alert.alert("Error", "Failed to load statistics")
    }
  }

  const fetchRecentOrders = async () => {
    try {
      // Fetch orders with customer data using a simpler query
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          total_amount,
          status,
          created_at,
          customer_id
        `)
        .order("created_at", { ascending: false })
        .limit(3)

      if (ordersError) throw ordersError

      // Fetch all relevant customers in a separate query
      const customerIds = ordersData.map((order) => order.customer_id)

      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds)

      if (customersError) throw customersError

      // Create a map of customer IDs to names for quick lookup
      const customerMap = new Map(customersData?.map((c) => [c.id, c.name]) || [])

      // Process the orders data
      const formattedOrders: Order[] = ordersData.map((order) => {
        const customerName = customerMap.get(order.customer_id)

        return {
          id: order.id,
          customer: customerName || "Unknown Customer",
          date: formatDistanceToNow(new Date(order.created_at), { addSuffix: true }),
          amount: new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
          }).format(Number(order.total_amount)),
          status: order.status as OrderStatus,
        }
      })

      setRecentOrders(formattedOrders)
    } catch (error) {
      console.error("Fetch orders error:", error)
      Alert.alert("Error", "Failed to load recent orders")
    }
  }

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          try {
            await authService.logout()
            router.replace("/")
          } catch (error) {
            console.error("Logout error:", error)
            Alert.alert("Error", "Failed to logout. Please try again.")
          }
        },
      },
    ])
  }

  const getStatusColor = (status: OrderStatus) => {
    return uiHelpers.getStatusColorString(status)
  }

  const handleNavigation = (route: keyof AppRoutes) => {
    if (route.includes("[id]")) {
      router.push({
        pathname: route as any,
        params: { id: "list" },
      })
    } else {
      router.push(route as any)
    }
  }

  const statItems: StatItem[] = [
    {
      icon: "box",
      label: "Total Orders",
      value: totalOrders,
      color: "#4361ee",
    },
    {
      icon: "dollar-sign",
      label: "Monthly Sales",
      value: monthlySales,
      color: "#f72585",
    },
  ]

  const menuItems: MenuItem[] = [
    {
      title: "Orders",
      icon: "shopping-bag",
      color: "#4A90E2",
      route: "/(admin)/orders/history",
      description: "View and manage customer orders"
    },
    {
      title: "New Order",
      icon: "plus-circle",
      color: "#10B981",
      route: "/(admin)/orders/new",
      description: "Create a new order for a customer"
    },
    {
      title: "Products",
      icon: "package",
      color: "#F59E0B",
      route: "/(admin)/products",
      description: "Manage your product catalog"
    },
    {
      title: "Visit Logs",
      icon: "map-pin",
      color: "#8B5CF6",
      route: "/(admin)/visit-log",
      description: "Track customer visits and travel details"
    },
    {
      title: "Admin Invitations",
      icon: "user-plus",
      color: "#EC4899",
      route: "/(admin)/admin-invitations",
      description: "Manage admin invitations and access"
    }
  ]

  const renderStatItem = (item: StatItem, index: number) => (
    <Animated.View
      key={item.label}
      style={[
        styles.statCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${item.color}15` }]}>
        <Feather name={item.icon} size={20} color={item.color} />
      </View>
      <View style={styles.statTextContainer}>
        <Text style={styles.statLabel}>{item.label}</Text>
        <Text style={styles.statValue}>{item.value}</Text>
      </View>
    </Animated.View>
  )

  const renderOrderItem = (order: Order, index: number) => (
    <Animated.View
      key={order.id}
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        { animationDelay: `${index * 100}ms` },
      ]}
    >
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() =>
          router.push({
            pathname: "/(admin)/orders/[id]",
            params: { id: order.id },
          })
        }
      >
        <View style={styles.orderInfo}>
          <Text style={styles.orderCustomer}>{order.customer}</Text>
          <Text style={styles.orderDate}>{order.date}</Text>
        </View>
        <View style={styles.orderDetails}>
          <Text style={styles.orderAmount}>{order.amount}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
            <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>{order.status}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )

  const renderMenuItem = (item: MenuItem, index: number) => (
    <Animated.View
      key={item.title}
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        { animationDelay: `${index * 100}ms` },
      ]}
    >
      <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation(item.route)}>
        <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
          <Feather name={item.icon} size={22} color="#fff" />
        </View>
        <View style={styles.menuTextContainer}>
          <Text style={styles.menuText}>{item.title}</Text>
          <Text style={styles.menuDescription}>{item.description}</Text>
        </View>
        <Feather name="chevron-right" size={18} color="#9ca3af" />
      </TouchableOpacity>
    </Animated.View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.headerTitle}>{username}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} testID="logout-button">
          <Feather name="log-out" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.statsContainer}>{statItems.map(renderStatItem)}</View>

        <View style={styles.recentOrdersContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Feather name="clock" size={18} color="#4361ee" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Recent Orders</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(admin)/orders/history")} style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See all</Text>
              <Feather name="arrow-right" size={14} color="#4361ee" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
          ) : recentOrders.length > 0 ? (
            recentOrders.map(renderOrderItem)
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={24} color="#9ca3af" />
              <Text style={styles.emptyText}>No recent orders</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Feather name="grid" size={18} color="#4361ee" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
        </View>

        <View style={styles.menuGrid}>{menuItems.map(renderMenuItem)}</View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeText: {
    fontSize: 14,
    color: "#6b7280",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: "#f72585",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  statTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: "#4361ee",
    fontWeight: "500",
  },
  recentOrdersContainer: {
    marginBottom: 24,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  orderInfo: {
    flex: 1,
  },
  orderCustomer: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  orderDate: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  orderDetails: {
    alignItems: "flex-end",
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  menuGrid: {
    marginBottom: 24,
    gap: 12,
  },
  menuItem: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 14,
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 8,
  },
})

