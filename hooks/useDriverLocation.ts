import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../hooks/supabaseClient';

type LocationCoords = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
};

type UseDriverLocationReturn = {
  currentLocation: LocationCoords | null;
  isTracking: boolean;
  startLocationTracking: (deliveryId: string) => Promise<void>;
  stopLocationTracking: () => void;
  updateDriverLocation: (deliveryId: string, lat: number, lng: number) => Promise<boolean>;
  locationError: string | null;
};

/**
 * Hook for managing driver location tracking and updates
 */
export const useDriverLocation = (): UseDriverLocationReturn => {
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  /**
   * Update driver location in the database
   */
  const updateDriverLocation = useCallback(async (deliveryId: string, lat: number, lng: number): Promise<boolean> => {
    try {
      console.log('📍 Updating driver location:', { deliveryId, lat, lng });
      
      const { error } = await supabase
        .from('deliveries')
        .update({
          current_lat: lat,
          current_lng: lng,
          updated_at: new Date().toISOString()
        })
        .eq('id', deliveryId);

      if (error) {
        console.error('❌ Database location update error:', error);
        return false;
      }

      console.log('✅ Driver location updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Unexpected error updating location:', error);
      return false;
    }
  }, []);

  /**
   * Start real-time location tracking for a delivery
   */
  const startLocationTracking = useCallback(async (deliveryId: string): Promise<void> => {
    try {
      setLocationError(null);
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        Alert.alert(
          'Location Permission Required',
          'This app needs location access to track your delivery route.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get initial position
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const initialCoords: LocationCoords = {
        lat: initialLocation.coords.latitude,
        lng: initialLocation.coords.longitude,
        accuracy: initialLocation.coords.accuracy,
        altitude: initialLocation.coords.altitude,
        heading: initialLocation.coords.heading,
        speed: initialLocation.coords.speed,
      };

      setCurrentLocation(initialCoords);
      
      // Update database with initial location
      await updateDriverLocation(deliveryId, initialCoords.lat, initialCoords.lng);

      // Start watching position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000, // Update every 15 seconds
          distanceInterval: 25, // Update every 25 meters
        },
        async (location) => {
          const newCoords: LocationCoords = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy,
            altitude: location.coords.altitude,
            heading: location.coords.heading,
            speed: location.coords.speed,
          };

          setCurrentLocation(newCoords);
          
          // Update database with new location
          await updateDriverLocation(deliveryId, newCoords.lat, newCoords.lng);
        }
      );

      setLocationSubscription(subscription);
      setIsTracking(true);
      
      console.log('🚗 Location tracking started for delivery:', deliveryId);

    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      setLocationError('Failed to start location tracking');
      Alert.alert('Location Error', 'Unable to start location tracking');
    }
  }, [updateDriverLocation]);

  /**
   * Stop location tracking
   */
  const stopLocationTracking = useCallback((): void => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    setIsTracking(false);
    console.log('🛑 Location tracking stopped');
  }, [locationSubscription]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationSubscription]);

  return {
    currentLocation,
    isTracking,
    startLocationTracking,
    stopLocationTracking,
    updateDriverLocation,
    locationError,
  };
};

/**
 * Utility function for one-time location updates (without continuous tracking)
 */
export const updateDriverLocationOnce = async (deliveryId: string): Promise<boolean> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.error('Location permission denied');
      return false;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { error } = await supabase
      .from('deliveries')
      .update({
        current_lat: location.coords.latitude,
        current_lng: location.coords.longitude,
        updated_at: new Date().toISOString()
      })
      .eq('id', deliveryId);

    if (error) {
      console.error('Error updating driver location:', error);
      return false;
    }

    console.log('✅ Driver location updated once');
    return true;
  } catch (error) {
    console.error('Error in one-time location update:', error);
    return false;
  }
};

/**
 * Hook for customers to track driver location in real-time
 */
export const useTrackDriverLocation = (deliveryId: string) => {
  const [driverLocation, setDriverLocation] = useState<LocationCoords | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deliveryId) return;

    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Fetch delivery with driver info
        const { data: deliveryData, error: fetchError } = await supabase
          .from('deliveries')
          .select(`
            *,
            users (
              full_name,
              phone,
              avatar_url
            )
          `)
          .eq('id', deliveryId)
          .single();

        if (fetchError) throw fetchError;

        if (deliveryData) {
          setDriverInfo(deliveryData.users);
          
          // Set initial location if available
          if (deliveryData.current_lat && deliveryData.current_lng) {
            setDriverLocation({
              lat: deliveryData.current_lat,
              lng: deliveryData.current_lng,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching driver data:', err);
        setError('Failed to load driver information');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`driver_location_${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`
        },
        (payload) => {
          const updatedDelivery = payload.new as any;
          
          if (updatedDelivery.current_lat && updatedDelivery.current_lng) {
            setDriverLocation({
              lat: updatedDelivery.current_lat,
              lng: updatedDelivery.current_lng,
            });
            console.log('📍 Driver location updated via real-time');
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [deliveryId]);

  return {
    driverLocation,
    driverInfo,
    loading,
    error,
  };
};