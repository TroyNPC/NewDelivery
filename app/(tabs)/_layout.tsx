// app/(tabs)/_layout.tsx
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useSegments } from 'expo-router';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const currentRoute = segments[segments.length - 1];

  // Show tab bar only on main tabs
  const isMainTab = ['deliveries', 'pickups', 'history', 'user'].includes(currentRoute);

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarStyle: { display: isMainTab ? 'flex' : 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Deliveries',
          tabBarIcon: ({ size, color }) => (
            <Ionicons name="bicycle" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="pickups"
        options={{
          title: 'Pickups',
          tabBarIcon: ({ size, color }) => (
            <Ionicons name="cube" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ size, color }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="user"
        options={{
          title: 'User',
          tabBarIcon: ({ size, color }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}