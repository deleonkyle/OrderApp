import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { Feather } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "@/lib/supabase"
import { Database } from "@/types/database"

type Item = Database["public"]["Tables"]["items"]["Row"]
type CartItem = Item & { quantity: number }

export default function CheckoutScreen() {
  const { items: itemsParam, total: totalParam } = useLocalSearchParams()
  const [items, setItems] = useState<CartItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [deliveryOption, setDeliveryOption] = useState<"pickup" | "delivery">("pickup")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (itemsParam && totalParam) {
      setItems(JSON.parse(itemsParam as string))
      setTotal(parseFloat(totalParam as string))
    }
  }, [itemsParam, totalParam])

  const handlePlaceOrder = async () => {
    try {
      setLoading(true)
      const sessionStr = await AsyncStorage.getItem("session")
      if (!sessionStr) {
        router.replace("/auth/customer-login")
        return
      }

      const session = JSON.parse(sessionStr)

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            customer_id: session.customerId,
            total_amount: total,
            status: "pending",
            delivery_option: deliveryOption,
            notes,
          },
        ])
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: orderData.id,
        item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }))

      const { error: orderItemsError } = await supabase.from("order_items").insert(orderItems)
      if (orderItemsError) throw orderItemsError

      Alert.alert(
        "Order Placed",
        "Your order has been placed successfully!",
        [
          {
            text: "OK",
            onPress: () => router.replace("/customer/home"),
          },
        ],
      )
    } catch (error: any) {
      console.error("Error placing order:", error)
      Alert.alert("Error", "Failed to place order. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <View style={styles.orderItemInfo}>
                <Text style={styles.orderItemName}>{item.name}</Text>
                <Text style={styles.orderItemPrice}>₱{item.price.toFixed(2)}</Text>
              </View>
              <Text style={styles.orderItemQuantity}>x{item.quantity}</Text>
            </View>
          ))}
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalAmount}>₱{total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Option</Text>
          <View style={styles.deliveryOptions}>
            <TouchableOpacity
              style={[styles.deliveryOption, deliveryOption === "pickup" && styles.selectedDeliveryOption]}
              onPress={() => setDeliveryOption("pickup")}
            >
              <Feather name="shopping-bag" size={24} color={deliveryOption === "pickup" ? "#fff" : "#4A90E2"} />
              <Text style={[styles.deliveryOptionText, deliveryOption === "pickup" && styles.selectedDeliveryOptionText]}>
                Pickup
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deliveryOption, deliveryOption === "delivery" && styles.selectedDeliveryOption]}
              onPress={() => setDeliveryOption("delivery")}
            >
              <Feather name="truck" size={24} color={deliveryOption === "delivery" ? "#fff" : "#4A90E2"} />
              <Text style={[styles.deliveryOptionText, deliveryOption === "delivery" && styles.selectedDeliveryOptionText]}>
                Delivery
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any special instructions..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentOption}>
            <View style={styles.paymentRadio}>
              <View style={styles.paymentRadioInner} />
            </View>
            <Text style={styles.paymentOptionText}>Cash on Delivery</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount:</Text>
          <Text style={styles.totalAmount}>₱{total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.placeOrderButton, loading && styles.placeOrderButtonDisabled]}
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.placeOrderButtonText}>Place Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F5F5F5",
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 16,
    color: "#333",
    marginBottom: 4,
  },
  orderItemPrice: {
    fontSize: 14,
    color: "#666",
  },
  orderItemQuantity: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 16,
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },
  totalLabel: {
    fontSize: 16,
    color: "#666",
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  deliveryOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deliveryOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  selectedDeliveryOption: {
    backgroundColor: "#4A90E2",
  },
  deliveryOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4A90E2",
    marginLeft: 8,
  },
  selectedDeliveryOptionText: {
    color: "#fff",
  },
  notesInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
  },
  footer: {
    padding: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },
  placeOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A90E2",
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  placeOrderButtonDisabled: {
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  placeOrderButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  paymentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
  },
  paymentRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4A90E2",
  },
  paymentOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 16,
  },
}) 