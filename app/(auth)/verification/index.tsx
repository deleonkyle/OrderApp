"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  Keyboard,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { supabase } from "@/lib/supabase"
import { StatusBar } from "expo-status-bar"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"

export default function VerificationScreen() {
  const params = useLocalSearchParams()
  const verificationType = params.verificationType as string
  const contactInfo = (params.contactInfo as string) || ""
  const purpose = (params.purpose as "login" | "registration") || "login"

  const [otpValue, setOtpValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [errorField, setErrorField] = useState<"email" | "otp" | null>(null)
  const [timer, setTimer] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [manualEmail, setManualEmail] = useState("")
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [registrationEmail, setRegistrationEmail] = useState<string | null>(null)

  const otpInputRef = useRef<TextInput>(null)
  const emailInputRef = useRef<TextInput>(null)

  // Flag to track if the component is mounted
  const isMounted = useRef(true)

  // Memoize the effective contact info to avoid recalculations
  const effectiveContactInfo = useMemo(
    () => contactInfo || registrationEmail || manualEmail,
    [contactInfo, registrationEmail, manualEmail],
  )

  // Memoize whether this is an email
  const isEmail = useMemo(() => effectiveContactInfo?.includes("@") || false, [effectiveContactInfo])

  // Format OTP with spaces for better readability
  const formattedOtp = useMemo(() => {
    if (!otpValue) return ""
    return otpValue
      .replace(/\s/g, "")
      .replace(/(.{3})/g, "$1 ")
      .trim()
  }, [otpValue])

  // Load registration email from AsyncStorage on mount
  useEffect(() => {
    const loadRegistrationData = async () => {
      try {
        const pendingRegistrationStr = await AsyncStorage.getItem("pendingRegistration")
        if (pendingRegistrationStr) {
          const pendingRegistration = JSON.parse(pendingRegistrationStr)
          if (pendingRegistration.email) {
            setRegistrationEmail(pendingRegistration.email)
            console.log("Loaded registration email:", pendingRegistration.email)
          }
        }
      } catch (error) {
        console.error("Error loading registration data:", error)
      }
    }

    loadRegistrationData()
  }, [])

  // Define createVerificationParams first since it's used by handleVerify
  const createVerificationParams = useCallback(() => {
    if (isEmail) {
      return {
        email: effectiveContactInfo,
        token: otpValue.replace(/\s/g, ""),
        type: purpose === "login" ? ("email" as const) : ("signup" as const),
      }
    } else {
      return {
        phone: effectiveContactInfo,
        token: otpValue.replace(/\s/g, ""),
        type: purpose === "login" ? ("sms" as const) : ("signup" as const),
      }
    }
  }, [effectiveContactInfo, isEmail, otpValue, purpose])

  // Define handleVerify before it's used
  const handleVerify = useCallback(async () => {
    const cleanOtp = otpValue.replace(/\s/g, "")

    // Check if we're missing critical info
    if (!effectiveContactInfo) {
      setError("Please enter your email address")
      setErrorField("email")
      setShowManualEntry(true)
      emailInputRef.current?.focus()
      return
    }

    if (cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code")
      setErrorField("otp")
      otpInputRef.current?.focus()
      return
    }

    setIsVerifying(true)
    setLoading(true)
    setError("")
    setErrorField(null)

    try {
      console.log("Verifying OTP:", cleanOtp, "for contact:", effectiveContactInfo, "purpose:", purpose)

      // Different verification approaches based on purpose
      if (purpose === "login") {
        // For login with OTP
        const verifyParams = createVerificationParams()
        console.log("Verify params:", verifyParams)

        // Sign in with OTP using the newer method - handle type casting for proper API call
        let result
        if (isEmail) {
          result = await supabase.auth.verifyOtp({
            email: effectiveContactInfo,
            token: cleanOtp,
            type: "email" as const,
          })
        } else {
          result = await supabase.auth.verifyOtp({
            phone: effectiveContactInfo,
            token: cleanOtp,
            type: "sms" as const,
          })
        }

        const { data, error } = result

        if (error) {
          console.error("Login verification error:", error)
          throw error
        }

        console.log("Login successful:", data)

        // Store session in AsyncStorage
        const userSession = {
          id: data.user?.id || "",
          email: isEmail ? effectiveContactInfo : "",
          phone: isEmail ? "" : effectiveContactInfo,
          name: data.user?.user_metadata?.name || (isEmail ? effectiveContactInfo.split("@")[0] : effectiveContactInfo),
          role: "customer",
        }

        await AsyncStorage.setItem("userSession", JSON.stringify(userSession))

        // Only show alert and navigate if the component is still mounted
        if (isMounted.current) {
          Alert.alert("Login Successful", "You have been successfully verified and logged in!", [
            { text: "Continue", onPress: () => router.replace("/customer/login") },
          ])
        } else {
          // If unmounted, just redirect
          router.replace("/customer/login")
        }
      } else {
        // For registration - handle type casting for proper API call
        let result
        if (isEmail) {
          result = await supabase.auth.verifyOtp({
            email: effectiveContactInfo,
            token: cleanOtp,
            type: "signup" as const,
          })
        } else {
          result = await supabase.auth.verifyOtp({
            phone: effectiveContactInfo,
            token: cleanOtp,
            type: "sms" as const,
          })
        }

        const { data, error } = result

        if (error) {
          console.error("Registration verification error:", error)
          throw error
        }

        console.log("Registration verification successful:", data)

        // Get registration data
        const pendingRegistrationStr = await AsyncStorage.getItem("pendingRegistration")
        if (!pendingRegistrationStr) {
          throw new Error("Registration data not found. Please start over.")
        }

        const pendingRegistration = JSON.parse(pendingRegistrationStr)

        // Create customer profile
        const { error: profileError } = await supabase.from("customers").insert([
          {
            id: data.user?.id || "",
            email: pendingRegistration.email || effectiveContactInfo,
            name: pendingRegistration.name,
            phone: pendingRegistration.phone,
            address: pendingRegistration.address,
            barangay: pendingRegistration.barangay,
            town: pendingRegistration.town,
            province: pendingRegistration.province,
            contact_person: pendingRegistration.contact_person,
            contact_number: pendingRegistration.contact_number,
          },
        ])

        if (profileError) {
          console.error("Customer profile creation error:", profileError)
          throw profileError
        }

        // Clean up registration data
        await AsyncStorage.removeItem("pendingRegistration")

        // Store session
        const userSession = {
          id: data.user?.id || "",
          email: pendingRegistration.email || effectiveContactInfo,
          name: pendingRegistration.name,
          role: "customer",
        }

        await AsyncStorage.setItem("userSession", JSON.stringify(userSession))

        // Only show alert if the component is still mounted
        if (isMounted.current) {
          Alert.alert("Registration Successful", "Your account has been successfully registered!", [
            { text: "Continue", onPress: () => router.replace("/customer/login") },
          ])
        } else {
          // If unmounted, just redirect
          router.replace("/customer/login")
        }
      }
    } catch (error: any) {
      console.error("Verification error:", error)

      // Show error only if component is still mounted
      if (isMounted.current) {
        Alert.alert("Verification Failed", error.message || "Please check your code and try again.")
        setError(error.message || "Verification failed. Please try again.")
        setErrorField("otp")
      }
    } finally {
      // Update loading state only if component is still mounted
      if (isMounted.current) {
        setLoading(false)
        setIsVerifying(false)
      }
    }
  }, [otpValue, effectiveContactInfo, purpose, isEmail, createVerificationParams, router, showManualEntry])

  // Handle OTP input change
  const handleOtpChange = useCallback(
    (text: string) => {
      // Remove any non-alphanumeric characters
      const cleanedText = text.replace(/[^a-zA-Z0-9]/g, "")

      // Check if the user is pasting a full link or code
      if (cleanedText.length > 6) {
        try {
          // Extract token from link - check various formats
          let extractedToken: string | null = null

          // Format 1: token=xxxxx
          let tokenMatch = text.match(/token=([a-zA-Z0-9]{6})/)
          if (tokenMatch && tokenMatch[1]) {
            extractedToken = tokenMatch[1]
          }

          // Format 2: confirmation_token=xxxxx
          else if (!extractedToken) {
            tokenMatch = text.match(/confirmation_token=([a-zA-Z0-9]{6})/)
            if (tokenMatch && tokenMatch[1]) {
              extractedToken = tokenMatch[1]
            }
          }

          // Format 3: Try to extract any 6-character alphanumeric sequence
          else if (!extractedToken && text.length >= 6) {
            const matches = text.match(/[a-zA-Z0-9]{6}/g)
            if (matches && matches.length > 0) {
              extractedToken = matches[0]
            }
          }

          // If we found a token, use it
          if (extractedToken) {
            console.log("Extracted token:", extractedToken)
            setOtpValue(extractedToken.substring(0, 6))

            // Clear any previous errors
            if (errorField === "otp") {
              setError("")
              setErrorField(null)
            }

            // Immediately verify if we have all 6 digits
            if (extractedToken.length === 6) {
              setTimeout(() => {
                handleVerify()
              }, 300)
            }
            return
          }
        } catch (e) {
          console.log("Error extracting token from text", e)
        }
      }

      // Limit to 6 characters
      const limitedText = cleanedText.substring(0, 6)
      setOtpValue(limitedText)

      // Clear any previous errors
      if (errorField === "otp" && limitedText.length > 0) {
        setError("")
        setErrorField(null)
      }

      // Automatically verify when all fields are filled
      if (limitedText.length === 6) {
        // Small delay to allow the state to update
        setTimeout(() => {
          Keyboard.dismiss()
          handleVerify()
        }, 300)
      }
    },
    [errorField, handleVerify],
  )

  // Handle email input change
  const handleEmailChange = useCallback(
    (text: string) => {
      setManualEmail(text)

      // Clear any previous errors
      if (errorField === "email" && text.length > 0) {
        setError("")
        setErrorField(null)
      }
    },
    [errorField],
  )

  // Effect to handle component mount/unmount
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Show manual email entry if contactInfo is missing and no registration email
  useEffect(() => {
    if (!contactInfo && !registrationEmail) {
      setError("Please enter your email address")
      setErrorField("email")
      setShowManualEntry(true)
    }
  }, [contactInfo, registrationEmail])

  // Timer effect with cleanup
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined = undefined

    if (timer > 0 && !canResend) {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1)
      }, 1000)
    } else if (timer === 0 && !canResend) {
      setCanResend(true)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timer, canResend])

  const handleResendCode = useCallback(async () => {
    if (!canResend || loading) return

    // Check if we have an email to send to
    if (!effectiveContactInfo) {
      setError("Please enter your email address")
      setErrorField("email")
      setShowManualEntry(true)
      emailInputRef.current?.focus()
      return
    }

    setLoading(true)
    setError("")
    setErrorField(null)

    try {
      if (verificationType === "email" || isEmail) {
        // Resend OTP via Supabase Auth
        const { error } = await supabase.auth.signInWithOtp({
          email: effectiveContactInfo,
          options: {
            shouldCreateUser: false,
          },
        })

        if (error) throw error

        setTimer(60)
        setCanResend(false)

        // Only show alert if component is still mounted
        if (isMounted.current) {
          Alert.alert("Code Sent", `A new verification code has been sent to ${effectiveContactInfo}`)
        }
      } else if (verificationType === "phone") {
        // Implement phone verification resend if needed
        Alert.alert("Not Implemented", "Phone verification is not supported yet.")
      }
    } catch (error: any) {
      console.error("Error resending code:", error)

      // Only update error if component is still mounted
      if (isMounted.current) {
        setError(error.message || "Failed to resend code. Please try again.")
        setErrorField("email")
      }
    } finally {
      // Only update loading if component is still mounted
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [canResend, verificationType, effectiveContactInfo, isEmail, loading])

  // Emergency bypass that works with effectiveContactInfo
  const emergencyRedirect = useCallback(() => {
    if (!effectiveContactInfo) {
      setError("Please enter your email address before using this option.")
      setErrorField("email")
      setShowManualEntry(true)
      emailInputRef.current?.focus()
      return
    }

    Alert.alert(
      "Skip Verification",
      "This will bypass verification and take you to the home screen. Use only for testing.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue Anyway",
          onPress: async () => {
            try {
              setLoading(true)

              // Try to get current user
              const {
                data: { user },
              } = await supabase.auth.getUser()

              // Create session data
              const sessionData = user
                ? {
                    id: user.id,
                    email: user.email || effectiveContactInfo,
                    name: user.user_metadata?.name || effectiveContactInfo.split("@")[0],
                    role: "customer",
                  }
                : {
                    id: "temp-" + Math.random().toString(36).substring(2, 9),
                    email: effectiveContactInfo,
                    name: effectiveContactInfo.split("@")[0],
                    role: "customer",
                  }

              await AsyncStorage.setItem("userSession", JSON.stringify(sessionData))
              router.replace("/customer/login")
            } catch (error) {
              console.error("Emergency redirect error:", error)
              router.replace("/")
            } finally {
              if (isMounted.current) {
                setLoading(false)
              }
            }
          },
        },
      ],
    )
  }, [effectiveContactInfo, router])

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <View style={styles.iconContainer}>
              <Feather name={verificationType === "email" ? "mail" : "smartphone"} size={40} color="#4a6da7" />
            </View>
            <Text style={styles.title}>Verification</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code from your email</Text>

            {contactInfo ? (
              <Text style={styles.contactInfo}>{contactInfo}</Text>
            ) : registrationEmail ? (
              <Text style={styles.contactInfo}>{registrationEmail}</Text>
            ) : showManualEntry ? (
              <View style={styles.emailInputContainer}>
                <TextInput
                  ref={emailInputRef}
                  style={[styles.manualEmailInput, errorField === "email" && styles.inputError]}
                  placeholder="Enter your email address"
                  value={manualEmail}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errorField === "email" && <Text style={styles.fieldErrorText}>{error}</Text>}
              </View>
            ) : null}
          </View>

          <View style={styles.formContainer}>
            <View style={styles.infoContainer}>
              <Feather name="info" size={20} color="#4a6da7" />
              <Text style={styles.infoText}>
                Enter the 6-digit code from your email. If you received a link, use the code after 'token=' in the link.
              </Text>
            </View>

            <View style={styles.otpInputContainer}>
              <TextInput
                ref={otpInputRef}
                style={[styles.otpInput, errorField === "otp" && styles.inputError]}
                value={formattedOtp}
                onChangeText={handleOtpChange}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#aaa"
                keyboardType="default"
                autoCapitalize="none"
                maxLength={7} // 6 digits + 1 space
              />
              {errorField === "otp" && <Text style={styles.fieldErrorText}>{error}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.verifyButton, isVerifying && styles.verifyingButton]}
              onPress={handleVerify}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <View style={styles.verifyingContainer}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.verifyButtonText}>Verifying...</Text>
                </View>
              ) : (
                <Text style={styles.verifyButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>
                {canResend ? "Didn't receive the code?" : `Resend code in ${timer}s`}
              </Text>
              <TouchableOpacity
                style={[styles.resendButton, (!canResend || loading) && styles.resendButtonDisabled]}
                onPress={handleResendCode}
                disabled={!canResend || loading}
              >
                <Text style={[styles.resendButtonText, (!canResend || loading) && styles.resendButtonTextDisabled]}>
                  Resend
                </Text>
              </TouchableOpacity>
            </View>

            {/* Emergency bypass button */}
            <TouchableOpacity style={styles.emergencyButton} onPress={emergencyRedirect}>
              <Text style={styles.emergencyButtonText}>Having trouble? Click here</Text>
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
    paddingVertical: 30,
    paddingHorizontal: 20,
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
    marginBottom: 12,
  },
  contactInfo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4a6da7",
    marginTop: 4,
  },
  emailInputContainer: {
    width: "100%",
    marginTop: 8,
  },
  formContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContainer: {
    flexDirection: "row",
    backgroundColor: "#f0f5ff",
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: "#4a6da7",
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  otpInputContainer: {
    marginBottom: 24,
  },
  otpInput: {
    height: 60,
    borderWidth: 1.5,
    borderColor: "#4a6da7",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
    backgroundColor: "#fff",
    letterSpacing: 8,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: "#e53935",
    backgroundColor: "#ffebee",
  },
  fieldErrorText: {
    color: "#c62828",
    marginTop: 6,
    fontSize: 14,
    fontWeight: "500",
  },
  verifyButton: {
    backgroundColor: "#4a6da7",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  verifyingButton: {
    backgroundColor: "#3a5a8c",
  },
  verifyingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  resendText: {
    color: "#666",
    fontSize: 14,
    marginRight: 8,
  },
  resendButton: {
    backgroundColor: "#e6f0ff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  resendButtonDisabled: {
    backgroundColor: "#f0f0f0",
  },
  resendButtonText: {
    color: "#4a6da7",
    fontSize: 14,
    fontWeight: "bold",
  },
  resendButtonTextDisabled: {
    color: "#aaa",
  },
  emergencyButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  emergencyButtonText: {
    color: "#999",
    fontSize: 14,
  },
  manualEmailInput: {
    height: 54,
    borderWidth: 1,
    borderColor: "#4a6da7",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
})

