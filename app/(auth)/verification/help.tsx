"use client"

import { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { supabase } from "@/lib/supabase"
import { StatusBar } from "expo-status-bar"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"

export default function VerificationHelpScreen() {
  const params = useLocalSearchParams()
  const email = (params.email as string) || ""

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [storedEmail, setStoredEmail] = useState("")

  // Get email from AsyncStorage if not provided in params
  useEffect(() => {
    const getStoredEmail = async () => {
      try {
        // Try to get email from pending registration
        const pendingRegistrationStr = await AsyncStorage.getItem("pendingRegistration")
        if (pendingRegistrationStr) {
          const pendingRegistration = JSON.parse(pendingRegistrationStr)
          if (pendingRegistration.email) {
            setStoredEmail(pendingRegistration.email)
            return
          }
        }

        // If not found in registration, try to get from session
        const sessionStr = await AsyncStorage.getItem("userSession")
        if (sessionStr) {
          const session = JSON.parse(sessionStr)
          if (session.email) {
            setStoredEmail(session.email)
          }
        }
      } catch (error) {
        console.error("Error retrieving email from storage:", error)
      }
    }

    if (!email) {
      getStoredEmail()
    }
  }, [email])

  // Use email from params or from storage
  const effectiveEmail = email || storedEmail

  const handleResendEmail = async () => {
    if (!effectiveEmail) {
      setError("Email address is missing")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: effectiveEmail,
      })

      if (error) throw error

      setSuccess("Verification email has been resent. Please check your inbox.")
    } catch (error: any) {
      console.error("Error resending verification email:", error)
      setError(error.message || "Failed to resend verification email")
    } finally {
      setLoading(false)
    }
  }

  const handleGoToVerification = () => {
    if (!effectiveEmail) {
      setError("Email address is missing")
      return
    }

    router.push({
      pathname: "/(auth)/verification",
      params: {
        verificationType: "email",
        contactInfo: effectiveEmail,
        purpose: "registration",
      },
    })
  }

  const handleDevelopmentBypass = async () => {
    if (!effectiveEmail) {
      setError("Email address is missing")
      return
    }

    Alert.alert(
      "Development Mode",
      "This option is only for development purposes. In production, email verification should always be required.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Continue",
          onPress: async () => {
            try {
              setLoading(true)

              // Create a temporary session
              const sessionData = {
                id: "temp-" + Math.random().toString(36).substring(2, 9),
                email: effectiveEmail,
                name: effectiveEmail.split("@")[0],
                role: "customer",
              }

              await AsyncStorage.setItem("userSession", JSON.stringify(sessionData))

              // Redirect to customer dashboard
              router.replace("/(customer)/dashboard")
            } catch (error) {
              console.error("Error creating temporary session:", error)
              setError("Failed to create temporary session")
            } finally {
              setLoading(false)
            }
          },
        },
      ],
    )
  }

  const handleContactSupport = () => {
    Alert.alert("Contact Support", "Please contact our support team for assistance with your account verification.", [
      { text: "OK" },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <View style={styles.iconContainer}>
              <Feather name="help-circle" size={40} color="#4a6da7" />
            </View>
            <Text style={styles.title}>Verification Help</Text>
            <Text style={styles.subtitle}>Having trouble verifying your email?</Text>
          </View>

          <View style={styles.contentContainer}>
            {effectiveEmail ? (
              <>
                <Text style={styles.emailText}>We sent a verification email to:</Text>
                <Text style={styles.emailAddress}>{effectiveEmail}</Text>
              </>
            ) : (
              <Text style={styles.emailMissing}>No email address found. Please return to the registration screen.</Text>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <View style={styles.illustrationContainer}>
              <Image
                source={{ uri: "https://v0.dev/placeholder.svg?height=120&width=120" }}
                style={styles.illustration}
              />
            </View>

            <View style={styles.infoContainer}>
              <Feather name="info" size={20} color="#4a6da7" style={styles.infoIcon} />
              <Text style={styles.infoText}>
                We've sent a verification email to your inbox. The email contains a link with your verification code.
              </Text>
            </View>

            <View style={styles.codeInstructions}>
              <Text style={styles.instructionTitle}>How to find your verification code:</Text>
              <View style={styles.instructionStep}>
                <View style={styles.stepNumberContainer}>
                  <Text style={styles.stepNumber}>1</Text>
                </View>
                <Text style={styles.stepText}>Open the email we sent you</Text>
              </View>
              <View style={styles.instructionStep}>
                <View style={styles.stepNumberContainer}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>
                <Text style={styles.stepText}>Find the verification link (looks like "Confirm your mail")</Text>
              </View>
              <View style={styles.instructionStep}>
                <View style={styles.stepNumberContainer}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  The code is in the link - look for "token=" followed by 6 characters
                </Text>
              </View>
              <View style={styles.instructionStep}>
                <View style={styles.stepNumberContainer}>
                  <Text style={styles.stepNumber}>4</Text>
                </View>
                <Text style={styles.stepText}>Enter those 6 characters in the verification screen</Text>
              </View>
            </View>

            <View style={styles.optionsContainer}>
              <TouchableOpacity style={styles.optionButton} onPress={handleResendEmail} disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#4a6da7" />
                ) : (
                  <>
                    <Feather name="mail" size={20} color="#4a6da7" style={styles.optionIcon} />
                    <Text style={styles.optionText}>Resend Verification Email</Text>
                    <Feather name="chevron-right" size={20} color="#4a6da7" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionButton} onPress={handleGoToVerification}>
                <Feather name="check-circle" size={20} color="#4a6da7" style={styles.optionIcon} />
                <Text style={styles.optionText}>Enter Verification Code</Text>
                <Feather name="chevron-right" size={20} color="#4a6da7" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionButton} onPress={handleContactSupport}>
                <Feather name="headphones" size={20} color="#4a6da7" style={styles.optionIcon} />
                <Text style={styles.optionText}>Contact Support</Text>
                <Feather name="chevron-right" size={20} color="#4a6da7" />
              </TouchableOpacity>

              {/* Development option - remove in production */}
              <TouchableOpacity style={[styles.optionButton, styles.devOptionButton]} onPress={handleDevelopmentBypass}>
                <Feather name="code" size={20} color="#666" style={styles.optionIcon} />
                <Text style={styles.devOptionText}>Development: Skip Verification</Text>
                <Feather name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.returnButton} onPress={() => router.replace("/(auth)/customer/login")}>
              <Feather name="log-in" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.returnButtonText}>Return to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  backButton: {
    alignSelf: "flex-start",
    padding: 8,
    marginBottom: 20,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e6f0ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
  },
  contentContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emailText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
  },
  emailAddress: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  emailMissing: {
    fontSize: 16,
    color: "#e53935",
    textAlign: "center",
    marginBottom: 20,
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    color: "#e53935",
    marginBottom: 16,
    textAlign: "center",
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 8,
  },
  successText: {
    color: "#43a047",
    marginBottom: 16,
    textAlign: "center",
    backgroundColor: "#e8f5e9",
    padding: 10,
    borderRadius: 8,
  },
  illustrationContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  illustration: {
    width: 120,
    height: 120,
  },
  infoContainer: {
    flexDirection: "row",
    backgroundColor: "#f0f5ff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    alignItems: "flex-start",
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    fontSize: 15,
    color: "#333",
    flex: 1,
    lineHeight: 22,
  },
  codeInstructions: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#4a6da7",
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-start",
  },
  stepNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4a6da7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  stepText: {
    fontSize: 15,
    color: "#333",
    flex: 1,
    lineHeight: 22,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  optionIcon: {
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  devOptionButton: {
    backgroundColor: "#f5f5f5",
    borderStyle: "dashed",
  },
  devOptionText: {
    fontSize: 16,
    color: "#666",
    flex: 1,
  },
  returnButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4a6da7",
    padding: 16,
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  returnButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
})

