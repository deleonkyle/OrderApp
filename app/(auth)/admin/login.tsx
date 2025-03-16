"use client"

import React, { useState } from "react"
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
import { router } from "expo-router"
import { supabase } from "@/lib/supabase"
import { StatusBar } from "expo-status-bar"
import { SafeAreaView } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Feather } from "@expo/vector-icons"
import { authService } from "@/lib/auth"

export default function AdminLoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [secureTextEntry, setSecureTextEntry] = useState(true)
  const [step, setStep] = useState(1)

  const handleLogin = async () => {
    if (!email.trim()) {
      setError("Please enter your email")
      return
    }

    if (!password.trim()) {
      setError("Please enter your password")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Use Supabase Auth for authentication
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (signInError) throw signInError

      // Check if the user is an admin
      const { data: adminData, error: adminError } = await supabase
        .from("admins")
        .select("*")
        .eq("id", data.user.id)
        .single()

      if (adminError || !adminData) {
        // If not an admin, sign out and show error
        await supabase.auth.signOut()
        throw new Error("You are not authorized as an admin")
      }

      // Store admin session
      await AsyncStorage.setItem(
        "session",
        JSON.stringify({
          userId: adminData.id,
          role: adminData.role,
          adminName: adminData.name,
          timestamp: new Date().toISOString(),
        })
      )

      // Navigate to home screen
      router.replace("/home")
    } catch (error: any) {
      console.error("Login error:", error)
      setError(error.message || "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setError("Please enter your email")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Use authService to send a magic link
      const result = await authService.signInWithEmail(email.trim())
      
      if (!result.success) {
        throw new Error(result.error || "Failed to send verification email")
      }

      Alert.alert(
        "Email Sent",
        "We've sent a magic link to your email. Please check your inbox and click the link to sign in.",
        [{ text: "OK" }]
      )
    } catch (error: any) {
      console.error("Magic link error:", error)
      setError(error.message || "Failed to send verification email")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length !== 6) {
      setError("Please enter a valid 6-digit OTP code")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Verify OTP
      const { data: otpData, error: otpError } = await supabase
        .from("admin_otps")
        .select("*, admin_users(*)")
        .eq("otp_code", otpCode)
        .gte("expires_at", new Date().toISOString()) // Check if OTP is not expired
        .single()

      if (otpError || !otpData) {
        throw new Error("Invalid or expired OTP code")
      }

      // Verify this OTP belongs to the admin who requested it
      if (otpData.admin_users.email !== email) {
        throw new Error("Invalid OTP code")
      }

      // Store session data
      await AsyncStorage.setItem(
        "session",
        JSON.stringify({
          userId: otpData.admin_users.id,
          role: "admin",
          adminId: otpData.admin_users.id,
          adminName: otpData.admin_users.name,
          timestamp: new Date().toISOString(),
        }),
      )

      // Delete used OTP
      await supabase.from("admin_otps").delete().eq("id", otpData.id)

      // Navigate to admin dashboard
      router.replace("/home")
    } catch (error: any) {
      console.error("OTP verification error:", error)
      setError(error.message || "OTP verification failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingView}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => (step === 1 ? router.back() : setStep(1))}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <View style={styles.iconContainer}>
              <Feather name="shield" size={40} color="#f72585" />
            </View>
            <Text style={styles.title}>Admin Login</Text>
            <Text style={styles.subtitle}>
              {step === 1 ? "Enter your credentials to continue" : "Enter the verification code sent to your email"}
            </Text>
          </View>

          <View style={styles.formContainer}>
            {step === 1 ? (
              <React.Fragment>
                <View style={styles.inputContainer}>
                  <Feather name="mail" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Feather name="lock" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={secureTextEntry}
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity onPress={() => setSecureTextEntry(!secureTextEntry)} style={styles.eyeIcon}>
                    <Feather name={secureTextEntry ? "eye" : "eye-off"} size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <React.Fragment>
                      <Feather name="log-in" size={20} color="#fff" style={styles.buttonIcon} />
                      <Text style={styles.loginButtonText}>Login</Text>
                    </React.Fragment>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.forgotPasswordButton} onPress={handleSendOtp}>
                  <Text style={styles.forgotPasswordText}>Trouble logging in? Send me a magic link</Text>
                </TouchableOpacity>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <Text style={styles.otpMessage}>We've sent a 6-digit verification code to your email address.</Text>

                <View style={styles.inputContainer}>
                  <Feather name="key" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="6-digit code"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholderTextColor="#999"
                  />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={styles.loginButton} onPress={handleVerifyOtp} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <React.Fragment>
                      <Feather name="log-in" size={20} color="#fff" style={styles.buttonIcon} />
                      <Text style={styles.loginButtonText}>Verify & Login</Text>
                    </React.Fragment>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.resendButton} onPress={() => setStep(1)}>
                  <Text style={styles.resendText}>Resend Code</Text>
                </TouchableOpacity>
              </React.Fragment>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Order Management App • Admin Portal</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    marginTop: 10,
    marginBottom: 20,
  },
  headerContainer: {
    marginBottom: 40,
    alignItems: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(247, 37, 133, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  formContainer: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    height: 56,
    backgroundColor: "#f9f9f9",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: "#333",
  },
  eyeIcon: {
    padding: 10,
  },
  loginButton: {
    height: 56,
    backgroundColor: "#f72585",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#f72585",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonIcon: {
    marginRight: 10,
  },
  errorText: {
    color: "#f72585",
    marginBottom: 15,
    textAlign: "center",
  },
  forgotPasswordButton: {
    marginTop: 20,
    alignItems: "center",
  },
  forgotPasswordText: {
    color: "#666",
    fontSize: 14,
  },
  otpMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },
  resendButton: {
    marginTop: 20,
    alignItems: "center",
  },
  resendText: {
    color: "#f72585",
    fontSize: 14,
  },
  footer: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    color: "#999",
    fontSize: 12,
  },
})

