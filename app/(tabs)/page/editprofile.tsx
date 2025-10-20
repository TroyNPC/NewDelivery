import { supabase } from "@/hooks/supabaseClient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Get the current user from Supabase auth
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !currentUser) {
          console.error('❌ Error getting user:', authError);
          Alert.alert("Error", "Please log in to edit your profile");
          router.back();
          return;
        }

        console.log('🔄 Fetching user profile for:', currentUser.id);
        setUser(currentUser);

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          console.error('❌ Error fetching user profile:', error);
          Alert.alert("Error", "Failed to load profile data");
          return;
        }

        if (data) {
          console.log('✅ User profile loaded:', data);
          setName(data.full_name || '');
          setPhone(data.phone || '');
          setEmail(data.email || '');
        }
      } catch (error) {
        console.error('❌ Error fetching user profile:', error);
        Alert.alert("Error", "Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

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
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user?.id) return;

    try {
      setSaving(true);
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      Alert.alert("Success", "Profile picture updated!");
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      Alert.alert("Error", "Failed to upload profile picture");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    try {
      setSaving(true);
      console.log('🔄 Updating user profile...');

      // First, verify the session is still active
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('❌ Session error:', sessionError);
        Alert.alert("Session Expired", "Please log in again");
        router.replace("/login");
        return;
      }

      console.log('✅ Session is active, proceeding with update');

      // Update the user profile
      const { error } = await supabase
        .from('users')
        .update({
          full_name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('❌ Error updating profile:', error);
        Alert.alert("Error", "Failed to update profile");
        return;
      }

      console.log('✅ Profile updated successfully');
      
      // Show success message and navigate back to AccountSettings
      Alert.alert(
        "Success", 
        "Profile updated successfully!",
        [
          {
            text: "OK",
            onPress: () => {
              console.log('✅ Navigating back to AccountSettings');
              // Navigate directly to the AccountSettings page
              router.push("/page/user");
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error updating profile:', error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { minHeight: height }]}>
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
              activeOpacity={0.8}
              onPress={() => router.push("/page/user")}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>EDIT PROFILE</Text>
            <View style={{ width: moderateScale(24) }} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3864C3" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { minHeight: height }]}>
      {/* ✅ CENTERED HEADER */}
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
            activeOpacity={0.8}
            onPress={() => router.push("/page/user")}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>EDIT PROFILE</Text>
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
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} disabled={saving}>
            <View style={styles.profilePlaceholder}>
              <Ionicons name="person" size={moderateScale(40)} color="#666" />
            </View>
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
              editable={!saving}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.sideLabel}>Phone:</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              style={styles.sideInput}
              editable={!saving}
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
              editable={!saving}
            />
          </View>

          <TouchableOpacity 
            activeOpacity={0.8} 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.saveText}>SAVE CHANGES</Text>
            )}
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
    alignItems: "center",
    overflow: "hidden",
  },
  waveTop: { position: "absolute", top: 0, left: 0, zIndex: 1 },
  headerContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scale(20),
    zIndex: 2,
    width: "100%",
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
    position: "absolute",
    left: 0,
    right: 0,
    fontSize: moderateScale(18),
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
  profilePlaceholder: {
    width: moderateScale(90),
    height: moderateScale(90),
    borderRadius: moderateScale(50),
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(10),
    borderWidth: 2,
    borderColor: "#D1D5DB",
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 2,
    right: 8,
    backgroundColor: "#0AADFF",
    borderRadius: 20,
    padding: 4,
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
    minWidth: scale(120),
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#cccccc",
  },
  saveText: {
    color: "#fff",
    fontSize: moderateScale(13.5),
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(16),
    color: "#666",
  },
});