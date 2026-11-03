
import React, { useCallback, useEffect, useState } from 'react';
import NetworkGuard from './src/NetworkGuard';
import { AppState } from 'react-native';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';

import AuthScreen from './src/screens/AuthScreen';
import PairScreen from './src/screens/PairScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatPinScreen from './src/screens/ChatPinScreen';
import ConnectionRequestsScreen from './src/screens/ConnectionRequestsScreen';

import { registerForMessagePush } from './src/pushNotifications';
import { configured, supabase } from './src/supabase';
import { loadMe, signOut, disconnectPartner } from './src/api';
import { useTheme } from './src/theme';
import { AudioRecordingProvider } from './src/AudioRecordingProvider';

function Centered({ theme, children }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        backgroundColor: theme.panel,
      }}
    >
      {children}
    </View>
  );
}

export default function App() {
  const theme = useTheme();

  const [session, setSession] = useState(undefined);
  const [ctx, setCtx] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // App starts locked on every fresh launch.
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);

  const userId = session?.user?.id;

  // Load Supabase session.
  useEffect(() => {
    if (!configured) {
      setSession(null);
      return undefined;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setLoadError(error.message);
        setSession(null);
        return;
      }

      setSession(data.session);
    }).catch((error) => {
      setLoadError(error.message || 'Unable to load session.');
      setSession(null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // Refresh user and partner information.
  const refresh = useCallback(async () => {
    if (!userId) return;

    try {
      const result = await loadMe(userId);
      setCtx(result);
      setLoadError(null);
    } catch (error) {
      setLoadError(error.message || 'Could not load your account.');
    }
  }, [userId]);

  // Disconnect partner.
  const disconnect = useCallback(async () => {
    await disconnectPartner();
    await refresh();
  }, [refresh]);

  // Handle user session changes.
  useEffect(() => {
    setPinUnlocked(false);
    setRequestsOpen(false);

    if (userId) {
      refresh();
    } else {
      setCtx(null);
    }
  }, [userId, refresh]);

  // Register device for push notifications.
  useEffect(() => {
    if (!userId) return undefined;

    let active = true;

    registerForMessagePush(userId)
      .then((result) => {
        if (active && !result.registered) {
          console.log('Push registration:', result.reason);
        }
      })
      .catch((error) => {
        if (active) {
          console.warn(
            'Sparsh push registration failed:',
            error?.message || error
          );
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // Lock app when it goes into background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setPinUnlocked(false);
      }
    });

    return () => sub.remove();
  }, []);

  let body;

  if (!configured) {
    body = (
      <Centered theme={theme}>
        <Text
          style={{
            color: theme.fg,
            fontSize: 20,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          Connect your database
        </Text>

        <Text
          style={{
            color: theme.muted,
            fontSize: 15,
            textAlign: 'center',
          }}
        >
          Check your .env file and restart Expo with npx expo start --clear.
        </Text>
      </Centered>
    );
  } else if (session === undefined) {
    body = (
      <Centered theme={theme}>
        <ActivityIndicator color={theme.accent} />
      </Centered>
    );
  } else if (!session) {
    body = <AuthScreen theme={theme} />;
  } else if (session && !pinUnlocked) {
    body = (
      <ChatPinScreen
        key={userId}
        userId={userId}
        email={session.user?.email}
        theme={theme}
        onUnlocked={() => setPinUnlocked(true)}
      />
    );
  } else if (loadError) {
    body = (
      <Centered theme={theme}>
        <Text
          style={{
            color: theme.fg,
            fontSize: 16,
            textAlign: 'center',
          }}
        >
          Could not load your account: {loadError}
        </Text>

        <Pressable onPress={refresh}>
          <Text style={{ color: theme.accent, fontWeight: '700' }}>
            Try again
          </Text>
        </Pressable>

        <Pressable onPress={() => signOut()}>
          <Text style={{ color: theme.muted }}>
            Sign out
          </Text>
        </Pressable>
      </Centered>
    );
  } else if (!ctx) {
    body = (
      <Centered theme={theme}>
        <ActivityIndicator color={theme.accent} />
      </Centered>
    );
  } else if (requestsOpen) {
    body = (
      <ConnectionRequestsScreen
        me={ctx.me}
        theme={theme}
        onBack={() => setRequestsOpen(false)}
        onRefresh={refresh}
      />
    );
  } else if (!ctx.partner) {
    body = (
      <PairScreen
        me={ctx.me}
        theme={theme}
        onRefresh={refresh}
        onOpenRequests={() => setRequestsOpen(true)}
      />
    );
  } else {
    body = (
      <ChatScreen
        me={ctx.me}
        partner={ctx.partner}
        theme={theme}
        onSignOut={signOut}
        onDisconnect={disconnect}
        onRefresh={refresh}
        onOpenRequests={() => setRequestsOpen(true)}
      />
    );
  }

  return (
    <AudioRecordingProvider>
      <NetworkGuard>
        <>
          <StatusBar
            barStyle={theme.statusBar}
            backgroundColor={theme.panel}
          />

          {body}
        </>
      </NetworkGuard>
    </AudioRecordingProvider>
  );
}
