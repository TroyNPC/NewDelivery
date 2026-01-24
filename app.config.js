export default {
  name: "LaundryGO Deliver",
  slug: "delivery",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "delivery",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "This app needs access to your location for delivery tracking and navigation.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "This app needs access to your location for delivery tracking and navigation.",
      NSLocationAlwaysUsageDescription: "This app needs access to your location for delivery tracking and navigation."
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/icon.png",
      backgroundColor: "#E6F4FE"
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.troytm.delivery",
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "FOREGROUND_SERVICE"
    ]
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000"
        }
      }
    ],
    "expo-secure-store",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location for delivery tracking and navigation.",
        locationAlwaysPermission: "Allow $(PRODUCT_NAME) to use your location for delivery tracking and navigation.", 
        locationWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location for delivery tracking and navigation."
      }
    ]
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  },
  extra: {
    router: {},
    eas: {
      projectId: "818591bd-77ed-446c-a9ad-831df8e1d0d7" // ← Add this line
    },
    supabaseUrl: process.env.SUPABASE_URL || "https://isorrhjmjywkldosbltw.supabase.co",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "sb_publishable_SEdBw1VsYsQLhK4M6xXwjw_L7cYquRS"
  }
};