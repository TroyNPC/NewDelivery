import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Linking,
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

export default function PickupReceived() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const webRef = useRef<WebView>(null);

  const {
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
    acceptedAt,
  } = useLocalSearchParams();

  const [initialLocation, setInitialLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [arrivalTime, setArrivalTime] = useState(
    new Date(Date.now() + 10 * 60000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  );

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
        const coords = {
          lat: current.coords.latitude,
          lng: current.coords.longitude,
        };
        setInitialLocation(coords);

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 3000,
            distanceInterval: 2,
          },
          (loc) => {
            const newCoords = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            };
            if (webRef.current) {
              webRef.current.postMessage(
                JSON.stringify({
                  action: "updateUserLocation",
                  lat: newCoords.lat,
                  lng: newCoords.lng,
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

  const mapHTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
        .leaflet-routing-container { display: none !important; }
        /* ✅ Static GPS circle (no blinking or pulse) */
        .gps-circle {
          width: 24px;
          height: 24px;
          background: rgba(0, 136, 255, 0.3);
          border: 4px solid #007bff;
          border-radius: 50%;
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

        const destMarker = L.marker([destLat, destLng]).addTo(map).bindPopup("Pickup Destination");

        const gpsIcon = L.divIcon({
          className: '',
          html: '<div class="gps-circle"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        let userMarker = L.marker([startLat, startLng], { icon: gpsIcon }).addTo(map);

        let routeLine = null;

        // ✅ Function to draw or update route (detour-aware)
        async function drawRoute(lat, lng) {
          try {
            const response = await fetch(
              \`https://router.project-osrm.org/route/v1/driving/\${lng},\${lat};\${destLng},\${destLat}?overview=full&geometries=geojson\`
            );
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
              const route = data.routes[0].geometry;
              if (routeLine) map.removeLayer(routeLine);
              routeLine = L.geoJSON(route, { color: '#3864C3', weight: 5 }).addTo(map);
            }
          } catch (err) {
            console.error("Route update error:", err);
          }
        }

        // ✅ Initial route
        drawRoute(startLat, startLng);

        // ✅ Live updates: move marker + recalc route
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

  const handleCall = () => {
    if (number) Linking.openURL(`tel:${number}`);
    else alert("No phone number available");
  };

  const handleArrived = () => {
    setArrivalTime(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

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
            onPress={() => router.push("/(tabs)/page/pickups")}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pickups</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.forText}>For: {name}</Text>

        <View style={styles.phoneRow}>
          <Ionicons name="call-outline" size={20} color="#000" />
          <Text style={styles.phoneText}>{number || "No number provided"}</Text>
          <TouchableOpacity style={styles.callButton} onPress={handleCall}>
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            Pickup Arrived at:{" "}
            <Text style={styles.bold}>
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </Text>
          <Text style={styles.timeText}>
            Destination Arrival Time: <Text style={styles.bold}>{arrivalTime}</Text>
          </Text>
        </View>

        <View style={styles.mapBox}>
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={{ html: mapHTML }}
            javaScriptEnabled
            domStorageEnabled
            style={styles.map}
          />
        </View>

        <TouchableOpacity style={styles.arriveButton} onPress={handleArrived}>
          <Text style={styles.arriveText}>Arrived at Destination</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  headerBox: { width: "100%", backgroundColor: "#0AADFF", justifyContent: "center", overflow: "hidden" },
  waveTop: { position: "absolute", top: 0, left: 0, zIndex: 1 },
  headerContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: verticalScale(40), zIndex: 2 },
  headerTitle: { color: "#fff", fontWeight: "bold", fontSize: moderateScale(20) },
  backButton: { position: "absolute", left: 20, top: verticalScale(-5), padding: 6 },
  body: { paddingHorizontal: scale(20), marginTop: verticalScale(10) },
  forText: { fontSize: moderateScale(15), fontWeight: "bold", marginBottom: verticalScale(6) },
  phoneRow: { flexDirection: "row", alignItems: "center", marginBottom: verticalScale(10) },
  phoneText: { fontSize: moderateScale(14), marginLeft: scale(5), flex: 1 },
  callButton: { backgroundColor: "#007AFF", paddingVertical: verticalScale(5), paddingHorizontal: scale(15), borderRadius: scale(6) },
  callButtonText: { color: "#fff", fontWeight: "bold", fontSize: moderateScale(13) },
  timeRow: { marginBottom: verticalScale(8) },
  timeText: { fontSize: moderateScale(13), color: "#000" },
  bold: { fontWeight: "bold" },
  mapBox: { width: "100%", height: verticalScale(220), borderRadius: scale(12), overflow: "hidden", marginVertical: verticalScale(10) },
  map: { flex: 1 },
  arriveButton: { backgroundColor: "#0AADFF", paddingVertical: verticalScale(10), borderRadius: scale(8), alignItems: "center", marginTop: verticalScale(10) },
  arriveText: { color: "#fff", fontWeight: "bold", fontSize: moderateScale(14) },
});
