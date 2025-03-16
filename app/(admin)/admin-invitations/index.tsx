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
  Modal,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { format } from "date-fns"

interface InvitedUser {
  id: string
  email: string
  invited_at: string
  role: string
}

export default function AdminInvitationsScreen() {
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchInvitedUsers()
  }, [])

  const fetchInvitedUsers = async () => {
    try {
      setIsLoading(true)
      
      // Fetch invited users from the admins table with role 'invited'
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .eq("role", "invited")
        .order("created_at", { ascending: false })
        
      if (error) throw error
      
      // Transform the data for our UI
      const invitedData = (data || []).map(user => ({
        id: user.id,
        email: user.email,
        invited_at: user.created_at,
        role: user.role
      }))
      
      setInvitedUsers(invitedData)
    } catch (error) {
      console.error("Error fetching invited users:", error)
      Alert.alert("Error", "Failed to load invited users")
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchInvitedUsers()
  }

  const sendInvitation = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter an email address")
      return
    }

    try {
      setSubmitting(true)
      
      // Use Supabase auth to invite the user
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email.trim())
      
      if (error) throw error
      
      // Store invited user info in the admins table with role 'invited'
      const { error: insertError } = await supabase
        .from("admins")
        .insert({
          id: data.user.id,
          email: email.trim(),
          name: "Invited User",
          phone: "",
          role: "invited",
          created_at: new Date().toISOString(),
        })
      
      if (insertError) throw insertError
      
      Alert.alert(
        "Invitation Sent",
        `An invitation has been sent to ${email}`,
        [{ text: "OK" }]
      )
      
      // Close modal and refresh the list
      setShowInviteModal(false)
      setEmail("")
      fetchInvitedUsers()
      
    } catch (error: any) {
      console.error("Error sending invitation:", error)
      Alert.alert("Error", error.message || "Failed to send invitation")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteInvitation = async (user: InvitedUser) => {
    Alert.alert(
      "Delete Invitation",
      `Are you sure you want to delete the invitation for ${user.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true)
              
              // Delete from admins table
              const { error } = await supabase
                .from("admins")
                .delete()
                .eq("id", user.id)
                
              if (error) throw error
              
              // Attempt to delete the auth user
              try {
                await supabase.auth.admin.deleteUser(user.id)
              } catch (authError) {
                console.log("Error deleting auth user:", authError)
                // Continue even if auth user deletion fails
              }
              
              fetchInvitedUsers()
              Alert.alert("Success", "Invitation deleted successfully")
            } catch (error) {
              console.error("Error deleting invitation:", error)
              Alert.alert("Error", "Failed to delete invitation")
              setIsLoading(false)
            }
          }
        }
      ]
    )
  }

  const resendInvitation = async (user: InvitedUser) => {
    try {
      setIsLoading(true)
      
      // Resend invitation using Supabase auth
      const { error } = await supabase.auth.admin.inviteUserByEmail(user.email)
      
      if (error) throw error
      
      Alert.alert("Success", `Invitation resent to ${user.email}`)
    } catch (error: any) {
      console.error("Error resending invitation:", error)
      Alert.alert("Error", error.message || "Failed to resend invitation")
    } finally {
      setIsLoading(false)
    }
  }

  const renderInvitedUserItem = ({ item }: { item: InvitedUser }) => {
    return (
      <View style={styles.invitationCard}>
        <View style={styles.invitationHeader}>
          <Text style={styles.emailText}>{item.email}</Text>
          <View style={[styles.statusBadge, { backgroundColor: "#3b82f620" }]}>
            <Text style={[styles.statusText, { color: "#3b82f6" }]}>
              Invited
            </Text>
          </View>
        </View>
        
        <View style={styles.invitationDetails}>
          <View style={styles.detailRow}>
            <Feather name="calendar" size={16} color="#666" />
            <Text style={styles.detailText}>
              Invited: {format(new Date(item.invited_at), "MMM dd, yyyy")}
            </Text>
          </View>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.resendButton]}
            onPress={() => resendInvitation(item)}
          >
            <Feather name="mail" size={16} color="#3b82f6" />
            <Text style={styles.resendButtonText}>Resend</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteInvitation(item)}
          >
            <Feather name="trash-2" size={16} color="#ef4444" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="mail" size={40} color="#fff" />
      </View>
      <Text style={styles.emptyText}>No invitations yet</Text>
      <Text style={styles.emptySubtext}>
        Invite users to join as admins
      </Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Invitations</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowInviteModal(true)}
        >
          <Feather name="plus" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading invitations...</Text>
        </View>
      ) : (
        <FlatList
          data={invitedUsers}
          renderItem={renderInvitedUserItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}

      {/* Invite User Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Admin</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowInviteModal(false)}
              >
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Enter the email address of the person you want to invite as an admin
            </Text>
            
            <View style={styles.inputContainer}>
              <Feather name="mail" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>
            
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowInviteModal(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton, submitting && styles.disabledButton]}
                onPress={sendInvitation}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Send Invitation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
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
  addButton: {
    padding: 8,
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
    backgroundColor: "#3b82f6",
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
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  invitationCard: {
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
  invitationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  emailText: {
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
  invitationDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  resendButton: {
    backgroundColor: "#dbeafe",
  },
  resendButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: "#3b82f6",
    fontWeight: "500",
  },
  deleteButton: {
    backgroundColor: "#fee2e2",
  },
  deleteButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "500",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#333",
  },
  modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  createButton: {
    backgroundColor: "#3b82f6",
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
  disabledButton: {
    opacity: 0.6,
  },
}); 