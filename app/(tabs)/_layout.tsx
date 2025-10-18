import { Tabs, useSegments } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
const colorScheme = useColorScheme();
const segments = useSegments(); // Gives current route segments
const currentRoute = segments[segments.length - 1]; // Get current file name (e.g. 'deliveries')

// Check if user is currently on deliveries.tsx
const isDeliveries = currentRoute === 'deliveries';

    return (
    <Tabs  screenOptions={{ tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint, headerShown: false, tabBarStyle: { display: isDeliveries ? 'flex' : 'none' },}}>
    <Tabs.Screen name="index" options={{ href: null }} />,
    <Tabs.Screen name="explore" options={{ href: null }} />,
    <Tabs.Screen name="page/deliveries" options={{ title: 'Deliveries', tabBarIcon: ({ color }) => <IconSymbol size={28} name="bicycle" color={color} />}}/>
    <Tabs.Screen name="page/delivery/[id]" options={{ href: null }}/>
    </Tabs>
);
}