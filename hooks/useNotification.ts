import { supabase } from './supabaseClient';

export const useNotifications = () => {
  const sendCustomerNotification = async (
    customerId: string,
    notificationData: {
      title: string;
      body: string;
      payload: any;
    }
  ): Promise<{ databaseSuccess: boolean; pushSuccess: boolean }> => {
    try {
      console.log('📢 Sending notification to customer:', customerId);
      
      if (!customerId) {
        console.log('👤 No customer ID - skipping notification');
        return { databaseSuccess: false, pushSuccess: false };
      }

      const results = {
        databaseSuccess: false,
        pushSuccess: false
      };

      // 1. SAVE TO DATABASE NOTIFICATIONS TABLE
      try {
        const { error: dbError } = await supabase
          .from('notifications')
          .insert({
            user_id: customerId,
            title: notificationData.title,
            body: notificationData.body,
            payload: notificationData.payload,
            sent_at: new Date().toISOString()
          });

        if (dbError) {
          console.error('❌ Database notification error:', dbError);
        } else {
          results.databaseSuccess = true;
          console.log('✅ Database notification saved');
        }
      } catch (dbError) {
        console.error('❌ Database notification failed:', dbError);
      }

      // 2. SEND PUSH NOTIFICATION VIA EXPO
      try {
        // Get customer's push tokens
        const { data: pushTokens, error: tokenError } = await supabase
          .from('user_push_tokens')
          .select('expo_push_token')
          .eq('user_id', customerId)
          .not('expo_push_token', 'is', null);

        if (tokenError || !pushTokens || pushTokens.length === 0) {
          console.log('📭 No push tokens found for customer:', customerId);
          return results;
        }

        console.log(`📲 Sending push to ${pushTokens.length} device(s)`);

        // Send to all devices in parallel
        const pushPromises = pushTokens.map(async (token) => {
          const message = {
            to: token.expo_push_token,
            sound: 'default' as const,
            title: notificationData.title,
            body: notificationData.body,
            data: {
              ...notificationData.payload,
              type: 'order_update'
            }
          };

          try {
            const response = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(message),
            });

            const result = await response.json();
            return result.data?.status === 'ok';
          } catch (error) {
            console.error('📱 Push send error:', error);
            return false;
          }
        });

        const pushResults = await Promise.all(pushPromises);
        results.pushSuccess = pushResults.some(success => success);
        
        if (results.pushSuccess) {
          console.log('✅ Push notifications sent successfully');
        } else {
          console.log('❌ All push notifications failed');
        }

      } catch (pushError) {
        console.error('💥 Push notification error:', pushError);
      }

      return results;

    } catch (error) {
      console.error('💥 Notification service error:', error);
      return { databaseSuccess: false, pushSuccess: false };
    }
  };

  return {
    sendCustomerNotification
  };
};