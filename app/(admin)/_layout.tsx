import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { authService } from '@/lib/auth';

export default function AdminLayout() {
  useEffect(() => {
    // Check if user is admin
    const checkAdmin = async () => {
      const isAdmin = await authService.isAdmin();
      if (!isAdmin) {
        router.replace('/');
      }
    };
    checkAdmin();
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