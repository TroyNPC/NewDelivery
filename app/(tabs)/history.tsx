import { supabase } from "@/hooks/supabaseClient";
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
import { AppHeader } from "../component/AppHeader";

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
  service_name?: string | null;
  detergent_name?: string | null;
  softener_name?: string | null;
  method_label?: string | null;
  branch_name?: string | null;
  isExpanded?: boolean;
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

      // Fetch pickup history with explicit column selection
      if (activeTab === 'all' || activeTab === 'pickups') {
        const { data: pickups, error: pickupError } = await supabase
          .from('pickup_history')
          .select(`
            id,
            driver_id,
            customer_name,
            customer_contact,
            pickup_address,
            service_type,
            service_name,
            detergent_name,
            softener_name,
            method_label,
            branch_name,
            collected_at,
            status,
            estimated_weight
          `)
          .eq('driver_id', user.id)
          .order('collected_at', { ascending: false });

        if (!pickupError && pickups) {
          pickupHistory = pickups.map(item => ({
            id: item.id,
            type: 'pickup' as const,
            customer_name: item.customer_name,
            customer_contact: item.customer_contact,
            address: item.pickup_address,
            service_type: item.service_type || item.service_name,
            completed_at: item.collected_at,
            status: item.status,
            weight: item.estimated_weight,
            service_name: item.service_name,
            detergent_name: item.detergent_name,
            softener_name: item.softener_name,
            method_label: item.method_label,
            branch_name: item.branch_name,
            isExpanded: false,
          }));
        }
      }

      // Fetch delivery history with explicit column selection
      if (activeTab === 'all' || activeTab === 'deliveries') {
        const { data: deliveries, error: deliveryError } = await supabase
          .from('delivery_history')
          .select(`
            id,
            driver_id,
            customer_name,
            customer_contact,
            delivery_address,
            service_type,
            service_name,
            detergent_name,
            softener_name,
            method_label,
            branch_name,
            delivered_at,
            status,
            weight,
            total_amount
          `)
          .eq('driver_id', user.id)
          .order('delivered_at', { ascending: false });

        if (!deliveryError && deliveries) {
          deliveryHistory = deliveries.map(item => ({
            id: item.id,
            type: 'delivery' as const,
            customer_name: item.customer_name,
            customer_contact: item.customer_contact,
            address: item.delivery_address,
            service_type: item.service_type || item.service_name,
            completed_at: item.delivered_at,
            status: item.status,
            weight: item.weight,
            total_amount: item.total_amount,
            service_name: item.service_name,
            detergent_name: item.detergent_name,
            softener_name: item.softener_name,
            method_label: item.method_label,
            branch_name: item.branch_name,
            isExpanded: false,
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

  const toggleItemExpanded = (itemId: string) => {
    setHistory(prevHistory => 
      prevHistory.map(item => 
        item.id === itemId 
          ? { ...item, isExpanded: !item.isExpanded }
          : item
      )
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
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

  const getServiceDetails = (item: HistoryItem) => {
    const details = [];
    
    const serviceName = item.service_name || item.service_type;
    if (serviceName) {
      details.push(serviceName);
    }
    
    if (item.detergent_name) {
      details.push(`Detergent: ${item.detergent_name}`);
    }
    
    if (item.softener_name) {
      details.push(`Softener: ${item.softener_name}`);
    }
    
    if (item.method_label) {
      details.push(item.method_label);
    }
    
    if (item.branch_name) {
      details.push(item.branch_name);
    }
    
    return details;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { minHeight: height }]}>
        <AppHeader title="HISTORY" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3864C3" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { minHeight: height }]}>
      <AppHeader 
        title="HISTORY"
        rightElement={
          <TouchableOpacity 
            onPress={fetchHistory} 
            style={styles.refreshButton}
          >
            <Ionicons name="refresh" size={24} color="white" />
          </TouchableOpacity>
        }
      />

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
            const serviceDetails = getServiceDetails(item);
            const isExpanded = item.isExpanded || false;
            const hasServiceDetails = serviceDetails.length > 0;

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

                {/* Customer Info - Always visible */}
                <Text style={styles.customerName}>For: {item.customer_name}</Text>
                {item.customer_contact && (
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={16} color="#666" />
                    <Text style={styles.contactText}>{item.customer_contact}</Text>
                  </View>
                )}

                {/* Address - Always visible */}
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={16} color="#666" />
                  <Text style={styles.addressText}>{item.address}</Text>
                </View>

                {/* Service Details - Only show when expanded */}
                {isExpanded && hasServiceDetails && (
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detailsTitle}>Service Details:</Text>
                    {serviceDetails.map((detail, index) => (
                      <View key={index} style={styles.detailItem}>
                        <Ionicons name="information-circle-outline" size={14} color="#3864C3" />
                        <Text style={styles.detailText}>{detail}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Weight and Amount - Always visible */}
                <View style={styles.metricsRow}>
                  {item.weight != null && (
                    <View style={styles.metricItem}>
                      <Ionicons name="scale-outline" size={14} color="#666" />
                      <Text style={styles.metricText}>{item.weight}kg</Text>
                    </View>
                  )}
                  
                  {item.total_amount != null && (
                    <View style={styles.metricItem}>
                      <Ionicons name="cash-outline" size={14} color="#666" />
                      <Text style={styles.metricText}>₱{item.total_amount}</Text>
                    </View>
                  )}
                </View>

                {/* Completion Time - Always visible */}
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={14} color="#666" />
                  <Text style={styles.timeText}>
                    Completed: {formatDate(item.completed_at)}
                  </Text>
                </View>

                {/* Show More/Less Button - Only show if there are service details */}
                {hasServiceDetails && (
                  <TouchableOpacity 
                    style={styles.showMoreButton}
                    onPress={() => toggleItemExpanded(item.id)}
                  >
                    <Text style={styles.showMoreText}>
                      {isExpanded ? `Show Less` : `Show Service Details`}
                    </Text>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={16} 
                      color="#3864C3" 
                    />
                  </TouchableOpacity>
                )}
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
  refreshButton: {
    zIndex: 3,
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
  detailsContainer: {
    marginBottom: verticalScale(8),
    padding: scale(12),
    backgroundColor: '#F8F9FA',
    borderRadius: scale(8),
  },
  detailsTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#333',
    marginBottom: verticalScale(6),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  detailText: {
    fontSize: moderateScale(13),
    color: "#3864C3",
    fontWeight: '500',
    marginLeft: scale(4),
    flex: 1,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(8),
    marginTop: verticalScale(4),
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  showMoreText: {
    fontSize: moderateScale(13),
    color: "#3864C3",
    fontWeight: '600',
    marginRight: scale(4),
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: verticalScale(8),
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scale(12),
    marginBottom: verticalScale(4),
  },
  metricText: {
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