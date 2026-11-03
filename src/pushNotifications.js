
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { supabase } from './supabase';

const CHANNEL_ID = 'messages';

// ===============================
// NOTIFICATION DISPLAY SETTINGS
// ===============================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ===============================
// GET EAS PROJECT ID
// ===============================
function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

// ===============================
// REGISTER PUSH NOTIFICATIONS
// ===============================
export async function registerForMessagePush(userId) {
  try {
    if (!userId) {
      return {
        registered: false,
        reason: 'user-id-missing',
      };
    }

    // Physical device required.
    if (!Device.isDevice) {
      return {
        registered: false,
        reason: 'physical-device-required',
      };
    }

    // Expo Go does not support Android remote push
    // notifications from SDK 53 onward.
    if (Constants.executionEnvironment === 'storeClient') {
      return {
        registered: false,
        reason: 'expo-go-not-supported',
      };
    }

    // ===============================
    // ANDROID NOTIFICATION CHANNEL
    // ===============================
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
        CHANNEL_ID,
        {
          name: 'Chat Messages',
          description: 'Notifications for new Sparsh messages',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E91E63',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        }
      );
    }

    // ===============================
    // CHECK PERMISSION
    // ===============================
    let permission =
      await Notifications.getPermissionsAsync();

    if (permission.status !== 'granted') {
      permission =
        await Notifications.requestPermissionsAsync();
    }

    if (permission.status !== 'granted') {
      return {
        registered: false,
        reason: 'permission-denied',
      };
    }

    // ===============================
    // GET EAS PROJECT ID
    // ===============================
    const projectId = getProjectId();

    if (!projectId) {
      throw new Error(
        'EAS project ID missing. Configure extra.eas.projectId in app.json.'
      );
    }

    // ===============================
    // GENERATE EXPO PUSH TOKEN
    // ===============================
    const tokenResult =
      await Notifications.getExpoPushTokenAsync({
        projectId,
      });

    const expoPushToken = tokenResult.data;

    if (!expoPushToken) {
      throw new Error('Expo push token was not generated.');
    }

    console.log('Expo Push Token:', expoPushToken);

    // ===============================
    // SAVE TOKEN TO SUPABASE
    // ===============================
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: expoPushToken,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,expo_push_token',
        }
      );

    if (error) {
      throw error;
    }

    console.log('Sparsh push registration successful.');

    return {
      registered: true,
      token: expoPushToken,
    };

  } catch (error) {
    console.warn(
      'Sparsh push registration failed:',
      error?.message || error
    );

    return {
      registered: false,
      reason: 'registration-failed',
      error: error?.message || String(error),
    };
  }
}

// ===============================
// REMOVE CURRENT DEVICE TOKEN
// ===============================
export async function removeCurrentPushToken(userId) {
  try {
    if (!userId || !Device.isDevice) {
      return;
    }

    if (Constants.executionEnvironment === 'storeClient') {
      return;
    }

    const permission =
      await Notifications.getPermissionsAsync();

    if (permission.status !== 'granted') {
      return;
    }

    const projectId = getProjectId();

    if (!projectId) {
      return;
    }

    const tokenResult =
      await Notifications.getExpoPushTokenAsync({
        projectId,
      });

    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('expo_push_token', tokenResult.data);

    if (error) {
      throw error;
    }

    console.log('Sparsh push token removed.');

  } catch (error) {
    console.warn(
      'Sparsh push token cleanup failed:',
      error?.message || error
    );
  }
}
