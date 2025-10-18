import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    SafeAreaView,
    ScrollView,
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

export default function PickUpInfo() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const pickups = [
    {
      id: 1,
      name: "John Michael Guttierrez",
      address: "W Rovira Dr, Dumaguete City, Negros Oriental",
      weight: "2 kg",
      price: "₱120",
      time: "3 minutes",
      distance: "1.0km",
      status: "Pick Up",
      number: "09352537960",
      destination: { lat: 9.3082, lng: 123.3074 },
    },
    {
      id: 2,
      name: "Vladimir Rodriguez",
      address: "88 E. J. Blanco Dr, Dumaguete City, Negros Oriental",
      weight: "4 kg",
      price: "₱200",
      time: "8 minutes",
      distance: "4.0km",
      status: "Pick Up",
      number: "09352537960",
      destination: { lat: 9.3105, lng: 123.3 },
    },
    {
      id: 3,
      name: "Willie Palomar",
      address: "Dumaguete-Balugo Rd, Dumaguete City, Negros Oriental",
      weight: "2 kg",
      price: "₱160",
      time: "5 minutes",
      distance: "3.0km",
      status: "Pick Up",
      number: "09352537960",
      destination: { lat: 9.315, lng: 123.301 },
    },
  ];

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

      const watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (loc) => {
          setCurrentLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      );

      return () => watchId.remove();
    })();
  }, []);

  const renderMiniMap = (destination: { lat: number; lng: number }) => {
    if (!currentLocation) {
      return (
        <View
          style={{
            width: width * 0.25,
            height: width * 0.25,
            borderRadius: scale(10),
            backgroundColor: "#f0f0f0",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: moderateScale(10), color: "#888" }}>Loading GPS...</Text>
        </View>
      );
    }

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
            .leaflet-control-zoom-in { margin-bottom: 4px; }
            .leaflet-control-zoom-in,
            .leaflet-control-zoom-out {
              width: 26px !important;
              height: 26px !important;
              line-height: 24px !important;
              font-size: 14px !important;
              border-radius: 6px !important;
            }
              .leaflet-routing-container {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                }

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
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
              }).addTo(map);

              var currentMarker = L.marker([${currentLocation.lat}, ${currentLocation.lng}]).addTo(map)
                .bindPopup("You are here");

              var destMarker = L.marker([${destination.lat}, ${destination.lng}]).addTo(map)
                .bindPopup("Pick Up Location");

              L.Routing.control({
                waypoints: [
                  L.latLng(${currentLocation.lat}, ${currentLocation.lng}),
                  L.latLng(${destination.lat}, ${destination.lng})
                ],
                lineOptions: { styles: [{ color: '#3864C3', weight: 5 }] },
                createMarker: function() { return null; },
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: true,
                show: false
              })
              .on('routeselected', function(e) {
                const container = document.querySelector('.leaflet-routing-container');
                if (container) container.style.display = 'none';
              })
              .addTo(map);
            });
          </script>
        </body>
      </html>
    `;

    return (
      <WebView
        originWhitelist={["*"]}
        source={{ html: mapHTML }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        automaticallyAdjustContentInsets={false}
        style={{
          width: width * 0.25,
          height: width * 0.25,
          borderRadius: scale(10),
          overflow: "hidden",
          backgroundColor: "#f0f0f0",
          minWidth: scale(70),
          minHeight: scale(70),
        }}
      />
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
          <Path
            fill="#3864C3"
            d="M0,64 C480,-32 720,256 1440,64 L1440,0 L0,0 Z"
          />
        </Svg>

        <View
          style={[
            styles.headerContent,
            { marginTop: height < 700 ? verticalScale(20) : verticalScale(30) },
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              { fontSize: moderateScale(width < 360 ? 18 : 22) },
            ]}
          >
            PICK UPS
          </Text>
          <View style={{ width: moderateScale(24) }} />
        </View>
      </View>

             <ScrollView
             style={{ flex: 1 }}
             contentContainerStyle={{
                 flexGrow: 1,
                 paddingBottom: verticalScale(100),
             }}
             keyboardShouldPersistTaps="handled"
             showsVerticalScrollIndicator={false}
             >

        <View style={[styles.infoBox, { maxWidth: "100%" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>
              You are assigned to (Brand Laundry Shop)
            </Text>
            <Text style={styles.infoDesc}>
              Address: Example 123 Rizal St., Dumaguete City
            </Text>
            <Text style={styles.infoDesc}>
              Operating Hours: 8:00 AM – 8:00 PM
            </Text>
          </View>
        </View>

        {pickups.map((item) => (
          <View key={item.id} style={[styles.card, { maxWidth: "95%" }]}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/page/pickup/[id]" as unknown as any,
                    params: {
                      id: String(item.id),
                      name: item.name,
                      address: item.address,
                      weight: item.weight,
                      price: item.price,
                      time: item.time,
                      distance: item.distance,
                      status: item.status,
                      number: item.number,
                      lat: String(item.destination.lat),
                      lng: String(item.destination.lng),
                    },
                  })
                }
              >
                <Text style={styles.cardTitle}>For: {item.name}</Text>
                <Text style={styles.cardText}>{item.address}</Text>

                <View style={styles.contactRow}>
                  <Ionicons name="scale-outline" size={16} color="#000" />
                  <Text style={styles.contactText}>{item.weight}</Text>
                </View>

                <View style={styles.contactRow}>
                  <Ionicons name="cash-outline" size={16} color="#000" />
                  <Text style={styles.contactText}>{item.price}</Text>
                </View>

                <View style={styles.contactRow}>
                  <Ionicons name="bicycle-outline" size={16} color="#000" />
                  <Text style={styles.contactText}>
                    {item.time} | {item.distance}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: moderateScale(11),
                    color: "#007AFF",
                    marginBottom: verticalScale(4),
                    fontWeight: "bold",
                  }}
                >
                  {item.status}
                </Text>
                {renderMiniMap(item.destination)}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  headerBox: {
    width: "100%",
    backgroundColor: "#0AADFF",
    justifyContent: "center",
    overflow: "hidden",
  },
  waveTop: { position: "absolute", top: 0, left: 0, zIndex: 1 },
  headerContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    paddingHorizontal: scale(10),
    zIndex: 2,
  },
  headerTitle: {
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  infoBox: {
    backgroundColor: "#D4F6F9",
    padding: scale(20),
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoTitle: {
    fontSize: moderateScale(16),
    fontWeight: "bold",
    color: "#000",
    marginBottom: verticalScale(6),
  },
  infoDesc: {
    fontSize: moderateScale(13),
    color: "#333",
    marginBottom: verticalScale(10),
    lineHeight: verticalScale(18),
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: scale(15),
    padding: scale(16),
    marginHorizontal: scale(20),
    marginVertical: verticalScale(10),
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTitle: {
    fontSize: moderateScale(14.5),
    fontWeight: "bold",
    color: "#000",
    marginBottom: verticalScale(8),
  },
  cardText: {
    fontSize: moderateScale(12.5),
    color: "#333",
    marginBottom: verticalScale(5),
    lineHeight: verticalScale(18),
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(6),
  },
  contactText: {
    fontSize: moderateScale(12.5),
    color: "#000",
    marginLeft: scale(6),
  },
});
