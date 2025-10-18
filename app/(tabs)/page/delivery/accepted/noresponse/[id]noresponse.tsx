import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router"; // ✅ Added useLocalSearchParams
import React, { useEffect, useState } from "react";

import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  moderateScale,
  scale,
  verticalScale,
} from "react-native-size-matters";
import Svg, { Path } from "react-native-svg";

export default function NoResponse() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // ✅ Get delivery ID
  const [photo, setPhoto] = useState<string | null>(null);
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
  
  // ✅ Clear photo when new delivery ID is opened
  useEffect(() => {
    setPhoto(null);
  }, [id]);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      alert("Camera permission is required to take a photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const submitDelivery = () => {
    if (!photo) {
      alert("Please take a photo before submitting.");
      return;
    }
    alert("Delivery attempt recorded successfully!");
    setPhoto(null); // ✅ Clears the photo after submitting
    router.push("/(tabs)/page/deliveries");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER (unchanged) */}
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
            onPress={() => {
                router.push({
                pathname: "/(tabs)/page/delivery/noreponse" as unknown as any,
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
              });

            }}

            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>No Response</Text>
        </View>
      </View>

      {/* CONTENT */}
      <View style={styles.body}>
        <Text style={styles.instruction}>
          Upload a photo to confirm that delivery was attempted
        </Text>

        <TouchableOpacity style={styles.takePhotoButton} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={22} color="#fff" />
          <Text style={styles.takePhotoText}>Take Photo</Text>
        </TouchableOpacity>

        <View style={styles.photoBox}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.previewImage} />
          ) : (
            <Ionicons
              name="camera-outline"
              size={70}
              color="#ccc"
              style={styles.placeholderIcon}
            />
          )}
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={submitDelivery}>
          <Text style={styles.submitText}>Submit Delivery</Text>
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
    flex: 1,
    alignItems: "center",
    paddingHorizontal: scale(20),
    marginTop: verticalScale(20),
  },
  instruction: {
    fontSize: moderateScale(15),
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: verticalScale(20),
  },
  takePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0AADFF",
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(20),
    borderRadius: scale(8),
    marginBottom: verticalScale(20),
  },
  takePhotoText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: moderateScale(14),
    marginLeft: scale(8),
  },
  photoBox: {
    width: scale(200),
    height: scale(200),
    borderRadius: scale(12),
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(30),
    overflow: "hidden",
  },
  placeholderIcon: {
    opacity: 0.6,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  submitButton: {
    backgroundColor: "#0AADFF",
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(40),
    borderRadius: scale(10),
  },
  submitText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: moderateScale(15),
  },
});
