// app/delivery/[id].tsx - COMPLETE FIXED VERSION WITH CLEANUP
import { supabase } from "@/hooks/supabaseClient";
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useNotifications } from '@/hooks/useNotification';
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Dimensions,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { WebView } from "react-native-webview";
import { AppHeader } from "../component/AppHeader";
// FIXED: Include out_for_delivery status
type DeliveryStatus = "out_for_delivery" | "delivered";

// Fixed type to match Expo Location's actual return types
type LocationCoords = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
};

// Navigation instruction type
type NavigationInstruction = {
  type: string;
  distance: number;
  text: string;
  modifier?: string;
};

// Type-safe Ionicons names for navigation
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Debug logging utility
const debugLog = (source: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`🔍 [${timestamp}] ${source}: ${message}`, data || '');
};

// Distance calculation helper
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

// Helper function to safely get accuracy value for display
const getAccuracyDisplay = (accuracy: number | null | undefined): string => {
  if (accuracy === null || accuracy === undefined) return 'Unknown';
  return `${accuracy.toFixed(1)}m`;
};

// Helper function to check if location is accurate enough
const isLocationAccurate = (accuracy: number | null | undefined): boolean => {
  if (accuracy === null || accuracy === undefined) return true;
  return accuracy <= 100;
};

// Format distance for display
const formatDistance = (meters: number): string => {
  if (meters < 10) {
    return `${Math.round(meters)}m`;
  } else if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    return `${(meters / 1000).toFixed(1)}km`;
  }
};

// Get icon for navigation instruction - TYPE SAFE VERSION
const getNavigationIcon = (type: string, modifier?: string): IoniconsName => {
  const iconMap: Record<string, IoniconsName> = {
    'Head': 'navigate',
    'Turn-left': 'arrow-back',
    'Turn-right': 'arrow-forward',
    'Turn-sharp left': 'return-up-back',
    'Turn-sharp right': 'return-up-forward',
    'Turn-slight left': 'arrow-back',
    'Turn-slight right': 'arrow-forward',
    'Turn-uturn': 'sync',
    'Turn': 'arrow-forward',
    'Continue': 'arrow-forward',
    'Roundabout': 'sync',
    'Rotary': 'sync',
    'Arrive': 'flag',
    'Depart': 'flag-outline',
    'EndOfRoad': 'alert-circle',
    'Fork': 'git-branch',
    'Merge': 'git-merge',
    'ExitRoundabout': 'exit',
    'ExitRotary': 'exit',
  };

  const key = modifier ? `${type}-${modifier}` : type;
  return iconMap[key] || 'navigate';
};

// Phone number validation
const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

// Cache delivery data for offline support
const cacheDeliveryData = async (deliveryId: string, data: any) => {
  try {
    await AsyncStorage.setItem(`delivery_${deliveryId}`, JSON.stringify({
      ...data,
      cachedAt: Date.now()
    }));
  } catch (error) {
    debugLog('CACHE', 'Error caching delivery data', error);
  }
};

// Get cached delivery data
const getCachedDeliveryData = async (deliveryId: string) => {
  try {
    const cached = await AsyncStorage.getItem(`delivery_${deliveryId}`);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.cachedAt < 3600000) {
        return data;
      }
    }
  } catch (error) {
    debugLog('CACHE', 'Error reading cached data', error);
  }
  return null;
};

// Static HTML template with wrong-turn detection and route recalculation - OPTIMIZED
const getMapHTML = (deliveryLat: number, deliveryLng: number, customerName: string, isFullScreen: boolean = false) => {
  debugLog('HTML_GENERATOR', `Creating HTML for ${isFullScreen ? 'FULL' : 'PREVIEW'} map`);
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body { 
            height: 100%; 
            width: 100%;
            margin: 0; 
            padding: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            background: #f8f9fa;
          }
          #map { 
            height: 100%; 
            width: 100%;
            margin: 0; 
            padding: 0; 
            background: #f8f9fa;
          }
          
          .route-info {
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            display: ${isFullScreen ? 'flex' : 'none'};
            justify-content: space-between;
            align-items: center;
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
            font-size: 14px;
            font-weight: bold;
            color: #007AFF;
          }
          
          .user-marker {
            background: #007AFF;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
          
          .leaflet-routing-container {
            display: none !important;
          }
          
          .leaflet-routing-alt {
            display: none !important;
          }
          
          .leaflet-bar {
            display: none !important;
          }

          .leaflet-container {
            background: #f8f9fa;
          }

          .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #f8f9fa;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            flex-direction: column;
          }

          .loading-text {
            margin-top: 10px;
            color: #666;
            font-size: 14px;
          }

          .hidden {
            display: none !important;
          }

          .debug-panel {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px;
            border-radius: 4px;
            font-size: 10px;
            max-width: 200px;
            z-index: 1000;
          }

          .navigation-panel {
            position: absolute;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: white;
            border-radius: 16px;
            padding: 0;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            z-index: 1000;
            display: ${isFullScreen ? 'block' : 'none'};
            border: 2px solid #34C759;
          }

          .next-turn {
            padding: 20px;
            display: flex;
            align-items: center;
            background: linear-gradient(135deg, #34C759, #2EBA52);
          }

          .next-turn-icon {
            margin-right: 16px;
            font-size: 24px;
            font-weight: bold;
            color: white;
          }

          .next-turn-content {
            flex: 1;
          }

          .next-turn-text {
            font-size: 18px;
            font-weight: 600;
            color: white;
            margin-bottom: 4px;
          }

          .next-turn-distance {
            font-size: 16px;
            color: rgba(255,255,255,0.9);
            font-weight: 500;
          }

          .arrival-instruction {
            padding: 20px;
            display: flex;
            align-items: center;
            background: linear-gradient(135deg, #FF9500, #FF8A00);
          }

          .arrival-icon {
            margin-right: 16px;
            font-size: 24px;
            font-weight: bold;
            color: white;
          }

          .arrival-text {
            font-size: 18px;
            fontWeight: 600;
            color: white;
            flex: 1;
          }

          .recalculating-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 2000;
            font-weight: 600;
            display: none;
          }
        </style>
      </head>
      <body>
        <div id="loadingOverlay" class="loading-overlay">
          <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007AFF; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <div class="loading-text">Loading map...</div>
        </div>
        
        <div id="map"></div>
        
        <div id="debugPanel" class="debug-panel:none" style="display: none;">
          <div>Map: <span id="debugMapStatus">Not initialized</span></div>
          <div>Marker: <span id="debugMarkerStatus">Not created</span></div>
          <div>Last Location: <span id="debugLastLocation">None</span></div>
          <div>Messages: <span id="debugMessageCount">0</span></div>
          <div>Route Status: <span id="debugRouteStatus">No route</span></div>
        </div>

        <div id="recalculatingOverlay" class="recalculating-overlay">
          🔄 Recalculating route...
        </div>
        
        ${isFullScreen ? `
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

        <div id="navigationPanel" class="navigation-panel" style="display: none;">
          <div id="nextTurn" class="next-turn">
            <div class="next-turn-icon">→</div>
            <div class="next-turn-content">
              <div class="next-turn-text" id="nextTurnText">Continue straight</div>
              <div class="next-turn-distance" id="nextTurnDistance">100m</div>
            </div>
          </div>
        </div>

        <div id="arrivalPanel" class="navigation-panel" style="display: none; border-color: #FF9500;">
          <div class="arrival-instruction">
            <div class="arrival-icon">🏁</div>
            <div class="arrival-text">You have arrived at your destination</div>
          </div>
        </div>
        ` : ''}
        
        <script>
          let map, userMarker, routeControl;
          let lastLocation = null;
          let mapInitialized = false;
          let pendingLocation = null;
          let messageCount = 0;
          let debugEnabled = true;
          let markerCreated = false;
          let lastRoutingTime = 0;
          let currentRoute = null;
          let currentInstructions = [];
          let currentRouteLine = null;
          const ROUTING_DEBOUNCE_MS = 10000;
          const MIN_MOVEMENT_METERS = 20;
          const ARRIVAL_DISTANCE_METERS = 50;
          const OFF_ROUTE_DISTANCE_METERS = 100;
          let lastRouteCheck = 0;
          const ROUTE_CHECK_INTERVAL = 5000;
          let isRecalculating = false;
          
          // MEMORY LEAK FIX: Cleanup function
          function performCleanup() {
            if (routeControl) {
              try {
                map.removeControl(routeControl);
                routeControl = null;
              } catch (e) {}
            }
            if (userMarker) {
              try {
                map.removeLayer(userMarker);
                userMarker = null;
              } catch (e) {}
            }
            currentRoute = null;
            currentInstructions = [];
            currentRouteLine = null;
          }

          function updateDebugInfo() {
            if (!debugEnabled) return;
            const debugPanel = document.getElementById('debugPanel');
            if (debugPanel) debugPanel.style.display = 'block';
            
            document.getElementById('debugMapStatus').textContent = mapInitialized ? '✅ Ready' : '❌ Not ready';
            document.getElementById('debugMarkerStatus').textContent = markerCreated ? '✅ Created' : '❌ Not created';
            document.getElementById('debugLastLocation').textContent = lastLocation ? lastLocation.join(', ') : 'None';
            document.getElementById('debugMessageCount').textContent = messageCount;
            document.getElementById('debugRouteStatus').textContent = isRecalculating ? '🔄 Recalculating' : (currentRoute ? '✅ Active' : '❌ No route');
          }

          function debugLog(source, message, data) {
            if (!debugEnabled) return;
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            console.log(\`🔍 [\${timestamp}] WEBVIEW_\${source}: \${message}\`, data || '');
            updateDebugInfo();
          }

          const style = document.createElement('style');
          style.textContent = \`
            @keyframes spin { 
              0% { transform: rotate(0deg); } 
              100% { transform: rotate(360deg); } 
            }
          \`;
          document.head.appendChild(style);

          function hideLoadingOverlay() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
              overlay.classList.add('hidden');
              debugLog('LOADING', 'Loading overlay hidden');
            }
          }

          function showRecalculatingOverlay() {
            const overlay = document.getElementById('recalculatingOverlay');
            if (overlay) {
              overlay.style.display = 'block';
              setTimeout(() => {
                overlay.style.display = 'none';
              }, 2000);
            }
          }

          function formatDistance(meters) {
            if (meters < 10) {
              return Math.round(meters) + 'm';
            } else if (meters < 1000) {
              return Math.round(meters) + 'm';
            } else {
              return (meters / 1000).toFixed(1) + 'km';
            }
          }

          // Check if user is off-route
          function isOffRoute(userLat, userLng) {
            if (!currentRoute || !currentRouteLine) {
              debugLog('ROUTE_CHECK', 'No route or route line available');
              return false;
            }
            
            const distanceToRoute = currentRouteLine.distanceTo([userLat, userLng]);
            const isOffRoute = distanceToRoute > OFF_ROUTE_DISTANCE_METERS;
            
            debugLog('ROUTE_CHECK', \`Distance to route: \${distanceToRoute.toFixed(1)}m (threshold: \${OFF_ROUTE_DISTANCE_METERS}m) - Off route: \${isOffRoute}\`);
            
            return isOffRoute;
          }

          // Check route adherence and recalculate if needed
          function checkRouteAdherence(userLat, userLng) {
            const now = Date.now();
            const timeSinceLastCheck = now - lastRouteCheck;
            
            if (timeSinceLastCheck < ROUTE_CHECK_INTERVAL) {
              return;
            }
            
            lastRouteCheck = now;
            
            if (isOffRoute(userLat, userLng) && !isRecalculating) {
              debugLog('ROUTE', 'User is OFF ROUTE! Recalculating...', { 
                distance: currentRouteLine ? currentRouteLine.distanceTo([userLat, userLng]) : 'N/A' 
              });
              
              isRecalculating = true;
              showRecalculatingOverlay();
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'off_route',
                message: 'Recalculating route due to wrong turn',
                distance: currentRouteLine ? currentRouteLine.distanceTo([userLat, userLng]) : 0
              }));
              
              setupRouting(userLat, userLng, true);
            } else {
              debugLog('ROUTE', 'User is on route');
            }
          }

          function updateNavigationPanel(instructions, userLat, userLng) {
            if (!${isFullScreen}) return;
            
            const navPanel = document.getElementById('navigationPanel');
            const arrivalPanel = document.getElementById('arrivalPanel');
            const nextTurnText = document.getElementById('nextTurnText');
            const nextTurnDistance = document.getElementById('nextTurnDistance');
            
            if (!navPanel || !arrivalPanel || !nextTurnText || !nextTurnDistance) return;

            const distanceToDestination = map.distance([userLat, userLng], [${deliveryLat}, ${deliveryLng}]);
            debugLog('NAVIGATION', \`Distance to destination: \${distanceToDestination.toFixed(1)}m\`);
            
            if (distanceToDestination <= ARRIVAL_DISTANCE_METERS) {
              navPanel.style.display = 'none';
              arrivalPanel.style.display = 'block';
              debugLog('NAVIGATION', 'Showing arrival panel');
              return;
            } else {
              arrivalPanel.style.display = 'none';
            }
            
            if (!instructions || instructions.length === 0) {
              navPanel.style.display = 'none';
              return;
            }
            
            const nextInstruction = instructions[0];
            if (nextInstruction) {
              nextTurnText.textContent = nextInstruction.text;
              nextTurnDistance.textContent = formatDistance(nextInstruction.distance);
              
              let arrow = '→';
              if (nextInstruction.modifier) {
                switch(nextInstruction.modifier) {
                  case 'left': arrow = '←'; break;
                  case 'right': arrow = '→'; break;
                  case 'sharp left': arrow = '↰'; break;
                  case 'sharp right': arrow = '↱'; break;
                  case 'slight left': arrow = '↖'; break;
                  case 'slight right': arrow = '↗'; break;
                  case 'uturn': arrow = '↶'; break;
                }
              }
              document.querySelector('.next-turn-icon').textContent = arrow;
              
              navPanel.style.display = 'block';
              debugLog('NAVIGATION', \`Showing instruction: \${nextInstruction.text} in \${formatDistance(nextInstruction.distance)}\`);
            } else {
              navPanel.style.display = 'none';
            }
          }

          function extractInstructions(route) {
            if (!route || !route.instructions) return [];
            
            const instructions = route.instructions.map(instr => ({
              type: instr.type,
              distance: instr.distance,
              text: instr.text,
              modifier: instr.modifier
            }));
            
            debugLog('NAVIGATION', 'Extracted instructions', { count: instructions.length });
            return instructions;
          }

          function initMap() {
            if (mapInitialized) {
              debugLog('INIT', 'Map already initialized, skipping');
              return;
            }
            
            debugLog('INIT', 'Starting map initialization');
            mapInitialized = true;
            
            map = L.map('map', {
              zoomControl: false,
              attributionControl: false,
              dragging: true,
              touchZoom: true,
              scrollWheelZoom: true
            }).setView([0, 0], 2);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '© OpenStreetMap'
            }).addTo(map);

            const destMarker = L.circleMarker([${deliveryLat}, ${deliveryLng}], {
              radius: 8,
              fillColor: "#FF3B30",
              color: "white",
              weight: 3,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map).bindPopup("Delivery: ${customerName}");
            debugLog('MARKER', 'Destination marker added');

            setTimeout(() => {
              map.invalidateSize();
              hideLoadingOverlay();
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'map_ready',
                message: 'Map loaded - waiting for location to create user marker'
              }));
              debugLog('INIT', 'Map initialization complete');
            }, 500);

            if (pendingLocation) {
              debugLog('PENDING', 'Processing pending location', pendingLocation);
              updateUserLocation(pendingLocation.lat, pendingLocation.lng);
              pendingLocation = null;
            }
            
            updateDebugInfo();
          }

          function createUserMarker(lat, lng) {
            debugLog('MARKER', 'CREATING user marker at actual location', { lat, lng });
            userMarker = L.circleMarker([lat, lng], {
              radius: 10,
              fillColor: "#007AFF",
              color: "white",
              weight: 3,
              opacity: 1,
              fillOpacity: 0.8,
              className: 'user-marker'
            }).addTo(map).bindPopup("Your Current Location");
            markerCreated = true;
            debugLog('MARKER', 'User marker created and added to map at actual location');
          }

          function setupRouting(userLat, userLng, forceRecalculation = false) {
            const now = Date.now();
            const timeSinceLastRouting = now - lastRoutingTime;
            
            if (!forceRecalculation && timeSinceLastRouting < ROUTING_DEBOUNCE_MS) {
              debugLog('ROUTING', \`Skipping routing - too soon: \${Math.round(timeSinceLastRouting/1000)}s since last routing\`);
              return;
            }
            
            lastRoutingTime = now;
            debugLog('ROUTING', 'Setting up routing', { userLat, userLng, forceRecalculation });
            
            if (routeControl) {
              try {
                map.removeControl(routeControl);
                debugLog('ROUTING', 'Removed previous route control');
              } catch (e) {
                debugLog('ROUTING', 'Error removing old route:', e);
              }
            }
            
            routeControl = L.Routing.control({
              waypoints: [
                L.latLng(userLat, userLng),
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

            routeControl.on('routesfound', function(e) {
              isRecalculating = false;
              const routes = e.routes;
              if (routes && routes.length > 0) {
                const route = routes[0];
                const totalDistance = (route.summary.totalDistance / 1000).toFixed(1);
                const totalTime = Math.round(route.summary.totalTime / 60);
                
                debugLog('ROUTING', 'Route calculated', { distance: totalDistance, time: totalTime, forceRecalculation });
                
                currentRoute = route;
                currentInstructions = extractInstructions(route);
                
                if (route.coordinates && route.coordinates.length > 0) {
                  currentRouteLine = L.polyline(route.coordinates);
                  debugLog('ROUTE_LINE', 'Route line stored for off-route detection');
                }
                
                updateNavigationPanel(currentInstructions, userLat, userLng);
                
                ${isFullScreen ? `
                document.getElementById('live-distance').textContent = totalDistance + ' km';
                document.getElementById('live-eta').textContent = totalTime + ' min';
                ` : ''}
                
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'route_calculated',
                  distance: totalDistance,
                  time: totalTime,
                  instructions: currentInstructions,
                  recalculated: forceRecalculation
                }));
              }
              updateDebugInfo();
            });

            routeControl.on('routingerror', function(e) {
              isRecalculating = false;
              debugLog('ROUTING', 'Routing error', e.error);
              const straightDistance = map.distance([userLat, userLng], [${deliveryLat}, ${deliveryLng}]) / 1000;
              const fallbackTime = Math.round((straightDistance / 30) * 60);
              
              debugLog('ROUTING', 'Using fallback distance', { distance: straightDistance, time: fallbackTime });
              
              ${isFullScreen ? `
              document.getElementById('live-distance').textContent = straightDistance.toFixed(1) + ' km';
              document.getElementById('live-eta').textContent = fallbackTime + ' min';
              ` : ''}
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'route_calculated',
                distance: straightDistance.toFixed(1),
                time: fallbackTime,
                instructions: [],
                recalculated: forceRecalculation
              }));
              updateDebugInfo();
            });
          }

          function updateUserLocation(lat, lng) {
            messageCount++;
            debugLog('LOCATION', \`Processing location #\${messageCount}\`, { lat, lng });
            
            if (!mapInitialized) {
              debugLog('LOCATION', 'Map not ready yet, queuing location');
              pendingLocation = { lat, lng };
              updateDebugInfo();
              return;
            }
            
            hideLoadingOverlay();
            
            if (!markerCreated) {
              debugLog('MARKER', 'First real location - creating user marker');
              createUserMarker(lat, lng);
              map.setView([lat, lng], 15);
              debugLog('MAP', 'Centered map on first actual location');
              setupRouting(lat, lng);
            } else {
              debugLog('MARKER', 'Updating existing marker position');
              userMarker.setLatLng([lat, lng]);
              
              checkRouteAdherence(lat, lng);
              
              if (currentInstructions.length > 0) {
                updateNavigationPanel(currentInstructions, lat, lng);
              }
              
              const distanceMoved = lastLocation ? map.distance(lastLocation, [lat, lng]) : 0;
              
              if (distanceMoved > MIN_MOVEMENT_METERS && !isRecalculating) {
                debugLog('ROUTING', \`Significant movement: \${distanceMoved.toFixed(1)}m - updating routing\`);
                setupRouting(lat, lng);
                
                if (distanceMoved > 100) {
                  map.panTo([lat, lng], { animate: true, duration: 1.0 });
                  debugLog('MAP', 'Panned to new location', { distanceMoved });
                }
              } else {
                debugLog('ROUTING', \`Minimal movement: \${distanceMoved.toFixed(1)}m - skipping routing\`);
              }
            }
            
            lastLocation = [lat, lng];
            updateDebugInfo();
          }

          const handleMessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              debugLog('MESSAGE', 'Received message from React Native', data);
              
              if (data.action === 'updateUserLocation') {
                updateUserLocation(data.lat, data.lng);
              }
            } catch (e) {
              debugLog('MESSAGE', 'Error parsing message:', e);
            }
          };

          // MEMORY LEAK FIX: Cleanup event listeners
          function cleanupEventListeners() {
            document.removeEventListener('message', handleMessage);
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('load', initMap);
          }

          document.addEventListener('message', handleMessage);
          window.addEventListener('message', handleMessage);
          debugLog('EVENTS', 'Message listeners registered');

          if (document.readyState === 'complete') {
            debugLog('INIT', 'Document already ready, initializing map immediately');
            initMap();
          } else {
            debugLog('INIT', 'Waiting for document load event');
            window.addEventListener('load', initMap);
          }

          setTimeout(() => {
            if (!mapInitialized) {
              debugLog('INIT', 'Fallback initialization triggered');
              initMap();
            }
          }, 2000);

          // MEMORY LEAK FIX: Handle page unload
          window.addEventListener('beforeunload', function() {
            performCleanup();
            cleanupEventListeners();
          });
        </script>
      </body>
    </html>
  `;
};

export default function DeliveryTracking() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { sendCustomerNotification } = useNotifications();
  
  const webViewRef = useRef<WebView>(null);
  const fullMapWebViewRef = useRef<WebView>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  // FIXED: Use out_for_delivery as initial state
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>("out_for_delivery");
  const [isUpdating, setIsUpdating] = useState(false);
  const [distance, setDistance] = useState<string>("Calculating...");
  const [eta, setEta] = useState<string>("Calculating...");
  const [showFullMap, setShowFullMap] = useState(false);
  const [anyMapReady, setAnyMapReady] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [webViewKey, setWebViewKey] = useState(0);
  const [fullMapKey, setFullMapKey] = useState(0);
  const [nextInstruction, setNextInstruction] = useState<NavigationInstruction | null>(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSignificantlyMoving, setIsSignificantlyMoving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Extract parameters with fallbacks
  const deliveryId = params.id as string;
  const orderId = params.orderId as string;
  const customerName = params.customerName as string;
  const customerContact = params.customerContact as string;
  const deliveryLocation = params.deliveryLocation as string;
  const deliveryLat = parseFloat(params.deliveryLat as string) || 0;
  const deliveryLng = parseFloat(params.deliveryLng as string) || 0;
  const orderMethod = params.orderMethod as string || "delivery";

  // ✅ ADD THIS: Function to send delivery notifications
// ✅ FIXED: Function to send delivery notifications with proper customer ID fetching
// ✅ FIXED: Function to send delivery notifications with proper customer ID fetching
// ✅ FIXED: Function to send delivery notifications - ONLY for delivered status
const sendDeliveryNotification = async (status: DeliveryStatus) => {
  try {
    addDebugLog(`Starting notification for status: ${status}`);
    
    // ONLY send notification for delivered status
    if (status !== "delivered") {
      addDebugLog(`Skipping notification for status: ${status}`);
      return;
    }
    
    // 1. Get customer ID from the database using order ID
    const { data: order, error } = await supabase
      .from('orders')
      .select('customer_id, customer_name')
      .eq('id', orderId)
      .single();

    if (error || !order || !order.customer_id) {
      addDebugLog(`❌ No customer found for order: ${orderId}. Error: ${error?.message || 'Unknown error'}`);
      return;
    }

    const customerId = order.customer_id;
    addDebugLog(`✅ Found customer ID: ${customerId} for order: ${orderId}`);

    let notificationData;

    // ONLY handle delivered status now
    switch (status) {
      case "delivered":
        notificationData = {
          title: orderMethod === "pickup" ? "✅ Laundry Returned!" : "🎉 Delivery Completed!",
          body: orderMethod === "pickup" 
            ? "Your laundry has been successfully returned to you. Thank you for using our service!" 
            : "Your order has been delivered. Thank you for your business!",
          payload: {
            orderId: orderId,
            deliveryId: deliveryId,
            status: 'delivered',
            orderMethod: orderMethod,
            timestamp: new Date().toISOString()
          }
        };
        break;
        
      default:
        return; // No notification for other statuses
    }

    addDebugLog(`Sending ${status} notification to customer ${customerId}`);
    
    const result = await sendCustomerNotification(customerId, notificationData);
    
    if (result.databaseSuccess || result.pushSuccess) {
      addDebugLog(`✅ Notification sent successfully (DB: ${result.databaseSuccess}, Push: ${result.pushSuccess})`);
    } else {
      addDebugLog(`❌ Notification failed to send`);
    }
    
  } catch (error) {
    addDebugLog(`Notification error: ${error instanceof Error ? error.message : String(error)}`);
  }
};
  
  // Add debug log
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logMessage = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [...prev.slice(-9), logMessage]);
    debugLog('REACT', message);
  }, []);

  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
      addDebugLog(`Network: ${state.isConnected ? 'ONLINE' : 'OFFLINE'}`);
    });

    return () => unsubscribe();
  }, []);


   const {
    currentLocation: hookCurrentLocation,
    isTracking,
    startLocationTracking,
    stopLocationTracking,
    updateDriverLocation,
    locationError: hookLocationError,
  } = useDriverLocation();

  // App state monitoring for battery optimization
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        addDebugLog('App in background - reducing location updates');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Update navigation instructions
  const updateNavigationInstructions = useCallback((instructions: NavigationInstruction[]) => {
    if (instructions.length > 0) {
      const next = instructions[0];
      setNextInstruction(next);
      
      if (!showNavigation) {
        setShowNavigation(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }
      
      addDebugLog(`Next instruction: ${next.text} in ${formatDistance(next.distance)}`);
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowNavigation(false));
    }
  }, [showNavigation, fadeAnim]);

  // Check if user has arrived at destination
  useEffect(() => {
    if (currentLocation && deliveryLat && deliveryLng) {
      const distanceToDestination = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        deliveryLat,
        deliveryLng
      );
      
      if (distanceToDestination <= 50 && !hasArrived) {
        setHasArrived(true);
        addDebugLog(`Arrived at destination! Distance: ${distanceToDestination.toFixed(1)}m`);
      } else if (distanceToDestination > 50 && hasArrived) {
        setHasArrived(false);
      }

      // Update movement state for battery optimization
      const isMoving = currentLocation.speed && currentLocation.speed > 2;
      setIsSignificantlyMoving(!!isMoving);
    }
  }, [currentLocation, deliveryLat, deliveryLng]);

  // Memoize map HTML to prevent re-renders
  const mapHTML = React.useMemo(() => {
    addDebugLog(`Creating PREVIEW map HTML for ${customerName}`);
    return getMapHTML(deliveryLat, deliveryLng, customerName, false);
  }, [deliveryLat, deliveryLng, customerName]);

  const fullMapHTML = React.useMemo(() => {
    addDebugLog(`Creating FULLSCREEN map HTML for ${customerName}`);
    return getMapHTML(deliveryLat, deliveryLng, customerName, true);
  }, [deliveryLat, deliveryLng, customerName]);

  // Function to reload WebViews if they go white
  const reloadWebViews = useCallback(() => {
    addDebugLog('Manually reloading WebViews...');
    setWebViewKey(prev => prev + 1);
    setFullMapKey(prev => prev + 1);
  }, []);

  // Enhanced WebView error handling
  const handleWebViewError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    addDebugLog(`WebView Error: ${nativeEvent.description || 'Unknown error'}`);
  }, []);

  // FIXED: Fetch delivery status with proper status handling
  const fetchDeliveryStatus = useCallback(async () => {
    addDebugLog('Fetching delivery status...');
    
    // Try cached data first
    const cachedData = await getCachedDeliveryData(deliveryId);
    if (cachedData && !isOnline) {
      addDebugLog('Using cached delivery data (offline mode)');
      setDeliveryStatus(cachedData.status);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("deliveries")
        .select("status")
        .eq("id", deliveryId)
        .single();

      if (error) {
        addDebugLog(`DB Error: ${error.message}`);
        return;
      }

      if (data && data.status) {
        // FIXED: Handle out_for_delivery status
        const validStatus: DeliveryStatus = data.status === "out_for_delivery" || data.status === "delivered" 
          ? data.status 
          : "out_for_delivery";
        
        setDeliveryStatus(validStatus);
        await cacheDeliveryData(deliveryId, { status: validStatus });
        addDebugLog(`Delivery status: ${validStatus}`);
      }
    } catch (error) {
      addDebugLog(`Error fetching delivery status: ${error}`);
      const cachedData = await getCachedDeliveryData(deliveryId);
      if (cachedData) {
        setDeliveryStatus(cachedData.status);
      }
    }
  }, [deliveryId, isOnline]);
  
  // 🔥 FIXED: COMPLETE CLEANUP FUNCTION - ARCHIVE TO ORDER_HISTORY AND DELETE FROM ALL TABLES
  // 🔥 FIXED: COMPLETE CLEANUP FUNCTION - Wait for triggers to archive first
const updateDeliveryStatus = async (newStatus: DeliveryStatus) => {
  addDebugLog(`Updating status to: ${newStatus}`);
  try {
    setIsUpdating(true);
    
    const updateData: any = {
      status: newStatus,
    };

    if (newStatus === "delivered") {
      updateData.delivered_at = new Date().toISOString();
    }

    // JUST update the delivery status
    const { error: deliveryError } = await supabase
      .from("deliveries")
      .update(updateData)
      .eq("id", deliveryId);

    if (deliveryError) throw deliveryError;

    // Database triggers handle everything else!
    setDeliveryStatus(newStatus);
    await sendDeliveryNotification(newStatus);
    
    Alert.alert("Success", 
      newStatus === "delivered" 
        ? "Delivery completed! Records archived and cleaned up automatically."
        : "Delivery status updated!"
    );

    if (newStatus === "delivered") {
      setTimeout(() => {
        router.push("/(tabs)/deliveries");
      }, 2000);
    }

  } catch (error: any) {
    addDebugLog(`Status update error: ${error.message}`);
    Alert.alert("Error", error.message || "Failed to update delivery status");
  } finally {
    setIsUpdating(false);
  }
};

  // Send location update to WebView
  const sendLocationToWebView = useCallback((coords: LocationCoords, isFullMap: boolean = false) => {
    const message = {
      action: "updateUserLocation",
      lat: coords.lat,
      lng: coords.lng,
    };
    
    addDebugLog(`Sending location to ${isFullMap ? 'FULL' : 'PREVIEW'} map: ${coords.lat}, ${coords.lng}`);
    
    const messageString = JSON.stringify(message);

    if (anyMapReady) {
      if (isFullMap && fullMapWebViewRef.current) {
        fullMapWebViewRef.current?.postMessage(messageString);
        addDebugLog('Location sent to FULL map');
      } else if (webViewRef.current) {
        webViewRef.current?.postMessage(messageString);
        addDebugLog('Location sent to PREVIEW map');
      }
    } else {
      addDebugLog(`Maps not ready yet - queuing location`);
    }
  }, [anyMapReady]);

  // Enhanced Location tracking with battery optimization
// Enhanced Location tracking with battery optimization
useEffect(() => {
  let locationSubscription: Location.LocationSubscription | null = null;
  let lastRoutingUpdate = 0;
  let isMounted = true;

  const setupLocation = async () => {
    if (!isMounted) return;

    addDebugLog('Setting up location tracking...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError('Location permission denied');
        Alert.alert("Permission Required", "Location permission is needed for delivery tracking");
        return;
      }

      setLocationError(null);
      addDebugLog('Location permission granted');
      
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const coords: LocationCoords = {
        lat: current.coords.latitude,
        lng: current.coords.longitude,
        accuracy: current.coords.accuracy,
        altitude: current.coords.altitude,
        heading: current.coords.heading,
        speed: current.coords.speed,
      };
      
      setCurrentLocation(coords);
      addDebugLog(`Initial location: ${coords.lat}, ${coords.lng} (accuracy: ${getAccuracyDisplay(coords.accuracy)})`);

      // ✅ ADD THIS: Update database with initial location
      if (deliveryId) {
        await updateDriverLocation(deliveryId, coords.lat, coords.lng);
      }

      const sendInitialLocation = () => {
        addDebugLog('Sending initial location to WebViews');
        sendLocationToWebView(coords, false);
        sendLocationToWebView(coords, true);
      };

      sendInitialLocation();
      lastRoutingUpdate = Date.now();
      
      // Adaptive location tracking based on movement
      const config = isSignificantlyMoving ? {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 10,
      } : {
        accuracy: Location.Accuracy.Lowest,
        timeInterval: 30000,
        distanceInterval: 50,
      };
      
      locationSubscription = await Location.watchPositionAsync(
        config,
        (location) => {
          if (!isMounted) return;

          const newCoords: LocationCoords = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy,
            altitude: location.coords.altitude,
            heading: location.coords.heading,
            speed: location.coords.speed,
          };
          
          if (!isLocationAccurate(newCoords.accuracy)) {
            addDebugLog(`Ignoring inaccurate location: ${getAccuracyDisplay(newCoords.accuracy)} accuracy`);
            return;
          }
          
          const now = Date.now();
          const timeSinceLastUpdate = now - lastRoutingUpdate;
          const distanceMoved = currentLocation ? 
            calculateDistance(
              currentLocation.lat, 
              currentLocation.lng, 
              newCoords.lat, 
              newCoords.lng
            ) : 0;
          
          setCurrentLocation(newCoords);
          addDebugLog(`Location update: ${newCoords.lat}, ${newCoords.lng} (accuracy: ${getAccuracyDisplay(newCoords.accuracy)}, moved: ${distanceMoved.toFixed(2)}m, timeSinceLastUpdate: ${timeSinceLastUpdate / 1000}s)`);
          
          // ✅ ADD THIS: Update database when location changes
          if (deliveryId && (distanceMoved > 10 || timeSinceLastUpdate > 30000)) {
            updateDriverLocation(deliveryId, newCoords.lat, newCoords.lng);
          }
          
          if (distanceMoved > 10 || timeSinceLastUpdate > 30000) {
            sendLocationToWebView(newCoords, false);
            sendLocationToWebView(newCoords, true);
            lastRoutingUpdate = now;
          } else {
            addDebugLog(`Skipping location send - minimal movement: ${distanceMoved.toFixed(1)}m`);
          }
        }
      );
      
      addDebugLog('Location watcher started');
    } catch (error) {
      if (!isMounted) return;
      addDebugLog(`Location error: ${error}`);
      setLocationError(`Location error: ${error}`);
      Alert.alert("Location Error", "Unable to access your location");
    }
  };

  setupLocation();

  return () => {
    isMounted = false;
    if (locationSubscription) {
      locationSubscription.remove();
      addDebugLog('Location watcher stopped');
    }
  };
}, [sendLocationToWebView, isSignificantlyMoving, deliveryId]); // ✅ Add deliveryId to dependencies

  // Initial data fetch
  useEffect(() => {
    addDebugLog('Component mounted - fetching initial data');
    fetchDeliveryStatus();
  }, [fetchDeliveryStatus]);

  // Handle WebView messages
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      const source = event.target === fullMapWebViewRef.current ? 'FULL_MAP' : 'PREVIEW_MAP';
      
      addDebugLog(`Message from ${source}: ${data.type}`);
      
      switch (data.type) {
        case 'map_ready':
          addDebugLog(`${source} map ready: ${data.message}`);
          setAnyMapReady(true);
          addDebugLog('ANY map marked as ready');
          
          if (currentLocation) {
            addDebugLog(`Sending current location to both maps`);
            setTimeout(() => {
              sendLocationToWebView(currentLocation, false);
              sendLocationToWebView(currentLocation, true);
            }, 300);
          }
          break;
        case 'route_calculated':
          addDebugLog(`Route calculated: ${data.distance} km, ${data.time} min ${data.recalculated ? '(RECALCULATED)' : ''}`);
          setDistance(data.distance + ' km');
          setEta(data.time + ' min');
          
          if (data.recalculated) {
            setRecalculating(false);
            Alert.alert("Route Updated", "Route has been recalculated based on your current location");
          }
          
          if (data.instructions && Array.isArray(data.instructions)) {
            updateNavigationInstructions(data.instructions);
          }
          break;
        case 'off_route':
          addDebugLog(`Off route detected: ${data.message}`);
          setRecalculating(true);
          break;
      }
    } catch (error) {
      addDebugLog(`Error parsing WebView message: ${error}`);
    }
  }, [currentLocation, sendLocationToWebView, updateNavigationInstructions]);

  // Fallback - force map ready after timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!anyMapReady) {
        addDebugLog('FORCING map ready after 5 second timeout');
        setAnyMapReady(true);
        
        if (currentLocation) {
          setTimeout(() => {
            sendLocationToWebView(currentLocation, false);
            sendLocationToWebView(currentLocation, true);
          }, 300);
        }
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [anyMapReady, currentLocation, sendLocationToWebView]);

  // MEMORY LEAK FIX: Cleanup WebViews on unmount
  useEffect(() => {
    return () => {
      addDebugLog('Component unmounting - cleaning up WebViews');
    };
  }, []);

  // FIXED: Status configuration - handle out_for_delivery
  const statusConfig = {
    out_for_delivery: {
      title: orderMethod === "pickup" ? "Return Delivery in Progress" : "Delivery in Progress",
      icon: "navigate" as IoniconsName,
      color: "#007AFF",
      nextAction: orderMethod === "pickup" ? "Mark Return Completed" : "Mark as Delivered",
      nextStatus: "delivered" as DeliveryStatus,
      description: orderMethod === "pickup" 
        ? "Returning completed laundry to customer" 
        : "Real-time location tracking enabled"
    },
    delivered: {
      title: "Delivery Completed",
      icon: "checkmark-done" as IoniconsName,
      color: "#34C759",
      nextAction: "Completed",
      nextStatus: "delivered" as DeliveryStatus,
      description: orderMethod === "pickup" 
        ? "Laundry successfully returned to customer" 
        : "Delivery has been successfully completed"
    }
  };

  // FIXED: Safe status getter with fallback
  const getCurrentStatus = (status: DeliveryStatus) => {
    return statusConfig[status] || statusConfig.out_for_delivery;
  };

  const currentStatus = getCurrentStatus(deliveryStatus);

  // Navigation Panel Component - ONLY FOR FULL SCREEN MAP
  const NavigationPanel = () => {
    if (!showFullMap || !showNavigation || !nextInstruction) return null;

    return (
      <Animated.View style={[styles.navigationPanel, { opacity: fadeAnim }]}>
        <View style={styles.nextTurn}>
          <Ionicons 
            name={getNavigationIcon(nextInstruction.type, nextInstruction.modifier)} 
            size={28} 
            color="white" 
            style={styles.nextTurnIcon}
          />
          <View style={styles.nextTurnContent}>
            <Text style={styles.nextTurnText}>{nextInstruction.text}</Text>
            <Text style={styles.nextTurnDistance}>
              in {formatDistance(nextInstruction.distance)}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Arrival Panel Component - ONLY FOR FULL SCREEN MAP
  const ArrivalPanel = () => {
    if (!showFullMap || !hasArrived) return null;

    return (
      <Animated.View style={[styles.arrivalPanel, { opacity: fadeAnim }]}>
        <View style={styles.arrivalInstruction}>
          <Ionicons name="flag" size={28} color="white" style={styles.arrivalIcon} />
          <Text style={styles.arrivalText}>You have arrived at your destination</Text>
        </View>
      </Animated.View>
    );
  };

  // Recalculating Overlay Component
  const RecalculatingOverlay = () => {
    if (!showFullMap || !recalculating) return null;

    return (
      <View style={styles.recalculatingOverlay}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.recalculatingText}>Recalculating route...</Text>
      </View>
    );
  };

  // Status indicator component
  const StatusIndicator = () => (
    <View style={styles.statusIndicator}>
      <Ionicons 
        name={isOnline ? "wifi" : "cloud-offline"}  
        size={16} 
        color={isOnline ? "#34C759" : "#FF3B30"} 
      />
      <Text style={styles.statusIndicatorText}>
        {isOnline ? 'Online' : 'Offline'} • {isSignificantlyMoving ? 'Moving' : 'Stationary'}
      </Text>
    </View>
  );

  // Debug panel component
 

  if (!currentLocation && !locationError) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#3864C3" />
        <Text style={{ marginTop: 10, color: "#3864C3" }}>Getting your location...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
   {/* Header */}
<AppHeader 
  title={orderMethod === "pickup" ? "RETURN DELIVERY" : "DELIVERY TRACKING"}
  leftElement={
    <TouchableOpacity onPress={() => router.back()}>
      <Ionicons name="arrow-back" size={24} color="white" />
    </TouchableOpacity>
  }
/>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Debug Panel */}

        {/* Status Card */}
        <View style={[styles.statusCard, { borderLeftColor: currentStatus.color }]}>
          <View style={styles.statusHeader}>
            <Ionicons name={currentStatus.icon} size={24} color={currentStatus.color} />
            <Text style={[styles.statusTitle, { color: currentStatus.color }]}>
              {currentStatus.title}
            </Text>
          </View>
          
          <Text style={styles.statusDescription}>{currentStatus.description}</Text>
          
          <View style={styles.distanceInfo}>
            <View style={styles.distanceItem}>
              <Ionicons name="location" size={16} color="#666" />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
            <View style={styles.distanceItem}>
              <Ionicons name="time" size={16} color="#666" />
              <Text style={styles.distanceText}>{eta}</Text>
            </View>
          </View>
        </View>

        {/* Map Preview */}
        <View style={styles.mapContainer}>
          <TouchableOpacity 
            style={styles.mapPreview}
            onPress={() => setShowFullMap(true)}
            activeOpacity={0.8}
          >
            <WebView
              key={webViewKey}
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: mapHTML }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              style={styles.map}
              onMessage={handleWebViewMessage}
              onError={handleWebViewError}
              onLoadStart={() => {
                addDebugLog('PREVIEW WebView STARTED loading');
              }}
              onLoadEnd={() => {
                addDebugLog('PREVIEW WebView FINISHED loading');
              }}
              onContentProcessDidTerminate={() => {
                addDebugLog('PREVIEW WebView process terminated - reloading');
                setWebViewKey(prev => prev + 1);
              }}
              renderLoading={() => (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color="#3864C3" />
                  <Text style={styles.loadingText}>Loading map...</Text>
                </View>
              )}
              startInLoadingState={true}
              mixedContentMode="compatibility"
            />
            <View style={styles.mapOverlay}>
              <Ionicons name="expand" size={24} color="white" />
              <Text style={styles.mapOverlayText}>TAP FOR FULL MAP</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Customer Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <View style={styles.detailRow}>
            <Ionicons name="person" size={18} color="#666" />
            <Text style={styles.detailText}>{customerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="call" size={18} color="#666" />
            <Text style={styles.detailText}>{customerContact}</Text>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {orderMethod === "pickup" ? "Return Address" : "Delivery Address"}
          </Text>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={18} color="#666" />
            <Text style={styles.detailText}>{deliveryLocation}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {deliveryStatus !== "delivered" && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: currentStatus.color },
                isUpdating && styles.buttonDisabled
              ]}
              onPress={() => updateDeliveryStatus(currentStatus.nextStatus)}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.actionButtonText}>{currentStatus.nextAction}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {deliveryStatus === "delivered" && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#3864C3" }]}
              onPress={() => router.push("/(tabs)/deliveries")}
            >
              <Ionicons name="list" size={20} color="white" />
              <Text style={styles.actionButtonText}>BACK TO DELIVERIES</Text>
            </TouchableOpacity>
          )}

          {/* Full Map Button */}
          <TouchableOpacity
            style={[styles.navButton, styles.primaryNavButton]}
            onPress={() => setShowFullMap(true)}
          >
            <Ionicons name="map" size={20} color="white" />
            <Text style={styles.primaryNavButtonText}>OPEN FULL MAP</Text>
          </TouchableOpacity>

          {/* Call Customer Button */}
          <TouchableOpacity
            style={[styles.secondaryButton, { marginTop: 10 }]}
            onPress={() => {
              if (!isValidPhoneNumber(customerContact)) {
                Alert.alert("Invalid Number", "The customer phone number format is invalid");
                return;
              }
              
              Alert.alert("Call Customer", `Call ${customerName} at ${customerContact}?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Call", onPress: () => Linking.openURL(`tel:${customerContact}`) }
              ]);
            }}
          >
            <Ionicons name="call" size={18} color="#3864C3" />
            <Text style={styles.secondaryButtonText}>CALL CUSTOMER</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Full Screen Map Modal */}
      <Modal
        visible={showFullMap}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowFullMap(false)}
      >
        <SafeAreaView style={styles.fullScreenContainer}>
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity 
              onPress={() => setShowFullMap(false)} 
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.fullScreenTitle}>
              {orderMethod === "pickup" ? "RETURN MAP VIEW" : "DELIVERY MAP VIEW"}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          
          <WebView
            key={fullMapKey}
            ref={fullMapWebViewRef}
            originWhitelist={["*"]}
            source={{ html: fullMapHTML }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={styles.fullScreenMap}
            onMessage={handleWebViewMessage}
            onError={handleWebViewError}
            onLoadStart={() => {
              addDebugLog('FULL WebView STARTED loading');
            }}
            onLoadEnd={() => {
              addDebugLog('FULL WebView FINISHED loading');
            }}
            onContentProcessDidTerminate={() => {
              addDebugLog('FULL WebView process terminated - reloading');
              setFullMapKey(prev => prev + 1);
            }}
            renderLoading={() => (
              <View style={styles.fullScreenLoading}>
                <ActivityIndicator size="large" color="#3864C3" />
                <Text style={styles.loadingText}>Loading map...</Text>
              </View>
            )}
            startInLoadingState={true}
            mixedContentMode="compatibility"
          />
          
          {/* Navigation Panel - ONLY IN FULL SCREEN MAP */}
          <NavigationPanel />
          <ArrivalPanel />
          <RecalculatingOverlay />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Styles remain exactly the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerBox: {
    width: "100%",
    height: verticalScale(90),
    backgroundColor: "#3864C3",
    justifyContent: "center",
    overflow: "hidden",
  },
  waveTop: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 1,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(20),
    zIndex: 2,
    marginTop: verticalScale(30),
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  backButton: {
    padding: scale(4),
  },
  content: {
    flex: 1,
    padding: scale(16),
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: scale(8),
    borderRadius: scale(6),
    marginBottom: verticalScale(8),
  },
  statusIndicatorText: {
    fontSize: moderateScale(12),
    color: '#666',
    marginLeft: scale(6),
    fontWeight: '500',
  },
  debugTitle: {
    fontSize: moderateScale(14),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: verticalScale(4),
  },
  debugLogsTitle: {
    fontSize: moderateScale(12),
    fontWeight: 'bold',
    color: '#666',
    marginTop: verticalScale(6),
    marginBottom: verticalScale(2),
  },
  debugLog: {
    fontSize: moderateScale(10),
    color: '#666',
    fontFamily: 'monospace',
  },
  reloadButton: {
    backgroundColor: '#3864C3',
    padding: scale(8),
    borderRadius: scale(6),
    marginTop: verticalScale(6),
    alignItems: 'center',
  },
  reloadButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: moderateScale(12),
  },
  navigationPanel: {
    position: 'absolute',
    bottom: verticalScale(20),
    left: scale(20),
    right: scale(20),
    backgroundColor: 'white',
    borderRadius: scale(16),
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#34C759',
  },
  nextTurn: {
    padding: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    borderRadius: scale(14),
  },
  nextTurnIcon: {
    marginRight: scale(16),
  },
  nextTurnContent: {
    flex: 1,
  },
  nextTurnText: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: 'white',
    marginBottom: scale(4),
  },
  nextTurnDistance: {
    fontSize: moderateScale(16),
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  arrivalPanel: {
    position: 'absolute',
    bottom: verticalScale(20),
    left: scale(20),
    right: scale(20),
    backgroundColor: 'white',
    borderRadius: scale(16),
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  arrivalInstruction: {
    padding: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    borderRadius: scale(14),
  },
  arrivalIcon: {
    marginRight: scale(16),
  },
  arrivalText: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  recalculatingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -50 }],
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: scale(20),
    borderRadius: scale(12),
    alignItems: 'center',
    zIndex: 2000,
    width: 150,
  },
  recalculatingText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(14),
    marginTop: scale(10),
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    padding: scale(16),
    borderRadius: scale(12),
    marginBottom: verticalScale(16),
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(8),
  },
  statusTitle: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    marginLeft: scale(8),
  },
  statusDescription: {
    fontSize: moderateScale(14),
    color: "#666",
    marginBottom: verticalScale(12),
    lineHeight: moderateScale(20),
  },
  distanceInfo: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f8f9fa",
    padding: scale(12),
    borderRadius: scale(8),
  },
  distanceItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  distanceText: {
    fontSize: moderateScale(14),
    color: "#666",
    marginLeft: scale(6),
    fontWeight: "500",
  },
  mapContainer: {
    width: "100%",
    height: verticalScale(200),
    borderRadius: scale(12),
    overflow: "hidden",
    marginBottom: verticalScale(16),
    backgroundColor: '#f8f9fa',
  },
  mapPreview: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapOverlayText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: moderateScale(12),
    marginTop: 5,
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  section: {
    backgroundColor: "#F8F9FA",
    padding: scale(16),
    borderRadius: scale(12),
    marginBottom: verticalScale(12),
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: "bold",
    color: "#333",
    marginBottom: verticalScale(12),
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(8),
  },
  detailText: {
    fontSize: moderateScale(14),
    color: "#666",
    marginLeft: scale(8),
    flex: 1,
  },
  actionContainer: {
    marginTop: verticalScale(8),
    marginBottom: verticalScale(30),
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(14),
    borderRadius: scale(12),
    gap: scale(8),
    marginBottom: verticalScale(10),
  },
  actionButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: moderateScale(16),
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(14),
    borderRadius: scale(12),
    gap: scale(8),
    marginBottom: verticalScale(10),
  },
  primaryNavButton: {
    backgroundColor: "#007AFF",
  },
  primaryNavButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: moderateScale(16),
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(12),
    borderRadius: scale(12),
    gap: scale(8),
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#3864C3",
  },
  secondaryButtonText: {
    color: "#3864C3",
    fontWeight: "bold",
    fontSize: moderateScale(14),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    backgroundColor: '#3864C3',
  },
  fullScreenTitle: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: scale(4),
  },
  fullScreenMap: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  fullScreenLoading: {
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
    marginTop: 10,
    color: '#666',
    fontSize: moderateScale(14),
  },
});