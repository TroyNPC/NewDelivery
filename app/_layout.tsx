import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';

import AuthGuard from '@/components/AuthGuard';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      gcTime: 1000 * 60 * 5,
    },
  },
});

function ProtectedStack({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </AuthGuard>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          {/* Login screen - NO AuthGuard (public) */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          
          {/* Tabs - WITH AuthGuard (protected) */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* DELIVERY SCREENS - NO HEADERS */}
          <Stack.Screen 
            name="delivery/[id]" 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="delivery/map-preview" 
            options={{ headerShown: false }} 
          />
          
          {/* PICKUP SCREENS - NO HEADERS */}
          <Stack.Screen 
            name="pickup/[id]" 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="pickup/map-preview" 
            options={{ headerShown: false }} 
          />
          
          {/* Add other protected screens as needed */}
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}