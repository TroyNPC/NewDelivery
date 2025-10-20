import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scale, verticalScale } from "react-native-size-matters";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../hooks/supabaseClient";

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  // Track screen size dynamically
  const [screen, setScreen] = useState(Dimensions.get("window"));

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setScreen(window);
    });
    return () => subscription?.remove();
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    console.log("🔄 HomeScreen mounted - checking user session");
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      console.log("🔍 Checking if user is already logged in...");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.log("❌ Error getting user:", userError);
        return;
      }

      console.log("👤 User found:", user ? user.id : "No user");
      
      if (user) {
        console.log("📋 Checking shop_user_assignments for user:", user.id);
        
        // Get user's role and assignment details
        const { data: userData, error } = await supabase
          .from('shop_user_assignments')
          .select(`
            *,
            shop:shops(name, logo_url),
            branch:shop_branches(name, address),
            user:users(full_name, phone, email)
          `)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        console.log("📊 Assignment query result:", {
          hasData: !!userData,
          data: userData,
          error: error
        });

        if (error) {
          console.log("❌ Assignment query error:", error);
          console.log("📝 Error details:", {
            code: error.code,
            message: error.message,
            details: error.details
          });
        }

        if (userData && (userData.role_in_shop === 'delivery' || userData.role_in_shop === 'driver')) {
          console.log("✅ User is a delivery person!");
          console.log("👤 User role:", userData.role_in_shop);
          console.log("🏪 Shop:", userData.shop?.name);
          console.log("📍 Branch:", userData.branch?.name);
          
          // Store user assignment data and navigate
          const userInfo = {
            id: user.id,
            full_name: userData.user?.full_name,
            email: userData.user?.email,
            phone: userData.user?.phone,
            role: userData.role_in_shop,
            shop: userData.shop,
            branch: userData.branch,
            assignment_id: userData.id
          };
          
          console.log("💾 User info to store:", userInfo);
          console.log("🚀 Navigating to deliveries page...");
          router.replace("/page/deliveries");
        } else {
          console.log("❌ User is not a delivery person or no assignment found");
          console.log("📝 Assignment data:", userData);
        }
      } else {
        console.log("👤 No user logged in");
      }
    } catch (error) {
      console.log("💥 Unexpected error in checkUser:", error);
    }
  };

  const handleLogin = async () => {
    console.log("🔐 Login attempt with email:", credentials.email);
    
    if (!credentials.email || !credentials.password) {
      console.log("❌ Missing credentials");
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      console.log("🔑 Signing in with Supabase Auth...");
      
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      console.log("📨 Auth response:", {
        hasUser: !!data?.user,
        error: error
      });

      if (error) {
        console.log("❌ Auth error:", error);
        Alert.alert("Login Error", error.message);
        return;
      }

      if (data.user) {
        console.log("✅ Auth successful! User ID:", data.user.id);
        console.log("📋 Checking user assignments...");

        // Get user's role and assignment details
        const { data: userAssignment, error: assignmentError } = await supabase
          .from('shop_user_assignments')
          .select(`
            *,
            shop:shops(name, logo_url),
            branch:shop_branches(name, address),
            user:users(full_name, phone, email)
          `)
          .eq('user_id', data.user.id)
          .eq('is_active', true)
          .single();

        console.log("📊 Assignment query result:", {
          hasAssignment: !!userAssignment,
          assignment: userAssignment,
          error: assignmentError
        });

        if (assignmentError) {
          console.log("❌ Assignment query failed:", assignmentError);
          console.log("📝 Assignment error details:", {
            code: assignmentError.code,
            message: assignmentError.message,
            details: assignmentError.details
          });
          
          console.log("🔄 Trying fallback: checking user_roles table...");
          
          // Fallback: Check user_roles table
          const { data: userRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select(`
              role:roles(name)
            `)
            .eq('user_id', data.user.id)
            .single();

          console.log("📊 User roles result:", {
            hasRoles: !!userRoles,
            roles: userRoles,
            error: rolesError
          });

          const userRole = userRoles?.role?.name;
          console.log("🎭 User role from fallback:", userRole);
          
          if (userRole === 'delivery' || userRole === 'driver') {
            console.log("✅ Fallback check passed! User has delivery role");
            
            // Get basic user info
            const { data: userInfo, error: userInfoError } = await supabase
              .from('users')
              .select('full_name, phone, email')
              .eq('id', data.user.id)
              .single();

            console.log("📝 User info query result:", {
              hasUserInfo: !!userInfo,
              userInfo: userInfo,
              error: userInfoError
            });

            const userData = {
              id: data.user.id,
              full_name: userInfo?.full_name,
              email: userInfo?.email,
              phone: userInfo?.phone,
              role: userRole,
              shop: null,
              branch: null,
              assignment_id: null
            };
            
            console.log("💾 User data to store:", userData);
            console.log("🚀 Navigating to deliveries page...");
            router.replace("/page/deliveries");
          } else {
            console.log("❌ User is not a delivery person in any system");
            Alert.alert("Access Denied", "This app is for delivery personnel only");
            console.log("🚪 Signing user out...");
            await supabase.auth.signOut();
          }
        } else if (userAssignment && (userAssignment.role_in_shop === 'delivery' || userAssignment.role_in_shop === 'driver')) {
          console.log("✅ User is a delivery person in shop assignments!");
          console.log("👤 Role:", userAssignment.role_in_shop);
          console.log("🏪 Shop:", userAssignment.shop?.name);
          console.log("📍 Branch:", userAssignment.branch?.name);
          
          // Success - store user data and navigate
          const userInfo = {
            id: data.user.id,
            full_name: userAssignment.user?.full_name,
            email: userAssignment.user?.email,
            phone: userAssignment.user?.phone,
            role: userAssignment.role_in_shop,
            shop: userAssignment.shop,
            branch: userAssignment.branch,
            assignment_id: userAssignment.id
          };
          
          console.log("💾 User assignment details:", userInfo);
          console.log("🚀 Navigating to deliveries page...");
          router.replace("/page/deliveries");
        } else {
          console.log("❌ User assignment found but not a delivery role");
          console.log("📝 Actual role:", userAssignment?.role_in_shop);
          Alert.alert("Access Denied", "This app is for delivery personnel only");
          console.log("🚪 Signing user out...");
          await supabase.auth.signOut();
        }
      }
    } catch (error: any) {
      console.log("💥 Unexpected error in handleLogin:", error);
      Alert.alert("Login Error", error.message || "An unexpected error occurred");
    } finally {
      console.log("🏁 Login process completed");
      setLoading(false);
    }
  };

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
            { height: screen.height * 0.50 },
          ]}
        >
          <Text style={styles.loginTitle}>Log in to your Account</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email:</Text>
            <View style={styles.inputField}>
              <TextInput
                style={styles.placeholderText}
                placeholder="Enter your email"
                placeholderTextColor="gray"
                value={credentials.email}
                onChangeText={(text) => setCredentials(prev => ({ ...prev, email: text }))}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password:</Text>
            <View style={styles.inputField}>
              <TextInput
                style={styles.placeholderText}
                placeholder="Enter your password"
                placeholderTextColor="gray"
                secureTextEntry
                value={credentials.password}
                onChangeText={(text) => setCredentials(prev => ({ ...prev, password: text }))}
                editable={!loading}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
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
    width: "100%",
  },
  loginButtonDisabled: {
    backgroundColor: "#87CEFA",
  },
  loginButtonText: {
    color: "white",
    fontSize: scale(18),
    fontWeight: "bold",
  },
  forgotPassword: {
    marginTop: verticalScale(15),
  },
  forgotPasswordText: {
    color: "#355fc7",
    fontSize: scale(14),
    textDecorationLine: "underline",
  },
});