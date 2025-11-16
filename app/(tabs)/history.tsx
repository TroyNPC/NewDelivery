import { supabase } from "@/hooks/supabaseClient"; // Adjust import path as needed
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
  View,
  useWindowDimensions,
} from "react-native";
import {
  moderateScale,
  scale,
  verticalScale,
} from "react-native-size-matters";
import Svg, { Path } from "react-native-svg";

type HistoryItem = {
  id: string;
  type: 'pickup' | 'delivery';
  customer_name: string;
  customer_contact: string | null;
  address: string;
  service_type: string | null;
  completed_at: string;
  status: string | null;
  weight?: number | null;
  total_amount?: number | null;
};

export default function History() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<'all' | 'pickups' | 'deliveries'>('all');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [activeTab]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      
      // Get user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('User not authenticated');
        return;
      }

      let pickupHistory: HistoryItem[] = [];
      let deliveryHistory: HistoryItem[] = [];

      // Fetch pickup history
      if (activeTab === 'all' || activeTab === 'pickups') {
        const { data: pickups, error: pickupError } = await supabase
          .from('pickup_history')
          .select('*')
          .eq('driver_id', user.id)
          .order('collected_at', { ascending: false });

        if (!pickupError && pickups) {
          pickupHistory = pickups.map(item => ({
            id: item.id,
            type: 'pickup' as const,
            customer_name: item.customer_name,
            customer_contact: item.customer_contact,
            address: item.pickup_address,
            service_type: item.service_type,
            completed_at: item.collected_at,
            status: item.status,
            weight: item.estimated_weight,
          }));
        }
      }

      // Fetch delivery history
      if (activeTab === 'all' || activeTab === 'deliveries') {
        const { data: deliveries, error: deliveryError } = await supabase
          .from('delivery_history')
          .select('*')
          .eq('driver_id', user.id)
          .order('delivered_at', { ascending: false });

        if (!deliveryError && deliveries) {
          deliveryHistory = deliveries.map(item => ({
            id: item.id,
            type: 'delivery' as const,
            customer_name: item.customer_name,
            customer_contact: item.customer_contact,
            address: item.delivery_address,
            service_type: item.service_type,
            completed_at: item.delivered_at,
            status: item.status,
            weight: item.weight,
            total_amount: item.total_amount,
          }));
        }
      }

      // Combine and sort by completion date
      const combinedHistory = [...pickupHistory, ...deliveryHistory]
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

      setHistory(combinedHistory);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (type: 'pickup' | 'delivery', status: string | null) => {
    if (status === 'completed' || status === 'delivered' || status === 'collected') {
      return { icon: 'checkmark-circle', color: '#34C759' };
    } else if (status === 'failed' || status === 'cancelled') {
      return { icon: 'close-circle', color: '#FF3B30' };
    } else {
      return { icon: 'time', color: '#FF9500' };
    }
  };

  const getTypeColor = (type: 'pickup' | 'delivery') => {
    return type === 'pickup' ? '#FF6B35' : '#007AFF';
  };

  const getTypeLabel = (type: 'pickup' | 'delivery') => {
    return type === 'pickup' ? 'PICKUP' : 'DELIVERY';
  };

  const formatStatusText = (status: string | null) => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
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
            <Text style={styles.headerTitle}>History</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3864C3" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { minHeight: height }]}>
      {/* Header */}
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
          <Text style={styles.headerTitle}>History</Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'all' && styles.activeTab
          ]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'all' && styles.activeTabText
          ]}>
            All
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'pickups' && styles.activeTab
          ]}
          onPress={() => setActiveTab('pickups')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'pickups' && styles.activeTabText
          ]}>
            Pickups
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'deliveries' && styles.activeTab
          ]}
          onPress={() => setActiveTab('deliveries')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'deliveries' && styles.activeTabText
          ]}>
            Deliveries
          </Text>
        </TouchableOpacity>
      </View>

      {/* History List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: verticalScale(100),
        }}
        showsVerticalScrollIndicator={false}
      >
        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyStateText}>
              No {activeTab === 'all' ? 'history' : activeTab} found
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Your completed {activeTab === 'all' ? 'pickups and deliveries' : activeTab} will appear here
            </Text>
          </View>
        ) : (
          history.map((item) => {
            const statusInfo = getStatusIcon(item.type, item.status);
            const typeColor = getTypeColor(item.type);
            
            return (
              <View
                key={item.id}
                style={[styles.card, { borderLeftColor: typeColor, borderLeftWidth: 4 }]}
              >
                {/* Header with type and status */}
                <View style={styles.cardHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
                    <Text style={styles.typeText}>{getTypeLabel(item.type)}</Text>
                  </View>
                  <View style={styles.statusContainer}>
                    <Ionicons 
                      name={statusInfo.icon as any} 
                      size={20} 
                      color={statusInfo.color} 
                    />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {formatStatusText(item.status)}
                    </Text>
                  </View>
                </View>

                {/* Customer Info */}
                <Text style={styles.customerName}>For: {item.customer_name}</Text>
                {item.customer_contact && (
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={16} color="#666" />
                    <Text style={styles.contactText}>{item.customer_contact}</Text>
                  </View>
                )}

                {/* Address */}
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={16} color="#666" />
                  <Text style={styles.addressText}>{item.address}</Text>
                </View>

                {/* Service Details */}
                <View style={styles.detailsRow}>
                  {item.service_type && (
                    <View style={styles.detailItem}>
                      <Ionicons name="cube-outline" size={14} color="#3864C3" />
                      <Text style={styles.serviceText}>{item.service_type}</Text>
                    </View>
                  )}
                  {item.weight && (
                    <View style={styles.detailItem}>
                      <Ionicons name="scale-outline" size={14} color="#666" />
                      <Text style={styles.detailText}>{item.weight}kg</Text>
                    </View>
                  )}
                  {item.total_amount && (
                    <View style={styles.detailItem}>
                      <Ionicons name="cash-outline" size={14} color="#666" />
                      <Text style={styles.detailText}>₱{item.total_amount}</Text>
                    </View>
                  )}
                </View>

                {/* Completion Time */}
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={14} color="#666" />
                  <Text style={styles.timeText}>
                    Completed: {formatDate(item.completed_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  headerBox: {
    width: "100%",
    backgroundColor: "#3864C3",
    justifyContent: "center",
    overflow: "hidden",
  },
  waveTop: { position: "absolute", top: 0, left: 0, zIndex: 1 },
  headerContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scale(10),
    zIndex: 2,
    marginTop: verticalScale(30),
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    paddingVertical: verticalScale(8),
    alignItems: 'center',
    borderRadius: scale(8),
    marginHorizontal: scale(4),
  },
  activeTab: {
    backgroundColor: '#3864C3',
  },
  tabText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: 'white',
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: scale(12),
    padding: scale(16),
    marginHorizontal: scale(20),
    marginVertical: verticalScale(8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  typeBadge: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: scale(20),
  },
  typeText: {
    color: 'white',
    fontSize: moderateScale(12),
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginLeft: scale(4),
  },
  customerName: {
    fontSize: moderateScale(16),
    fontWeight: "bold",
    color: "#000",
    marginBottom: verticalScale(4),
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  contactText: {
    fontSize: moderateScale(14),
    color: "#666",
    marginLeft: scale(6),
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: verticalScale(8),
  },
  addressText: {
    fontSize: moderateScale(14),
    color: "#333",
    marginLeft: scale(8),
    flex: 1,
    lineHeight: verticalScale(20),
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: verticalScale(8),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scale(12),
    marginBottom: verticalScale(4),
  },
  serviceText: {
    fontSize: moderateScale(13),
    color: "#3864C3",
    fontWeight: '500',
    marginLeft: scale(4),
  },
  detailText: {
    fontSize: moderateScale(13),
    color: "#666",
    marginLeft: scale(4),
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
  timeText: {
    fontSize: moderateScale(12),
    color: "#666",
    marginLeft: scale(6),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(16),
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(100),
  },
  emptyStateText: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: '#666',
    marginTop: verticalScale(16),
  },
  emptyStateSubtext: {
    fontSize: moderateScale(14),
    color: '#999',
    textAlign: 'center',
    marginTop: verticalScale(8),
    paddingHorizontal: scale(40),
  },
});