import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Image,
    Modal,
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

export default function PickUpInfo() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [showModal, setShowModal] = useState(false);

  const pickups = [
    {
      id: 1,
      name: "John Doe",
      address: "W Rovira Dr, Dumaguete City, Negros Oriental",
      status: "Delivered",
      acceptedTime: "10:20 AM",
      finishedTime: "10:30 AM",
    },
    {
      id: 2,
      name: "John Smith",
      address: "W Rovira Dr, Dumaguete City, Negros Oriental",
      status: "Attempted",
      acceptedTime: "10:05 AM",
      attemptedTime: "10:15 AM",
    },
    {
      id: 3,
      name: "John Keith",
      address: "W Rovira Dr, Dumaguete City, Negros Oriental",
      status: "Delivered",
      acceptedTime: "9:50 AM",
      finishedTime: "10:00 AM",
    },
    {
      id: 4,
      name: "John Ling",
      address: "W Rovira Dr, Dumaguete City, Negros Oriental",
      status: "Not Attempted",
      acceptedTime: "—",
      attemptedTime: "—",
    },
  ];

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
            History
          </Text>
        </View>
      </View>

      {/* Cards */}
        <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: verticalScale(100),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        >

        {pickups.map((item) => (
          <View
            key={item.id}
            style={[styles.card, { borderColor: "#ccc", borderWidth: 0.5 }]}
          >
            <Text style={styles.cardTitle}>
              For: {item.name}
            </Text>
            <Text style={styles.cardText}>{item.address}</Text>

            {/* Status Section */}
            <View style={styles.statusRow}>
              {item.status === "Delivered" && (
                <>
                  <Text style={styles.statusLabelDelivered}>Delivered</Text>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={28}
                    color="green"
                    style={{ marginLeft: 8 }}
                  />
                </>
              )}
              {item.status === "Attempted" && (
                <>
                  <TouchableOpacity
                    style={styles.seeAttemptButton}
                    onPress={() => setShowModal(true)}
                  >
                    <Text style={styles.seeAttemptText}>See Attempt</Text>
                  </TouchableOpacity>
                  <Text style={styles.statusLabelAttempted}>Attempted</Text>
                  <Ionicons
                    name="alert-circle"
                    size={26}
                    color="red"
                    style={{ marginLeft: 6 }}
                  />
                </>
              )}
              {item.status === "Not Attempted" && (
                <>
                  <Text style={styles.statusLabelNotAttempted}>
                    Not Attempted
                  </Text>
                  <Ionicons
                    name="ellipse-outline"
                    size={25}
                    color="#aaa"
                    style={{ marginLeft: 6 }}
                  />
                </>
              )}
            </View>

            {/* Times */}
            <View style={{ marginTop: verticalScale(8) }}>
              <Text style={styles.timeText}>
                Delivery Accepted at: {item.acceptedTime}
              </Text>
              {item.finishedTime && (
                <Text style={styles.timeText}>
                  Delivery Finished at: {item.finishedTime}
                </Text>
              )}
              {item.attemptedTime && (
                <Text style={styles.timeText}>
                  Delivery Attempted at: {item.attemptedTime}
                </Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modal Placeholder */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Attempt Photo</Text>
            <Image
              source={{
                uri: "https://via.placeholder.com/300x200?text=Attempt+Photo",
              }}
              style={styles.modalImage}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="close-circle" size={30} color="#3864C3" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  card: {
    backgroundColor: "#fff",
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(4),
  },
  statusLabelDelivered: {
    fontSize: moderateScale(13),
    fontWeight: "bold",
    color: "green",
  },
  statusLabelAttempted: {
    fontSize: moderateScale(13),
    fontWeight: "bold",
    color: "red",
    marginLeft: 6,
  },
  statusLabelNotAttempted: {
    fontSize: moderateScale(13),
    fontWeight: "bold",
    color: "#888",
  },
  seeAttemptButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  seeAttemptText: {
    color: "#fff",
    fontSize: moderateScale(11),
    fontWeight: "bold",
  },
  timeText: {
    fontSize: moderateScale(12),
    color: "#000",
    marginTop: verticalScale(2),
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    width: "80%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalImage: {
    width: 250,
    height: 180,
    borderRadius: 10,
    marginBottom: 10,
  },
  closeButton: {
    marginTop: 6,
  },
});
