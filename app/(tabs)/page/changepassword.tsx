import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import Svg, { Path } from "react-native-svg";

export default function ExchangePassword() {
  const { width, height } = useWindowDimensions();
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSave = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert("Please fill out all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match.");
      return;
    }
    alert("Password changed successfully!");
  };

  return (
    <SafeAreaView style={[styles.container, { minHeight: height }]}>
      {/* ✅ HEADER */}
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
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/page/user")}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>

          <Text
            style={[
              styles.headerTitle,
              { fontSize: moderateScale(width < 360 ? 18 : 22) },
            ]}
          >
            CHANGE PASSWORD
          </Text>
          <View style={{ width: moderateScale(24) }} />
        </View>
      </View>

      {/* ✅ CONTENT */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingVertical: verticalScale(30),
          paddingBottom: verticalScale(100),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          {/* Input: Old Password */}
          <View style={styles.inputRow}>
            <Text style={styles.sideLabel}>Old:</Text>
            <TextInput
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Enter old password"
              secureTextEntry
              style={styles.sideInput}
            />
          </View>

          {/* Input: New Password */}
          <View style={styles.inputRow}>
            <Text style={styles.sideLabel}>New:</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              secureTextEntry
              style={styles.sideInput}
            />
          </View>

          {/* Input: Confirm Password */}
          <View style={styles.inputRow}>
            <Text style={styles.sideLabel}>Confirm:</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
              style={styles.sideInput}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity activeOpacity={0.8} style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>SAVE PASSWORD</Text>
          </TouchableOpacity>
        </View>
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
  backButton: {
    position: "absolute",
    left: scale(20),
    zIndex: 3,
  },
  headerTitle: {
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },

  formContainer: {
    alignItems: "center",
    backgroundColor: "#fff",
    width: "85%",
    borderRadius: scale(20),
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    paddingVertical: verticalScale(30),
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: verticalScale(8),
    width: "90%",
    alignSelf: "center",
  },

  sideLabel: {
    width: "25%",
    fontSize: moderateScale(15),
    color: "#333",
    fontWeight: "500",
  },

  sideInput: {
    width: "70%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    fontSize: moderateScale(13),
  },

  saveButton: {
    backgroundColor: "#0AADFF",
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(40),
    borderRadius: scale(10),
    marginTop: verticalScale(15),
  },
  saveText: {
    color: "#fff",
    fontSize: moderateScale(13.5),
    fontWeight: "bold",
  },
});
