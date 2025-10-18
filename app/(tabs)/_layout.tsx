import { Tabs, useSegments } from "expo-router";
import React from "react";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const currentRoute = segments[segments.length - 1];

  // Check if user is on either deliveries.tsx or pickups.tsx
  const isMainTab = currentRoute === "deliveries" || currentRoute === "pickups" || currentRoute === "history";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        // Show tab bar only on deliveries or pickups pages
        tabBarStyle: { display: isMainTab ? "flex" : "none" },
      }}
    >
      {/* Hidden screens */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="page/delivery/[id]" options={{ href: null }} />
      <Tabs.Screen name="page/pickup/[id]" options={{ href: null }} />
      <Tabs.Screen name="page/delivery/accepted/[id]" options={{ href: null }} />
      <Tabs.Screen name="page/pickup/accepted/[id]" options={{ href: null }} />
      <Tabs.Screen name="page/delivery/accepted/noresponse/[id]noresponse" options={{ href: null }} />
      <Tabs.Screen name="page/pickup/accepted/pickupreceived/[id]" options={{ href: null }} />

      {/* Main tabs */}
      <Tabs.Screen
        name="page/deliveries"
        options={{
          title: "Deliveries",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="bicycle" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="page/pickups"
        options={{
          title: "Pickups",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="cube" color={color} />
          ),
        }}
      />
            <Tabs.Screen
        name="page/history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="cube" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
