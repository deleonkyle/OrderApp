import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { authService } from '@/lib/auth';

export default function CustomerLayout() {
  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        router.replace('/');
      }
    };
    checkAuth();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
} 