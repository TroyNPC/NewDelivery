import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, useSegments } from "expo-router";
import React from "react";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const currentRoute = segments[segments.length - 1];

  // Check if user is on either deliveries.tsx, pickups.tsx, or history.tsx
  const isMainTab =
    currentRoute === "deliveries" ||
    currentRoute === "pickups" ||
    currentRoute === "history" ||
    currentRoute === "user";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        // Show tab bar only on deliveries, pickups, history, or user pages
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
      <Tabs.Screen
        name="page/delivery/accepted/noresponse/[id]noresponse"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="page/pickup/accepted/pickupreceived/[id]"
        options={{ href: null }}
      />

      {/* Main tabs */}
      <Tabs.Screen
        name="page/deliveries"
        options={{
          title: "Deliveries",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="page/pickups"
        options={{
          title: "Pickups",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="page/history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="page/user"
        options={{
          title: "User",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="page/editprofile"
        options={{ href: null }}
      />
    </Tabs>
  );
}
