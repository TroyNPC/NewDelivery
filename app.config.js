export default {
  name: "delivery",
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
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png"
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
      projectId: "973feae5-ff3b-47cb-bc94-906b3caf813d"
    },
    supabaseUrl: process.env.SUPABASE_URL || "https://isorrhjmjywkldosbltw.supabase.co",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "sb_publishable_SEdBw1VsYsQLhK4M6xXwjw_L7cYquRS"
  }
};