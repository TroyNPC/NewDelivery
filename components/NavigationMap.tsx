// components/NavigationMap.tsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { moderateScale, verticalScale } from 'react-native-size-matters';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface NavigationMapProps {
  initialLocation: { lat: number; lng: number };
  deliveryLocation: { lat: number; lng: number };
  customerName: string;
  isFullScreen?: boolean;
  onMapLoaded?: () => void;
  onRouteCalculated?: (data: { distance: string; time: string; instruction: string }) => void;
  onInstructionUpdate?: (instruction: string) => void;
  onLocationUpdated?: (data: { distance: string; time: string; lat: number; lng: number }) => void;
}

export interface NavigationMapRef {
  updateUserLocation: (coords: { lat: number; lng: number }) => void;
}

const NavigationMap = forwardRef<NavigationMapRef, NavigationMapProps>(({
  initialLocation,
  deliveryLocation,
  customerName,
  isFullScreen = false,
  onMapLoaded,
  onRouteCalculated,
  onInstructionUpdate,
  onLocationUpdated,
}, ref) => {
  const webViewRef = useRef<WebView>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    updateUserLocation: (coords: { lat: number; lng: number }) => {
      const message = {
        action: "updateLocation",
        lat: coords.lat,
        lng: coords.lng,
        timestamp: Date.now()
      };
      
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify(message));
      }
    }
  }));

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'map_loaded':
          onMapLoaded?.();
          break;
        case 'route_calculated':
          onRouteCalculated?.({
            distance: data.distance,
            time: data.time,
            instruction: data.instruction
          });
          break;
        case 'instruction_update':
          onInstructionUpdate?.(data.instruction);
          break;
        case 'location_updated':
          onLocationUpdated?.({
            distance: data.distance,
            time: data.time,
            lat: data.lat,
            lng: data.lng
          });
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const mapHTML = getMapHTML(isFullScreen, initialLocation, deliveryLocation, customerName);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: mapHTML }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        onError={(syntheticEvent) => {
          console.warn('WebView error:', syntheticEvent.nativeEvent);
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3864C3" />
            <Text style={styles.loadingText}>
              {isFullScreen ? 'Loading navigation...' : 'Loading map...'}
            </Text>
          </View>
        )}
        startInLoadingState={true}
      />
    </View>
  );
});

// HTML Generation Function
const getMapHTML = (isFullScreen: boolean, initialLocation: { lat: number; lng: number }, deliveryLocation: { lat: number; lng: number }, customerName: string) => {
  const { lat: startLat, lng: startLng } = initialLocation;
  const { lat: deliveryLat, lng: deliveryLng } = deliveryLocation;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
        <style>
          html, body, #map { 
            height: 100%; 
            margin: 0; 
            padding: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          .navigation-header {
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            background: white;
            padding: 15px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 1000;
            display: ${isFullScreen ? 'block' : 'none'};
          }
          
          .route-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }
          
          .route-info-item {
            text-align: center;
            flex: 1;
          }
          
          .route-info-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          }
          
          .route-info-value {
            font-size: 16px;
            font-weight: bold;
            color: #007AFF;
          }
          
          .current-instruction {
            background: #007AFF;
            color: white;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            margin-top: 5px;
          }
          
          .user-marker {
            background: #007AFF;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
          
          .pulse {
            animation: pulse 1.5s infinite;
          }
          
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
          }
          
          /* Hide the routing control panel completely */
          .leaflet-routing-container {
            display: none !important;
          }
          
          .leaflet-routing-alt {
            display: none !important;
          }
          
          .leaflet-bar {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        ${isFullScreen ? `
        <div class="navigation-header">
          <div class="route-info">
            <div class="route-info-item">
              <div class="route-info-label">DISTANCE</div>
              <div class="route-info-value" id="live-distance">Calculating...</div>
            </div>
            <div class="route-info-item">
              <div class="route-info-label">ETA</div>
              <div class="route-info-value" id="live-eta">Calculating...</div>
            </div>
          </div>
          <div class="current-instruction" id="current-instruction">
            Getting your location...
          </div>
        </div>
        ` : ''}
        
        <script>
          let map, userMarker, routeControl;
          let isMapReady = false;
          let instructions = [];
          let currentInstructionIndex = 0;
          
          function initMap() {
            console.log("Initializing map with start location:", ${startLat}, ${startLng});
            
            map = L.map('map').setView([${startLat}, ${startLng}], 15);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '© OpenStreetMap'
            }).addTo(map);

            // User location marker with pulsing animation
            const userIcon = L.divIcon({
              className: 'user-marker pulse',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            
            userMarker = L.marker([${startLat}, ${startLng}], { 
              icon: userIcon,
              zIndexOffset: 1000 
            }).addTo(map).bindPopup("Your Current Location");

            // Destination marker
            const destIcon = L.divIcon({
              html: '<div style="background: #FF3B30; width: 16px; height: 16px; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });
            
            const destMarker = L.marker([${deliveryLat}, ${deliveryLng}], { 
              icon: destIcon 
            }).addTo(map).bindPopup("Delivery: ${customerName}");

            // Initialize routing
            setupRouting();
            
            isMapReady = true;
            console.log("Map ready!");
            
            // Notify React Native that map is loaded
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'map_loaded',
                message: 'Map is ready for location updates'
              }));
            }
          }

          function setupRouting() {
            try {
              routeControl = L.Routing.control({
                waypoints: [
                  L.latLng(${startLat}, ${startLng}),
                  L.latLng(${deliveryLat}, ${deliveryLng})
                ],
                lineOptions: {
                  styles: [{ color: '#007AFF', weight: 6, opacity: 0.8 }]
                },
                routeWhileDragging: false,
                showAlternatives: false,
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: true,
                show: false,
                collapsible: false
              }).addTo(map);

              // Listen for route events
              routeControl.on('routesfound', function(e) {
                const routes = e.routes;
                if (routes && routes.length > 0) {
                  const route = routes[0];
                  const totalDistance = (route.summary.totalDistance / 1000).toFixed(1);
                  const totalTime = Math.round(route.summary.totalTime / 60);
                  
                  instructions = route.instructions;
                  currentInstructionIndex = 0;
                  
                  updateRouteInfo(totalDistance, totalTime);
                  updateCurrentInstruction();
                  
                  // Send to React Native
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'route_calculated',
                      distance: totalDistance,
                      time: totalTime,
                      instruction: instructions[0]?.text || "Head to destination"
                    }));
                  }
                }
              });

              routeControl.on('routingerror', function(e) {
                console.log('Routing error, using straight line calculation');
                const straightDistance = map.distance(
                  [${startLat}, ${startLng}],
                  [${deliveryLat}, ${deliveryLng}]
                ) / 1000;
                const fallbackTime = Math.round((straightDistance / 5) * 60); // 5 km/h walking speed
                
                updateRouteInfo(straightDistance.toFixed(1), fallbackTime);
                document.getElementById('current-instruction').textContent = "Follow the route to destination";
                
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'route_calculated',
                    distance: straightDistance.toFixed(1),
                    time: fallbackTime,
                    instruction: "Follow the route to destination"
                  }));
                }
              });
            } catch (error) {
              console.error('Routing setup error:', error);
            }
          }

          function updateRouteInfo(distance, time) {
            ${isFullScreen ? `
            const distanceEl = document.getElementById('live-distance');
            const etaEl = document.getElementById('live-eta');
            if (distanceEl) distanceEl.textContent = distance + ' km';
            if (etaEl) etaEl.textContent = time + ' min';
            ` : ''}
          }

          function updateCurrentInstruction() {
            if (instructions.length > 0 && currentInstructionIndex < instructions.length) {
              const instruction = instructions[currentInstructionIndex];
              ${isFullScreen ? `
              const instructionEl = document.getElementById('current-instruction');
              if (instructionEl) {
                instructionEl.textContent = instruction.text + ' in ' + instruction.distance + 'm';
              }
              ` : ''}
              
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'instruction_update',
                  instruction: instruction.text + ' in ' + instruction.distance + 'm',
                  distance: instruction.distance,
                  index: currentInstructionIndex
                }));
              }
            }
          }

          // REAL-TIME LOCATION UPDATES
          function updateUserLocation(lat, lng) {
            if (!isMapReady) {
              console.log("Map not ready yet, queuing location update");
              return;
            }
            
            console.log("Updating user location to:", lat, lng);
            
            // Update user marker position
            if (userMarker) {
              userMarker.setLatLng([lat, lng]);
            }
            
            // Update the route with new starting point
            if (routeControl) {
              try {
                routeControl.setWaypoints([
                  L.latLng(lat, lng),
                  L.latLng(${deliveryLat}, ${deliveryLng})
                ]);
              } catch (error) {
                console.log("Route update error:", error);
              }
            }
            
            // Smoothly move the map view
            if (map.getZoom() > 14) {
              map.panTo([lat, lng], {
                animate: true,
                duration: 1.0
              });
            }
            
            // Calculate straight-line distance for fallback
            const straightDistance = map.distance([lat, lng], [${deliveryLat}, ${deliveryLng}]) / 1000;
            const fallbackTime = Math.round((straightDistance / 5) * 60);
            
            // Send real-time distance update
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'location_updated',
                distance: straightDistance.toFixed(1),
                time: fallbackTime,
                lat: lat,
                lng: lng
              }));
            }
          }

          // Message handling from React Native
          window.addEventListener('message', function(event) {
            try {
              const data = JSON.parse(event.data);
              if (data.action === 'updateLocation') {
                updateUserLocation(data.lat, data.lng);
              }
            } catch (error) {
              console.error("Message parsing error:", error);
            }
          });

          // Initialize map when page loads
          window.addEventListener('load', initMap);
          
          // Backup initialization
          setTimeout(() => {
            if (!isMapReady) {
              console.log("Force initializing map...");
              initMap();
            }
          }, 2000);
        </script>
      </body>
    </html>
  `;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(14),
    color: '#666',
  },
});

export default NavigationMap;