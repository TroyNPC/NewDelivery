import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../hooks/supabaseClient";

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  // Responsive scaling functions
  const scale = (size: number) => {
    const { width } = dimensions;
    const baseWidth = 375; // iPhone 6/7/8 width
    return (size * width) / baseWidth;
  };

  const verticalScale = (size: number) => {
    const { height } = dimensions;
    const baseHeight = 667; // iPhone 6/7/8 height
    return (size * height) / baseHeight;
  };

  const moderateScale = (size: number, factor = 0.5) => {
    return size + (scale(size) - size) * factor;
  };

  const checkDeliveryRole = async (userId: string): Promise<boolean> => {
    try {
      const { data: assignment, error } = await supabase
        .from('shop_user_assignments')
        .select('*')
        .eq('user_id', userId)
        .eq('role_in_shop', 'delivery')
        .eq('is_active', true)
        .single();

      if (error) {
        console.log("Assignment check error:", error);
        return false;
      }

      return !!assignment;
    } catch (error) {
      console.log("Role check error:", error);
      return false;
    }
  };

  const validateForm = (): boolean => {
    const newErrors = { email: "", password: "" };
    let isValid = true;

    if (!credentials.email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(credentials.email)) {
      newErrors.email = "Please enter a valid email address";
      isValid = false;
    }

    if (!credentials.password) {
      newErrors.password = "Password is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async () => {
    Keyboard.dismiss();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      });

      if (error) {
        Alert.alert(
          "Login Failed", 
          error.message === "Invalid login credentials" 
            ? "The email or password you entered is incorrect. Please try again."
            : error.message
        );
        return;
      }

      if (data.user) {
        const isDeliveryPerson = await checkDeliveryRole(data.user.id);
        
        if (isDeliveryPerson) {
          router.replace("/deliveries");
        } else {
          Alert.alert(
            "Access Restricted", 
            "This application is exclusively for delivery partners."
          );
          await supabase.auth.signOut();
        }
      }
    } catch (error: any) {
      console.log("Login error:", error);
      Alert.alert(
        "Connection Issue", 
        "Unable to connect to the server. Please check your internet connection."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handlePasswordSubmit = () => {
    handleLogin();
  };

  // Responsive styles based on screen dimensions
  const responsiveStyles = createResponsiveStyles(dimensions, scale, verticalScale, moderateScale);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={responsiveStyles.container}>
        {/* Background Wave */}
        <View style={responsiveStyles.waveContainer}>
          <Svg
            width={dimensions.width}
            height={verticalScale(200)}
            viewBox="0 0 1440 320"
            preserveAspectRatio="xMidYMid slice"
          >
            <Path
              fill="#355fc7"
              d="M0,96L48,112C96,128,192,160,288,186.7C384,213,480,235,576,213.3C672,192,768,128,864,128C960,128,1056,192,1152,197.3C1248,203,1344,149,1392,122.7L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
            />
          </Svg>
        </View>

        <ScrollView 
          contentContainerStyle={responsiveStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Branding Section */}
          <View style={responsiveStyles.brandingSection}>
            <ImageBackground 
              style={responsiveStyles.logoContainer}
              imageStyle={responsiveStyles.logoImageStyle}
            >
              <Image
                source={require("../assets/images/delivery.png")}
                style={responsiveStyles.logo}
                resizeMode="contain"
              />
            </ImageBackground>

            <View style={responsiveStyles.titleContainer}>
              <Text style={responsiveStyles.title} numberOfLines={2}>
                LaundryGo Delivery
              </Text>
              <Text style={responsiveStyles.subtitle}>
                Partner Portal
              </Text>
            </View>
          </View>

          {/* Login Form Section */}
          <View style={responsiveStyles.loginBox}>
            <View style={responsiveStyles.loginHeader}>
              <Text style={responsiveStyles.loginTitle}>Welcome Back</Text>
              <Text style={responsiveStyles.loginSubtitle}>
                Sign in to continue to your delivery dashboard
              </Text>
            </View>

            <View style={responsiveStyles.formContainer}>
              {/* Email Input */}
              <View style={responsiveStyles.inputGroup}>
                <Text style={responsiveStyles.inputLabel}>Email Address</Text>
                <View style={[
                  responsiveStyles.inputField,
                  errors.email && responsiveStyles.inputFieldError,
                ]}>
                  <TextInput
                    style={responsiveStyles.inputText}
                    placeholder="Enter your email"
                    placeholderTextColor="#999"
                    value={credentials.email}
                    onChangeText={(text) => handleInputChange("email", text)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    editable={!loading}
                    returnKeyType="next"
                  />
                </View>
                {errors.email ? (
                  <Text style={responsiveStyles.errorText}>{errors.email}</Text>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={responsiveStyles.inputGroup}>
                <Text style={responsiveStyles.inputLabel}>Password</Text>
                <View style={[
                  responsiveStyles.inputField,
                  errors.password && responsiveStyles.inputFieldError,
                ]}>
                  <TextInput
                    style={responsiveStyles.inputText}
                    placeholder="Enter your password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    value={credentials.password}
                    onChangeText={(text) => handleInputChange("password", text)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handlePasswordSubmit}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={responsiveStyles.visibilityToggle}
                  >
                    <Text style={responsiveStyles.visibilityText}>
                      {showPassword ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <Text style={responsiveStyles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[
                  responsiveStyles.loginButton,
                  loading && responsiveStyles.loginButtonDisabled,
                  (!credentials.email || !credentials.password) && responsiveStyles.loginButtonDisabled
                ]}
                onPress={handleLogin}
                disabled={loading || !credentials.email || !credentials.password}
              >
                {loading ? (
                  <View style={responsiveStyles.buttonContent}>
                    <ActivityIndicator color="white" size="small" />
                    <Text style={responsiveStyles.loginButtonText}>Signing In...</Text>
                  </View>
                ) : (
                  <Text style={responsiveStyles.loginButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Support Text */}
              <View style={responsiveStyles.supportContainer}>
                <Text style={responsiveStyles.supportText}>
                  Need help? Contact{" "}
                  <Text style={responsiveStyles.supportLink}>delivery-support@laundrygo.com</Text>
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const createResponsiveStyles = (dimensions: any, scale: any, verticalScale: any, moderateScale: any) => {
  const { width, height } = dimensions;
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 414;
  const isTablet = width > 768;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#0AADFF",
    },
    waveContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      minHeight: height,
    },
    brandingSection: {
      alignItems: "center",
      paddingHorizontal: moderateScale(20),
      marginTop: isTablet ? verticalScale(40) : verticalScale(20),
      marginBottom: verticalScale(10),
    },
    logoContainer: {
      width: isTablet ? scale(180) : isSmallScreen ? scale(120) : scale(150),
      height: isTablet ? verticalScale(160) : isSmallScreen ? verticalScale(120) : verticalScale(140),
      backgroundColor: "white",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: scale(300),
      overflow: "hidden",
    },
    logoImageStyle: {
      borderRadius: scale(150),
    },
    logo: {
      width: isTablet ? scale(280) : isSmallScreen ? scale(200) : scale(250),
      height: isTablet ? verticalScale(180) : isSmallScreen ? verticalScale(140) : verticalScale(160),
      marginTop: verticalScale(-10),
    },
    titleContainer: {
      alignItems: "center",
      marginTop: verticalScale(10),
    },
    title: {
      fontSize: isTablet ? moderateScale(36) : isSmallScreen ? moderateScale(28) : moderateScale(32),
      fontWeight: "bold",
      color: "white",
      textAlign: "center",
      marginBottom: verticalScale(5),
    },
    subtitle: {
      fontSize: isTablet ? moderateScale(18) : isSmallScreen ? moderateScale(14) : moderateScale(16),
      color: "white",
      textAlign: "center",
      opacity: 0.9,
    },
    loginBox: {
      backgroundColor: "white",
      marginTop: "auto",
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingVertical: isTablet ? verticalScale(40) : verticalScale(25),
      paddingHorizontal: isTablet ? scale(40) : scale(25),
      marginHorizontal: isTablet ? scale(20) : 0,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
      minHeight: height * 0.5,
    },
    loginHeader: {
      alignItems: "center",
      marginBottom: isTablet ? verticalScale(35) : verticalScale(25),
    },
    loginTitle: {
      fontSize: isTablet ? moderateScale(28) : isSmallScreen ? moderateScale(20) : moderateScale(24),
      fontWeight: "bold",
      color: "#1a1a1a",
      marginBottom: verticalScale(8),
    },
    loginSubtitle: {
      fontSize: isTablet ? moderateScale(16) : isSmallScreen ? moderateScale(12) : moderateScale(14),
      color: "#666",
      textAlign: "center",
      lineHeight: moderateScale(20),
    },
    formContainer: {
      width: "100%",
    },
    inputGroup: {
      width: "100%",
      marginBottom: isTablet ? verticalScale(25) : verticalScale(20),
    },
    inputLabel: {
      color: "#355fc7",
      fontWeight: "600",
      fontSize: isTablet ? moderateScale(16) : isSmallScreen ? moderateScale(12) : moderateScale(14),
      marginBottom: verticalScale(8),
    },
    inputField: {
      width: "100%",
      backgroundColor: "#F8F9FA",
      borderRadius: 12,
      paddingVertical: isTablet ? verticalScale(16) : verticalScale(12),
      paddingHorizontal: scale(16),
      borderWidth: 1,
      borderColor: "#E9ECEF",
      flexDirection: "row",
      alignItems: "center",
    },
    inputFieldError: {
      borderColor: "#DC3545",
      backgroundColor: "#FFF5F5",
    },
    inputText: {
      color: "#1a1a1a",
      fontSize: isTablet ? moderateScale(18) : isSmallScreen ? moderateScale(14) : moderateScale(16),
      flex: 1,
    },
    errorText: {
      color: "#DC3545",
      fontSize: isTablet ? moderateScale(14) : isSmallScreen ? moderateScale(10) : moderateScale(12),
      marginTop: verticalScale(4),
      marginLeft: scale(4),
    },
    visibilityToggle: {
      padding: scale(4),
    },
    visibilityText: {
      color: "#355fc7",
      fontSize: isTablet ? moderateScale(14) : isSmallScreen ? moderateScale(10) : moderateScale(12),
      fontWeight: "600",
    },
    loginButton: {
      backgroundColor: "#0AADFF",
      paddingVertical: isTablet ? verticalScale(20) : verticalScale(16),
      borderRadius: 12,
      alignItems: "center",
      width: "100%",
      shadowColor: "#0AADFF",
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
      marginTop: verticalScale(10),
    },
    loginButtonDisabled: {
      backgroundColor: "#87CEFA",
      shadowOpacity: 0,
      elevation: 0,
    },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    loginButtonText: {
      color: "white",
      fontSize: isTablet ? moderateScale(18) : isSmallScreen ? moderateScale(14) : moderateScale(16),
      fontWeight: "bold",
    },
    supportContainer: {
      marginTop: isTablet ? verticalScale(30) : verticalScale(20),
      paddingTop: isTablet ? verticalScale(25) : verticalScale(20),
      borderTopWidth: 1,
      borderTopColor: "#E9ECEF",
    },
    supportText: {
      color: "#666",
      fontSize: isTablet ? moderateScale(14) : isSmallScreen ? moderateScale(10) : moderateScale(12),
      textAlign: "center",
      lineHeight: moderateScale(18),
    },
    supportLink: {
      color: "#355fc7",
      fontWeight: "600",
    },
  });
};