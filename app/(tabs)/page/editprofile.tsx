import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
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

export default function EditProfile() {
  const { width, height } = useWindowDimensions();
  const router = useRouter();

  const [image, setImage] = useState(require("@/assets/images/pic.jpg"));
  const [name, setName] = useState("John Michael Guterirez");
  const [number, setNumber] = useState("(+63) 912 45 6789");
  const [email, setEmail] = useState("john.doe@email.com");
  const [address, setAddress] = useState("City");

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("Permission required to access your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setImage({ uri: result.assets[0].uri });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { minHeight: height }]}>
      {/* ✅ SAME HEADER */}
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
            EDIT PROFILE
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
        <View style={styles.profileContainer}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
            <Image source={image} style={styles.profileImage} resizeMode="cover" />
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={18} color="white" />
            </View>
          </TouchableOpacity>

          {/* ✅ Input Fields with Side Labels */}
<View style={styles.inputRow}>
  <Text style={styles.sideLabel}>Name:</Text>
  <TextInput
    value={name}
    onChangeText={setName}
    placeholder="Full Name"
    style={styles.sideInput}
  />
</View>

<View style={styles.inputRow}>
  <Text style={styles.sideLabel}>Phone:</Text>
  <TextInput
    value={number}
    onChangeText={setNumber}
    placeholder="Phone Number"
    keyboardType="phone-pad"
    style={styles.sideInput}
  />
</View>

<View style={styles.inputRow}>
  <Text style={styles.sideLabel}>Email:</Text>
  <TextInput
    value={email}
    onChangeText={setEmail}
    placeholder="Email"
    keyboardType="email-address"
    style={styles.sideInput}
  />
</View>

<View style={styles.inputRow}>
  <Text style={styles.sideLabel}>Address:</Text>
  <TextInput
    value={address}
    onChangeText={setAddress}
    placeholder="Address"
    style={styles.sideInput}
  />
</View>


          <TouchableOpacity activeOpacity={0.8} style={styles.saveButton}>
            <Text style={styles.saveText}>SAVE CHANGES</Text>
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

  profileContainer: {
    alignItems: "center",
    marginBottom: verticalScale(25),
    backgroundColor: "#fff",
    width: "85%",
    borderRadius: scale(20),
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    paddingVertical: verticalScale(20),
  },
  profileImage: {
    width: moderateScale(90),
    height: moderateScale(90),
    borderRadius: moderateScale(50),
    marginBottom: verticalScale(10),
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 2,
    right: 8,
    backgroundColor: "#0AADFF",
    borderRadius: 20,
    padding: 4,
  },
  inputBox: {
    width: "85%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: scale(10),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
    marginVertical: verticalScale(6),
    fontSize: moderateScale(13),
    color: "#000",
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
