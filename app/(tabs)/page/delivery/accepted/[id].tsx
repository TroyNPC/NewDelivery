import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Linking,
} from "react-native";
import { WebView } from "react-native-webview";
import Svg, { Path } from "react-native-svg";
import {
  moderateScale,
  scale,
  verticalScale,
} from "react-native-size-matters";

export default function DeliveryDetails() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // 🧩 All delivery details passed from deliveries.tsx
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

  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    })();
  }, []);

  if (!currentLocation) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { minHeight: height, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text>Loading your location...</Text>
      </SafeAreaView>
    );
  }

  // 🗺 Leaflet Map
  const mapHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.css" />
        <script src="https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.js"></script>
        <style>
          html, body { margin: 0; padding: 0; height: 100%; width: 100%; }
          #map { height: 100%; width: 100%; border-radius: 12px; background: #f0f0f0; }
          .leaflet-container { background: #f0f0f0; }
          .leaflet-control-zoom-in, .leaflet-control-zoom-out {
            width: 30px !important;
            height: 30px !important;
            line-height: 24px !important;
            font-size: 23px !important;
            border-radius: 6px !important;
            text-align: center !important;
          }
          .leaflet-control-zoom-in { margin-bottom: 10px !important; }
          .leaflet-control-zoom a {
            background-color: rgba(56, 100, 195, 0.85) !important;
            color: white !important;
            border: none !important;
          }
          .leaflet-control-zoom a:hover {
            background-color: rgba(56, 100, 195, 1) !important;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            var map = L.map('map').setView([${currentLocation.lat}, ${currentLocation.lng}], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
            var currentMarker = L.marker([${currentLocation.lat}, ${currentLocation.lng}]).addTo(map)
              .bindPopup("You are here");
            var destMarker = L.marker([${lat}, ${lng}]).addTo(map)
              .bindPopup("Destination");
            L.Routing.control({
              waypoints: [
                L.latLng(${currentLocation.lat}, ${currentLocation.lng}),
                L.latLng(${lat}, ${lng})
              ],
              lineOptions: { styles: [{ color: '#3864C3', weight: 5 }] },
              createMarker: function() { return null; },
              addWaypoints: false,
              draggableWaypoints: false,
              fitSelectedRoutes: true,
              show: false
            }).on('routeselected', function() {
              const container = document.querySelector('.leaflet-routing-container');
              if (container) container.style.display = 'none';
            }).addTo(map);
          });
        </script>
      </body>
    </html>
  `;

  const handleCall = () => {
    if (number) {
      Linking.openURL(`tel:${number}`);
    } else {
      alert("No phone number available");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { minHeight: height }]}>
      {/* HEADER (untouched) */}
      <View style={[styles.headerBox, { height: verticalScale(100) }]}>
        <Svg
          width={"100%"}
          height={verticalScale(200)}
          viewBox="0 0 1200 320"
          style={styles.waveTop}
          preserveAspectRatio="none"
        >
          <Path
            fill="#3864C3"
            d="M0,64 C480,-32 720,256 1440,64 L1440,0 L0,0 Z"
          />
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

      {/* CONTENT */}
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
            Delivery Accepted at:{" "}
            <Text style={styles.bold}>{acceptedAt || "N/A"}</Text>
          </Text>
          <Text style={styles.timeText}>
            Estimated Arrival: <Text style={styles.bold}>{eta || "N/A"}</Text>
          </Text>
        </View>

        <View style={styles.mapBox}>
          <WebView
            originWhitelist={["*"]}
            source={{ html: mapHTML }}
            javaScriptEnabled
            domStorageEnabled
            style={styles.map}
          />
        </View>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() => alert(`Delivery for ${name} confirmed!`)}
        >
          <Text style={styles.confirmText}>Confirm Delivery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.noResponseBtn}
          onPress={() =>
            router.push({
                pathname: "/(tabs)/page/delivery/accepted/noresponse/[id]noresponse" as unknown as any,
                params: {
                name,
                address,
                weight,
                price,
                time,
                distance,
                status,
                lat,
                lng,
                acceptedAt: new Date().toISOString(),
                },
            })
            }

        >
          <Text style={styles.noResponseText}>No Response</Text>
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
  noResponseBtn: {
    backgroundColor: "#C62828",
    paddingVertical: verticalScale(12),
    borderRadius: scale(10),
  },
  noResponseText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: moderateScale(15),
  },
});
