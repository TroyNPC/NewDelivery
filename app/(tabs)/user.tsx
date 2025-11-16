import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../hooks/supabaseClient";
import { Database } from "../../types/supabase";

type UserProfile = Database['public']['Tables']['users']['Row'];
type ShopAssignment = Database['public']['Tables']['shop_user_assignments']['Row'] & {
  shops: { name: string } | null;
  shop_branches: { name: string } | null;
};
type Delivery = Database['public']['Tables']['deliveries']['Row'];

export default function UserProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [shopAssignment, setShopAssignment] = useState<ShopAssignment | null>(null);
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    pendingDeliveries: 0,
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !authUser) {
        Alert.alert("Error", "Unable to load user data");
        return;
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.log("Profile error:", profileError);
      }

      // Use the profile from database or create a fallback
      if (userProfile) {
        setUser(userProfile);
      } else {
        // Create a basic profile from auth data
        setUser({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || null,
          phone: null,
          avatar_url: null,
          created_at: authUser.created_at,
          updated_at: null,
        } as UserProfile);
      }

      // Get shop assignment with proper typing
      const { data: assignment, error: assignmentError } = await supabase
        .from('shop_user_assignments')
        .select(`
          *,
          shops (name),
          shop_branches (name)
        `)
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .eq('role_in_shop', 'delivery')
        .single();

      if (!assignmentError && assignment) {
        setShopAssignment(assignment as ShopAssignment);
      }

      // Get delivery stats
      await loadDeliveryStats(authUser.id);

    } catch (error) {
      console.log("Error loading user data:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryStats = async (userId: string) => {
    try {
      // Use count queries for better performance
      const { count: totalCount, error: totalError } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', userId);

      const { count: completedCount, error: completedError } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', userId)
        .eq('status', 'delivered');

      const { count: pendingCount, error: pendingError } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', userId)
        .in('status', ['assigned', 'picked_up']);

      if (!totalError && !completedError && !pendingError) {
        setStats({
          totalDeliveries: totalCount || 0,
          completedDeliveries: completedCount || 0,
          pendingDeliveries: pendingCount || 0,
        });
      }
    } catch (error) {
      console.log("Error loading stats:", error);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: performSignOut,
        },
      ]
    );
  };

  const performSignOut = async () => {
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      router.replace("/");
    } catch (error: any) {
      console.log("Sign out error:", error);
      Alert.alert("Error", "Failed to sign out");
    } finally {
      setSigningOut(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDisplayEmail = () => {
    return user?.email || 'No email provided';
  };

  const getDisplayName = () => {
    return user?.full_name || 'Delivery Partner';
  };

  const getShopName = () => {
    return shopAssignment?.shops?.name || 'Unknown Shop';
  };

  const getBranchName = () => {
    return shopAssignment?.shop_branches?.name || 'Unknown Branch';
  };

  const getRoleDisplay = () => {
    // Safe handling of potentially null/undefined role_in_shop
    const role = shopAssignment?.role_in_shop;
    if (!role) return 'Delivery Partner';
    
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const hasAvatar = (): boolean => {
    return !!(user?.avatar_url && user.avatar_url.trim() !== '');
  };

  const getAvatarUri = (): string | null => {
    const avatarUrl = user?.avatar_url;
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '') {
      return avatarUrl;
    }
    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0AADFF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const avatarUri = getAvatarUri();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image 
                source={{ uri: avatarUri }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#666" />
              </View>
            )}
          </View>

          <Text style={styles.userName}>
            {getDisplayName()}
          </Text>
          <Text style={styles.userEmail}>{getDisplayEmail()}</Text>
          
          {user?.phone && (
            <View style={styles.phoneContainer}>
              <Ionicons name="call-outline" size={16} color="#666" />
              <Text style={styles.phoneText}>{user.phone}</Text>
            </View>
          )}
        </View>

        {/* Shop Assignment */}
        {shopAssignment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shop Assignment</Text>
            <View style={styles.assignmentCard}>
              <View style={styles.assignmentRow}>
                <Ionicons name="business-outline" size={20} color="#0AADFF" />
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentLabel}>Shop</Text>
                  <Text style={styles.assignmentValue}>{getShopName()}</Text>
                </View>
              </View>
              
              <View style={styles.assignmentRow}>
                <Ionicons name="location-outline" size={20} color="#0AADFF" />
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentLabel}>Branch</Text>
                  <Text style={styles.assignmentValue}>{getBranchName()}</Text>
                </View>
              </View>
              
              <View style={styles.assignmentRow}>
                <Ionicons name="person-outline" size={20} color="#0AADFF" />
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentLabel}>Role</Text>
                  <Text style={styles.assignmentValue}>
                    {getRoleDisplay()}
                  </Text>
                </View>
              </View>

              <View style={styles.assignmentRow}>
                <Ionicons name="calendar-outline" size={20} color="#0AADFF" />
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentLabel}>Assignment Date</Text>
                  <Text style={styles.assignmentValue}>
                    {formatDate(shopAssignment.created_at)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Delivery Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Statistics</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={[styles.statCircle, styles.totalStat]}>
                <Ionicons name="cube-outline" size={24} color="white" />
              </View>
              <Text style={styles.statNumber}>{stats.totalDeliveries}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            
            <View style={styles.statItem}>
              <View style={[styles.statCircle, styles.completedStat]}>
                <Ionicons name="checkmark-done-outline" size={24} color="white" />
              </View>
              <Text style={styles.statNumber}>{stats.completedDeliveries}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            
            <View style={styles.statItem}>
              <View style={[styles.statCircle, styles.pendingStat]}>
                <Ionicons name="time-outline" size={24} color="white" />
              </View>
              <Text style={styles.statNumber}>{stats.pendingDeliveries}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        </View>

        {/* Account Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="notifications-outline" size={22} color="#666" />
              <Text style={styles.actionText}>Notification Settings</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#666" />
              <Text style={styles.actionText}>Privacy & Security</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="help-circle-outline" size={22} color="#666" />
              <Text style={styles.actionText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity 
          style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="white" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            LaundryGo Delivery Partner App
          </Text>
          <Text style={styles.footerVersion}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  headerPlaceholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  profileCard: {
    backgroundColor: "white",
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f1f3f4",
    justifyContent: "center",
    alignItems: "center",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
    textAlign: "center",
  },
  userEmail: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
    textAlign: "center",
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  phoneText: {
    fontSize: 14,
    color: "#666",
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  assignmentCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  assignmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  assignmentValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  totalStat: {
    backgroundColor: "#0AADFF",
  },
  completedStat: {
    backgroundColor: "#28a745",
  },
  pendingStat: {
    backgroundColor: "#ffc107",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  actionsContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f4",
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#dc3545",
    marginHorizontal: 20,
    marginVertical: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#dc3545",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 12,
    color: "#999",
  },
});