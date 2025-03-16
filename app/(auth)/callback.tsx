"use client"

import React, { useEffect, useState } from "react"
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Alert } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { supabase } from "@/lib/supabase"
import { StatusBar } from "expo-status-bar"
import { SafeAreaView } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Feather } from "@expo/vector-icons"

export default function AuthCallback() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState<string | null>(null)
  const [message, setMessage] = useState("Processing authentication...")
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        if (params.error) {
          throw new Error(params.error_description as string || 'Error during confirmation')
        }

        setLoading(true)

        // Exchange the code for a session
        if (params.code) {
          const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(
            String(params.code)
          )
          
          if (sessionError) throw sessionError
          if (!session || !session.user) throw new Error('No session or user found')

          // Check if this is a password reset flow
          if (params.type === 'recovery') {
            // Redirect to the reset password form
            setMessage("Password reset link verified. Redirecting to reset form...")
            setTimeout(() => {
              router.replace({
                pathname: "/auth/reset-password"
              })
            }, 2000)
            return
          }

          // For other auth callbacks (confirmation links, etc.)
          setSuccess("Authentication successful!")
          setTimeout(() => router.replace("/auth/customer-login"), 2000)
        }
      } catch (error: any) {
        console.error("Authentication error:", error)
        setIsError(true)
        setError(error.message || "Unknown error")
        
        // After a delay, redirect back to login
        setTimeout(() => {
          router.replace("/auth/customer-login")
        }, 3000)
      } finally {
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [params, router])

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color="#4A90E2" style={styles.loader} />
            <Text style={styles.loadingText}>{message}</Text>
          </>
        ) : error ? (
          <>
            <View style={styles.iconContainer}>
              <Feather name="alert-circle" size={64} color="#ff4d4f" />
            </View>
            <Text style={styles.errorTitle}>Verification Failed</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.helpText}>Please try again or contact support if the problem persists.</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={() => router.replace("/auth/customer-login")}>
                <Text style={styles.buttonText}>Return to Login</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => router.replace("/auth/verification-help")}>
                <Text style={styles.buttonText}>Get Help</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : success ? (
          <>
            <View style={styles.iconContainer}>
              <Feather name="check-circle" size={64} color="#52c41a" />
            </View>
            <Text style={styles.successTitle}>{success}</Text>
            <Text style={styles.successText}>Redirecting you to your account...</Text>
          </>
        ) : (
          <>
            <View style={styles.iconContainer}>
              <Feather name="check-circle" size={64} color="#52c41a" />
            </View>
            <Text style={styles.successTitle}>Email Verified!</Text>
            <Text style={styles.successText}>Your email has been successfully verified.</Text>
            <Text style={styles.redirectText}>Redirecting you to login...</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loader: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    color: "#333",
    textAlign: "center",
  },
  iconContainer: {
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ff4d4f",
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  helpText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  button: {
    backgroundColor: "#4A90E2",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#52c41a",
    marginBottom: 12,
    textAlign: "center",
  },
  successText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  redirectText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
})

