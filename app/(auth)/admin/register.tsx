"use client"

import React, { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { authService } from "@/lib/auth"
import { validation } from "@/lib/utils"

export default function AdminRegisterScreen() {
  const params = useLocalSearchParams()
  const invitedEmail = params.email as string || ""

  const [email, setEmail] = useState(invitedEmail)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isFirstAdmin, setIsFirstAdmin] = useState(false)
  const [isInvited, setIsInvited] = useState(false)

  useEffect(() => {
    checkAdminSetup()
    checkInvitation()
  }, [])

  const checkAdminSetup = async () => {
    const isSetupComplete = await authService.isAdminSetupComplete()
    setIsFirstAdmin(!isSetupComplete)
    
    // If setup is complete and user isn't invited, redirect to login
    if (isSetupComplete && !invitedEmail) {
      Alert.alert("Setup Complete", "Admin setup is already complete. Please log in.")
      router.replace("/(auth)/admin/login")
    }
  }

  const checkInvitation = async () => {
    if (invitedEmail) {
      const isUserInvited = await authService.isUserInvited(invitedEmail)
      setIsInvited(isUserInvited)
      
      if (!isUserInvited) {
        Alert.alert(
          "Invalid Invitation",
          "This invitation is no longer valid.",
          [{ text: "OK", onPress: () => router.replace("/(auth)/admin/login") }]
        )
      }
    }
  }

  const handleRegister = async () => {
    // Validate inputs
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Error", "All fields are required")
      return
    }

    if (!validation.email(email)) {
      Alert.alert("Error", "Please enter a valid email address")
      return
    }

    if (!validation.phone(phone)) {
      Alert.alert("Error", "Please enter a valid phone number")
      return
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match")
      return
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters")
      return
    }

    try {
      setLoading(true)
      
      // If using an invitation, ensure email matches
      if (invitedEmail && email !== invitedEmail) {
        Alert.alert("Error", "The email address does not match the invitation")
        setLoading(false)
        return
      }

      const { success, error } = await authService.registerAdmin({
        email,
        password,
        name,
        phone
      })

      if (success) {
        Alert.alert(
          "Success",
          isFirstAdmin
            ? "Admin account created successfully. You can now log in."
            : "Your admin account has been created successfully. You can now log in.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(auth)/admin/login"),
            },
          ]
        )
      } else {
        Alert.alert("Error", error || "Failed to register admin")
      }
    } catch (error) {
      console.error("Registration error:", error)
      Alert.alert("Error", "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>
              {isFirstAdmin ? "Admin Setup" : isInvited ? "Accept Invitation" : "Admin Registration"}
            </Text>
            <Text style={styles.subtitle}>
              {isFirstAdmin 
                ? "Create the first admin account for your system" 
                : isInvited
                  ? "Complete your admin account registration"
                  : "Create a new admin account"}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Feather name="mail" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading && !invitedEmail} // Disable if invited email is provided
              />
            </View>

            <View style={styles.inputContainer}>
              <Feather name="user" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Feather name="phone" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            {isInvited && (
              <View style={styles.invitationBadge}>
                <Feather name="check-circle" size={16} color="#10b981" style={styles.invitationIcon} />
                <Text style={styles.invitationText}>Valid invitation</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>Register</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/admin/login")}
              >
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  showPasswordButton: {
    padding: 8,
  },
  invitationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d1fae5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  invitationIcon: {
    marginRight: 6,
  },
  invitationText: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "500",
  },
  registerButton: {
    backgroundColor: "#f72585",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    color: "#666",
    fontSize: 14,
  },
  loginLink: {
    color: "#f72585",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
}) 