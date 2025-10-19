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

export default function PickupDetails() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const webViewRef = useRef<WebView>(null);

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
    eta,
  } = useLocalSearchParams();

  const [initialLocation, setInitialLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // ✅ Full live GPS logic (copied exactly)
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
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text>Loading your location...</Text>
      </SafeAreaView>
    );
  }

  // ✅ Exact map HTML copied from memorized logic
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
        const destMarker = L.marker([destLat, destLng]).addTo(map).bindPopup("Pickup Destination");

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
              // ❌ Removed map.panTo to stop auto-centering
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

  return (
    <SafeAreaView style={[styles.container, { minHeight: height }]}>
      {/* Header */}
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
            onPress={() =>
              router.push({
                pathname: "/(tabs)/page/pickup/accepted" as unknown as any,
                params: {
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
                  eta,
                },
              })
            }
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pickups</Text>
        </View>
      </View>

      {/* Content */}
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
            Pickup Accepted at: <Text style={styles.bold}>{acceptedAt || "N/A"}</Text>
          </Text>
          <Text style={styles.timeText}>
            Estimated Arrival: <Text style={styles.bold}>{eta || "N/A"}</Text>
          </Text>
        </View>

        <View style={styles.mapBox}>
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: mapHTML }}
            javaScriptEnabled
            domStorageEnabled
            style={styles.map}
          />
        </View>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/page/pickup/accepted/pickupreceived/[id]" as unknown as any,
              params: {
                name,
                address,
                weight,
                price,
                time,
                number,
                distance,
                status,
                lat,
                lng,
                acceptedAt: new Date().toISOString(),
              },
            })
          }
        >
          <Text style={styles.confirmText}>Pick Up Received</Text>
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
  body: {
    paddingHorizontal: scale(20),
    marginTop: verticalScale(10),
  },
  forText: {
    fontSize: moderateScale(15),
    fontWeight: "bold",
    marginBottom: verticalScale(6),
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(10),
  },
  phoneText: {
    fontSize: moderateScale(14),
    marginLeft: scale(5),
    flex: 1,
  },
  callButton: {
    backgroundColor: "#007AFF",
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(15),
    borderRadius: scale(6),
  },
  callButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: moderateScale(13),
  },
  timeRow: {
    marginBottom: verticalScale(8),
  },
  timeText: {
    fontSize: moderateScale(13),
    color: "#000",
  },
  bold: { fontWeight: "bold" },
  mapBox: {
    width: "100%",
    height: verticalScale(220),
    borderRadius: scale(12),
    overflow: "hidden",
    marginVertical: verticalScale(10),
  },
  map: { flex: 1 },
  confirmBtn: {
    backgroundColor: "#0AADFF",
    paddingVertical: verticalScale(12),
    borderRadius: scale(10),
    marginBottom: verticalScale(10),
  },
  confirmText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: moderateScale(15),
  },
});
