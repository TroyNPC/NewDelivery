import { supabase } from "@/hooks/supabaseClient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { WebView } from "react-native-webview";
import { AppHeader } from "../component/AppHeader";

type Delivery = {
  order_item_id: string;
  order_item_status: string;
  order_id: string;
  customer_name: string;
  customer_contact: string;
  delivery_location: string;
  delivery_latitude: number;
  delivery_longitude: number;
  weight: string;
  total_amount: string;
  branch_name: string;
  branch_address: string;
  branch_lat: number;
  branch_lng: number;
  driver_id: string | null;
  delivery_status: string | null;
  started_at: string;
  delivery_id?: string;
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
                  .bindPopup('Delivery Location');
                
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

export default function LaundryInfo() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const isMounted = useRef(true);
  
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [takingDeliveryId, setTakingDeliveryId] = useState<string | null>(null);
  const [driverBranchId, setDriverBranchId] = useState<string | null>(null);
  
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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

  // Fetch active delivery for this driver
  const fetchActiveDelivery = useCallback(async (driverId: string) => {
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
            method_id,
            shop_methods (
              code,
              label
            ),
            order_items (
              id,
              quantity,
              price_per_unit,
              started_at
            )
          )
        `)
        .eq("driver_id", driverId)
        .in("status", ["assigned", "in_progress", "picked_up"])
        .order("assigned_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          if (isMounted.current) {
            setActiveDelivery(null);
          }
          return;
        }
        throw error;
      }

      if (data && isMounted.current) {
        const orderItem = Array.isArray(data.orders?.order_items) ? data.orders.order_items[0] : null;
        
        let method = null;
        if (data.orders?.shop_methods) {
          if (Array.isArray(data.orders.shop_methods) && data.orders.shop_methods.length > 0) {
            method = data.orders.shop_methods[0];
          } else if (typeof data.orders.shop_methods === 'object') {
            method = data.orders.shop_methods;
          }
        }
        
        const quantity = orderItem?.quantity ? Number(orderItem.quantity) : 0;
        const pricePerUnit = orderItem?.price_per_unit ? Number(orderItem.price_per_unit) : 0;
        
        const active: Delivery = {
          delivery_id: data.id,
          order_id: data.order_id || "",
          order_item_id: orderItem?.id || "",
          order_item_status: "out_for_delivery",
          customer_name: data.orders?.customer_name || "Unknown Customer",
          customer_contact: data.orders?.customer_contact || "No contact",
          delivery_location: data.orders?.delivery_location || "Address not provided",
          delivery_latitude: data.orders?.delivery_latitude || 0,
          delivery_longitude: data.orders?.delivery_longitude || 0,
          weight: quantity.toString() || "0",
          total_amount: (quantity * pricePerUnit).toFixed(2),
          branch_name: "",
          branch_address: "",
          branch_lat: 0,
          branch_lng: 0,
          driver_id: driverId,
          delivery_status: data.status,
          started_at: orderItem?.started_at || new Date().toISOString(),
          order_method: method?.code || "delivery",
          order_method_label: method?.label || "Delivery",
        };
        setActiveDelivery(active);
      } else if (isMounted.current) {
        setActiveDelivery(null);
      }
    } catch (error) {
      console.error("Error fetching active delivery:", error);
      if (isMounted.current) {
        setActiveDelivery(null);
      }
    }
  }, []);

  // Fixed fetchDeliveries function with correct table names
  const fetchDeliveries = useCallback(async (driverId: string) => {
    try {
      if (isMounted.current) {
        setLoading(true);
      }

      const branchId = await getDriverBranch(driverId);
      if (!branchId) {
        if (isMounted.current) {
          Alert.alert("Error", "No branch assigned to this driver");
          setDeliveries([]);
        }
        return;
      }

      if (isMounted.current) {
        setDriverBranchId(branchId);
      }

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

      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          id,
          status,
          quantity,
          price_per_unit,
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
            method_id,
            shop_methods (
              code,
              label
            )
          )
        `)
        .eq("status", "ready_for_delivery")
        .eq("orders.branch_id", branchId)
        .order("started_at", { ascending: true });

      if (itemsError) throw itemsError;

      if (!orderItems || orderItems.length === 0) {
        if (isMounted.current) {
          setDeliveries([]);
        }
        return;
      }

      const orderIds = orderItems.map(item => item.order_id).filter(Boolean);

      const { data: existingDeliveries, error: deliveriesError } = await supabase
        .from("deliveries")
        .select("order_id, driver_id")
        .in("order_id", orderIds)
        .not("driver_id", "is", null);

      if (deliveriesError) {
        console.error("Error checking existing deliveries:", deliveriesError);
      }

      const availableOrderItems = orderItems.filter(item => {
        const hasDelivery = existingDeliveries?.some(delivery => delivery.order_id === item.order_id);
        return !hasDelivery;
      });

      if (isMounted.current) {
        const transformedDeliveries: Delivery[] = availableOrderItems.map((item: any) => {
          const orderItem = item;
          const order = item.orders;
          
          let method = null;
          if (order?.shop_methods) {
            if (Array.isArray(order.shop_methods) && order.shop_methods.length > 0) {
              method = order.shop_methods[0];
            } else if (typeof order.shop_methods === 'object') {
              method = order.shop_methods;
            }
          }
          
          const quantity = orderItem.quantity ? Number(orderItem.quantity) : 0;
          const pricePerUnit = orderItem.price_per_unit ? Number(orderItem.price_per_unit) : 0;
          
          console.log(`Order ${orderItem.order_id} - Method:`, method);
          
          return {
            order_item_id: orderItem.id || "",
            order_item_status: orderItem.status || "ready_for_delivery",
            order_id: orderItem.order_id || "",
            customer_name: order?.customer_name || "Unknown Customer",
            customer_contact: order?.customer_contact || "No contact",
            delivery_location: order?.delivery_location || "Address not provided",
            delivery_latitude: order?.delivery_latitude || 0,
            delivery_longitude: order?.delivery_longitude || 0,
            weight: quantity.toString() || "0",
            total_amount: (quantity * pricePerUnit).toFixed(2),
            branch_name: branchName,
            branch_address: branchAddress,
            branch_lat: branchLat,
            branch_lng: branchLng,
            driver_id: null,
            delivery_status: null,
            started_at: orderItem.started_at || new Date().toISOString(),
            order_method: method?.code || "delivery",
            order_method_label: method?.label || "Delivery",
          };
        });

        setDeliveries(transformedDeliveries);
        
        console.log("All deliveries with order_method:", transformedDeliveries.map(d => ({
          order_id: d.order_id,
          order_method: d.order_method,
          order_method_label: d.order_method_label,
          customer_name: d.customer_name
        })));
      }
    } catch (error: any) {
      console.error("Error fetching deliveries:", error);
      
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

        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("id, customer_name, customer_contact, delivery_location, delivery_latitude, delivery_longitude, method_id")
          .eq("branch_id", branchId);

        if (ordersError) throw ordersError;

        if (!orders || orders.length === 0) {
          if (isMounted.current) {
            setDeliveries([]);
          }
          return;
        }

        // With:
        const methodIds = orders
          .map(order => order.method_id)
          .filter((id): id is string => id !== null && id !== undefined);

        // Then fetch shop methods
        const { data: shopMethods, error: methodsError } = await supabase
  .from("shop_methods")
  .select("id, code, label")
  .in("id", methodIds); // Now methodIds is properly typed as string[]

        const orderIds = orders.map(order => order.id).filter(Boolean);
        const { data: orderItems, error: itemsError } = await supabase
          .from("order_items")
          .select("id, status, quantity, price_per_unit, started_at, order_id")
          .in("order_id", orderIds)
          .eq("status", "ready_for_delivery")
          .order("started_at", { ascending: true });

        if (itemsError) throw itemsError;

        if (!orderItems || orderItems.length === 0) {
          if (isMounted.current) {
            setDeliveries([]);
          }
          return;
        }

        const { data: existingDeliveries } = await supabase
          .from("deliveries")
          .select("order_id")
          .in("order_id", orderIds)
          .not("driver_id", "is", null);

        const availableOrderItems = orderItems.filter(item => {
          const hasDelivery = existingDeliveries?.some(delivery => delivery.order_id === item.order_id);
          return !hasDelivery;
        });

        if (isMounted.current) {
          const fallbackDeliveries: Delivery[] = availableOrderItems.map((orderItem: any) => {
            const order = orders.find((o: any) => o.id === orderItem.order_id);
            const method = shopMethods?.find((m: any) => m.id === order?.method_id);
            
            const quantity = orderItem.quantity ? Number(orderItem.quantity) : 0;
            const pricePerUnit = orderItem.price_per_unit ? Number(orderItem.price_per_unit) : 0;
            
            return {
              order_item_id: orderItem.id || "",
              order_item_status: orderItem.status || "ready_for_delivery",
              order_id: orderItem.order_id || "",
              customer_name: order?.customer_name || "Unknown Customer",
              customer_contact: order?.customer_contact || "No contact",
              delivery_location: order?.delivery_location || "Address not provided",
              delivery_latitude: order?.delivery_latitude || 0,
              delivery_longitude: order?.delivery_longitude || 0,
              weight: quantity.toString() || "0",
              total_amount: (quantity * pricePerUnit).toFixed(2),
              branch_name: branchName,
              branch_address: branchAddress,
              branch_lat: 0,
              branch_lng: 0,
              driver_id: null,
              delivery_status: null,
              started_at: orderItem.started_at || new Date().toISOString(),
              order_method: method?.code || "delivery",
              order_method_label: method?.label || "Delivery",
            };
          });

          setDeliveries(fallbackDeliveries);
        }
      } catch (fallbackError: any) {
        console.error("Fallback error:", fallbackError);
        if (isMounted.current) {
          Alert.alert("Error", "Failed to load deliveries. Please try again.");
          setDeliveries([]);
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [getDriverBranch]);

  const fetchAllData = useCallback(async (driverId: string) => {
    await Promise.all([
      fetchDeliveries(driverId),
      fetchActiveDelivery(driverId)
    ]);
  }, [fetchDeliveries, fetchActiveDelivery]);

  const initializeApp = useCallback(async () => {
    try {
      if (isMounted.current) {
        setAuthLoading(true);
      }
      
      const user = await getCurrentUser();
      
      if (!user) {
        if (isMounted.current) {
          setAuthError("Please log in to access deliveries");
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

  // Navigate to map preview screen (like pickup flow)
  const showMapPreview = (delivery: Delivery) => {
    if (!currentDriverId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    // Check if driver already has an active delivery
    if (activeDelivery) {
      Alert.alert(
        "Already Have Active Delivery",
        "You can only handle one delivery at a time. Please complete your current delivery before taking a new one.",
        [
          {
            text: "Continue Current Delivery",
            onPress: continueActiveDelivery
          },
          {
            text: "OK",
            style: "cancel"
          }
        ]
      );
      return;
    }

    router.push({
      pathname: "/delivery/map-preview",
      params: {
        order_item_id: delivery.order_item_id,
        customer_name: delivery.customer_name,
        delivery_location: delivery.delivery_location,
        delivery_latitude: delivery.delivery_latitude.toString(),
        delivery_longitude: delivery.delivery_longitude.toString(),
        current_lat: currentLocation?.lat.toString() || "0",
        current_lng: currentLocation?.lng.toString() || "0",
        customer_contact: delivery.customer_contact,
        weight: delivery.weight,
        total_amount: delivery.total_amount,
        branch_name: delivery.branch_name,
        branch_address: delivery.branch_address,
        order_id: delivery.order_id,
        order_method: delivery.order_method || "delivery",
        order_method_label: delivery.order_method_label || "Delivery",
      }
    });
  };

  const continueActiveDelivery = () => {
    if (activeDelivery?.delivery_id && isMounted.current) {
      router.push({
        pathname: "/delivery/[id]",
        params: {
          id: activeDelivery.delivery_id,
          orderId: activeDelivery.order_id,
          customerName: activeDelivery.customer_name,
          customerContact: activeDelivery.customer_contact,
          deliveryLocation: activeDelivery.delivery_location,
          deliveryLat: activeDelivery.delivery_latitude.toString(),
          deliveryLng: activeDelivery.delivery_longitude.toString(),
          orderMethod: activeDelivery.order_method || "delivery",
        }
      });
    }
  };

  const onRefresh = useCallback(async () => {
    if (!currentDriverId || !isMounted.current) return;
    
    if (isMounted.current) {
      setRefreshing(true);
    }
    await fetchAllData(currentDriverId);
  }, [fetchAllData, currentDriverId]);

  useEffect(() => {
    if (!currentDriverId) return;

    const subscription = supabase
      .channel("order_items_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: "status=eq.ready_for_delivery",
        },
        () => fetchAllData(currentDriverId)
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAllData, currentDriverId]);

  useEffect(() => {
    isMounted.current = true;
    initializeApp();

    return () => {
      isMounted.current = false;
    };
  }, [initializeApp]);

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
        <Text style={{ marginTop: 10, color: "#3864C3", fontSize: moderateScale(16) }}>Loading deliveries...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={[styles.container]}>
        <AppHeader 
          title={`DELIVERIES (${deliveries.length})`}
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
          {activeDelivery && (
            <View style={styles.activeDeliveryContainer}>
              <View style={styles.activeDeliveryHeader}>
                <Ionicons name="navigate-circle" size={24} color="#28a745" />
                <Text style={styles.activeDeliveryTitle}>Active Delivery</Text>
                <View style={[
                  styles.activeDeliveryBadge,
                  activeDelivery.order_method === "pickup" ? styles.pickupBadge : styles.deliveryBadge
                ]}>
                  <Text style={styles.activeDeliveryBadgeText}>
                    {activeDelivery.order_method === "pickup" ? "🔄 PICKUP RETURN" : "📦 DELIVERY"}
                  </Text>
                </View>
              </View>
              
              <View style={styles.activeDeliveryContent}>
                <Text style={styles.activeDeliveryCustomer}>{activeDelivery.customer_name}</Text>
                <Text style={styles.activeDeliveryAddress}>{activeDelivery.delivery_location}</Text>
                <View style={styles.activeDeliveryDetails}>
                  <Text style={styles.activeDeliveryDetail}>Weight: {activeDelivery.weight} kg</Text>
                  <Text style={styles.activeDeliveryDetail}>Amount: ₱{activeDelivery.total_amount}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.continueButton}
                onPress={continueActiveDelivery}
              >
                <Ionicons name="play-circle" size={20} color="white" />
                <Text style={styles.continueButtonText}>CONTINUE DELIVERY</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>
              You are assigned to {deliveries[0]?.branch_name || "Main Branch Hangyu Laundry Shop"}
            </Text>
            <Text style={styles.infoDesc}>Address: {deliveries[0]?.branch_address || "Santa Rosa Street"}</Text>
            <Text style={styles.infoDesc}>
              {activeDelivery 
                ? "You have an active delivery. Complete it to take new orders." 
                : `Available Deliveries: ${deliveries.length}`
              }
            </Text>
            <Text style={[styles.infoDesc, { fontSize: moderateScale(12), color: "#666" }]}>
              {activeDelivery 
                ? "One delivery at a time - complete your current delivery first"
                : "Includes both new deliveries and pickup returns"
              }
            </Text>
          </View>

          {deliveries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle" size={48} color="#ccc" />
              <Text style={styles.emptyStateTitle}>
                {activeDelivery ? "Complete your current delivery first" : "No deliveries available"}
              </Text>
              <Text style={styles.emptyStateText}>
                {activeDelivery 
                  ? "You can only handle one delivery at a time.\nComplete your current delivery to see new orders."
                  : "All current deliveries have been assigned.\nCheck back later for new orders."
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
            deliveries.map((item) => (
              <TouchableOpacity
                key={item.order_item_id}
                style={[
                  styles.card,
                  takingDeliveryId === item.order_item_id && styles.cardDisabled,
                  activeDelivery && styles.cardDisabled
                ]}
                onPress={() => showMapPreview(item)}
                disabled={takingDeliveryId === item.order_item_id || activeDelivery !== null}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <View style={[
                      styles.orderMethodBadge,
                      item.order_method === "pickup" ? styles.pickupBadge : styles.deliveryBadge
                    ]}>
                      <Text style={styles.orderMethodBadgeText}>
                        {item.order_method === "pickup" ? "🔄 PICKUP RETURN" : "📦 DELIVERY"}
                      </Text>
                    </View>
                    
                    <Text style={styles.cardTitle}>For: {item.customer_name}</Text>
                    <Text style={styles.cardText}>{item.delivery_location}</Text>
                    <View style={styles.contactRow}>
                      <Ionicons name="scale-outline" size={16} color="#000" />
                      <Text style={styles.contactText}>{item.weight} kg</Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Ionicons name="cash-outline" size={16} color="#000" />
                      <Text style={styles.contactText}>₱{item.total_amount}</Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Ionicons name="call-outline" size={16} color="#000" />
                      <Text style={styles.contactText}>{item.customer_contact}</Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Ionicons name="time-outline" size={14} color="#666" />
                      <Text style={[styles.contactText, { color: "#666", fontSize: moderateScale(11) }]}>
                        Ready: {new Date(item.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {activeDelivery && (
                      <View style={styles.oneAtATimeWarning}>
                        <Ionicons name="warning" size={14} color="#ff6b35" />
                        <Text style={styles.oneAtATimeText}>Complete current delivery first</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ alignItems: "center" }}>
                    <TouchableOpacity
                      style={[
                        styles.takeButton,
                        { 
                          backgroundColor: takingDeliveryId === item.order_item_id 
                            ? "#ccc" 
                            : activeDelivery 
                            ? "#6c757d" 
                            : "#28a745" 
                        },
                      ]}
                      onPress={() => showMapPreview(item)}
                      disabled={takingDeliveryId === item.order_item_id || activeDelivery !== null}
                    >
                      <Text style={styles.takeButtonText}>
                        {activeDelivery ? "UNAVAILABLE" : "VIEW ROUTE"}
                      </Text>
                    </TouchableOpacity>
                    <MiniMap 
                      destination={{ lat: item.delivery_latitude, lng: item.delivery_longitude }} 
                      orderItemId={item.order_item_id}
                      currentLocation={currentLocation}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#FFFFFF" 
  },
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
  refreshButton: {
    zIndex: 3,
  },
  activeDeliveryContainer: {
    backgroundColor: '#f0f9f0',
    margin: scale(10),
    padding: scale(16),
    borderRadius: scale(12),
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeDeliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  activeDeliveryTitle: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#28a745',
    marginLeft: scale(8),
    flex: 1,
  },
  activeDeliveryBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(12),
  },
  activeDeliveryBadgeText: {
    color: 'white',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  activeDeliveryContent: {
    marginBottom: verticalScale(12),
  },
  activeDeliveryCustomer: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: verticalScale(4),
  },
  activeDeliveryAddress: {
    fontSize: moderateScale(14),
    color: '#666',
    marginBottom: verticalScale(8),
  },
  activeDeliveryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activeDeliveryDetail: {
    fontSize: moderateScale(12),
    color: '#888',
  },
  continueButton: {
    backgroundColor: '#28a745',
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
  orderMethodBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(6),
    marginBottom: verticalScale(8),
  },
  deliveryBadge: {
    backgroundColor: '#3864C3',
  },
  pickupBadge: {
    backgroundColor: '#FF6B35',
  },
  orderMethodBadgeText: {
    color: 'white',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
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
});