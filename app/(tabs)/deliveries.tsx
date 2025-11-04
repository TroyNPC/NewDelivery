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
import Svg, { Path } from "react-native-svg";
import { WebView } from "react-native-webview";

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
};

const webViewCache = new Map<string, string>();

// Create a separate component for the mini map to use hooks properly
const MiniMap = ({ 
  destination, 
  orderItemId, 
  currentLocation,
  visibleItems 
}: { 
  destination: { lat: number; lng: number };
  orderItemId: string;
  currentLocation: { lat: number; lng: number } | null;
  visibleItems: Set<string>;
}) => {
  const [webViewError, setWebViewError] = useState(false);

  const getCachedMapHTML = useCallback(
    (dest: { lat: number; lng: number }) => {
      if (!currentLocation) return "";

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
              html, body, #map { height: 100%; margin: 0; padding: 0; }
              .leaflet-routing-container { display: none; }
            </style>
          </head>
          <body>
            <div id="map"></div>
            <script>
              var map = L.map('map').setView([${currentLocation.lat}, ${currentLocation.lng}], 14);
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
              }).addTo(map);
              L.Routing.control({
                waypoints: [
                  L.latLng(${currentLocation.lat}, ${currentLocation.lng}),
                  L.latLng(${dest.lat}, ${dest.lng})
                ],
                addWaypoints: false,
                draggableWaypoints: false,
                show: false,
                lineOptions: { styles: [{ color: '#3864C3', weight: 5 }] }
              }).addTo(map);
            </script>
          </body>
        </html>
      `;
      webViewCache.set(cacheKey, mapHTML);
      return mapHTML;
    },
    [currentLocation]
  );

  if (webViewError || !currentLocation) {
    return (
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={20} color="#888" />
        <Text style={styles.mapPlaceholderText}>Map view</Text>
      </View>
    );
  }

  if (!visibleItems.has(orderItemId)) {
    return (
      <View style={styles.mapPlaceholder}>
        <ActivityIndicator size="small" color="#3864C3" />
        <Text style={styles.mapPlaceholderText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: getCachedMapHTML(destination) }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scrollEnabled={false}
        overScrollMode="never"
        androidLayerType="software"
        style={{ flex: 1, backgroundColor: "#f0f0f0" }}
        renderLoading={() => (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f0f0f0" }}>
            <ActivityIndicator size="small" color="#3864C3" />
          </View>
        )}
        onError={() => setWebViewError(true)}
        onHttpError={() => setWebViewError(true)}
      />
    </View>
  );
};

export default function LaundryInfo() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentDriverId] = useState<string>("e303e1db-c147-4ac0-afcd-0d48304f281e");
  const [takingDeliveryId, setTakingDeliveryId] = useState<string | null>(null);
  const [driverBranchId, setDriverBranchId] = useState<string | null>(null);

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

  // Get driver's assigned branch
  const getDriverBranch = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shop_user_assignments")
        .select("branch_id")
        .eq("user_id", currentDriverId)
        .eq("role_in_shop", "delivery")
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data?.branch_id;
    } catch (error) {
      console.error("Error fetching driver branch:", error);
      return null;
    }
  }, [currentDriverId]);

  // Fetch active delivery for this driver
  const fetchActiveDelivery = useCallback(async () => {
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
            order_items (
              id,
              quantity,
              price_per_unit,
              started_at
            )
          )
        `)
        .eq("driver_id", currentDriverId)
        .in("status", ["assigned", "in_progress", "picked_up"])
        .order("assigned_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No active delivery found
          setActiveDelivery(null);
          return;
        }
        throw error;
      }

      if (data) {
        const orderItem = data.orders?.order_items?.[0];
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
          driver_id: currentDriverId,
          delivery_status: data.status,
          started_at: orderItem?.started_at || new Date().toISOString(),
        };
        setActiveDelivery(active);
      } else {
        setActiveDelivery(null);
      }
    } catch (error) {
      console.error("Error fetching active delivery:", error);
      setActiveDelivery(null);
    }
  }, [currentDriverId]);

  // Memoize fetchDeliveries to prevent infinite re-renders
  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);

      // First, get the driver's branch
      const branchId = await getDriverBranch();
      if (!branchId) {
        Alert.alert("Error", "No branch assigned to this driver");
        setDeliveries([]);
        return;
      }

      setDriverBranchId(branchId);

      // Query order_items directly and join with orders
      const { data, error } = await supabase
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
            shop_branches!inner (
              name,
              address,
              latitude,
              longitude
            ),
            deliveries!left (
              driver_id,
              status
            )
          )
        `)
        .eq("status", "ready_for_delivery")
        .eq("orders.branch_id", branchId)
        .is("orders.deliveries.driver_id", null)
        .order("started_at", { ascending: true });

      if (error) throw error;

      const transformedDeliveries: Delivery[] = (data || []).map((item: any) => {
      const quantity = item.quantity ? Number(item.quantity) : 0;
      const pricePerUnit = item.price_per_unit ? Number(item.price_per_unit) : 0;
        
        return {
          order_item_id: item.id || "",
          order_item_status: item.status || "ready_for_delivery",
          order_id: item.order_id || "",
          customer_name: item.orders?.customer_name || "Unknown Customer",
          customer_contact: item.orders?.customer_contact || "No contact",
          delivery_location: item.orders?.delivery_location || "Address not provided",
          delivery_latitude: item.orders?.delivery_latitude || 0,
          delivery_longitude: item.orders?.delivery_longitude || 0,
          weight: quantity.toString() || "0",
          total_amount: (quantity * pricePerUnit).toFixed(2),
          branch_name: item.orders?.shop_branches?.name || "Unknown Branch",
          branch_address: item.orders?.shop_branches?.address || "Address not available",
          branch_lat: item.orders?.shop_branches?.latitude || 0,
          branch_lng: item.orders?.shop_branches?.longitude || 0,
          driver_id: item.orders?.deliveries?.[0]?.driver_id || null,
          delivery_status: item.orders?.deliveries?.[0]?.status || null,
          started_at: item.started_at || new Date().toISOString(),
        };
      });

      setDeliveries(transformedDeliveries);
    } catch (error: any) {
      console.error("Error fetching deliveries:", error);
      
      // Fallback approach if the first query fails
      try {
        console.log("Trying fallback query...");
        const branchId = await getDriverBranch();
        if (!branchId) return;

        const { data, error: fallbackError } = await supabase
          .from("orders")
          .select(`
            id,
            customer_name,
            customer_contact,
            delivery_location,
            delivery_latitude,
            delivery_longitude,
            branch_id,
            shop_branches!inner (
              name,
              address,
              latitude,
              longitude
            ),
            order_items!inner (
              id,
              status,
              quantity,
              price_per_unit,
              started_at
            ),
            deliveries!left (
              driver_id,
              status
            )
          `)
          .eq("branch_id", branchId)
          .eq("order_items.status", "ready_for_delivery")
          .is("deliveries.driver_id", null);

        if (fallbackError) throw fallbackError;

        const fallbackDeliveries: Delivery[] = (data || []).map((item: any) => {
          const orderItem = item.order_items?.[0];
          const quantity = orderItem?.quantity ? Number(orderItem.quantity) : 0;
          const pricePerUnit = orderItem?.price_per_unit ? Number(orderItem.price_per_unit) : 0;
          
          return {
            order_item_id: orderItem?.id || "",
            order_item_status: orderItem?.status || "ready_for_delivery",
            order_id: item.id || "",
            customer_name: item.customer_name || "Unknown Customer",
            customer_contact: item.customer_contact || "No contact",
            delivery_location: item.delivery_location || "Address not provided",
            delivery_latitude: item.delivery_latitude || 0,
            delivery_longitude: item.delivery_longitude || 0,
            weight: quantity.toString() || "0",
            total_amount: (quantity * pricePerUnit).toFixed(2),
            branch_name: item.shop_branches?.name || "Unknown Branch",
            branch_address: item.shop_branches?.address || "Address not available",
            branch_lat: item.shop_branches?.latitude || 0,
            branch_lng: item.shop_branches?.longitude || 0,
            driver_id: item.deliveries?.[0]?.driver_id || null,
            delivery_status: item.deliveries?.[0]?.status || null,
            started_at: orderItem?.started_at || new Date().toISOString(),
          };
        });

        // Manual sorting by started_at
        fallbackDeliveries.sort((a, b) => 
          new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
        );

        setDeliveries(fallbackDeliveries);
      } catch (fallbackError: any) {
        Alert.alert("Error", fallbackError.message || "Failed to load deliveries");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDriverBranch]);

  // Combined fetch function
  const fetchAllData = useCallback(async () => {
    await Promise.all([
      fetchDeliveries(),
      fetchActiveDelivery()
    ]);
  }, [fetchDeliveries, fetchActiveDelivery]);

  // Navigate to map preview screen
  const showMapPreview = (delivery: Delivery) => {
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
        weight: delivery.weight,
        total_amount: delivery.total_amount,
        branch_name: delivery.branch_name,
        branch_address: delivery.branch_address,
        order_id: delivery.order_id,
      }
    });
  };

  // Show confirmation modal (after map preview)
  const showConfirmation = (orderItemId: string, orderId: string, customerName: string) => {
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

    setConfirmationModal({
      visible: true,
      orderItemId,
      orderId,
      customerName,
    });
  };

  const hideConfirmation = () => {
    setConfirmationModal({
      visible: false,
      orderItemId: "",
      orderId: "",
      customerName: "",
    });
  };

  const takeDelivery = async (orderItemId: string, orderId: string, customerName: string) => {
    try {
      setTakingDeliveryId(orderItemId);
      hideConfirmation();

      // Double-check if driver already has an active delivery
      const { data: existingActiveDelivery, error: activeCheckError } = await supabase
        .from("deliveries")
        .select("id")
        .eq("driver_id", currentDriverId)
        .in("status", ["assigned", "in_progress", "picked_up"])
        .maybeSingle();

      if (activeCheckError) throw activeCheckError;

      if (existingActiveDelivery) {
        Alert.alert(
          "Already Have Active Delivery",
          "You already have an active delivery. Please complete it before taking a new one.",
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
        await fetchAllData();
        return;
      }

      // First, check if delivery already exists to avoid race conditions
      const { data: existingDelivery, error: checkError } = await supabase
        .from("deliveries")
        .select("id, driver_id")
        .eq("order_id", orderId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingDelivery) {
        if (existingDelivery.driver_id === currentDriverId) {
          Alert.alert("Already Taken", "You have already taken this delivery.");
        } else {
          Alert.alert("Already Taken", "This delivery has already been taken by another driver.");
        }
        await fetchAllData();
        return;
      }

      // Insert the delivery record
      const { data: delivery, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          order_id: orderId,
          driver_id: currentDriverId,
          status: "in_progress",
          assigned_at: new Date().toISOString(),
          picked_up_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (deliveryError) {
        if (deliveryError.code === "42501") {
          Alert.alert(
            "Permission Denied", 
            "You don't have permission to take deliveries. Please contact support."
          );
          return;
        }
        
        if (deliveryError.code === "23505") {
          Alert.alert("Already Taken", "This delivery has already been taken by another driver.");
          await fetchAllData();
          return;
        }
        throw deliveryError;
      }

      // Update order item status
      const { error: orderItemError } = await supabase
        .from("order_items")
        .update({
          status: "out_for_delivery",
        })
        .eq("id", orderItemId);

      if (orderItemError) throw orderItemError;

      // Success - automatically navigate to delivery tracking
      const deliveryItem = deliveries.find(d => d.order_item_id === orderItemId);
      if (delivery && deliveryItem) {
        router.push({
          pathname: "/delivery/[id]",
          params: {
            id: delivery.id,
            orderId: orderId,
            customerName: customerName,
            customerContact: deliveryItem.customer_contact,
            deliveryLocation: deliveryItem.delivery_location,
            deliveryLat: deliveryItem.delivery_latitude.toString(),
            deliveryLng: deliveryItem.delivery_longitude.toString(),
          }
        });
      }

      await fetchAllData();
      
    } catch (error: any) {
      console.error("Error taking delivery:", error);
      
      if (error.code === "42501") {
        Alert.alert(
          "Security Policy", 
          "Unable to take delivery due to security restrictions."
        );
      } else {
        Alert.alert("Error", error.message || "Failed to take delivery");
      }
    } finally {
      setTakingDeliveryId(null);
    }
  };

  const continueActiveDelivery = () => {
    if (activeDelivery?.delivery_id) {
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
        }
      });
    }
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData();
  }, [fetchAllData]);

  // Fixed useEffect with proper cleanup
  useEffect(() => {
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
        () => fetchAllData()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAllData]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Fixed location tracking with proper cleanup
  useEffect(() => {
    let isMounted = true;
    let watchId: Location.LocationSubscription | null = null;

    const setupLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || !isMounted) return;

        let location = await Location.getCurrentPositionAsync({});
        if (isMounted) {
          setCurrentLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
        }

        watchId = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (loc) => {
            if (isMounted) {
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
      isMounted = false;
      if (watchId) {
        watchId.remove();
      }
    };
  }, []);

  const handleScroll = useCallback(() => {
    setVisibleItems(new Set(deliveries.map((d) => d.order_item_id)));
  }, [deliveries]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#3864C3" />
        <Text style={{ marginTop: 10, color: "#3864C3", fontSize: moderateScale(16) }}>Loading deliveries...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container]}>
      {/* Header matching the map screen style */}
      <View style={styles.headerBox}>
        <Svg width="100%" height={verticalScale(90)} viewBox="0 0 1440 320" style={styles.waveTop} preserveAspectRatio="none">
          <Path fill="#3864C3" d="M0,64 C720,-32 720,160 1440,64 L1440,0 L0,0 Z" />
        </Svg>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>DELIVERIES ({deliveries.length})</Text>
          <TouchableOpacity onPress={fetchAllData} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: verticalScale(100) }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
        {/* Active Delivery Section */}
        {activeDelivery && (
          <View style={styles.activeDeliveryContainer}>
            <View style={styles.activeDeliveryHeader}>
              <Ionicons name="navigate-circle" size={24} color="#28a745" />
              <Text style={styles.activeDeliveryTitle}>Active Delivery</Text>
              <View style={styles.activeDeliveryBadge}>
                <Text style={styles.activeDeliveryBadgeText}>IN PROGRESS</Text>
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
              : "Tap 'VIEW ROUTE' to see delivery details and map"
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
            <TouchableOpacity style={styles.refreshLargeButton} onPress={fetchAllData}>
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
                activeDelivery && styles.cardDisabled // Disable all cards if there's an active delivery
              ]}
              onPress={() => showMapPreview(item)}
              disabled={takingDeliveryId === item.order_item_id || activeDelivery !== null}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
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
                    visibleItems={visibleItems}
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
              <Ionicons name="car-sport" size={32} color="#3864C3" />
              <Text style={styles.modalTitle}>Start Delivery?</Text>
            </View>
            
            <Text style={styles.modalMessage}>
              Are you sure you want to start this delivery now?
            </Text>

            <Text style={styles.deliveryDetails}>
              Customer: {confirmationModal.customerName}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={hideConfirmation}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => takeDelivery(
                  confirmationModal.orderItemId, 
                  confirmationModal.orderId, 
                  confirmationModal.customerName
                )}
              >
                <Text style={styles.confirmButtonText}>Start Delivery</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#FFFFFF" 
  },
  // Header styles matching the map screen
  headerBox: {
    width: '100%',
    height: verticalScale(90),
    backgroundColor: '#0AADFF',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  waveTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    zIndex: 2,
    width: '100%',
    marginTop: verticalScale(30),
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  refreshButton: {
    marginLeft: 'auto',
    zIndex: 3,
  },
  // Active Delivery Styles
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
    backgroundColor: '#28a745',
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
  // Rest of the styles remain the same
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
  mapPlaceholderText: { fontSize: moderateScale(8), color: "#888", marginTop: 5, textAlign: 'center' },
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
  deliveryDetails: {
    fontSize: moderateScale(14),
    color: '#3864C3',
    fontWeight: '600',
    marginBottom: verticalScale(20),
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
    backgroundColor: '#28a745',
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