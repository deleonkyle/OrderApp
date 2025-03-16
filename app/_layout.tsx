import React, { useEffect } from 'react'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AppProvider } from '@/lib/AppContext'
import { perfMonitor } from '@/lib/utils'
import { UI, PERFORMANCE } from '@/constants/config'
import { View, Text, StyleSheet } from 'react-native'

// Define valid route paths
export type AppRoutes = {
  '/': undefined
  '/(auth)/customer/login': undefined
  '/(auth)/customer/register': undefined
  '/(auth)/admin/login': undefined
  '/(auth)/admin/register': { email?: string }
  '/(auth)/forgot-password': undefined
  '/(auth)/reset-password': undefined
  '/(auth)/verification': undefined
  '/(customer)/home': undefined
  '/(customer)/orders/checkout': undefined
  '/(customer)/orders/history': undefined
  '/(customer)/orders/[id]': { id: string }
  '/(customer)/profile': undefined
  '/(admin)/home': undefined
  '/(admin)/orders/history': undefined
  '/(admin)/orders/[id]': { id: string }
  '/(admin)/orders/new': undefined
  '/(admin)/customers/[id]': { id: string }
  '/(admin)/products': undefined
  '/(admin)/visit-log': undefined
  '/(admin)/admin-invitations': undefined
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends AppRoutes {}
  }
}

export default function RootLayout() {
  // Track app render performance
  useEffect(() => {
    perfMonitor.startTimer('appRender')
    
    return () => {
      const renderTime = perfMonitor.endTimer('appRender')
      if (renderTime > PERFORMANCE.RENDER_THRESHOLD) {
        console.warn(`App render took ${renderTime}ms, which exceeds the threshold of ${PERFORMANCE.RENDER_THRESHOLD}ms`)
      }
    }
  }, [])

  return (
    <AppProvider>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: UI.DEFAULT_ANIMATION_DURATION,
            gestureEnabled: false,
          }}
        />
      </SafeAreaProvider>
    </AppProvider>
  )
}

// Handle app errors
export function ErrorBoundary({ error }: { error: Error }) {
  // Log error for monitoring
  useEffect(() => {
    console.error('App Error:', error)
    // Here we could send the error to a monitoring service
  }, [error])
  
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>
        Something went wrong
      </Text>
      <Text style={styles.errorMessage}>
        {error.message}
      </Text>
      <Text style={styles.errorHelp}>
        Please restart the app or contact support if the problem persists.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    color: '#ff4d4f'
  },
  errorMessage: {
    fontSize: 14, 
    textAlign: 'center', 
    color: '#333'
  },
  errorHelp: {
    fontSize: 12, 
    marginTop: 20, 
    color: '#666',
    textAlign: 'center'
  }
}) 