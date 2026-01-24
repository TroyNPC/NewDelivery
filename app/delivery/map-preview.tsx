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

export default function MapPreviewScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams();
  
  const { user, loading: authLoading } = useAuth();

  // Extract parameters
  const delivery = {
    order_item_id: params.order_item_id as string,
    order_id: params.order_id as string,
    customer_name: params.customer_name as string,
    customer_contact: params.customer_contact as string,
    delivery_location: params.delivery_location as string,
    delivery_latitude: parseFloat(params.delivery_latitude as string) || 0,
    delivery_longitude: parseFloat(params.delivery_longitude as string) || 0,
    current_lat: parseFloat(params.current_lat as string) || 0,
    current_lng: parseFloat(params.current_lng as string) || 0,
    weight: params.weight as string,
    total_amount: params.total_amount as string,
    branch_name: params.branch_name as string,
    branch_address: params.branch_address as string,
    special_instructions: params.special_instructions as string || "",
    order_method: params.order_method as string || "delivery",
  };

  const [mapHTML, setMapHTML] = useState<string | null>(null);
  const [isTakingDelivery, setIsTakingDelivery] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const webViewRef = useRef<WebView>(null);

  // Generate map HTML
  useEffect(() => {
    isMounted.current = true;

    const generateMapHTML = () => {
      if (!isMounted.current) return;

      try {
        setMapLoading(true);
        setMapError(null);

        const isValidCoordinate = (lat: number, lng: number): boolean => 
          !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

        if (!isValidCoordinate(delivery.current_lat, delivery.current_lng) || 
            !isValidCoordinate(delivery.delivery_latitude, delivery.delivery_longitude)) {
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
      .delivery-marker {
        background: #28a745;
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
          }).setView([${delivery.current_lat}, ${delivery.current_lng}], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          const userIcon = L.divIcon({
            className: 'user-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          L.marker([${delivery.current_lat}, ${delivery.current_lng}], { 
            icon: userIcon
          }).addTo(map).bindPopup("Your Location");

          const deliveryIcon = L.divIcon({
            className: 'delivery-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          
          L.marker([${delivery.delivery_latitude}, ${delivery.delivery_longitude}], { 
            icon: deliveryIcon 
          }).addTo(map).bindPopup("Delivery Location");

          if (typeof L.Routing !== 'undefined') {
            L.Routing.control({
              waypoints: [
                L.latLng(${delivery.current_lat}, ${delivery.current_lng}),
                L.latLng(${delivery.delivery_latitude}, ${delivery.delivery_longitude})
              ],
              lineOptions: {
                styles: [{ color: '#28a745', weight: 6, opacity: 0.7 }]
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

      const isPickupReturn = delivery.order_method === "pickup";
      
      let notificationTitle, notificationBody;
      
      if (isPickupReturn) {
        notificationTitle = 'Driver Coming to Return Your Laundry! 🔄';
        notificationBody = `Driver ${driverName} is coming to return your cleaned laundry`;
      } else {
        notificationTitle = 'Driver On The Way! 🚗';
        notificationBody = `Driver ${driverName} is on the way to deliver your laundry`;
      }

      await sendCustomerNotification(order.customer_id, {
        title: notificationTitle,
        body: notificationBody,
        payload: {
          order_id: orderId,
          order_status: 'out_for_delivery',
          delivery_status: 'driver_assigned',
          driver_name: driverName,
          driver_email: user.email,
          order_method: delivery.order_method,
          shop_name: order.shop_branches?.name,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      secureLog.error('Error in notifyCustomerDriverAssigned:', error);
    }
  };

  // Delivery assignment
  const takeDelivery = async (): Promise<void> => {
    if (!user) {
      Alert.alert(
        "Authentication Required",
        "Please log in to accept deliveries.",
        [{ text: "Go to Login", onPress: () => router.push('/') }]
      );
      return;
    }

    if (!delivery.order_item_id || !delivery.order_id) {
      Alert.alert(
        "Invalid Data",
        "Delivery information is incomplete. Please go back and try again."
      );
      return;
    }

    try {
      setIsTakingDelivery(true);

      // Validate order exists
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, customer_name, created_at')
        .eq('id', delivery.order_id)
        .single();

      if (orderError || !order) {
        Alert.alert(
          "Order Not Found", 
          `Order ID: ${delivery.order_id}\n\nThis order does not exist in the database. Please check the order details.`
        );
        return;
      }

      // Validate order item exists and is ready
      const { data: orderItem, error: orderItemError } = await supabase
        .from('order_items')
        .select('id, status, order_id, quantity')
        .eq('id', delivery.order_item_id)
        .single();

      if (orderItemError || !orderItem) {
        Alert.alert(
          "Order Item Not Found", 
          `Order Item ID: ${delivery.order_item_id}\n\nNo order item found with that ID.`
        );
        return;
      }

      // Verify order_item belongs to the correct order
      if (orderItem.order_id !== delivery.order_id) {
        Alert.alert("Data Mismatch", "Order item does not belong to this order.");
        return;
      }

      if (orderItem.status !== 'ready_for_delivery') {
        Alert.alert(
          "Cannot Take Delivery", 
          `Current status: ${orderItem.status}\n\nOrder must be 'ready_for_delivery' to proceed.`
        );
        return;
      }

      // Check if driver already has an active delivery
      const { data: existingActiveDelivery, error: activeCheckError } = await supabase
        .from("deliveries")
        .select("id, order_id, status")
        .eq("driver_id", user.id)
        .in("status", ["assigned", "in_progress", "picked_up"])
        .maybeSingle();

      if (activeCheckError) {
        throw activeCheckError;
      }

      if (existingActiveDelivery) {
        Alert.alert(
          "Already Have Active Delivery",
          "You already have an active delivery. Please complete it before taking a new one.",
          [
            {
              text: "Continue Current Delivery",
              onPress: () => router.push(`/delivery/${existingActiveDelivery.id}`)
            },
            {
              text: "OK",
              style: "cancel"
            }
          ]
        );
        return;
      }

      // Check if delivery already exists for this order
      const { data: existingDelivery, error: checkError } = await supabase
        .from("deliveries")
        .select("id, driver_id, status")
        .eq("order_id", delivery.order_id)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existingDelivery) {
        if (existingDelivery.driver_id === user.id) {
          Alert.alert("Already Taken", "You have already taken this delivery.");
        } else {
          Alert.alert("Already Taken", "This delivery has already been taken by another driver.");
        }
        return;
      }

      // Insert the delivery record
      const { data: newDelivery, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          order_id: delivery.order_id,
          driver_id: user.id,
          status: delivery.order_method === "pickup" ? "in_progress" : "out_for_delivery",
          assigned_at: new Date().toISOString(),
          ...(delivery.order_method === "pickup" && { picked_up_at: new Date().toISOString() }),
        })
        .select()
        .single();

      if (deliveryError) {
        if (deliveryError.code === "42501") {
          Alert.alert(
            "Permission Denied", 
            "You don't have permission to take deliveries. Please contact support."
          );
        } else if (deliveryError.code === "23505") {
          Alert.alert("Already Taken", "This delivery was just taken by another driver.");
        } else {
          Alert.alert("Database Error", deliveryError.message);
        }
        return;
      }

      // Update order item status
      const { error: updateError } = await supabase
        .from('order_items')
        .update({ status: 'out_for_delivery' })
        .eq('id', delivery.order_item_id);

      if (updateError) {
        // Rollback delivery creation
        await supabase.from('deliveries').delete().eq('id', newDelivery.id);
        Alert.alert("Update Error", "Failed to update order status. Please try again.");
        return;
      }

      // Send notification to customer
      await notifyCustomerDriverAssigned(delivery.order_id);

      // Navigate to delivery tracking
      router.replace({
        pathname: "/delivery/[id]",
        params: {
          id: newDelivery.id,
          orderId: delivery.order_id,
          customerName: delivery.customer_name,
          customerContact: delivery.customer_contact,
          deliveryLocation: delivery.delivery_location,
          deliveryLat: delivery.delivery_latitude.toString(),
          deliveryLng: delivery.delivery_longitude.toString(),
          specialInstructions: delivery.special_instructions || "",
          orderMethod: delivery.order_method || "delivery",
        }
      });

    } catch (error: any) {
      secureLog.error("Unexpected error taking delivery:", error);
      Alert.alert(
        "Unexpected Error", 
        error.message || "An unexpected error occurred while taking the delivery."
      );
    } finally {
      setIsTakingDelivery(false);
    }
  };

  const handleTakeDelivery = (): void => {
    if (!user) {
      Alert.alert(
        "Authentication Required",
        "Please log in to accept deliveries.",
        [{ text: "Go to Login", onPress: () => router.push('../index') }]
      );
      return;
    }

    const isPickupReturn = delivery.order_method === "pickup";
    const actionType = isPickupReturn ? "Return Delivery" : "Delivery";

    Alert.alert(
      `Start ${actionType}?`,
      `Are you sure you want to start ${actionType.toLowerCase()} to ${delivery.customer_name}?\n\nOrder ID: ${delivery.order_id}\nLocation: ${delivery.delivery_location}`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: `Start ${actionType}`,
          onPress: takeDelivery
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
        <ActivityIndicator size="large" color="#28a745" />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Ionicons name="lock-closed" size={48} color="#ccc" />
        <Text style={styles.errorTitle}>Authentication Required</Text>
        <Text style={styles.errorText}>Please log in to access delivery assignments</Text>
        <TouchableOpacity 
          style={styles.authButton}
          onPress={() => router.push('/')}
        >
          <Text style={styles.authButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isPickupReturn = delivery.order_method === "pickup";
  const actionType = isPickupReturn ? "Return Delivery" : "Delivery";

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <AppHeader title="DELIVERY ROUTE" />

      {/* Map */}
      <View style={styles.mapContainer}>
        {mapLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#28a745" />
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
            <ActivityIndicator size="large" color="#28a745" />
            <Text style={styles.loadingText}>Preparing map...</Text>
          </View>
        )}
      </View>

      {/* Delivery Info */}
      <View style={styles.infoContainer}>
        <View style={[
          styles.typeBadge,
          isPickupReturn ? styles.pickupBadge : styles.deliveryBadge
        ]}>
          <Ionicons 
            name={isPickupReturn ? "refresh-circle" : "car-sport"} 
            size={16} 
            color="white" 
          />
          <Text style={styles.typeBadgeText}>
            {isPickupReturn ? "🔄 PICKUP RETURN" : "📦 DELIVERY"}
          </Text>
        </View>

        <Text style={styles.customerName}>
          {isPickupReturn ? "Return to:" : "Delivery to:"} {delivery.customer_name}
        </Text>
        <Text style={styles.deliveryAddress}>{delivery.delivery_location}</Text>
        
        {delivery.special_instructions && (
          <View style={styles.specialInstructionsContainer}>
            <View style={styles.instructionsHeader}>
              <Ionicons name="information-circle" size={16} color="#28a745" />
              <Text style={styles.instructionsTitle}>Special Instructions</Text>
            </View>
            <Text style={styles.instructionsText}>{delivery.special_instructions}</Text>
          </View>
        )}
        
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={16} color="#666" />
            <Text style={styles.detailText}>Contact: {delivery.customer_contact}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="scale-outline" size={16} color="#666" />
            <Text style={styles.detailText}>Weight: {delivery.weight}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#666" />
            <Text style={styles.detailText}>Amount: ₱{delivery.total_amount}</Text>
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.backButtonStyle}
            onPress={() => router.back()}
            disabled={isTakingDelivery}
          >
            <Text style={styles.backButtonText}>Back to List</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.takeDeliveryButton,
              isTakingDelivery && styles.buttonDisabled
            ]}
            onPress={handleTakeDelivery}
            disabled={isTakingDelivery}
          >
            {isTakingDelivery ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={styles.takeDeliveryText}>
                  Take This {actionType}
                </Text>
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
    backgroundColor: '#28a745',
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
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: scale(16),
    marginBottom: verticalScale(12),
    gap: scale(4),
  },
  deliveryBadge: {
    backgroundColor: '#28a745',
  },
  pickupBadge: {
    backgroundColor: '#FF6B35',
  },
  typeBadgeText: {
    color: 'white',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  customerName: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: verticalScale(4),
  },
  deliveryAddress: {
    fontSize: moderateScale(14),
    color: '#666',
    marginBottom: verticalScale(12),
  },
  specialInstructionsContainer: {
    backgroundColor: '#e8f5e8',
    padding: scale(12),
    borderRadius: scale(8),
    marginBottom: verticalScale(12),
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  instructionsTitle: {
    fontSize: moderateScale(12),
    fontWeight: 'bold',
    color: '#28a745',
    marginLeft: scale(6),
  },
  instructionsText: {
    fontSize: moderateScale(12),
    color: '#666',
    lineHeight: moderateScale(16),
  },
  detailsContainer: {
    backgroundColor: 'white',
    padding: scale(12),
    borderRadius: scale(8),
    marginBottom: verticalScale(16),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  detailText: {
    fontSize: moderateScale(12),
    color: '#666',
    marginLeft: scale(6),
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
  takeDeliveryButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(12),
    backgroundColor: '#28a745',
    borderRadius: scale(8),
    gap: scale(8),
  },
  takeDeliveryText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  authButton: {
    backgroundColor: '#28a745',
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