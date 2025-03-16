"use client"

import React, { useEffect, useState } from "react"
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { authService } from "@/lib/auth"
import { perfMonitor } from "@/lib/utils"
import { setupDatabase } from "@/lib/database-setup"

export default function LandingScreen() {
  const [loading, setLoading] = useState(true)
  const [showAdminSetup, setShowAdminSetup] = useState(false)

  useEffect(() => {
    checkExistingSession()
    checkAdminSetup()
  }, [])

  useEffect(() => {
    const initApp = async () => {
      try {
        // Check and setup database tables if needed
        await setupDatabase()
      } catch (error) {
        console.error("Error initializing app:", error)
      }
    }
    
    initApp()
  }, [])

  const checkExistingSession = async () => {
    try {
      perfMonitor.startTimer('checkSessionLanding')
      
      // Use the auth service to check for authentication
      const isAuthenticated = await authService.isAuthenticated()
      
      if (isAuthenticated) {
        // Check if the user is an admin
        const isAdmin = await authService.isAdmin()
        if (isAdmin) {
          router.replace("/(admin)/home")
        } else {
          router.replace("/(customer)/home")
        }
      }
      
      perfMonitor.endTimer('checkSessionLanding')
    } catch (error) {
      console.error("Error checking session:", error)
    } finally {
      setLoading(false)
    }
  }

  const checkAdminSetup = async () => {
    try {
      // Use the auth service to check if admin setup is complete
      const isSetupComplete = await authService.isAdminSetupComplete()
      
      // Show admin setup button if setup is not complete
      setShowAdminSetup(!isSetupComplete)
    } catch (error) {
      console.error("Error checking admin setup status:", error)
    }
  }

  // Show a loading indicator while checking for authentication
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Feather name="package" size={60} color="#4A90E2" />
          </View>
          <Text style={styles.title}>Order Management System</Text>
          <Text style={styles.subtitle}>Welcome to our ordering platform</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.loginButton, styles.customerButton]}
            onPress={() => router.push("/(auth)/customer/login")}
          >
            <Feather name="log-in" size={24} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.loginButtonText}>Customer Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, styles.adminButton]}
            onPress={() => router.push("/(auth)/admin/login")}
          >
            <Feather name="shield" size={24} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.loginButtonText}>Admin Login</Text>
          </TouchableOpacity>

          {showAdminSetup && (
            <TouchableOpacity
              style={[styles.loginButton, styles.setupButton]}
              onPress={() => router.push("/(auth)/admin/register")}
            >
              <Feather name="user-plus" size={24} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.loginButtonText}>Admin Setup</Text>
            </TouchableOpacity>
          )}

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/customer/register")}>
              <Text style={styles.registerLink}>Register Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  buttonContainer: {
    gap: 20,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerButton: {
    backgroundColor: "#4A90E2",
  },
  adminButton: {
    backgroundColor: "#f72585",
  },
  buttonIcon: {
    marginRight: 12,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  registerText: {
    color: "#666",
    fontSize: 16,
  },
  registerLink: {
    color: "#4A90E2",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 5,
  },
  setupButton: {
    backgroundColor: "#6C63FF", // Different color for setup button
    marginTop: 10,
  },
})
