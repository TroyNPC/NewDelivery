import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

  // 🧠 All parameters from the card
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

  // ✅ Use real GPS instead of static location
const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);


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

  // 🗺 Render Leaflet Map (with real road routing, no panel)
  const mapHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.css"
        />
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
        .leaflet-control-zoom-in{
            margin-bottom: 10px !important;
        }
          .leaflet-control-zoom a {
            background-color: rgba(56, 100, 195, 0.85) !important;
            color: white !important;
            border: none !important;
          }
          .leaflet-control-zoom a:hover {
            background-color: rgba(56, 100, 195, 1) !important;
          }
            .leaflet-routing-container {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
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

            // ✅ Use Leaflet Routing Machine (trace real roads)
            L.Routing.control({
              waypoints: [
                L.latLng(${currentLocation.lat}, ${currentLocation.lng}),
                L.latLng(${lat}, ${lng})
              ],
              lineOptions: {
                styles: [{ color: '#3864C3', weight: 5 }]
              },
              createMarker: function() { return null; }, // hide extra markers
              addWaypoints: false,
              draggableWaypoints: false,
              fitSelectedRoutes: true,
              show: false
            })
            .on('routeselected', function() {
              const container = document.querySelector('.leaflet-routing-container');
              if (container) container.style.display = 'none'; // hide routing text
            })
            .addTo(map);
          });
        </script>
      </body>
    </html>
  `;

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

      {/* Delivery Info */}
      <View style={styles.content}>
        <Text style={styles.forText}>For: {name}</Text>

        <View style={styles.mapContainer}>
          <WebView
            originWhitelist={["*"]}
            source={{ html: mapHTML }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
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
            <Text style={styles.infoText}>
              {time} | {distance}
            </Text>
          </View>
        </View>

     <TouchableOpacity
        style={styles.acceptButton}
        onPress={() =>
            router.push({
            pathname: "/(tabs)/page/delivery/accepted/[id]"  as unknown as any,
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
