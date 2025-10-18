import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageBackground,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { scale, verticalScale } from "react-native-size-matters";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();

  // Track screen size dynamically (for rotation or resize)
  const [screen, setScreen] = useState(Dimensions.get("window"));

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setScreen(window);
    });
    return () => subscription?.remove();
  }, []);

  const svgHeight = screen.height * 0.25;
  const vbW = 1440;
  const vbH = 320;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0AADFF" }]}>
      {/* ===== Top Wave ===== */}
      <Svg
        width={screen.width}
        height={verticalScale(300)}
        viewBox={`0 0 ${vbW} ${vbH}`}
        style={styles.topWave}
        preserveAspectRatio="none"
      >
        <Path
          fill="#355fc7"
          d={`M0,0 L0,${vbH * 0.3} C ${vbW * 0.3},${vbH * 0.1} ${vbW * 0.6},${vbH * 0.8} ${vbW},${vbH * 0.7} L${vbW},0 Z`}
        />
      </Svg>

      {/* ===== Content (Full Screen, No Scroll) ===== */}
      <View
        style={[
          styles.content,
          { width: screen.width, height: screen.height },
        ]}
      >
        {/* Icon */}
        <ImageBackground style={styles.ovalBackground} imageStyle={styles.ovalShape}>
          <Image
            source={require("../../assets/images/delivery.png")}
            style={styles.icon}
            resizeMode="contain"
          />
        </ImageBackground>

        {/* Title */}
        <Text style={styles.title} adjustsFontSizeToFit numberOfLines={2}>
          LaundryGo Delivery
        </Text>

        {/* Login Box */}
        <View
          style={[
            styles.loginBox,
            { height: screen.height * 0.45 }, // adjust dynamically
          ]}
        >
          <Text style={styles.loginTitle}>Log in to your Account</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name:</Text>
            <View style={styles.inputField}>
              <Text style={styles.placeholderText}>Name</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password:</Text>
            <View style={styles.inputField}>
              <Text style={styles.placeholderText}>Password</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/page/deliveries")}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    justifyContent: "center",
    alignItems: "center",
  },
  topWave: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  ovalBackground: {
    width: scale(200),
    height: verticalScale(180),
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: scale(300),
    overflow: "hidden",
    alignSelf: "center",
    marginTop: verticalScale(-5),
  },
  ovalShape: {
    borderRadius: scale(150),
  },
  icon: {
    width: scale(330),
    height: verticalScale(210),
    marginTop: verticalScale(-10),
  },
  title: {
    fontSize: scale(45),
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    width: "80%",
    marginBottom: verticalScale(25),
  },
  loginBox: {
    backgroundColor: "white",
    width: "100%",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingVertical: verticalScale(25),
    paddingHorizontal: scale(25),
    alignItems: "center",
    marginTop: verticalScale(15),
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  loginTitle: {
    fontSize: scale(18),
    fontWeight: "bold",
    color: "black",
    marginBottom: verticalScale(20),
  },
  inputGroup: {
    width: "100%",
    marginBottom: verticalScale(15),
  },
  inputLabel: {
    color: "#355fc7",
    fontWeight: "600",
    fontSize: scale(14),
    marginBottom: verticalScale(5),
  },
  inputField: {
    width: "100%",
    backgroundColor: "#F3F3F3",
    borderRadius: 8,
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(10),
  },
  placeholderText: {
    color: "gray",
    fontSize: scale(14),
  },
  loginButton: {
    backgroundColor: "#0AADFF",
    marginTop: verticalScale(10),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(100),
    borderRadius: 40,
    alignItems: "center",
  },
  loginButtonText: {
    color: "white",
    fontSize: scale(18),
    fontWeight: "bold",
  },
});
