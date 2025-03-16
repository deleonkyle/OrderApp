"use client"

import { useState, useEffect, useRef } from "react"
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  Animated,
  Image,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import "react-native-get-random-values"
import React from "react"

interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
}

interface Item {
  id: string
  code: string
  name: string
  price: number
  category?: string
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

const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: "pickup", name: "Pickup", fee: 0, icon: "package" },
  { id: "tricycle", name: "Tricycle", fee: 50, icon: "truck" },
  { id: "motorcycle", name: "Motorcycle", fee: 80, icon: "wind" },
  { id: "car", name: "Car/Van", fee: 150, icon: "truck" },
]

interface RenderCustomerItemProps {
  item: Customer
  section: "inline" | "modal"
  index?: number
}

interface CustomerListRenderItemProps {
  item: Customer
}

export default function NewOrderScreen() {
  const [customer, setCustomer] = useState<Customer>({ id: "", name: "" })
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [customerQuery, setCustomerQuery] = useState("")
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [allItems, setAllItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOption>(DELIVERY_OPTIONS[0])

  // Animation for cart badge
  const cartBadgeScale = useRef(new Animated.Value(1)).current

  // Load all items, categories, and customers on component mount
  useEffect(() => {
    fetchItems()
    fetchCustomers()
  }, [])

  // Calculate total amount whenever cart items change
  useEffect(() => {
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    setTotalAmount(total)

    // Animate cart badge when items are added
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
  }, [cartItems])

  useEffect(() => {
    calculateTotals()
  }, [cartItems, selectedDelivery])

  const fetchItems = async () => {
    setIsLoadingItems(true)
    try {
      // Fetch all items
      const { data: itemsData, error: itemsError } = await supabase.from("items").select("*").order("name")

      if (itemsError) throw itemsError

      setAllItems(itemsData || [])

      // Extract unique categories
      const uniqueCategories = Array.from(new Set(itemsData?.map((item) => item.category).filter(Boolean))) as string[]

      setCategories(["all", ...uniqueCategories])
    } catch (error) {
      console.error("Error fetching items:", error)
      Alert.alert("Error", "Failed to load items")
    } finally {
      setIsLoadingItems(false)
    }
  }

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true)
    try {
      const { data, error } = await supabase.from("customers").select("id, name, phone, email, address").order("name")

      if (error) throw error

      if (data && data.length > 0) {
        setAllCustomers(data as Customer[])
      } else {
        setAllCustomers([])
      }
    } catch (error) {
      console.error("Error fetching customers:", error)
      Alert.alert("Error", "Failed to load customers")
      setAllCustomers([])
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const handleCustomerSearch = (text: string) => {
    setCustomerQuery(text)
    if (text.length > 0) {
      const results = allCustomers.filter(
        (c) =>
          c.name.toLowerCase().includes(text.toLowerCase()) ||
          c.phone?.toLowerCase().includes(text.toLowerCase()) ||
          c.email?.toLowerCase().includes(text.toLowerCase()),
      )
      setCustomerResults(results)
    } else {
      setCustomerResults([])
    }
  }

  const selectCustomer = (selectedCustomer: Customer) => {
    setCustomer(selectedCustomer)
    setShowCustomerSelector(false)
  }

  const handleItemSearch = (text: string) => {
    setSearchQuery(text)
  }

  const filterItemsByCategory = (category: string) => {
    setSelectedCategory(category)
  }

  const addToCart = (item: Item) => {
    setCartItems((prev) => {
      const existingItem = prev.find((i) => i.id === item.id)
      if (existingItem) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i,
        )
      }
      return [...prev, { ...item, quantity: 1, total: item.price }]
    })
  }

  const updateCartItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(itemId)
      return
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity, total: newQuantity * item.price } : item,
      ),
    )
  }

  const removeFromCart = (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const clearCart = () => {
    setCartItems([])
  }

  const proceedToCheckout = () => {
    if (!customer.id) {
      Alert.alert("Error", "Please select a customer first")
      return
    }
    if (cartItems.length === 0) {
      Alert.alert("Error", "Your cart is empty")
      return
    }
    setShowCart(false)
    setShowCheckout(true)
  }

  const getFilteredItems = (): Item[] => {
    let filteredItems = allItems

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredItems = filteredItems.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query) ||
          (item.category && item.category.toLowerCase().includes(query)),
      )
    }

    // Filter by category
    if (selectedCategory && selectedCategory !== "all") {
      filteredItems = filteredItems.filter((item) => item.category === selectedCategory)
    }

    return filteredItems
  }

  const placeOrder = async () => {
    if (!customer.id) {
      Alert.alert("Error", "Please select a customer")
      return
    }

    if (cartItems.length === 0) {
      Alert.alert("Error", "Cart is empty")
      return
    }

    try {
      setIsLoading(true)

      // Calculate final total with delivery fee
      const finalTotal = totalAmount + selectedDelivery.fee

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            customer_id: customer.id,
            total_amount: finalTotal,
            status: "pending",
            delivery_option: selectedDelivery.name.toLowerCase(),
            delivery_fee: selectedDelivery.fee,
          },
        ])
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = cartItems.map((item) => ({
        order_id: orderData.id,
        item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }))

      const { error: orderItemsError } = await supabase.from("order_items").insert(orderItems)
      if (orderItemsError) throw orderItemsError

      Alert.alert("Success", "Order placed successfully!", [
        {
          text: "OK",
          onPress: () => router.replace("/home"),
        },
      ])
    } catch (error: any) {
      console.error("Error placing order:", error)
      Alert.alert("Error", "Failed to place order. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const calculateTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const deliveryFee = selectedDelivery.fee
    const total = subtotal + deliveryFee
    setTotalAmount(total)
  }

  const exportOrder = async (orderId: string) => {
    try {
      const workbook = XLSX.utils.book_new()
      const orderDetails = [
        ["Order ID", orderId],
        ["Customer", customer.name],
        ["Date", new Date().toLocaleDateString()],
        ["Total Amount", `₱${totalAmount.toFixed(2)}`],
        [""],
        ["Item Code", "Item Name", "Quantity", "Price", "Total"],
      ]

      cartItems.forEach((item: CartItem) => {
        orderDetails.push([
          item.code,
          item.name,
          String(item.quantity),
          `₱${item.price.toFixed(2)}`,
          `₱${(item.price * item.quantity).toFixed(2)}`,
        ])
      })

      const worksheet = XLSX.utils.aoa_to_sheet(orderDetails)
      XLSX.utils.book_append_sheet(workbook, worksheet, "Order")

      const wbout = XLSX.write(workbook, { type: "base64", bookType: "xlsx" })
      const fileName = `order_${orderId}_${new Date().getTime()}.xlsx`
      const filePath = `${FileSystem.documentDirectory}${fileName}`

      await FileSystem.writeAsStringAsync(filePath, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      })

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath)
        Alert.alert("Success", "Order exported successfully")
      } else {
        Alert.alert("Error", "Sharing is not available on this device")
      }
    } catch (error) {
      console.error("Error exporting order:", error)
      Alert.alert("Error", "Failed to export order")
    }
  }

  // Component renderers
  const renderItemCard = ({ item }: { item: Item }) => (
    <TouchableOpacity style={styles.itemCard} onPress={() => addToCart(item)} activeOpacity={0.7}>
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
          {item.category && (
            <View style={styles.categoryTag}>
              <Text style={styles.categoryTagText} numberOfLines={1}>
                {item.category}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.name}</Text>
        <Text style={styles.cartItemCode}>{item.code}</Text>
        <Text style={styles.cartItemPrice}>₱{item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.cartItemActions}>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => updateCartItemQuantity(item.id, item.quantity - 1)}
          >
            <Feather name="minus" size={16} color="#007bff" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => updateCartItemQuantity(item.id, item.quantity + 1)}
          >
            <Feather name="plus" size={16} color="#007bff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.cartItemTotal}>₱{(item.price * item.quantity).toFixed(2)}</Text>
        <TouchableOpacity style={styles.removeButton} onPress={() => removeFromCart(item.id)}>
          <Feather name="trash-2" size={16} color="#ff4d4f" />
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderCustomerItem = ({ item, section }: RenderCustomerItemProps) => {
    const isInline = section === "inline"
    return (
      <TouchableOpacity
        style={isInline ? styles.inlineCustomerItem : styles.customerItem}
        onPress={() => selectCustomer(item)}
        activeOpacity={0.7}
      >
        <View style={styles.customerItemContent}>
          <Text style={isInline ? styles.inlineCustomerName : styles.customerName}>{item.name}</Text>
          {item.phone && (
            <Text style={isInline ? styles.inlineCustomerDetail : styles.customerDetail}>
              {isInline ? item.phone : `Phone: ${item.phone}`}
            </Text>
          )}
          {!isInline && item.email && <Text style={styles.customerDetail}>Email: {item.email}</Text>}
        </View>
        <Feather name="chevron-right" size={isInline ? 16 : 20} color="#999" />
      </TouchableOpacity>
    )
  }

  const renderCustomerListItem = ({ item }: CustomerListRenderItemProps) =>
    renderCustomerItem({ item, section: "inline" })

  const renderCustomerList = () => {
    const customers = customerQuery.length > 0 ? customerResults : allCustomers.slice(0, 5)
    return (
      <FlatList
        data={customers}
        renderItem={renderCustomerListItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.inlineCustomerList}
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <Feather name="users" size={32} color="#ccc" />
            <Text style={styles.emptyStateText}>No customers found</Text>
          </View>
        }
        ListFooterComponent={
          allCustomers.length > 5 && customerQuery.length === 0 ? (
            <TouchableOpacity style={styles.viewAllCustomersButton} onPress={() => setShowCustomerSelector(true)}>
              <Text style={styles.viewAllCustomersText}>View All Customers</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    )
  }

  const renderProductList = () => (
    <View style={styles.productsSection}>
      {isLoadingItems ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredItems()}
          renderItem={renderItemCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productsRow}
          contentContainerStyle={styles.productsGrid}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Feather name="package" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No products found</Text>
              <Text style={styles.emptyStateSubtext}>Try adjusting your search or category filter</Text>
            </View>
          }
        />
      )}
    </View>
  )

  // Main screen content
  const renderMainContent = () => (
    <>
      {/* Customer Selection */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Customer</Text>
        </View>

        {customer.id ? (
  <View style={styles.selectedCustomerCard}>
    <View style={styles.selectedCustomerInfo}>
      <Feather name="user" size={20} color="#0369a1" style={styles.customerIcon} />
      <View style={styles.selectedCustomerDetails}>
        <Text style={styles.selectedCustomerName}>{customer.name}</Text>
        {customer.phone && <Text style={styles.selectedCustomerDetail}>{customer.phone}</Text>}
        {customer.email && <Text style={styles.selectedCustomerDetail}>{customer.email}</Text>}
      </View>
    </View>
    <TouchableOpacity 
      style={styles.closeCustomerButton} 
      onPress={() => setCustomer({ id: "", name: "" })}
    >
      <Feather name="x" size={18} color="#666" />
    </TouchableOpacity>
  </View>
        ) : (
          <>
            <View style={styles.customerSearchContainer}>
              <View style={[styles.searchContainer, { flex: 1 }]}>
                <Feather name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Search customers by name or phone"
                  value={customerQuery}
                  onChangeText={handleCustomerSearch}
                  placeholderTextColor="#999"
                  autoFocus
                />
              </View>
            </View>

            {isLoadingCustomers ? (
              <View style={styles.inlineLoadingContainer}>
                <ActivityIndicator size="small" color="#0ea5e9" />
                <Text style={styles.inlineLoadingText}>Loading customers...</Text>
              </View>
            ) : (
              renderCustomerList()
            )}
          </>
        )}
      </View>

      {/* Search and Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Products</Text>

        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search products by name or code"
            value={searchQuery}
            onChangeText={handleItemSearch}
            placeholderTextColor="#999"
          />
        </View>

        {/* Categories horizontal scroll */}
        {categories.length > 0 && (
          <View style={styles.categoriesContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScrollContent}
            >
              <TouchableOpacity
                style={[styles.categoryChip, !selectedCategory && styles.categoryChipSelected]}
                onPress={() => setSelectedCategory("")}
              >
                <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextSelected]}>All</Text>
              </TouchableOpacity>

              {categories
                .filter((c) => c !== "all")
                .map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, selectedCategory === category && styles.categoryChipSelected]}
                    onPress={() => filterItemsByCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === category && styles.categoryChipTextSelected,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        )}
      </View>

      {renderProductList()}
    </>
  )

  // Cart screen content
  const renderCartContent = () => (
    <View style={styles.cartContainer}>
      <View style={styles.cartHeader}>
        <Text style={styles.cartTitle}>Shopping Cart</Text>
        <Text style={styles.cartItemCount}>
          {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {cartItems.length > 0 ? (
        <>
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.cartItemsList}
            ListFooterComponent={<View style={{ height: 150 }} />}
          />

          <View style={styles.cartSummary}>
            <View style={styles.cartSummaryRow}>
              <Text style={styles.cartSummaryLabel}>Subtotal</Text>
              <Text style={styles.cartSummaryValue}>₱{totalAmount.toFixed(2)}</Text>
            </View>

            <View style={[styles.cartSummaryRow, styles.cartSummaryTotal]}>
              <Text style={styles.cartTotalLabel}>Total</Text>
              <Text style={styles.cartTotalValue}>₱{totalAmount.toFixed(2)}</Text>
            </View>

            <View style={styles.cartActions}>
              <TouchableOpacity style={styles.clearCartButton} onPress={clearCart}>
                <Feather name="trash" size={16} color="#666" style={{ marginRight: 8 }} />
                <Text style={styles.clearCartButtonText}>Clear Cart</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.checkoutButton} onPress={proceedToCheckout}>
                <Feather name="check-circle" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.checkoutButtonText}>Checkout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.emptyCartContainer}>
          <Feather name="shopping-cart" size={64} color="#ccc" />
          <Text style={styles.emptyCartText}>Your cart is empty</Text>
          <Text style={styles.emptyCartSubtext}>Add some products to your cart to get started</Text>
          <TouchableOpacity style={styles.continueShopping} onPress={() => setShowCart(false)}>
            <Feather name="arrow-left" size={16} color="#0ea5e9" style={{ marginRight: 8 }} />
            <Text style={styles.continueShoppingText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )

  // Checkout screen content
  const renderCheckoutContent = () => (
    <View style={styles.checkoutContainer}>
      <View style={styles.checkoutHeader}>
        <Text style={styles.checkoutTitle}>Checkout</Text>
      </View>

      <ScrollView style={styles.checkoutContent}>
        {/* Customer Information */}
        <View style={styles.checkoutSection}>
          <Text style={styles.checkoutSectionTitle}>Customer Information</Text>

          {customer.id ? (
            <View style={styles.checkoutCustomerInfo}>
              <Text style={styles.checkoutCustomerName}>{customer.name}</Text>
              {customer.phone && <Text style={styles.checkoutCustomerDetail}>Phone: {customer.phone}</Text>}
              {customer.email && <Text style={styles.checkoutCustomerDetail}>Email: {customer.email}</Text>}
              {customer.address && <Text style={styles.checkoutCustomerDetail}>Address: {customer.address}</Text>}
            </View>
          ) : (
            <View style={styles.checkoutCustomerSelect}>
              <Text style={styles.checkoutCustomerSelectText}>Please select a customer to continue</Text>
              <TouchableOpacity
                style={styles.selectCustomerButton}
                onPress={() => {
                  setShowCheckout(false)
                  setShowCustomerSelector(true)
                }}
              >
                <Text style={styles.selectCustomerButtonText}>Select Customer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Delivery Options */}
        <View style={styles.checkoutSection}>
          <Text style={styles.checkoutSectionTitle}>Delivery Options</Text>
          <View style={styles.deliveryOptionsContainer}>
            {DELIVERY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.deliveryOptionButton,
                  selectedDelivery.id === option.id && styles.selectedDeliveryOption,
                ]}
                onPress={() => setSelectedDelivery(option)}
              >
                <View style={styles.deliveryOptionContent}>
                  <Feather
                    name={option.icon as any}
                    size={24}
                    color={selectedDelivery.id === option.id ? "#fff" : "#0ea5e9"}
                  />
                  <View style={styles.deliveryOptionInfo}>
                    <Text
                      style={[
                        styles.deliveryOptionName,
                        selectedDelivery.id === option.id && styles.selectedDeliveryOptionText,
                      ]}
                    >
                      {option.name}
                    </Text>
                    <Text
                      style={[
                        styles.deliveryOptionFee,
                        selectedDelivery.id === option.id && styles.selectedDeliveryOptionText,
                      ]}
                    >
                      {option.fee > 0 ? `₱${option.fee.toFixed(2)}` : "Free"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.checkoutSection}>
          <Text style={styles.checkoutSectionTitle}>Order Summary</Text>

          {cartItems.map((item, index) => (
            <View key={item.id} style={styles.checkoutItem}>
              <View style={styles.checkoutItemInfo}>
                <Text style={styles.checkoutItemName}>{item.name}</Text>
                <Text style={styles.checkoutItemCode}>{item.code}</Text>
              </View>
              <Text style={styles.checkoutItemQuantity}>
                {item.quantity} x ₱{item.price.toFixed(2)}
              </Text>
              <Text style={styles.checkoutItemTotal}>₱{(item.quantity * item.price).toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.checkoutDivider} />

          <View style={styles.checkoutSummary}>
            <View style={styles.checkoutSummaryRow}>
              <Text style={styles.checkoutSummaryLabel}>Subtotal</Text>
              <Text style={styles.checkoutSummaryValue}>₱{totalAmount.toFixed(2)}</Text>
            </View>

            <View style={styles.checkoutSummaryRow}>
              <Text style={styles.checkoutSummaryLabel}>Delivery Fee</Text>
              <Text style={styles.checkoutSummaryValue}>₱{selectedDelivery.fee.toFixed(2)}</Text>
            </View>

            <View style={[styles.checkoutSummaryRow, styles.checkoutSummaryTotal]}>
              <Text style={styles.checkoutTotalLabel}>Total</Text>
              <Text style={styles.checkoutTotalValue}>₱{(totalAmount + selectedDelivery.fee).toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.checkoutActions}>
        <TouchableOpacity
          style={styles.backToCartButton}
          onPress={() => {
            setShowCheckout(false)
            setShowCart(true)
          }}
        >
          <Feather name="arrow-left" size={16} color="#666" style={{ marginRight: 8 }} />
          <Text style={styles.backToCartButtonText}>Back to Cart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.placeOrderButton, (!customer.id || cartItems.length === 0) && styles.placeOrderButtonDisabled]}
          onPress={placeOrder}
          disabled={isLoading || !customer.id || cartItems.length === 0}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.placeOrderButtonText}>Place Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )

  // Customer selector screen
  const renderCustomerSelectorScreen = () => (
    <View style={styles.customerSelectorContainer}>
      <View style={styles.customerSearchContainer}>
        <View style={[styles.searchContainer, { flex: 1 }]}>
          <Feather name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search customers by name or phone"
            value={customerQuery}
            onChangeText={handleCustomerSearch}
            placeholderTextColor="#999"
            autoFocus
          />
        </View>
      </View>

      {isLoadingCustomers ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : (
        <FlatList
          data={customerQuery.length > 0 ? customerResults : allCustomers}
          renderItem={({ item, index }) => renderCustomerItem({ item, index, section: "modal" })}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.customerList}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Feather name="users" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No customers found</Text>
            </View>
          }
        />
      )}
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (showCheckout) {
              setShowCheckout(false)
              setShowCart(true)
              return
            }

            if (showCart) {
              setShowCart(false)
              return
            }

            if (showCustomerSelector) {
              setShowCustomerSelector(false)
              return
            }

            router.back()
          }}
        >
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {showCheckout
            ? "Checkout"
            : showCart
              ? "Shopping Cart"
              : showCustomerSelector
                ? "Select Customer"
                : "New Order"}
        </Text>
        <TouchableOpacity style={styles.cartButton} onPress={() => setShowCart(!showCart)}>
          <Feather name="shopping-cart" size={24} color="#333" />
          {cartItems.length > 0 && (
            <Animated.View style={[styles.cartBadge, { transform: [{ scale: cartBadgeScale }] }]}>
              <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.mainContainer}>
          {showCheckout ? (
            renderCheckoutContent()
          ) : showCart ? (
            renderCartContent()
          ) : showCustomerSelector ? (
            renderCustomerSelectorScreen()
          ) : (
            <FlatList
              data={[{ key: "mainContent" }]}
              renderItem={() => renderMainContent()}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </KeyboardAvoidingView>
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
  },
  cartBadge: {
    position: "absolute",
    top: 0,
    right: 0,
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
  mainContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productsSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  customerSearchContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    marginBottom: 16,
    flex: 1,
  },
  searchIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
  selectedCustomerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  customerIcon: {
    marginRight: 12,
  },
  selectedCustomerDetails: {
    flex: 1,
    paddingRight: 8,
  },
  selectedCustomerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0369a1",
    marginBottom: 4,
  },
  selectedCustomerDetail: {
    fontSize: 14,
    color: "#666",
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesScrollContent: {
    paddingRight: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  categoryChipSelected: {
    backgroundColor: "#0ea5e9",
    borderColor: "#0ea5e9",
  },
  categoryChipText: {
    fontSize: 14,
    color: "#666",
  },
  categoryChipTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  productsGrid: {
    padding: 16,
    paddingTop: 8,
  },
  productsRow: {
    justifyContent: "space-between",
    marginBottom: 16,
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start", // Changed from center to fix overlap
    marginTop: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0ea5e9",
    flex: 1, // Added flex to prevent overlap
  },
  categoryTag: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bae6fd",
    maxWidth: "50%", // Added max width to prevent overlap
  },
  categoryTagText: {
    fontSize: 12,
    color: "#0369a1",
    flexShrink: 1, // Added to allow text to shrink
    flexWrap: "wrap", // Added to wrap text
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
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  emptyStateSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  // Customer selector styles
  customerSelectorContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  customerList: {
    padding: 16,
  },
  customerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  customerItemContent: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  customerDetail: {
    fontSize: 14,
    color: "#666",
  },
  inlineCustomerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 6,
    marginBottom: 8,
  },
  inlineCustomerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  inlineCustomerDetail: {
    fontSize: 13,
    color: "#666",
  },
  // Cart styles
  cartContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
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
  cartTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  cartItemCount: {
    fontSize: 14,
    color: "#666",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cartItemsList: {
    padding: 16,
  },
  cartItem: {
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
  cartItemInfo: {
    marginBottom: 12,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  cartItemCode: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    color: "#0ea5e9",
    fontWeight: "600",
  },
  cartItemActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  quantityButton: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    width: 32,
  },
  quantityText: {
    width: 40,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  removeButton: {
    padding: 8,
    backgroundColor: "#fff0f0",
    borderRadius: 8,
  },
  cartSummary: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  cartSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cartSummaryLabel: {
    fontSize: 16,
    color: "#666",
  },
  cartSummaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  cartSummaryTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  cartTotalLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  cartTotalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0ea5e9",
  },
  cartActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
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
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 2,
  },
  checkoutButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyCartText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  emptyCartSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  continueShopping: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0ea5e9",
  },
  continueShoppingText: {
    color: "#0ea5e9",
    fontWeight: "600",
    fontSize: 14,
  },
  // Checkout styles
  checkoutContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  checkoutHeader: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  checkoutTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  checkoutContent: {
    flex: 1,
    padding: 16,
  },
  checkoutSection: {
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
  checkoutSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  checkoutCustomerInfo: {
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  checkoutCustomerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0369a1",
    marginBottom: 8,
  },
  checkoutCustomerDetail: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  checkoutCustomerSelect: {
    alignItems: "center",
    padding: 16,
  },
  checkoutCustomerSelectText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  selectCustomerButton: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  selectCustomerButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  checkoutItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  checkoutItemInfo: {
    flex: 1,
  },
  checkoutItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  checkoutItemCode: {
    fontSize: 12,
    color: "#666",
  },
  checkoutItemQuantity: {
    fontSize: 14,
    color: "#666",
    marginHorizontal: 16,
  },
  checkoutItemTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    minWidth: 80,
    textAlign: "right",
  },
  checkoutDivider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 16,
  },
  checkoutSummary: {
    marginTop: 8,
  },
  checkoutSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  checkoutSummaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  checkoutSummaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  checkoutSummaryTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  checkoutTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  checkoutTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0ea5e9",
  },
  checkoutActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  backToCartButton: {
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
  backToCartButtonText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 14,
  },
  placeOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 2,
    marginLeft: 12,
  },
  placeOrderButtonDisabled: {
    backgroundColor: "#93c5fd",
  },
  placeOrderButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  selectedCustomerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  changeCustomerButton: {
    padding: 8,
    backgroundColor: "#fff0f0",
    borderRadius: 8,
  },
  changeCustomerButtonText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 14,
  },
  inlineLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  inlineLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  inlineCustomerList: {
    padding: 16,
  },
  viewAllCustomersButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0ea5e9",
  },
  viewAllCustomersText: {
    color: "#0ea5e9",
    fontWeight: "600",
    fontSize: 14,
  },
  deliveryOptionsContainer: {
    marginTop: 8,
  },
  deliveryOptionButton: {
    flexDirection: "row" as const,
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  selectedDeliveryOption: {
    backgroundColor: "#0ea5e9",
    borderColor: "#0ea5e9",
  },
  deliveryOptionContent: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center",
  },
  deliveryOptionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  deliveryOptionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  deliveryOptionFee: {
    fontSize: 14,
    color: "#666",
  },
  selectedDeliveryOptionText: {
    color: "#fff",
  },

closeCustomerButton: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: "#f1f5f9",
  alignItems: "center",
  justifyContent: "center",
  marginLeft: 8,
},
})