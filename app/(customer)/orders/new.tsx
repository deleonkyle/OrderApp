"use client"

import React, { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  StatusBar,
  Animated,
  Platform,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"

interface Item {
  id: string
  code: string
  name: string
  price: number
  category: string
  description?: string
  image_url?: string
}

interface CartItem extends Item {
  quantity: number
  total: number
}

interface DeliveryOption {
  id: string
  name: string
  fee: number
  icon: string
}

export default function CustomerOrderScreen() {
  const [items, setItems] = useState<Item[]>([])
  const [filteredItems, setFilteredItems] = useState<Item[]>([])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [subtotal, setSubtotal] = useState(0)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [total, setTotal] = useState(0)
  const [selectedDeliveryOption, setSelectedDeliveryOption] = useState<DeliveryOption | null>(null)
  const [customerInfo, setCustomerInfo] = useState<{ id: string; name: string; address: string } | null>(null)
  const [showCart, setShowCart] = useState(false)
  
  // Animation value for cart badge
  const cartBadgeScale = React.useRef(new Animated.Value(1)).current

  const deliveryOptions: DeliveryOption[] = [
    { id: "pickup", name: "Pickup", fee: 0, icon: "package" },
    { id: "tricycle", name: "Tricycle", fee: 50, icon: "truck" },
    { id: "motorcycle", name: "Motorcycle", fee: 80, icon: "wind" },
    { id: "car", name: "4-Wheeler", fee: 120, icon: "truck" },
  ]

  useEffect(() => {
    fetchCustomerInfo()
    fetchItems()
  }, [])

  useEffect(() => {
    filterItems()
  }, [searchQuery, selectedCategory, items])

  useEffect(() => {
    calculateTotals()
    
    // Animate cart badge when items change
    if (cartItems.length > 0) {
      Animated.sequence([
        Animated.timing(cartBadgeScale, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(cartBadgeScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [cartItems, selectedDeliveryOption])

  const fetchCustomerInfo = async () => {
    try {
      const sessionStr = await AsyncStorage.getItem("userSession")
      if (!sessionStr) {
        Alert.alert("Session Error", "Your session has expired. Please log in again.")
        router.replace("/(auth)/customer/login")
        return
      }

      const session = JSON.parse(sessionStr)
      if (!session.id) {
        Alert.alert("Session Error", "User ID not found. Please log in again.")
        router.replace("/(auth)/customer/login")
        return
      }

      // Fetch customer info using the customer ID
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, address")
        .eq("id", session.id)
        .single()

      if (error) {
        throw error
      }

      if (!data) {
        Alert.alert("Error", "Customer information not found. Please contact support.")
        return
      }

      setCustomerInfo(data)
    } catch (error) {
      console.error("Error fetching customer info:", error)
      Alert.alert("Error", "Failed to load customer information. Please try again later.")
    }
  }

  const fetchItems = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true })

      if (error) throw error

      setItems(data || [])
      setFilteredItems(data || [])

      // Extract unique categories
      const uniqueCategories = Array.from(new Set(data?.map((item) => item.category).filter(Boolean))) as string[]

      setCategories(uniqueCategories)
    } catch (error) {
      console.error("Error fetching items:", error)
      Alert.alert("Error", "Failed to load items")
    } finally {
      setIsLoading(false)
    }
  }

  const filterItems = () => {
    let filtered = items

    if (selectedCategory) {
      filtered = filtered.filter((item) => item.category === selectedCategory)
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.code.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    setFilteredItems(filtered)
  }

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category === selectedCategory ? "" : category)
  }

  const addToCart = (item: Item) => {
    setCartItems((prevItems) => {
      // Check if item already exists in cart
      const existingItemIndex = prevItems.findIndex((cartItem) => cartItem.id === item.id)

      if (existingItemIndex >= 0) {
        // Update quantity of existing item
        const updatedItems = [...prevItems]
        updatedItems[existingItemIndex].quantity += 1
        updatedItems[existingItemIndex].total =
          updatedItems[existingItemIndex].price * updatedItems[existingItemIndex].quantity
        return updatedItems
      } else {
        // Add new item to cart
        return [
          ...prevItems,
          {
            ...item,
            quantity: 1,
            total: item.price,
          },
        ]
      }
    })
  }

  const updateCartItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(itemId)
      return
    }

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity, total: item.price * newQuantity } : item,
      ),
    )
  }

  const removeFromCart = (itemId: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== itemId))
  }

  const calculateTotals = () => {
    const itemsSubtotal = cartItems.reduce((sum, item) => sum + item.total, 0)
    setSubtotal(itemsSubtotal)

    const fee = selectedDeliveryOption ? selectedDeliveryOption.fee : 0
    setDeliveryFee(fee)

    setTotal(itemsSubtotal + fee)
  }

  const selectDeliveryOption = (option: DeliveryOption) => {
    setSelectedDeliveryOption(option)
  }

  const placeOrder = async () => {
    try {
      setIsLoading(true)

      // Get customer ID from session
      const sessionStr = await AsyncStorage.getItem("userSession")
      if (!sessionStr) {
        router.replace("/(auth)/customer/login")
        return
      }

      const session = JSON.parse(sessionStr)

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            customer_id: session.id,
            total_amount: total,
            status: "pending",
            delivery_option: selectedDeliveryOption?.name.toLowerCase(),
            delivery_fee: selectedDeliveryOption?.fee || 0
          },
        ])
        .select()
        .single()

      if (orderError) {
        throw new Error("Failed to create order: " + orderError.message)
      }

      // Create order items
      const orderItems = cartItems.map((item) => ({
        order_id: orderData.id,
        item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }))

      const { error: orderItemsError } = await supabase.from("order_items").insert(orderItems)

      if (orderItemsError) {
        throw new Error("Failed to create order items: " + orderItemsError.message)
      }

      Alert.alert(
        "Order Placed",
        "Your order has been placed successfully!",
        [
          {
            text: "OK",
            onPress: () => {
              setCartItems([])
              router.replace("/(customer)/home")
            },
          },
        ],
      )
    } catch (error: any) {
      console.error("Error placing order:", error)
      Alert.alert("Order Error", error.message || "Failed to place order. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const renderItemCard = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => addToCart(item)}
      activeOpacity={0.7}
    >
      <View style={styles.itemImageContainer}>
        {item.image_url ? (
          <Image 
            source={{ uri: item.image_url }} 
            style={styles.itemImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <Feather name="image" size={24} color="#ccc" />
          </View>
        )}
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemCode}>{item.code}</Text>
        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.itemFooter}>
          <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
        </View>
        {item.category && (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText} numberOfLines={1}>
              {item.category}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemMain}>
        <View style={styles.cartItemInfo}>
          <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.cartItemCode}>{item.code}</Text>
          <Text style={styles.cartItemPrice}>₱{item.price.toFixed(2)} each</Text>
          {item.category && (
            <View style={styles.cartItemCategoryTag}>
              <Text style={styles.cartItemCategoryText}>{item.category}</Text>
            </View>
          )}
        </View>
        <View style={styles.quantityControls}>
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => updateCartItemQuantity(item.id, item.quantity - 1)}
          >
            <Feather name="minus" size={18} color="#0ea5e9" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => updateCartItemQuantity(item.id, item.quantity + 1)}
          >
            <Feather name="plus" size={18} color="#0ea5e9" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.cartItemFooter}>
        <Text style={styles.cartItemTotal}>Total: ₱{(item.price * item.quantity).toFixed(2)}</Text>
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => removeFromCart(item.id)}
        >
          <Feather name="trash-2" size={18} color="#f43f5e" />
        </TouchableOpacity>
      </View>
    </View>
  )

  // Main screen content
  const renderMainContent = () => (
    <React.Fragment>
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome, {customerInfo?.name || "Customer"}</Text>
        <Text style={styles.subtitleText}>What would you like to order today?</Text>
      </View>

      <View style={styles.searchAndFilter}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContainer}
        >
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.activeCategoryChip]}
            onPress={() => setSelectedCategory("")}
          >
            <Text 
              style={[styles.categoryChipText, !selectedCategory && styles.activeCategoryChipText]}
              numberOfLines={1}
            >
              All Products
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[styles.categoryChip, selectedCategory === category && styles.activeCategoryChip]}
              onPress={() => handleCategorySelect(category)}
            >
              <Text 
                style={[styles.categoryChipText, selectedCategory === category && styles.activeCategoryChipText]} 
                numberOfLines={1}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Feather name="inbox" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>No products found</Text>
          <Text style={styles.emptyStateSubtext}>Try a different search term or category</Text>
        </View>
      ) : (
        <View style={styles.productListWrapper}>
          <FlatList
            data={filteredItems}
            renderItem={renderItemCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.productRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productGrid}
          />
        </View>
      )}

      {cartItems.length > 0 && !showCart && (
        <TouchableOpacity style={styles.cartSummaryButton} onPress={() => setShowCart(true)}>
          <View style={styles.cartSummaryContent}>
            <View style={styles.cartItemCount}>
              <Text style={styles.cartItemCountText}>{cartItems.length}</Text>
            </View>
            <Text style={styles.cartSummaryText}>View Cart</Text>
          </View>
          <Text style={styles.cartSummaryPrice}>₱{subtotal.toFixed(2)}</Text>
        </TouchableOpacity>
      )}
    </React.Fragment>
  )

  // Cart screen content
  const renderCartContent = () => (
    <React.Fragment>
      <View style={styles.cartHeader}>
        <Text style={styles.cartHeaderTitle}>Your Cart</Text>
        <Text style={styles.cartItemCountBadge}>{cartItems.length} items</Text>
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyCartContainer}>
          <Feather name="shopping-cart" size={64} color="#4A90E2" />
          <Text style={styles.emptyCartText}>Your cart is empty</Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => setShowCart(false)}>
            <Text style={styles.browseButtonText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.cartItemsList}
            ListHeaderComponent={
              <View style={styles.customerInfoCard}>
                <View style={styles.customerInfoHeader}>
                  <Feather name="user" size={18} color="#4A90E2" />
                  <Text style={styles.customerInfoTitle}>Delivery Information</Text>
                </View>
                <Text style={styles.customerName}>{customerInfo?.name}</Text>
                {customerInfo?.address && <Text style={styles.customerAddress}>{customerInfo.address}</Text>}
              </View>
            }
            ListFooterComponent={
              <>
                <View style={styles.deliveryOptionsContainer}>
                  <Text style={styles.deliveryOptionsTitle}>Select Delivery Method</Text>
                  {deliveryOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.deliveryOption,
                        selectedDeliveryOption?.id === option.id && styles.selectedDeliveryOption,
                      ]}
                      onPress={() => selectDeliveryOption(option)}
                    >
                      <View style={styles.deliveryOptionContent}>
                        <Feather name={option.icon as any} size={20} color="#4A90E2" />
                        <View style={styles.deliveryOptionInfo}>
                          <Text style={styles.deliveryOptionName}>{option.name}</Text>
                          <Text style={styles.deliveryOptionFee}>
                            {option.fee > 0 ? `₱${option.fee.toFixed(2)}` : "Free"}
                          </Text>
                        </View>
                      </View>
                      {selectedDeliveryOption?.id === option.id && (
                        <Feather name="check-circle" size={20} color="#4A90E2" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.orderSummary}>
                  <Text style={styles.orderSummaryTitle}>Order Summary</Text>
                  <View style={styles.orderSummaryRow}>
                    <Text style={styles.orderSummaryLabel}>Subtotal</Text>
                    <Text style={styles.orderSummaryValue}>₱{subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.orderSummaryRow}>
                    <Text style={styles.orderSummaryLabel}>Delivery Fee</Text>
                    <Text style={styles.orderSummaryValue}>₱{deliveryFee.toFixed(2)}</Text>
                  </View>
                  <View style={styles.orderSummaryTotal}>
                    <Text style={styles.orderSummaryTotalLabel}>Total</Text>
                    <Text style={styles.orderSummaryTotalValue}>₱{total.toFixed(2)}</Text>
                  </View>
                </View>
              </>
            }
          />

          <View style={styles.cartActions}>
            <TouchableOpacity style={styles.clearCartButton} onPress={() => setCartItems([])}>
              <Text style={styles.clearCartButtonText}>Clear Cart</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.checkoutButton, !selectedDeliveryOption && styles.checkoutButtonDisabled]}
              onPress={placeOrder}
              disabled={!selectedDeliveryOption || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <React.Fragment>
                  <Text style={styles.checkoutButtonText}>Place Order</Text>
                  <Feather name="arrow-right" size={18} color="#fff" />
                </React.Fragment>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </React.Fragment>
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (showCart) {
              setShowCart(false)
              return
            }
            router.back()
          }}
        >
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{showCart ? "Shopping Cart" : "Order Products"}</Text>
        <TouchableOpacity 
          style={styles.cartButton} 
          onPress={() => setShowCart(!showCart)}
        >
          <Feather name="shopping-cart" size={24} color="#4A90E2" />
          {cartItems.length > 0 && (
            <Animated.View 
              style={[
                styles.cartBadge, 
                { transform: [{ scale: cartBadgeScale }] }
              ]}
            >
              <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      {showCart ? renderCartContent() : renderMainContent()}
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
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  cartButton: {
    padding: 8,
    borderRadius: 8,
    position: "relative",
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ff4d4f",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  welcomeSection: {
    padding: 16,
    paddingBottom: 12,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: "#666",
  },
  searchAndFilter: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    height: 50,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: "#333",
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  categoriesScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#eee",
    minWidth: 100,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  activeCategoryChip: {
    backgroundColor: "#4A90E2",
    borderColor: "#4A90E2",
  },
  categoryChipText: {
    fontSize: 14,
    color: "#333",
    textAlign: 'center',
    fontWeight: "500",
    width: 'auto',
    maxWidth: 150,
  },
  activeCategoryChipText: {
    color: "#fff",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  productListWrapper: {
    flex: 1,
  },
  productGrid: {
    paddingHorizontal: 8,
    paddingBottom: 80, // Add padding to bottom for cart summary button
  },
  productRow: {
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  itemCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImageContainer: {
    width: "100%",
    height: 150,
    backgroundColor: "#f5f5f5",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  itemInfo: {
    padding: 12,
    position: "relative",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  itemCode: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    lineHeight: 16,
  },
  itemFooter: {
    marginTop: 8,
    marginBottom: 24, // Add space for category tag
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0ea5e9",
  },
  categoryTag: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bae6fd",
    maxWidth: "90%", // Prevent overflow
  },
  categoryTagText: {
    fontSize: 12,
    color: "#0369a1",
    flexShrink: 1,
  },
  cartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  cartHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  cartItemCountBadge: {
    fontSize: 14,
    color: "#666",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cartItemsList: {
    padding: 16,
    paddingBottom: 100, // Extra padding for bottom buttons
  },
  // Delivery Info Card
  customerInfoCard: {
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
  customerInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  customerInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginLeft: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  customerAddress: {
    fontSize: 14,
    color: "#666",
  },
  // Delivery Options
  deliveryOptionsContainer: {
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deliveryOptionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  deliveryOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    marginBottom: 8,
  },
  selectedDeliveryOption: {
    backgroundColor: "#e6f7ff",
    borderColor: "#4A90E2",
  },
  deliveryOptionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  deliveryOptionInfo: {
    marginLeft: 12,
  },
  deliveryOptionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  deliveryOptionFee: {
    fontSize: 14,
    color: "#666",
  },
  // Order Summary
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
  orderSummaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  orderSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderSummaryLabel: {
    fontSize: 16,
    color: "#666",
  },
  orderSummaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  orderSummaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  orderSummaryTotalLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  orderSummaryTotalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#28a745",
  },
  cartActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    gap: 12,
  },
  clearCartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    flex: 1,
  },
  clearCartButtonText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 14,
  },
  checkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#28a745",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 2,
  },
  checkoutButtonDisabled: {
    backgroundColor: "#8bc9a0",
  },
  checkoutButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginRight: 8,
  },
  emptyCartContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyCartText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4A90E2",
  },
  browseButtonText: {
    color: "#4A90E2",
    fontWeight: "600",
    fontSize: 14,
  },
  cartSummaryButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  cartSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemCount: {
    backgroundColor: '#fff',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cartItemCountText: {
    color: '#4A90E2',
    fontWeight: 'bold',
    fontSize: 12,
  },
  cartSummaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cartSummaryPrice: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cartItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cartItemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cartItemCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A90E2',
    marginBottom: 8,
  },
  cartItemCategoryTag: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bae6fd",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  cartItemCategoryText: {
    fontSize: 12,
    color: "#0369a1",
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  quantityButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    width: 32,
  },
  quantityText: {
    width: 40,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  cartItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 12,
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  removeButton: {
    padding: 8,
    backgroundColor: '#fff0f0',
    borderRadius: 8,
  },
})