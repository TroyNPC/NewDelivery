import { supabase } from "@/hooks/supabaseClient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { WebView } from "react-native-webview";
import { AppHeader } from "../component/AppHeader";

type Pickup = {
  order_item_id: string;
  order_item_status: string;
  order_id: string;
  customer_name: string;
  customer_contact: string;
  pickup_location: string;
  pickup_latitude: number;
  pickup_longitude: number;
  estimated_weight: string;
  branch_name: string;
  branch_address: string;
  branch_lat: number;
  branch_lng: number;
  driver_id: string | null;
  pickup_status: string | null;
  requested_at: string;
  pickup_id?: string;
  special_instructions?: string;
  order_method?: string;
  order_method_label?: string;
};

const webViewCache = new Map<string, string>();

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color="#ff6b35" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const MiniMap = ({ 
  destination, 
  orderItemId, 
  currentLocation
}: { 
  destination: { lat: number; lng: number };
  orderItemId: string;
  currentLocation: { lat: number; lng: number } | null;
}) => {
  const [webViewError, setWebViewError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  const getCachedMapHTML = useCallback(
    (dest: { lat: number; lng: number }) => {
      if (!currentLocation) {
        return `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                html, body, #map { 
                  height: 100%; 
                  margin: 0; 
                  padding: 0; 
                  background-color: #f0f0f0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  font-family: Arial, sans-serif;
                }
              </style>
            </head>
            <body>
              <div id="map">Waiting for location...</div>
            </body>
          </html>
        `;
      }

      const cacheKey = `${currentLocation.lat},${currentLocation.lng}-${dest.lat},${dest.lng}`;
      
      if (webViewCache.has(cacheKey)) return webViewCache.get(cacheKey)!;

      const mapHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <script src="https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.js"></script>
            <style>
              html, body, #map { 
                height: 100%; 
                margin: 0; 
                padding: 0; 
                background-color: #f0f0f0;
              }
              .leaflet-routing-container { display: none; }
              .leaflet-control-container { display: none; }
            </style>
          </head>
          <body>
            <div id="map"></div>
            <script>
              try {
                var map = L.map('map', {
                  zoomControl: false,
                  attributionControl: false
                }).setView([${currentLocation.lat}, ${currentLocation.lng}], 14);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  maxZoom: 19
                }).addTo(map);
                
                // Add markers
                var startMarker = L.marker([${currentLocation.lat}, ${currentLocation.lng}])
                  .addTo(map)
                  .bindPopup('Your Location');
                  
                var endMarker = L.marker([${dest.lat}, ${dest.lng}])
                  .addTo(map)
                  .bindPopup('Pickup Location');
                
                // Add route
                var control = L.Routing.control({
                  waypoints: [
                    L.latLng(${currentLocation.lat}, ${currentLocation.lng}),
                    L.latLng(${dest.lat}, ${dest.lng})
                  ],
                  addWaypoints: false,
                  draggableWaypoints: false,
                  routeWhileDragging: false,
                  show: false,
                  fitSelectedRoutes: true,
                  lineOptions: { 
                    styles: [{ color: '#3864C3', weight: 5, opacity: 0.7 }] 
                  },
                  createMarker: function() { return null; }
                }).addTo(map);
                
                // Fit bounds to show both markers
                var group = new L.featureGroup([startMarker, endMarker]);
                map.fitBounds(group.getBounds().pad(0.1));
                
                // Notify React that map is loaded
                setTimeout(function() {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage('map_loaded');
                  }
                }, 500);
                
              } catch (error) {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage('map_error:' + error.message);
                }
              }
            </script>
          </body>
        </html>
      `;
      webViewCache.set(cacheKey, mapHTML);
      return mapHTML;
    },
    [currentLocation]
  );

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (webViewError) {
    return (
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={20} color="#888" />
        <Text style={styles.mapPlaceholderText}>Map unavailable</Text>
      </View>
    );
  }

  if (!currentLocation) {
    return (
      <View style={styles.mapPlaceholder}>
        <ActivityIndicator size="small" color="#3864C3" />
        <Text style={styles.mapPlaceholderText}>Getting location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: getCachedMapHTML(destination) }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scrollEnabled={false}
        zoomable={false}
        overScrollMode="never"
        androidLayerType="hardware"
        style={{ flex: 1 }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'map_loaded') {
            setIsLoading(false);
          } else if (event.nativeEvent.data.startsWith('map_error')) {
            console.error('Map error:', event.nativeEvent.data);
            if (isMounted.current) setWebViewError(true);
          }
        }}
        onError={() => {
          console.log('WebView error');
          if (isMounted.current) setWebViewError(true);
        }}
        onHttpError={() => {
          console.log('WebView HTTP error');
          if (isMounted.current) setWebViewError(true);
        }}
        renderLoading={() => (
          <View style={styles.mapLoadingContainer}>
            <ActivityIndicator size="small" color="#3864C3" />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        )}
      />
      {isLoading && (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator size="small" color="#3864C3" />
          <Text style={styles.mapLoadingText}>Loading...</Text>
        </View>
      )}
    </View>
  );
};

export default function PickupInfo() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Memory leak prevention
  const isMounted = useRef(true);
  
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [activePickup, setActivePickup] = useState<Pickup | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [takingPickupId, setTakingPickupId] = useState<string | null>(null);
  const [driverBranchId, setDriverBranchId] = useState<string | null>(null);
  
  // Authentication states
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Confirmation Modal State
  const [confirmationModal, setConfirmationModal] = useState<{
    visible: boolean;
    orderItemId: string;
    orderId: string;
    customerName: string;
  }>({
    visible: false,
    orderItemId: "",
    orderId: "",
    customerName: "",
  });

  // Get current authenticated user
  const getCurrentUser = useCallback(async () => {
    try {
      if (isMounted.current) {
        setAuthLoading(true);
      }
      
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) throw error;
      if (!user) {
        if (isMounted.current) {
          setAuthError("No user logged in");
        }
        return null;
      }
      
      return user;
    } catch (error: any) {
      console.error("Error getting current user:", error);
      if (isMounted.current) {
        setAuthError(error.message || "Authentication failed");
      }
      return null;
    } finally {
      if (isMounted.current) {
        setAuthLoading(false);
      }
    }
  }, []);

  // Get driver's assigned branch
  const getDriverBranch = useCallback(async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from("shop_user_assignments")
        .select("branch_id")
        .eq("user_id", driverId)
        .eq("role_in_shop", "delivery")
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data?.branch_id;
    } catch (error) {
      console.error("Error fetching driver branch:", error);
      return null;
    }
  }, []);

  // Fetch active pickup for this driver
  const fetchActivePickup = useCallback(async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          id,
          order_id,
          status,
          assigned_at,
          orders (
            customer_name,
            customer_contact,
            delivery_location,
            delivery_latitude,
            delivery_longitude,
            shop_methods (
              code,
              label
            ),
            order_items (
              id,
              status,
              started_at
            )
          )
        `)
        .eq("driver_id", driverId)
        .in("status", ["assigned", "in_progress"])
        .order("assigned_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          if (isMounted.current) {
            setActivePickup(null);
          }
          return;
        }
        throw error;
      }

      if (data && isMounted.current) {
        const orderItem = Array.isArray(data.orders?.order_items) ? data.orders.order_items[0] : null;
        const shopMethod = Array.isArray(data.orders?.shop_methods) ? data.orders.shop_methods[0] : null;
        
        const active: Pickup = {
          pickup_id: data.id,
          order_id: data.order_id || "",
          order_item_id: orderItem?.id || "",
          order_item_status: orderItem?.status || "waiting_for_pickup",
          customer_name: data.orders?.customer_name || "Unknown Customer",
          customer_contact: data.orders?.customer_contact || "No contact",
          pickup_location: data.orders?.delivery_location || "Address not provided",
          pickup_latitude: data.orders?.delivery_latitude || 0,
          pickup_longitude: data.orders?.delivery_longitude || 0,
          estimated_weight: "To be weighed at shop",
          branch_name: "",
          branch_address: "",
          branch_lat: 0,
          branch_lng: 0,
          driver_id: driverId,
          pickup_status: data.status,
          requested_at: orderItem?.started_at || new Date().toISOString(),
          order_method: shopMethod?.code || "pickup",
          order_method_label: shopMethod?.label || "Pickup",
        };
        setActivePickup(active);
      } else if (isMounted.current) {
        setActivePickup(null);
      }
    } catch (error) {
      console.error("Error fetching active pickup:", error);
      if (isMounted.current) {
        setActivePickup(null);
      }
    }
  }, []);

  // Fetch available pickups
  const fetchPickups = useCallback(async (driverId: string) => {
    try {
      if (isMounted.current) {
        setLoading(true);
      }

      // First, get the driver's branch with branch details
      const branchId = await getDriverBranch(driverId);
      if (!branchId) {
        if (isMounted.current) {
          Alert.alert("Error", "No branch assigned to this driver");
          setPickups([]);
        }
        return;
      }

      if (isMounted.current) {
        setDriverBranchId(branchId);
      }

      // Get branch details first
      const { data: branchData, error: branchError } = await supabase
        .from("shop_branches")
        .select("name, address, latitude, longitude")
        .eq("id", branchId)
        .single();

      if (branchError) {
        console.error("Error fetching branch details:", branchError);
      }

      const branchName = branchData?.name || "Main Branch Hangyu Laundry Shop";
      const branchAddress = branchData?.address || "Santa Rosa Street";
      const branchLat = branchData?.latitude || 0;
      const branchLng = branchData?.longitude || 0;

      // Get all order_items that are waiting for pickup and belong to this branch
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          id,
          status,
          started_at,
          order_id,
          orders!inner (
            id,
            customer_name,
            customer_contact,
            delivery_location,
            delivery_latitude,
            delivery_longitude,
            branch_id,
            meta,
            shop_methods (
              code,
              label
            )
          )
        `)
        .eq("status", "waiting_for_pickup")
        .eq("orders.branch_id", branchId)
        .order("started_at", { ascending: true });

      if (itemsError) throw itemsError;

      if (!orderItems || orderItems.length === 0) {
        if (isMounted.current) {
          setPickups([]);
        }
        return;
      }

      // Get order IDs to check for existing deliveries
      const orderIds = orderItems.map(item => item.order_id).filter(Boolean);

      // Check which orders already have deliveries assigned
      const { data: existingDeliveries, error: deliveriesError } = await supabase
        .from("deliveries")
        .select("order_id, driver_id")
        .in("order_id", orderIds)
        .not("driver_id", "is", null);

      if (deliveriesError) {
        console.error("Error checking existing deliveries:", deliveriesError);
      }

      // Filter out order items that already have deliveries assigned
      const availableOrderItems = orderItems.filter(item => {
        const hasDelivery = existingDeliveries?.some(delivery => delivery.order_id === item.order_id);
        return !hasDelivery;
      });

      if (isMounted.current) {
        const transformedPickups: Pickup[] = availableOrderItems.map((item: any) => {
          const orderItem = item;
          const order = item.orders;
          const shopMethod = Array.isArray(order?.shop_methods) ? order.shop_methods[0] : null;
          const meta = order.meta as { special_instructions?: string } | null;
          const specialInstructions = meta?.special_instructions;

          return {
            order_item_id: orderItem.id || "",
            order_item_status: orderItem.status || "waiting_for_pickup",
            order_id: orderItem.order_id || "",
            customer_name: order?.customer_name || "Unknown Customer",
            customer_contact: order?.customer_contact || "No contact",
            pickup_location: order?.delivery_location || "Address not provided",
            pickup_latitude: order?.delivery_latitude || 0,
            pickup_longitude: order?.delivery_longitude || 0,
            estimated_weight: "To be weighed at shop",
            branch_name: branchName,
            branch_address: branchAddress,
            branch_lat: branchLat,
            branch_lng: branchLng,
            driver_id: null,
            pickup_status: null,
            requested_at: orderItem.started_at || new Date().toISOString(),
            special_instructions: specialInstructions || "",
            order_method: shopMethod?.code || "pickup",
            order_method_label: shopMethod?.label || "Pickup",
          };
        });

        setPickups(transformedPickups);
      }
    } catch (error: any) {
      console.error("Error fetching pickups:", error);
      
      // Fallback approach
      try {
        const branchId = await getDriverBranch(driverId);
        if (!branchId) return;

        const { data: branchData } = await supabase
          .from("shop_branches")
          .select("name, address")
          .eq("id", branchId)
          .single();

        const branchName = branchData?.name || "Main Branch Hangyu Laundry Shop";
        const branchAddress = branchData?.address || "Santa Rosa Street";

        // Simple approach: get orders first, then check for deliveries
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select(`
            id,
            customer_name,
            customer_contact,
            delivery_location,
            delivery_latitude,
            delivery_longitude,
            meta,
            shop_methods (
              code,
              label
            )
          `)
          .eq("branch_id", branchId);

        if (ordersError) throw ordersError;

        if (!orders || orders.length === 0) {
          if (isMounted.current) {
            setPickups([]);
          }
          return;
        }

        // Get order items for these orders
        const orderIds = orders.map(order => order.id).filter(Boolean);
        const { data: orderItems, error: itemsError } = await supabase
          .from("order_items")
          .select("id, status, started_at, order_id")
          .in("order_id", orderIds)
          .eq("status", "waiting_for_pickup")
          .order("started_at", { ascending: true });

        if (itemsError) throw itemsError;

        if (!orderItems || orderItems.length === 0) {
          if (isMounted.current) {
            setPickups([]);
          }
          return;
        }

        // Check for existing deliveries
        const { data: existingDeliveries } = await supabase
          .from("deliveries")
          .select("order_id")
          .in("order_id", orderIds)
          .not("driver_id", "is", null);

        // Filter out orders that have deliveries
        const availableOrderItems = orderItems.filter(item => {
          const hasDelivery = existingDeliveries?.some(delivery => delivery.order_id === item.order_id);
          return !hasDelivery;
        });

        if (isMounted.current) {
          const fallbackPickups: Pickup[] = availableOrderItems.map((orderItem: any) => {
            const order = orders.find((o: any) => o.id === orderItem.order_id);
            const shopMethod = Array.isArray(order?.shop_methods) ? order.shop_methods[0] : null;
            const meta = order?.meta as { special_instructions?: string } | null;
            const specialInstructions = meta?.special_instructions;

            return {
              order_item_id: orderItem.id || "",
              order_item_status: orderItem.status || "waiting_for_pickup",
              order_id: orderItem.order_id || "",
              customer_name: order?.customer_name || "Unknown Customer",
              customer_contact: order?.customer_contact || "No contact",
              pickup_location: order?.delivery_location || "Address not provided",
              pickup_latitude: order?.delivery_latitude || 0,
              pickup_longitude: order?.delivery_longitude || 0,
              estimated_weight: "To be weighed at shop",
              branch_name: branchName,
              branch_address: branchAddress,
              branch_lat: 0,
              branch_lng: 0,
              driver_id: null,
              pickup_status: null,
              requested_at: orderItem.started_at || new Date().toISOString(),
              special_instructions: specialInstructions || "",
              order_method: shopMethod?.code || "pickup",
              order_method_label: shopMethod?.label || "Pickup",
            };
          });

          setPickups(fallbackPickups);
        }
      } catch (fallbackError: any) {
        console.error("Fallback error:", fallbackError);
        if (isMounted.current) {
          Alert.alert("Error", "Failed to load pickups. Please try again.");
          setPickups([]);
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [getDriverBranch]);

  // Combined fetch function
  const fetchAllData = useCallback(async (driverId: string) => {
    await Promise.all([
      fetchPickups(driverId),
      fetchActivePickup(driverId)
    ]);
  }, [fetchPickups, fetchActivePickup]);

  // Initialize authentication and data
  const initializeApp = useCallback(async () => {
    try {
      if (isMounted.current) {
        setAuthLoading(true);
      }
      
      const user = await getCurrentUser();
      
      if (!user) {
        if (isMounted.current) {
          setAuthError("Please log in to access pickups");
        }
        return;
      }
      
      if (isMounted.current) {
        setCurrentDriverId(user.id);
      }
      await fetchAllData(user.id);
    } catch (error: any) {
      console.error("Error initializing app:", error);
      if (isMounted.current) {
        setAuthError(error.message || "Failed to initialize app");
      }
    } finally {
      if (isMounted.current) {
        setAuthLoading(false);
      }
    }
  }, [getCurrentUser, fetchAllData]);

  // Navigate to map preview screen
  const showMapPreview = (pickup: Pickup) => {
    if (!currentDriverId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    router.push({
      pathname: "/pickup/map-preview",
      params: {
        order_item_id: pickup.order_item_id,
        customer_name: pickup.customer_name,
        pickup_location: pickup.pickup_location,
        pickup_latitude: pickup.pickup_latitude.toString(),
        pickup_longitude: pickup.pickup_longitude.toString(),
        current_lat: currentLocation?.lat.toString() || "0",
        current_lng: currentLocation?.lng.toString() || "0",
        customer_contact: pickup.customer_contact,
        special_instructions: pickup.special_instructions || "",
        branch_name: pickup.branch_name,
        branch_address: pickup.branch_address,
        order_id: pickup.order_id,
      }
    });
  };

  // Show confirmation modal
  const hideConfirmation = () => {
    if (isMounted.current) {
      setConfirmationModal({
        visible: false,
        orderItemId: "",
        orderId: "",
        customerName: "",
      });
    }
  };

  const showConfirmation = (orderItemId: string, orderId: string, customerName: string) => {
    if (!currentDriverId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    // Check if driver already has an active pickup
    if (activePickup) {
      Alert.alert(
        "Already Have Active Pickup",
        "You can only handle one pickup at a time. Please complete your current pickup before taking a new one.",
        [
          {
            text: "Continue Current Pickup",
            onPress: continueActivePickup
          },
          {
            text: "OK",
            style: "cancel"
          }
        ]
      );
      return;
    }

    if (isMounted.current) {
      setConfirmationModal({
        visible: true,
        orderItemId,
        orderId,
        customerName,
      });
    }
  };

  const takePickup = async (orderItemId: string, orderId: string, customerName: string) => {
    if (!currentDriverId || !isMounted.current) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    try {
      if (isMounted.current) {
        setTakingPickupId(orderItemId);
      }
      hideConfirmation();

      // Double-check if driver already has an active pickup
      const { data: existingActivePickup, error: activeCheckError } = await supabase
        .from("deliveries")
        .select("id")
        .eq("driver_id", currentDriverId)
        .in("status", ["assigned", "in_progress"])
        .maybeSingle();

      if (activeCheckError) throw activeCheckError;

      if (existingActivePickup) {
        if (isMounted.current) {
          Alert.alert(
            "Already Have Active Pickup",
            "You already have an active pickup. Please complete it before taking a new one.",
            [
              {
                text: "Continue Current Pickup",
                onPress: continueActivePickup
              },
              {
                text: "OK",
                style: "cancel"
              }
            ]
          );
        }
        await fetchAllData(currentDriverId);
        return;
      }

      // First, check if pickup already exists to avoid race conditions
      const { data: existingPickup, error: checkError } = await supabase
        .from("deliveries")
        .select("id, driver_id")
        .eq("order_id", orderId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingPickup) {
        if (isMounted.current) {
          if (existingPickup.driver_id === currentDriverId) {
            Alert.alert("Already Taken", "You have already taken this pickup.");
          } else {
            Alert.alert("Already Taken", "This pickup has already been taken by another driver.");
          }
        }
        await fetchAllData(currentDriverId);
        return;
      }

      // Insert the delivery record for pickup
      const { data: pickup, error: pickupError } = await supabase
        .from("deliveries")
        .insert({
          order_id: orderId,
          driver_id: currentDriverId,
          status: "in_progress",
          assigned_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (pickupError) {
        if (pickupError.code === "42501") {
          if (isMounted.current) {
            Alert.alert(
              "Permission Denied", 
              "You don't have permission to take pickups. Please contact support."
            );
          }
          return;
        }
        
        if (pickupError.code === "23505") {
          if (isMounted.current) {
            Alert.alert("Already Taken", "This pickup has already been taken by another driver.");
          }
          await fetchAllData(currentDriverId);
          return;
        }
        throw pickupError;
      }

      // Update order item status
      const { error: orderItemError } = await supabase
        .from("order_items")
        .update({
          status: "collected",
        })
        .eq("id", orderItemId);

      if (orderItemError) throw orderItemError;

      // Success - automatically navigate to pickup tracking
      const pickupItem = pickups.find(p => p.order_item_id === orderItemId);
      if (pickup && pickupItem && isMounted.current) {
        router.push({
          pathname: "/pickup/[id]",
          params: {
            id: pickup.id,
            orderId: orderId,
            customerName: customerName,
            customerContact: pickupItem.customer_contact,
            pickupLocation: pickupItem.pickup_location,
            pickupLat: pickupItem.pickup_latitude.toString(),
            pickupLng: pickupItem.pickup_longitude.toString(),
            specialInstructions: pickupItem.special_instructions || "",
          }
        });
      }

      await fetchAllData(currentDriverId);
      
    } catch (error: any) {
      console.error("Error taking pickup:", error);
      
      if (isMounted.current) {
        if (error.code === "42501") {
          Alert.alert(
            "Security Policy", 
            "Unable to take pickup due to security restrictions."
          );
        } else {
          Alert.alert("Error", error.message || "Failed to take pickup");
        }
      }
    } finally {
      if (isMounted.current) {
        setTakingPickupId(null);
      }
    }
  };

  const continueActivePickup = () => {
    if (activePickup?.pickup_id && isMounted.current) {
      router.push({
        pathname: "/pickup/[id]",
        params: {
          id: activePickup.pickup_id,
          orderId: activePickup.order_id,
          customerName: activePickup.customer_name,
          customerContact: activePickup.customer_contact,
          pickupLocation: activePickup.pickup_location,
          pickupLat: activePickup.pickup_latitude.toString(),
          pickupLng: activePickup.pickup_longitude.toString(),
          specialInstructions: activePickup.special_instructions || "",
        }
      });
    }
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    if (!currentDriverId || !isMounted.current) return;
    
    if (isMounted.current) {
      setRefreshing(true);
    }
    await fetchAllData(currentDriverId);
  }, [fetchAllData, currentDriverId]);

  // Real-time updates for pickups
  useEffect(() => {
    if (!currentDriverId) return;

    const subscription = supabase
      .channel("pickup_items_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: "status=eq.waiting_for_pickup",
        },
        () => fetchAllData(currentDriverId)
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAllData, currentDriverId]);

  // Initial data fetch
  useEffect(() => {
    isMounted.current = true;
    initializeApp();

    return () => {
      isMounted.current = false;
    };
  }, [initializeApp]);

  // Location tracking
  useEffect(() => {
    let locationMounted = true;
    let watchId: Location.LocationSubscription | null = null;

    const setupLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || !locationMounted) return;

        let location = await Location.getCurrentPositionAsync({});
        if (locationMounted && isMounted.current) {
          setCurrentLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
        }

        watchId = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (loc) => {
            if (locationMounted && isMounted.current) {
              setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            }
          }
        );
      } catch (error) {
        console.error("Location error:", error);
      }
    };

    setupLocation();

    return () => {
      locationMounted = false;
      if (watchId) {
        watchId.remove();
      }
    };
  }, []);

  // Show authentication loading
  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#3864C3" />
        <Text style={{ marginTop: 10, color: "#3864C3", fontSize: moderateScale(16) }}>
          Loading user information...
        </Text>
      </SafeAreaView>
    );
  }

  // Show authentication error
  if (authError) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="warning-outline" size={48} color="#ff6b35" />
        <Text style={styles.errorTitle}>Authentication Error</Text>
        <Text style={styles.errorText}>{authError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={initializeApp}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#3864C3" />
        <Text style={{ marginTop: 10, color: "#3864C3", fontSize: moderateScale(16) }}>Loading pickups...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={[styles.container]}>
        <AppHeader 
          title={`PICKUPS (${pickups.length})`}
          rightElement={
            <TouchableOpacity 
              onPress={() => currentDriverId && fetchAllData(currentDriverId)} 
              style={styles.refreshButton}
            >
              <Ionicons name="refresh" size={24} color="white" />
            </TouchableOpacity>
          }
        />

        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: verticalScale(100) }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3864C3"]}
              tintColor="#3864C3"
            />
          }
        >
          {/* Active Pickup Section */}
          {activePickup && (
            <View style={styles.activePickupContainer}>
              <View style={styles.activePickupHeader}>
                <Ionicons name="bag-handle" size={24} color="#FF6B35" />
                <Text style={styles.activePickupTitle}>Active Pickup</Text>
                <View style={styles.activePickupBadge}>
                  <Text style={styles.activePickupBadgeText}>IN PROGRESS</Text>
                </View>
              </View>
              
              <View style={styles.activePickupContent}>
                <Text style={styles.activePickupCustomer}>{activePickup.customer_name}</Text>
                <Text style={styles.activePickupAddress}>{activePickup.pickup_location}</Text>
                <View style={styles.activePickupDetails}>
                  <Text style={styles.activePickupDetail}>Status: Collecting Laundry</Text>
                  <Text style={styles.activePickupDetail}>Contact: {activePickup.customer_contact}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.continueButton}
                onPress={continueActivePickup}
              >
                <Ionicons name="play-circle" size={20} color="white" />
                <Text style={styles.continueButtonText}>CONTINUE PICKUP</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>
              You are assigned to {pickups[0]?.branch_name || "Main Branch Hangyu Laundry Shop"}
            </Text>
            <Text style={styles.infoDesc}>Address: {pickups[0]?.branch_address || "Santa Rosa Street"}</Text>
            <Text style={styles.infoDesc}>
              {activePickup 
                ? "You have an active pickup. Complete it to take new orders." 
                : `Available Pickups: ${pickups.length}`
              }
            </Text>
            <Text style={[styles.infoDesc, { fontSize: moderateScale(12), color: "#666" }]}>
              {activePickup 
                ? "One assignment at a time - complete your current pickup first"
                : "Collect laundry from customers and bring to shop"
              }
            </Text>
          </View>

          {pickups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bag-check-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateTitle}>
                {activePickup ? "Complete your current assignment first" : "No pickups available"}
              </Text>
              <Text style={styles.emptyStateText}>
                {activePickup 
                  ? "You can only handle one assignment at a time.\nComplete your current pickup to see new orders."
                  : "All current pickups have been assigned.\nCheck back later for new orders."
                }
              </Text>
              <TouchableOpacity 
                style={styles.refreshLargeButton} 
                onPress={() => currentDriverId && fetchAllData(currentDriverId)}
              >
                <Text style={styles.refreshLargeText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            pickups.map((item) => (
              <TouchableOpacity
                key={item.order_item_id}
                style={[
                  styles.card,
                  takingPickupId === item.order_item_id && styles.cardDisabled,
                  activePickup && styles.cardDisabled
                ]}
                onPress={() => showMapPreview(item)}
                disabled={takingPickupId === item.order_item_id || activePickup !== null}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    {/* Pickup Badge */}
                    <View style={styles.pickupBadge}>
                      <Text style={styles.pickupBadgeText}>🔄 LAUNDRY PICKUP</Text>
                    </View>
                    
                    <Text style={styles.cardTitle}>For: {item.customer_name}</Text>
                    <Text style={styles.cardText}>{item.pickup_location}</Text>
                    
                    <View style={styles.contactRow}>
                      <Ionicons name="scale-outline" size={16} color="#000" />
                      <Text style={styles.contactText}>Weight: To be determined at shop</Text>
                    </View>
                    
                    <View style={styles.contactRow}>
                      <Ionicons name="call-outline" size={16} color="#000" />
                      <Text style={styles.contactText}>{item.customer_contact}</Text>
                    </View>
                    
                    {item.special_instructions && (
                      <View style={styles.contactRow}>
                        <Ionicons name="information-circle" size={16} color="#FF6B35" />
                        <Text style={[styles.contactText, { color: "#FF6B35", fontSize: moderateScale(11) }]}>
                          {item.special_instructions}
                        </Text>
                      </View>
                    )}
                    
                    <View style={styles.contactRow}>
                      <Ionicons name="time-outline" size={14} color="#666" />
                      <Text style={[styles.contactText, { color: "#666", fontSize: moderateScale(11) }]}>
                        Requested: {new Date(item.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    
                    {activePickup && (
                      <View style={styles.oneAtATimeWarning}>
                        <Ionicons name="warning" size={14} color="#ff6b35" />
                        <Text style={styles.oneAtATimeText}>Complete current pickup first</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ alignItems: "center" }}>
                    <TouchableOpacity
                      style={[
                        styles.takeButton,
                        { 
                          backgroundColor: takingPickupId === item.order_item_id 
                            ? "#ccc" 
                            : activePickup 
                            ? "#6c757d" 
                            : "#FF6B35" 
                        },
                      ]}
                      onPress={() => showMapPreview(item)}
                      disabled={takingPickupId === item.order_item_id || activePickup !== null}
                    >
                      <Text style={styles.takeButtonText}>
                        {activePickup ? "UNAVAILABLE" : "VIEW ROUTE"}
                      </Text>
                    </TouchableOpacity>
                    <MiniMap 
                      destination={{ lat: item.pickup_latitude, lng: item.pickup_longitude }} 
                      orderItemId={item.order_item_id}
                      currentLocation={currentLocation}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Confirmation Modal */}
        <Modal
          visible={confirmationModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={hideConfirmation}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="bag-handle" size={32} color="#FF6B35" />
                <Text style={styles.modalTitle}>Start Pickup?</Text>
              </View>
              
              <Text style={styles.modalMessage}>
                Are you ready to collect laundry from this customer?
              </Text>

              <Text style={styles.pickupDetails}>
                Customer: {confirmationModal.customerName}
              </Text>

              <View style={[
                styles.pickupBadge,
                { marginBottom: verticalScale(20), alignSelf: 'center' }
              ]}>
                <Text style={styles.pickupBadgeText}>🔄 LAUNDRY PICKUP</Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={hideConfirmation}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={() => takePickup(
                    confirmationModal.orderItemId, 
                    confirmationModal.orderId, 
                    confirmationModal.customerName
                  )}
                >
                  <Text style={styles.confirmButtonText}>Start Pickup</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#FFFFFF" 
  },
  // Error boundary styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
    backgroundColor: '#FFFFFF',
  },
  errorTitle: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: '#333',
    marginTop: verticalScale(16),
    marginBottom: verticalScale(8),
  },
  errorText: {
    fontSize: moderateScale(14),
    color: '#666',
    textAlign: 'center',
    lineHeight: moderateScale(20),
    marginBottom: verticalScale(20),
  },
  retryButton: {
    backgroundColor: '#3864C3',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(12),
    borderRadius: scale(8),
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: moderateScale(14),
  },
  // Refresh button style
  refreshButton: {
    zIndex: 3,
  },
  // Active Pickup Styles
  activePickupContainer: {
    backgroundColor: '#fff3e0',
    margin: scale(10),
    padding: scale(16),
    borderRadius: scale(12),
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activePickupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  activePickupTitle: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#FF6B35',
    marginLeft: scale(8),
    flex: 1,
  },
  activePickupBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(12),
  },
  activePickupBadgeText: {
    color: 'white',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  activePickupContent: {
    marginBottom: verticalScale(12),
  },
  activePickupCustomer: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: verticalScale(4),
  },
  activePickupAddress: {
    fontSize: moderateScale(14),
    color: '#666',
    marginBottom: verticalScale(8),
  },
  activePickupDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activePickupDetail: {
    fontSize: moderateScale(12),
    color: '#888',
  },
  continueButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(10),
    borderRadius: scale(8),
    gap: scale(8),
  },
  continueButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: moderateScale(12),
  },
  // Pickup Badge
  pickupBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF6B35',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(6),
    marginBottom: verticalScale(8),
  },
  pickupBadgeText: {
    color: 'white',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  // One at a time warning
  oneAtATimeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: scale(8),
    borderRadius: scale(6),
    marginTop: verticalScale(8),
  },
  oneAtATimeText: {
    fontSize: moderateScale(10),
    color: '#856404',
    marginLeft: scale(4),
    fontWeight: '500',
  },
  // Map Styles
  mapContainer: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  mapPlaceholder: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(10),
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholderText: { 
    fontSize: moderateScale(8), 
    color: "#888", 
    marginTop: 5, 
    textAlign: 'center' 
  },
  mapLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
  },
  mapLoadingText: {
    fontSize: moderateScale(10),
    color: '#3864C3',
    marginTop: 5,
  },
  // Rest of the styles
  infoBox: {
    backgroundColor: "#D4F6F9",
    padding: scale(20),
    margin: scale(10),
    borderRadius: scale(12),
  },
  infoTitle: { fontSize: moderateScale(16), fontWeight: "bold", color: "#000", marginBottom: verticalScale(4) },
  infoDesc: { fontSize: moderateScale(13), color: "#333", marginTop: verticalScale(2) },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: scale(15),
    padding: scale(16),
    marginHorizontal: scale(20),
    marginVertical: verticalScale(10),
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardTitle: { fontSize: moderateScale(14.5), fontWeight: "bold", color: "#000", marginBottom: 6 },
  cardText: { fontSize: moderateScale(12.5), color: "#333", marginBottom: 4 },
  contactRow: { flexDirection: "row", alignItems: "center", marginVertical: 2 },
  contactText: { fontSize: moderateScale(12.5), marginLeft: 6, color: "#000" },
  takeButton: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: scale(8),
    marginBottom: verticalScale(8),
    minWidth: scale(100),
    alignItems: "center",
  },
  takeButtonText: { 
    color: "white", 
    fontWeight: "bold", 
    fontSize: moderateScale(12) 
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: verticalScale(40),
    marginHorizontal: scale(20),
  },
  emptyStateTitle: {
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    fontSize: moderateScale(16),
    fontWeight: 'bold',
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
    lineHeight: moderateScale(18),
  },
  refreshLargeButton: {
    backgroundColor: '#3864C3',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    borderRadius: scale(8),
    marginTop: verticalScale(20),
  },
  refreshLargeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: moderateScale(14),
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: scale(16),
    padding: scale(24),
    width: '100%',
    maxWidth: scale(320),
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: 'bold',
    color: '#333',
    marginTop: verticalScale(8),
  },
  modalMessage: {
    fontSize: moderateScale(16),
    color: '#666',
    textAlign: 'center',
    lineHeight: moderateScale(22),
    marginBottom: verticalScale(12),
  },
  pickupDetails: {
    fontSize: moderateScale(14),
    color: '#FF6B35',
    fontWeight: '600',
    marginBottom: verticalScale(12),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: scale(12),
  },
  modalButton: {
    flex: 1,
    paddingVertical: verticalScale(12),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  confirmButton: {
    backgroundColor: '#FF6B35',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
});