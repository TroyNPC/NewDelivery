import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../../hooks/supabaseClient";

export default function AccountSettings() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("No user found");
        return;
      }

      // Fetch user details from users table
      const { data: userDetails, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log("Error fetching user details:", error);
        return;
      }

      // Fetch user assignment to get role and shop info
      const { data: assignment } = await supabase
        .from('shop_user_assignments')
        .select(`
          role_in_shop,
          shop:shops(name)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      setUserData({
        ...userDetails,
        role: assignment?.role_in_shop || 'Delivery Personnel',
        shop: assignment?.shop?.name || 'Laundry Shop'
      });

    } catch (error) {
      console.log("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.log("Error signing out:", error);
      } else {
        router.replace("/");
      }
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3864C3" />
        <Text style={{ marginTop: 10 }}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { minHeight: height }]}>
      {/* ✅ SAME HEADER - DO NOT CHANGE */}
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
            ACCOUNT SETTINGS
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
        {/* Profile Section */}
        <View style={styles.profileContainer}>
          {/* Default profile icon instead of image */}
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={moderateScale(40)} color="#666" />
          </View>
          
          <Text style={styles.profileName}>
            {userData?.full_name || 'User Name'}
          </Text>
          <Text style={styles.profileRole}>
            {userData?.role || 'Delivery Personnel'}
          </Text>
          <Text style={styles.profileNumber}>
            {userData?.phone || 'Phone number not set'}
          </Text>
          <Text style={styles.profileEmail}>
            {userData?.email || 'Email not set'}
          </Text>
          <Text style={styles.profileShop}>
            {userData?.shop || 'Shop assignment'}
          </Text>

          <TouchableOpacity 
            activeOpacity={0.8} 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>LOG OUT</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Options */}
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}  onPress={() => router.push("/page/editprofile")}>
            <Ionicons
              name="person-outline"
              size={moderateScale(18)}
              color="#000"
            />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons
              name="chevron-forward"
              size={moderateScale(18)}
              color="#888"
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push("/page/changepassword")}>
            <Ionicons
              name="lock-closed-outline"
              size={moderateScale(18)}
              color="#000"
            />
            <Text style={styles.menuText}>Change Password</Text>
            <Ionicons
              name="chevron-forward"
              size={moderateScale(18)}
              color="#888"
              style={{ marginLeft: "auto" }}
            />
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
  headerTitle: {
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },

  // ✅ Profile Section
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
  profileIcon: {
    width: moderateScale(90),
    height: moderateScale(90),
    borderRadius: moderateScale(50),
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(10),
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  profileName: {
    fontSize: moderateScale(16),
    fontWeight: "bold",
    color: "#000",
  },
  profileRole: {
    fontSize: moderateScale(13),
    color: "#007AFF",
    marginVertical: verticalScale(4),
  },
  profileNumber: {
    fontSize: moderateScale(13),
    color: "#333",
  },
  profileEmail: {
    fontSize: moderateScale(12),
    color: "#777",
    marginBottom: verticalScale(4),
  },
  profileShop: {
    fontSize: moderateScale(12),
    color: "#555",
    marginBottom: verticalScale(10),
  },
  logoutButton: {
    backgroundColor: "#FF4D4D",
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(30),
    borderRadius: scale(10),
    marginTop: verticalScale(6),
  },
  logoutText: {
    color: "#fff",
    fontSize: moderateScale(13),
    fontWeight: "bold",
  },

  // ✅ Menu Section
  menuContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: scale(15),
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingVertical: verticalScale(10),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(15),
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  menuText: {
    fontSize: moderateScale(13.5),
    color: "#000",
    marginLeft: scale(10),
  },
});