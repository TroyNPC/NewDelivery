import { supabase } from "@/hooks/supabaseClient";
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

// Secure logging utility
const secureLog = {
  debug: (message: string, data?: any) => {
    if (__DEV__) {
      console.log(`[DEBUG] ${message}`, data);
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error?.message || error);
  },
  warn: (message: string, data?: any) => {
    if (__DEV__) {
      console.warn(`[WARN] ${message}`, data);
    }
  }
};

export default function PickupMapPreviewScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams();
  
  const { user, loading: authLoading } = useAuth();

  // Extract parameters
  const pickup = {
    order_item_id: params.order_item_id as string,
    order_id: params.order_id as string,
    customer_name: params.customer_name as string,
    customer_contact: params.customer_contact as string,
    pickup_location: params.pickup_location as string,
    pickup_latitude: parseFloat(params.pickup_latitude as string) || 0,
    pickup_longitude: parseFloat(params.pickup_longitude as string) || 0,
    current_lat: parseFloat(params.current_lat as string) || 0,
    current_lng: parseFloat(params.current_lng as string) || 0,
    branch_name: params.branch_name as string,
    branch_address: params.branch_address as string,
    special_instructions: params.special_instructions as string || "",
  };

  const [mapHTML, setMapHTML] = useState<string | null>(null);
  const [isTakingPickup, setIsTakingPickup] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const webViewRef = useRef<WebView>(null);

  // Notification service
  const sendCustomerNotification = async (
    customerId: string,
    notificationData: {
      title: string;
      body: string;
      payload: any;
    }
  ): Promise<{ databaseSuccess: boolean; pushSuccess: boolean }> => {
    try {
      if (!customerId) {
        return { databaseSuccess: false, pushSuccess: false };
      }

      const results = {
        databaseSuccess: false,
        pushSuccess: false
      };

      // Save to database
      try {
        const { error: dbError } = await supabase
          .from('notifications')
          .insert({
            user_id: customerId,
            title: notificationData.title,
            body: notificationData.body,
            payload: notificationData.payload,
            sent_at: new Date().toISOString()
          });

        if (!dbError) {
          results.databaseSuccess = true;
        }
      } catch (dbError) {
        secureLog.error('Database notification failed:', dbError);
      }

      // Send push notification
      try {
        const { data: pushTokens, error: tokenError } = await supabase
          .from('user_push_tokens')
          .select('expo_push_token')
          .eq('user_id', customerId)
          .not('expo_push_token', 'is', null);

        if (tokenError || !pushTokens || pushTokens.length === 0) {
          return results;
        }

        const pushPromises = pushTokens.map(async (token) => {
          const message = {
            to: token.expo_push_token,
            sound: 'default' as const,
            title: notificationData.title,
            body: notificationData.body,
            data: {
              ...notificationData.payload,
              type: 'order_update'
            }
          };

          try {
            const response = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(message),
            });

            const result = await response.json();
            return result.data?.status === 'ok';
          } catch (error) {
            return false;
          }
        });

        const pushResults = await Promise.all(pushPromises);
        results.pushSuccess = pushResults.some(success => success);

      } catch (pushError) {
        secureLog.error('Push notification error:', pushError);
      }

      return results;

    } catch (error) {
      secureLog.error('Notification service error:', error);
      return { databaseSuccess: false, pushSuccess: false };
    }
  };

  // Generate stable map HTML
  useEffect(() => {
    isMounted.current = true;

    const generateMapHTML = () => {
      if (!isMounted.current) return;

      try {
        setMapLoading(true);
        setMapError(null);

        const isValidCoordinate = (lat: number, lng: number): boolean => 
          !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

        if (!isValidCoordinate(pickup.current_lat, pickup.current_lng) || 
            !isValidCoordinate(pickup.pickup_latitude, pickup.pickup_longitude)) {
          throw new Error('Invalid coordinates for map generation');
        }

        const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body, #map { 
        height: 100%; 
        width: 100%;
        overflow: hidden;
      }
      .leaflet-routing-container { 
        display: none !important; 
      }
      .leaflet-control-container {
        display: block !important;
      }
      .pickup-marker {
        background: #FF6B35;
        border: 3px solid white;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      .user-marker {
        background: #007AFF;
        border: 3px solid white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      let map;
      
      function initializeMap() {
        try {
          map = L.map('map', {
            zoomControl: true,
            dragging: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            boxZoom: true,
            keyboard: true,
            tap: true
          }).setView([${pickup.current_lat}, ${pickup.current_lng}], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          const userIcon = L.divIcon({
            className: 'user-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          L.marker([${pickup.current_lat}, ${pickup.current_lng}], { 
            icon: userIcon
          }).addTo(map).bindPopup("Your Location");

          const pickupIcon = L.divIcon({
            className: 'pickup-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          
          L.marker([${pickup.pickup_latitude}, ${pickup.pickup_longitude}], { 
            icon: pickupIcon 
          }).addTo(map).bindPopup("Pickup Location");

          if (typeof L.Routing !== 'undefined') {
            L.Routing.control({
              waypoints: [
                L.latLng(${pickup.current_lat}, ${pickup.current_lng}),
                L.latLng(${pickup.pickup_latitude}, ${pickup.pickup_longitude})
              ],
              lineOptions: {
                styles: [{ color: '#FF6B35', weight: 6, opacity: 0.7 }]
              },
              addWaypoints: false,
              draggableWaypoints: false,
              fitSelectedRoutes: true,
              show: false,
              routeWhileDragging: false
            }).addTo(map);
          }

          setTimeout(() => {
            map.invalidateSize();
          }, 100);
          
        } catch (error) {
          console.error('Map initialization error:', error);
        }
      }

      document.addEventListener('DOMContentLoaded', initializeMap);
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMap);
      } else {
        initializeMap();
      }
    </script>
  </body>
</html>`;

        if (isMounted.current) {
          setMapHTML(html);
        }
      } catch (error: any) {
        secureLog.error('Map HTML generation error:', error);
        if (isMounted.current) {
          setMapError(error.message || 'Failed to generate map');
        }
      }
    };

    generateMapHTML();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle WebView load events
  const handleWebViewLoad = () => {
    if (isMounted.current) {
      setMapLoading(false);
    }
  };

  const handleWebViewError = (error: any) => {
    secureLog.error('WebView error:', error);
    if (isMounted.current) {
      setMapError('Failed to load map');
      setMapLoading(false);
    }
  };

  // Customer notification
  const notifyCustomerDriverAssigned = async (orderId: string): Promise<void> => {
    try {
      if (!user) return;

      // Get driver's name
      const { data: driverData } = await supabase
        .from('users')
        .select('full_name, phone')
        .eq('id', user.id)
        .single();

      let driverName = 'our driver';
      if (driverData?.full_name) {
        driverName = driverData.full_name.trim();
      } else {
        driverName = user.email?.split('@')[0] || 'our driver';
      }

      // Get order details
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          customer_id, 
          customer_name,
          shop_branches(name)
        `)
        .eq('id', orderId)
        .single();

      if (error || !order || !order.customer_id) {
        return;
      }

      const notificationTitle = 'Driver Coming for Pickup! 🚗';
      const notificationBody = `Driver ${driverName} is on the way to pick up your laundry`;

      await sendCustomerNotification(order.customer_id, {
        title: notificationTitle,
        body: notificationBody,
        payload: {
          order_id: orderId,
          order_status: 'out_for_pickup',
          delivery_status: 'driver_assigned',
          driver_name: driverName,
          driver_email: user.email,
          order_method: 'pickup',
          shop_name: order.shop_branches?.name,
          timestamp: new Date().toISOString(),
          type: 'pickup_driver_assigned'
        }
      });

    } catch (error) {
      secureLog.error('Error in notifyCustomerDriverAssigned:', error);
    }
  };

  const takePickup = async () => {
    try {
      setIsTakingPickup(true);

      // Check if user exists and has an ID
      if (!user?.id) {
        Alert.alert("Authentication Error", "Please log in to accept pickups.");
        return;
      }

      // Validate that the ORDER exists
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, customer_name, created_at')
        .eq('id', pickup.order_id)
        .single();

      if (orderError || !order) {
        Alert.alert(
          "Order Not Found", 
          `Order ID: ${pickup.order_id}\n\nThis order does not exist in the database. Please check the order details.`
        );
        return;
      }

      // Validate ORDER_ITEM exists and is waiting for pickup
      const { data: orderItem, error: orderItemError } = await supabase
        .from('order_items')
        .select('id, status, order_id, quantity')
        .eq('id', pickup.order_item_id)
        .single();

      if (orderItemError || !orderItem) {
        Alert.alert(
          "Order Item Not Found", 
          `Order Item ID: ${pickup.order_item_id}\n\nNo order item found with that ID.`
        );
        return;
      }

      // Verify order_item belongs to the correct order
      if (orderItem.order_id !== pickup.order_id) {
        Alert.alert("Data Mismatch", "Order item does not belong to this order.");
        return;
      }

      // Check if order is waiting for pickup
      if (orderItem.status !== 'waiting_for_pickup') {
        Alert.alert(
          "Cannot Take Pickup", 
          `Current status: ${orderItem.status}\n\nOrder must be 'waiting_for_pickup' to proceed.`
        );
        return;
      }

      // Check if driver already has an active delivery/pickup
      const { data: existingActiveDeliveries, error: activeCheckError } = await supabase
        .from("deliveries")
        .select("id, order_id, status, driver_id")
        .eq("driver_id", user.id)
        .in("status", ["in_progress", "picked_up"])
        .limit(1);

      if (activeCheckError) {
        throw activeCheckError;
      }

      if (existingActiveDeliveries && existingActiveDeliveries.length > 0) {
        const existingActiveDelivery = existingActiveDeliveries[0];
        Alert.alert(
          "Already Have Active Delivery/Pickup",
          "You already have an active delivery or pickup. Please complete it before taking a new one.",
          [
            {
              text: "Continue Current Task",
              onPress: () => router.push(`/pickup/${existingActiveDelivery.id}`)
            },
            {
              text: "OK",
              style: "cancel"
            }
          ]
        );
        return;
      }

      // Check if delivery/pickup already exists for this order
      const { data: existingDeliveries, error: checkError } = await supabase
        .from("deliveries")
        .select("id, driver_id, status")
        .eq("order_id", pickup.order_id)
        .limit(1);

      if (checkError) {
        throw checkError;
      }

      if (existingDeliveries && existingDeliveries.length > 0) {
        const existingDelivery = existingDeliveries[0];
        if (existingDelivery.driver_id === user.id) {
          Alert.alert("Already Taken", "You have already taken this pickup.");
        } else {
          Alert.alert("Already Taken", "This pickup has already been taken by another driver.");
        }
        return;
      }

      // Insert the delivery record for PICKUP
      const { data: newDelivery, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          order_id: pickup.order_id,
          driver_id: user.id,
          status: "in_progress",
          assigned_at: new Date().toISOString(),
          attempt_reason: `PICKUP: ${pickup.customer_name} - ${pickup.pickup_location}`
        })
        .select()
        .single();

      if (deliveryError) {
        if (deliveryError.code === "42501") {
          Alert.alert(
            "Permission Denied", 
            "You don't have permission to take pickups. Please contact support."
          );
        } else if (deliveryError.code === "23505") {
          Alert.alert("Already Taken", "This pickup was just taken by another driver.");
        } else {
          Alert.alert("Database Error", deliveryError.message);
        }
        return;
      }

      // Update order_item status to 'collected'
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          status: 'collected',
        })
        .eq('id', pickup.order_item_id);

      if (updateError) {
        secureLog.error('Order item status update failed:', updateError);
      }

      // Send notification to customer
      await notifyCustomerDriverAssigned(pickup.order_id);

      // Navigate to pickup tracking
      router.push({
        pathname: "/pickup/[id]",
        params: {
          id: newDelivery.id,
          orderId: pickup.order_id,
          customerName: pickup.customer_name,
          customerContact: pickup.customer_contact,
          pickupLocation: pickup.pickup_location,
          pickupLat: pickup.pickup_latitude.toString(),
          pickupLng: pickup.pickup_longitude.toString(),
          specialInstructions: pickup.special_instructions,
          deliveryType: 'pickup',
          orderItemId: pickup.order_item_id
        }
      });

    } catch (error: any) {
      secureLog.error("Unexpected error taking pickup:", error);
      Alert.alert(
        "Unexpected Error", 
        error.message || "An unexpected error occurred while taking the pickup."
      );
    } finally {
      setIsTakingPickup(false);
    }
  };

  const handleTakePickup = () => {
    if (!user) {
      Alert.alert(
        "Authentication Required",
        "Please log in to accept pickups.",
        [{ text: "Go to Login", onPress: () => router.push('../index') }]
      );
      return;
    }

    Alert.alert(
      "Start Pickup?",
      `Are you sure you want to start pickup from ${pickup.customer_name}?\n\nOrder ID: ${pickup.order_id}`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Start Pickup",
          onPress: takePickup
        }
      ]
    );
  };

  // Component cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Show loading state during auth check
  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Ionicons name="lock-closed" size={48} color="#ccc" />
        <Text style={styles.errorTitle}>Authentication Required</Text>
        <Text style={styles.errorText}>Please log in to access pickup assignments</Text>
        <TouchableOpacity 
          style={styles.authButton}
          onPress={() => router.push('/')}
        >
          <Text style={styles.authButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <AppHeader title="PICKUP ROUTE" />

      {/* Map */}
      <View style={styles.mapContainer}>
        {mapLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
        
        {mapError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="map-outline" size={48} color="#ccc" />
            <Text style={styles.errorTitle}>Map Unavailable</Text>
            <Text style={styles.errorText}>{mapError}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setMapError(null);
                setMapLoading(true);
                setMapHTML(null);
                setTimeout(() => {
                  const html = mapHTML;
                  setMapHTML(html);
                }, 100);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : mapHTML ? (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: mapHTML }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            style={styles.map}
            onLoad={handleWebViewLoad}
            onError={handleWebViewError}
            onHttpError={handleWebViewError}
            scrollEnabled={true}
            bounces={false}
            overScrollMode="never"
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            allowsFullscreenVideo={false}
            mixedContentMode="always"
            onContentProcessDidTerminate={() => {
              webViewRef.current?.reload();
            }}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Preparing map...</Text>
          </View>
        )}
      </View>

      {/* Pickup Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.customerName}>Pickup from: {pickup.customer_name}</Text>
        <Text style={styles.pickupAddress}>{pickup.pickup_location}</Text>
        
        {pickup.special_instructions && (
          <View style={styles.specialInstructionsContainer}>
            <View style={styles.instructionsHeader}>
              <Ionicons name="information-circle" size={16} color="#FF6B35" />
              <Text style={styles.instructionsTitle}>Special Instructions</Text>
            </View>
            <Text style={styles.instructionsText}>{pickup.special_instructions}</Text>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.backButtonStyle}
            onPress={() => router.back()}
            disabled={isTakingPickup}
          >
            <Text style={styles.backButtonText}>Back to List</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.takePickupButton,
              isTakingPickup && styles.buttonDisabled
            ]}
            onPress={handleTakePickup}
            disabled={isTakingPickup}
          >
            {isTakingPickup ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="bag-handle" size={20} color="white" />
                <Text style={styles.takePickupText}>Take This Pickup</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    zIndex: 1,
  },
  loadingText: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(14),
    color: '#666',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 20,
    zIndex: 1,
  },
  errorTitle: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#333',
    marginTop: verticalScale(12),
    textAlign: 'center',
  },
  errorText: {
    fontSize: moderateScale(14),
    color: '#666',
    marginTop: verticalScale(8),
    textAlign: 'center',
  },
  retryButton: {
    marginTop: verticalScale(16),
    backgroundColor: '#FF6B35',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    borderRadius: scale(8),
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  infoContainer: {
    padding: scale(20),
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  customerName: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: verticalScale(4),
  },
  pickupAddress: {
    fontSize: moderateScale(14),
    color: '#666',
    marginBottom: verticalScale(12),
  },
  specialInstructionsContainer: {
    backgroundColor: '#fff3e0',
    padding: scale(12),
    borderRadius: scale(8),
    marginBottom: verticalScale(12),
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  instructionsTitle: {
    fontSize: moderateScale(12),
    fontWeight: 'bold',
    color: '#FF6B35',
    marginLeft: scale(6),
  },
  instructionsText: {
    fontSize: moderateScale(12),
    color: '#666',
    lineHeight: moderateScale(16),
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: scale(12),
  },
  backButtonStyle: {
    flex: 1,
    paddingVertical: verticalScale(12),
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: scale(8),
    alignItems: 'center',
  },
  backButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  takePickupButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(12),
    backgroundColor: '#FF6B35',
    borderRadius: scale(8),
    gap: scale(8),
  },
  takePickupText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  authButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(12),
    borderRadius: scale(8),
    marginTop: verticalScale(20),
  },
  authButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
});