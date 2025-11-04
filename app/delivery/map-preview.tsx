import { supabase } from "@/hooks/supabaseClient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

export default function MapPreviewScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams();

  // Extract parameters with better error handling
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
  };

  const [mapHTML, setMapHTML] = useState("");
  const [isTakingDelivery, setIsTakingDelivery] = useState(false);
  const [currentDriverId] = useState<string>("e303e1db-c147-4ac0-afcd-0d48304f281e");

  // Generate map HTML with dependency array
  useEffect(() => {
    // Only generate map if we have valid coordinates
    if (!delivery.current_lat || !delivery.current_lng || 
        !delivery.delivery_latitude || !delivery.delivery_longitude) {
      console.warn('Invalid coordinates for map');
      return;
    }

    const html = `
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
            }
            .leaflet-routing-container { 
              display: none !important; 
            }
            .destination-marker {
              background: #FF3B30;
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
            // Initialize map
            const map = L.map('map').setView([${delivery.current_lat}, ${delivery.current_lng}], 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '© OpenStreetMap'
            }).addTo(map);

            // User location marker
            const userIcon = L.divIcon({
              className: 'user-marker',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            L.marker([${delivery.current_lat}, ${delivery.current_lng}], { 
              icon: userIcon
            }).addTo(map).bindPopup("Your Location");

            // Destination marker
            const destIcon = L.divIcon({
              className: 'destination-marker',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });
            const destMarker = L.marker([${delivery.delivery_latitude}, ${delivery.delivery_longitude}], { 
              icon: destIcon 
            }).addTo(map).bindPopup("Delivery to ${delivery.customer_name.replace(/'/g, "\\'")}");

            // Draw route
            L.Routing.control({
              waypoints: [
                L.latLng(${delivery.current_lat}, ${delivery.current_lng}),
                L.latLng(${delivery.delivery_latitude}, ${delivery.delivery_longitude})
              ],
              lineOptions: {
                styles: [{ color: '#3864C3', weight: 6, opacity: 0.7 }]
              },
              addWaypoints: false,
              draggableWaypoints: false,
              fitSelectedRoutes: true,
              show: false,
              routeWhileDragging: false
            }).addTo(map);

            // Make map interactive
            map.dragging.enable();
            map.touchZoom.enable();
            map.doubleClickZoom.enable();
            map.scrollWheelZoom.enable();
            map.boxZoom.enable();
            map.keyboard.enable();
          </script>
        </body>
      </html>
    `;
    setMapHTML(html);
  }, [delivery]);

  // Only send customer notification
  const notifyCustomerDriverAssigned = async (orderId: string) => {
    try {
      console.log('📢 Sending notification for order:', orderId);
      
      // Get order details WITHOUT joining to protected tables
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          customer_id,
          customer_name,
          branch_id
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('Error fetching order details:', error);
        return;
      }

      if (!order) {
        console.error('Order not found:', orderId);
        return;
      }

      // Create notification for customer
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: order.customer_id,
          title: 'Driver On The Way! 🚗',
          body: `A driver is on the way to pick up your laundry`,
          payload: {
            order_id: orderId,
            status: 'out_for_delivery',
            type: 'driver_assigned_customer'
          },
          sent_at: new Date().toISOString()
        });

      if (notificationError) {
        console.error('Error creating customer notification:', notificationError);
        return;
      }

      console.log('✅ Customer notified about driver assignment');

    } catch (error) {
      console.error('Error in notifyCustomerDriverAssigned:', error);
    }
  };

  const takeDelivery = async () => {
    try {
      setIsTakingDelivery(true);

      console.log('🔍 DEBUG - Starting delivery process:', {
        order_id: delivery.order_id,
        order_item_id: delivery.order_item_id,
        customer_name: delivery.customer_name,
        driver_id: currentDriverId
      });

      // 1. FIRST: Validate that the ORDER exists
      console.log('🔍 Checking if order exists...');
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, customer_name, created_at')
        .eq('id', delivery.order_id)
        .single();

      if (orderError || !order) {
        console.error('❌ ORDER NOT FOUND:', { 
          searched_order_id: delivery.order_id,
          error: orderError 
        });
        Alert.alert(
          "Order Not Found", 
          `Order ID: ${delivery.order_id}\n\nThis order does not exist in the database. Please check the order details.`
        );
        return;
      }

      console.log('✅ ORDER FOUND:', order);

      // 2. Validate ORDER_ITEM exists and is ready
      console.log('🔍 Checking if order item exists...');
      const { data: orderItem, error: orderItemError } = await supabase
        .from('order_items')
        .select('id, status, order_id, quantity')
        .eq('id', delivery.order_item_id)
        .single();

      if (orderItemError || !orderItem) {
        console.error('❌ ORDER ITEM NOT FOUND:', {
          searched_order_item_id: delivery.order_item_id,
          error: orderItemError
        });
        Alert.alert(
          "Order Item Not Found", 
          `Order Item ID: ${delivery.order_item_id}\n\nNo order item found with that ID.`
        );
        return;
      }

      console.log('✅ ORDER ITEM FOUND:', orderItem);

      // Verify order_item belongs to the correct order
      if (orderItem.order_id !== delivery.order_id) {
        console.error('❌ ORDER ITEM MISMATCH:', {
          expected_order_id: delivery.order_id,
          actual_order_id: orderItem.order_id
        });
        Alert.alert("Data Mismatch", "Order item does not belong to this order.");
        return;
      }

      if (orderItem.status !== 'ready_for_delivery') {
        console.log('❌ ORDER NOT READY:', { current_status: orderItem.status });
        Alert.alert(
          "Cannot Take Delivery", 
          `Current status: ${orderItem.status}\n\nOrder must be 'ready_for_delivery' to proceed.`
        );
        return;
      }

      console.log('✅ ORDER ITEM IS READY FOR DELIVERY');

      // 3. Check if driver already has an active delivery
      console.log('🔍 Checking for existing active deliveries...');
      const { data: existingActiveDelivery, error: activeCheckError } = await supabase
        .from("deliveries")
        .select("id, order_id, status")
        .eq("driver_id", currentDriverId)
        .in("status", ["assigned", "in_progress", "picked_up"])
        .maybeSingle();

      if (activeCheckError) throw activeCheckError;

      if (existingActiveDelivery) {
        console.log('❌ DRIVER HAS ACTIVE DELIVERY:', existingActiveDelivery);
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

      console.log('✅ No active deliveries found');

      // 4. Check if delivery already exists for this order
      console.log('🔍 Checking for existing delivery...');
      const { data: existingDelivery, error: checkError } = await supabase
        .from("deliveries")
        .select("id, driver_id, status")
        .eq("order_id", delivery.order_id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingDelivery) {
        console.log('❌ DELIVERY ALREADY EXISTS:', existingDelivery);
        if (existingDelivery.driver_id === currentDriverId) {
          Alert.alert("Already Taken", "You have already taken this delivery.");
        } else {
          Alert.alert("Already Taken", "This delivery has already been taken by another driver.");
        }
        return;
      }

      console.log('✅ No existing delivery found');

      // 5. Insert the delivery record - TRIGGER WILL HANDLE ORDER_ITEMS STATUS UPDATE
      console.log('🚀 Creating delivery record...');
      const { data: newDelivery, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          order_id: delivery.order_id,
          driver_id: currentDriverId,
          status: "in_progress",
          assigned_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (deliveryError) {
        console.error('❌ DELIVERY CREATION FAILED:', deliveryError);
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

      console.log('✅ DELIVERY CREATED SUCCESSFULLY:', newDelivery.id);

      // 6. Wait a moment and verify trigger worked
      console.log('⏳ Waiting for trigger to update order_items...');
      setTimeout(async () => {
        const { data: updatedOrderItem } = await supabase
          .from('order_items')
          .select('status')
          .eq('id', delivery.order_item_id)
          .single();
        
        console.log('🔍 ORDER ITEM STATUS AFTER DELIVERY:', updatedOrderItem?.status);
        
        if (updatedOrderItem?.status === 'out_for_delivery') {
          console.log('🎉 TRIGGER WORKED! Order item status updated to out_for_delivery');
        } else {
          console.warn('⚠️  TRIGGER MAY NOT HAVE WORKED. Status:', updatedOrderItem?.status);
        }
      }, 1000);

      // 7. Send notification to customer
      console.log('📢 Sending customer notification...');
      await notifyCustomerDriverAssigned(delivery.order_id);

      console.log('🎉 DELIVERY PROCESS COMPLETED SUCCESSFULLY!');

      // 8. Navigate to delivery tracking
      router.push({
        pathname: "/delivery/[id]",
        params: {
          id: newDelivery.id,
          orderId: delivery.order_id,
          customerName: delivery.customer_name,
          customerContact: delivery.customer_contact,
          deliveryLocation: delivery.delivery_location,
          deliveryLat: delivery.delivery_latitude.toString(),
          deliveryLng: delivery.delivery_longitude.toString(),
        }
      });

    } catch (error: any) {
      console.error("💥 UNEXPECTED ERROR TAKING DELIVERY:", error);
      Alert.alert(
        "Unexpected Error", 
        error.message || "An unexpected error occurred while taking the delivery."
      );
    } finally {
      setIsTakingDelivery(false);
    }
  };

  const handleTakeDelivery = () => {
    Alert.alert(
      "Start Delivery?",
      `Are you sure you want to start delivery to ${delivery.customer_name}?\n\nOrder ID: ${delivery.order_id}`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Start Delivery",
          onPress: takeDelivery
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery Route</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {mapHTML ? (
          <WebView
            originWhitelist={["*"]}
            source={{ html: mapHTML }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={styles.map}
            scrollEnabled={true}
            overScrollMode="always"
            androidLayerType="hardware"
            setBuiltInZoomControls={true}
            setDisplayZoomControls={true}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
      </View>

      {/* Delivery Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.customerName}>Delivery to: {delivery.customer_name}</Text>
        <Text style={styles.deliveryAddress}>{delivery.delivery_location}</Text>
        
        {/* Order ID Display for debugging */}
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Order ID: {delivery.order_id}</Text>
          <Text style={styles.debugText}>Order Item ID: {delivery.order_item_id}</Text>
        </View>
        
        {/* Additional Delivery Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="scale-outline" size={16} color="#666" />
            <Text style={styles.detailText}>Weight: {delivery.weight} kg</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#666" />
            <Text style={styles.detailText}>Amount: ₱{delivery.total_amount}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="business-outline" size={16} color="#666" />
            <Text style={styles.detailText}>Pickup: {delivery.branch_name}</Text>
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.backButtonStyle}
            onPress={() => router.back()}
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
                <Text style={styles.takeDeliveryText}>Take This Delivery</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(15),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: scale(4),
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: '#333',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(14),
    color: '#666',
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
  deliveryAddress: {
    fontSize: moderateScale(14),
    color: '#666',
    marginBottom: verticalScale(12),
  },
  debugContainer: {
    backgroundColor: '#e3f2fd',
    padding: scale(10),
    borderRadius: scale(8),
    marginBottom: verticalScale(12),
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  debugText: {
    fontSize: moderateScale(10),
    color: '#1565c0',
    fontFamily: 'monospace',
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
});