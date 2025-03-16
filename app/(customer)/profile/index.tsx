"use client"

import React, { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
  Animated,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { validation } from "@/lib/utils"
import { Database } from "@/types/database"
import { LinearGradient } from "expo-linear-gradient"

type Customer = Database["public"]["Tables"]["customers"]["Row"]

const { width } = Dimensions.get("window")

export default function CustomerProfileScreen() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    barangay: "",
    town: "",
    province: "",
    contact_person: "",
    contact_number: "",
  })
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0]
  const slideAnim = useState(new Animated.Value(50))[0]

  useEffect(() => {
    fetchCustomerProfile()
  }, [])
  
  useEffect(() => {
    if (!loading) {
      // Animate content in when loaded
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [loading])

  const fetchCustomerProfile = async () => {
    try {
      setLoading(true)
      
      // Get current user ID
      const userId = await authService.getUserId()
      if (!userId) {
        router.replace("/(auth)/customer/login")
        return
      }

      // Fetch customer profile
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", userId)
        .single()

      if (customerError) throw customerError

      setCustomer(customerData)
      setFormData({
        name: customerData.name || "",
        email: customerData.email || "",
        phone: customerData.phone || "",
        address: customerData.address || "",
        barangay: customerData.barangay || "",
        town: customerData.town || "",
        province: customerData.province || "",
        contact_person: customerData.contact_person || "",
        contact_number: customerData.contact_number || "",
      })
    } catch (error) {
      console.error("Error fetching profile:", error)
      Alert.alert("Error", "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      if (!customer) return

      // Validate form data
      if (!formData.name.trim()) {
        Alert.alert("Error", "Name is required")
        return
      }

      if (formData.email && !validation.email(formData.email)) {
        Alert.alert("Error", "Please enter a valid email address")
        return
      }

      if (formData.phone && !validation.phone(formData.phone)) {
        Alert.alert("Error", "Please enter a valid phone number")
        return
      }

      setSaving(true)

      // Update customer profile
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          barangay: formData.barangay,
          town: formData.town,
          province: formData.province,
          contact_person: formData.contact_person,
          contact_number: formData.contact_number,
        })
        .eq("id", customer.id)

      if (updateError) throw updateError

      // Refresh profile data
      await fetchCustomerProfile()
      setEditMode(false)
      Alert.alert("Success", "Profile updated successfully")
    } catch (error) {
      console.error("Error updating profile:", error)
      Alert.alert("Error", "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      setShowLogoutConfirm(false)
      setLoading(true)
      
      const { success, error } = await authService.logout()
      
      if (!success) {
        throw error || new Error("Failed to logout")
      }
      
      router.replace("/")
    } catch (error) {
      console.error("Error logging out:", error)
      Alert.alert("Error", "Failed to logout. Please try again.")
      setLoading(false)
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

  const renderField = (
    label: string, 
    value: string, 
    field: keyof typeof formData, 
    icon: string,
    keyboardType: "default" | "email-address" | "phone-pad" = "default"
  ) => (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldLabelContainer}>
        <Feather name={icon as any} size={16} color="#64748b" style={styles.fieldIcon} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      {editMode ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={formData[field]}
            onChangeText={(text) => setFormData({ ...formData, [field]: text })}
            placeholder={`Enter ${label.toLowerCase()}`}
            placeholderTextColor="#94a3b8"
            autoCapitalize={field === "email" ? "none" : "words"}
            keyboardType={keyboardType}
          />
        </View>
      ) : (
        <Text style={styles.fieldValue}>
          {value || <Text style={styles.emptyFieldValue}>Not provided</Text>}
        </Text>
      )}
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            if (editMode) {
              setFormData({
                name: customer?.name || "",
                email: customer?.email || "",
                phone: customer?.phone || "",
                address: customer?.address || "",
                barangay: customer?.barangay || "",
                town: customer?.town || "",
                province: customer?.province || "",
                contact_person: customer?.contact_person || "",
                contact_number: customer?.contact_number || "",
              })
            }
            setEditMode(!editMode)
          }}
        >
          <Feather name={editMode ? "x" : "edit-2"} size={20} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View 
            style={[
              styles.animatedContainer, 
              { 
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.profileHeaderContainer}>
              <LinearGradient
                colors={['#3b82f6', '#1d4ed8']}
                style={styles.profileHeaderGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>
                    {getInitials(customer?.name || "")}
                  </Text>
                </View>
                <Text style={styles.welcomeText}>
                  {customer?.name || "Customer"}
                </Text>
                <Text style={styles.memberSinceText}>
                  Member since {new Date(customer?.created_at || "").toLocaleDateString()}
                </Text>
              </LinearGradient>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              
              {renderField("Full Name", customer?.name || "", "name", "user")}
              {renderField("Email Address", customer?.email || "", "email", "mail", "email-address")}
              {renderField("Phone Number", customer?.phone || "", "phone", "phone", "phone-pad")}
              {renderField("Street Address", customer?.address || "", "address", "map-pin")}
              {renderField("Barangay", customer?.barangay || "", "barangay", "map-pin")}
              {renderField("Town/City", customer?.town || "", "town", "map-pin")}
              {renderField("Province", customer?.province || "", "province", "map-pin")}
              {renderField("Contact Person", customer?.contact_person || "", "contact_person", "user")}
              {renderField("Contact Number", customer?.contact_number || "", "contact_number", "phone", "phone-pad")}
            </View>

            {editMode && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setFormData({
                      name: customer?.name || "",
                      email: customer?.email || "",
                      phone: customer?.phone || "",
                      address: customer?.address || "",
                      barangay: customer?.barangay || "",
                      town: customer?.town || "",
                      province: customer?.province || "",
                      contact_person: customer?.contact_person || "",
                      contact_number: customer?.contact_number || "",
                    })
                    setEditMode(false)
                  }}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.accountActionsContainer}>
              <Text style={styles.accountActionsTitle}>Account Actions</Text>
              
              <TouchableOpacity
                style={styles.accountActionButton}
                onPress={() => router.push("/(customer)/orders/history")}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#f0fdf4' }]}>
                  <Feather name="shopping-bag" size={18} color="#16a34a" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Order History</Text>
                  <Text style={styles.actionSubtitle}>View your past orders</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.accountActionButton}
                onPress={() => router.push("/(customer)/orders/new")}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#f8fafc' }]}>
                  <Feather name="plus-circle" size={18} color="#64748b" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>New Order</Text>
                  <Text style={styles.actionSubtitle}>Place a new order</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => setShowLogoutConfirm(true)}
            >
              <Feather name="log-out" size={20} color="#ef4444" />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
            
            <Text style={styles.versionText}>Version 1.0.0</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Feather name="log-out" size={28} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalText}>Are you sure you want to logout from your account?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalLogoutButton]}
                onPress={handleLogout}
              >
                <Text style={styles.modalLogoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  animatedContainer: {
    flex: 1,
  },
  profileHeaderContainer: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 16,
    marginTop: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileHeaderGradient: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  memberSinceText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldIcon: {
    marginRight: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  fieldValue: {
    fontSize: 16,
    color: "#0f172a",
    paddingVertical: 8,
  },
  emptyFieldValue: {
    color: "#94a3b8",
    fontStyle: "italic",
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0f172a",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
  },
  saveButton: {
    backgroundColor: "#3b82f6",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  accountActionsContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  accountActionsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 16,
  },
  accountActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
    marginLeft: 8,
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: "#f1f5f9",
  },
  modalLogoutButton: {
    backgroundColor: "#ef4444",
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  modalLogoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
})