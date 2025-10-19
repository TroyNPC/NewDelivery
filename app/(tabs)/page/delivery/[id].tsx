import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  moderateScale,
  scale,
  verticalScale,
} from "react-native-size-matters";
import Svg, { Path } from "react-native-svg";
import { WebView } from "react-native-webview";

export default function DeliveryDetails() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const {
    id,
    name,
    address,
    weight,
    price,
    time,
    distance,
    status,
    number,
    lat,
    lng,
  } = useLocalSearchParams();

  const [initialLocation, setInitialLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const webViewRef = useRef<WebView>(null);

  // ✅ Full live GPS logic from MapScreen
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Permission denied");
          return;
        }

        const current = await Location.getCurrentPositionAsync({});
        setInitialLocation({
          lat: current.coords.latitude,
          lng: current.coords.longitude,
        });

        // Watch and update live GPS position
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 3000,
            distanceInterval: 2,
          },
          (loc) => {
            const coords = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            };
            if (webViewRef.current) {
              webViewRef.current.postMessage(
                JSON.stringify({
                  action: "updateUserLocation",
                  lat: coords.lat,
                  lng: coords.lng,
                })
              );
            }
          }
        );
      } catch (err) {
        console.error("Location error:", err);
      }
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  if (!initialLocation) {
    return (
      <SafeAreaView
        style={[styles.container, { justifyContent: "center", alignItems: "center" }]}
      >
        <Text>Loading your location...</Text>
      </SafeAreaView>
    );
  }

  // ✅ Map HTML identical to MapScreen logic (live GPS + circle + route)
  const mapHTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.js"></script>
      <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.css" />
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
        .leaflet-routing-container { display: none !important; }

        /* ✅ GPS circle identical to MapScreen */
        .gps-circle {
          width: 24px;
          height: 24px;
          background: rgba(0, 136, 255, 0.3);
          border: 4px solid #007bff;
          border-radius: 50%;
        }
        .pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const destLat = ${lat};
        const destLng = ${lng};
        const startLat = ${initialLocation.lat};
        const startLng = ${initialLocation.lng};

        const map = L.map('map').setView([startLat, startLng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        // ✅ Destination marker
        const destMarker = L.marker([destLat, destLng]).addTo(map).bindPopup("Delivery Destination");

        // ✅ Live GPS circle marker
        const gpsIcon = L.divIcon({
          className: '',
          html: '<div class="gps-circle pulse"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        let userMarker = L.marker([startLat, startLng], { icon: gpsIcon }).addTo(map);
        let routeControl = null;

        function drawRoute(fromLat, fromLng) {
          if (routeControl) map.removeControl(routeControl);
          routeControl = L.Routing.control({
            waypoints: [
              L.latLng(fromLat, fromLng),
              L.latLng(destLat, destLng)
            ],
            lineOptions: { styles: [{ color: '#3864C3', weight: 5 }] },
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: false,
            show: false,
          }).addTo(map);
        }

        drawRoute(startLat, startLng);

        // ✅ Handle messages from React Native
        document.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.action === 'updateUserLocation') {
              const { lat, lng } = data;
              userMarker.setLatLng([lat, lng]);
              drawRoute(lat, lng);
            }
          } catch (e) {
            console.error("WebView message error:", e);
          }
        });
      </script>
    </body>
  </html>
  `;

  return (
    <SafeAreaView style={[styles.container, { minHeight: height }]}>
      <View style={[styles.headerBox, { height: verticalScale(100) }]}>
        <Svg
          width={"100%"}
          height={verticalScale(200)}
          viewBox="0 0 1200 320"
          style={styles.waveTop}
          preserveAspectRatio="none"
        >
          <Path fill="#3864C3" d="M0,64 C480,-32 720,256 1440,64 L1440,0 L0,0 Z" />
        </Svg>

        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/page/deliveries")}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Deliveries</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.forText}>For: {name}</Text>

        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: mapHTML }}
            javaScriptEnabled
            domStorageEnabled
            style={styles.map}
          />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#000" />
            <Text style={styles.infoText}>{address}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="scale-outline" size={18} color="#000" />
            <Text style={styles.infoText}>{weight}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={18} color="#000" />
            <Text style={styles.infoText}>{price}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="bicycle-outline" size={18} color="#000" />
            <Text style={styles.infoText}>{time} | {distance}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/page/delivery/accepted/[id]" as unknown as any,
              params: {
                id,
                name,
                address,
                weight,
                price,
                time,
                distance,
                status,
                number,
                lat,
                lng,
              },
            })
          }
        >
          <Text style={styles.acceptButtonText}>
            {status === "Picked Up and Delivery"
              ? "Accept Pick Up and Delivery"
              : "Accept Delivery"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  headerBox: {
    width: "100%",
    backgroundColor: "#0AADFF",
    justifyContent: "center",
    overflow: "hidden",
  },
  waveTop: { position: "absolute", top: 0, left: 0, zIndex: 1 },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(40),
    zIndex: 2,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: moderateScale(20),
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: verticalScale(-5),
    padding: 6,
  },
  content: {
    paddingHorizontal: scale(20),
    marginTop: verticalScale(10),
  },
  forText: {
    fontSize: moderateScale(16),
    fontWeight: "bold",
    marginBottom: verticalScale(10),
  },
  mapContainer: {
    width: "100%",
    height: verticalScale(200),
    borderRadius: scale(12),
    overflow: "hidden",
    marginBottom: verticalScale(15),
  },
  map: { flex: 1 },
  infoSection: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: verticalScale(10),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(6),
  },
  infoText: {
    fontSize: moderateScale(13),
    color: "#000",
    marginLeft: scale(8),
    flexShrink: 1,
  },
  acceptButton: {
    marginTop: verticalScale(15),
    backgroundColor: "#007AFF",
    paddingVertical: verticalScale(14),
    borderRadius: scale(10),
  },
  acceptButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
});
