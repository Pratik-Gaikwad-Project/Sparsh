
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Share,
  ActivityIndicator,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  cancelConnectionRequest,
  listConnectionRequests,
  sendConnectionRequest,
  signOut,
} from '../api';

import { supabase } from '../supabase';
import Avatar from '../components/Avatar';
import { editProfilePhoto, signedProfilePhoto } from '../profilePhoto';

export default function PairScreen({
  me,
  theme,
  onRefresh,
  onOpenRequests,
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [outgoing, setOutgoing] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);

  const loadRequests = async () => {
    setLoadingRequests(true);

    try {
      const requests = await listConnectionRequests();
      setOutgoing(
        requests.filter((request) => request.direction === 'outgoing')
      );
    } catch (e) {
      setError(e.message || 'Could not load requests.');
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadProfilePhoto = async () => {
    try {
      if (!me?.avatar_path) {
        setProfilePhotoUrl(null);
        return;
      }

      const url = await signedProfilePhoto(me.avatar_path);
      setProfilePhotoUrl(url);
    } catch {
      setProfilePhotoUrl(null);
    }
  };

  useEffect(() => {
    loadRequests();
    loadProfilePhoto();

    const channel = supabase
      .channel(`connection-requests-pair-${me.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connection_requests',
          filter: `sender_id=eq.${me.id}`,
        },
        () => {
          loadRequests();
          onRefresh?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connection_requests',
          filter: `receiver_id=eq.${me.id}`,
        },
        () => {
          loadRequests();
          onRefresh?.();
        }
      )
      .subscribe();

    const timer = setInterval(() => {
      loadRequests();
      onRefresh?.();
    }, 12000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [me.id]);

  const handleRefreshProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_path, name, hue')
        .eq('id', me.id)
        .single();

      if (error) throw error;

      const url = await signedProfilePhoto(data.avatar_path);
      setProfilePhotoUrl(url);

      await onRefresh?.();
    } catch (error) {
      console.error('Profile photo refresh failed:', error.message);
      Alert.alert('Profile photo', error.message);
    }
  };
  const send = async () => {
    const value = code.trim().toUpperCase();

    if (!value) {
      setError('Enter a connection code.');
      return;
    }

    if (busy) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      await sendConnectionRequest(value);

      setCode('');
      setSuccess(
        'Request sent. They must accept before you can chat.'
      );

      await loadRequests();
    } catch (e) {
      setError(
        e.message || 'Could not send the request. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const cancel = (id) => {
    Alert.alert(
      'Cancel request?',
      'The other person will no longer be able to accept this request.',
      [
        {
          text: 'Keep request',
          style: 'cancel',
        },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelConnectionRequest(id);
              await loadRequests();
            } catch (e) {
              setError(e.message || 'Could not cancel the request.');
            }
          },
        },
      ]
    );
  };

  const share = async () => {
    try {
      await Share.share({
        message: `Join me on Lovenest. My connection code is ${me.invite_code}`,
      });
    } catch (e) {
      setError(e.message || 'Could not share your connection code.');
    }
  };

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.panel },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* User profile photo */}
        <Pressable
          onPress={() => editProfilePhoto(me.id, handleRefreshProfile)}
          style={{ alignItems: 'center', gap: 6 }}
        >
          <Avatar
            name={me?.name || 'You'}
            hue={me?.hue || 345}
            imageUrl={profilePhotoUrl || me?.avatar_url || null}
            size={82}
          />
          <Text style={{ color: theme.accent, fontWeight: '700' }}>
            Change profile photo
          </Text>
        </Pressable>

        <View style={styles.heart}>
          <Ionicons
            name="heart"
            size={40}
            color={theme.accent}
          />
        </View>

        <Text
          style={[
            styles.title,
            { color: theme.fg },
          ]}
        >
          Hi {me.name}, connect with your person
        </Text>

        <Text
          style={[
            styles.sub,
            { color: theme.muted },
          ]}
        >
          Send a request using their code. You will connect only
          after they accept.
        </Text>

        {/* Your connection code */}
        <View
          style={[
            styles.codeBox,
            {
              backgroundColor: theme.panel2,
              borderColor: theme.line,
            },
          ]}
        >
          <Text
            style={[
              styles.codeLabel,
              { color: theme.muted },
            ]}
          >
            YOUR CONNECTION CODE
          </Text>

          <Text
            selectable
            style={[
              styles.code,
              { color: theme.accent },
            ]}
          >
            {me.invite_code}
          </Text>

          <Pressable onPress={share} hitSlop={8}>
            <Text
              style={[
                styles.shareText,
                { color: theme.accent },
              ]}
            >
              Share my code
            </Text>
          </Pressable>
        </View>

        {/* Enter partner connection code */}
        <TextInput
          value={code}
          onChangeText={(value) => {
            setCode(value.toUpperCase());
            setError(null);
            setSuccess(null);
          }}
          placeholder="Their connection code"
          placeholderTextColor={theme.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={[
            styles.input,
            {
              backgroundColor: theme.panel2,
              color: theme.fg,
              borderColor: theme.line,
            },
          ]}
        />

        {error ? (
          <Text
            accessibilityRole="alert"
            style={styles.error}
          >
            {error}
          </Text>
        ) : null}

        {success ? (
          <Text style={styles.success}>
            {success}
          </Text>
        ) : null}

        <Pressable
          onPress={send}
          disabled={busy}
          style={[
            styles.btn,
            {
              backgroundColor: theme.accent,
              opacity: busy ? 0.65 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text
              style={[
                styles.btnText,
                { color: theme.onAccent },
              ]}
            >
              Send Request
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={onOpenRequests}
          style={[
            styles.secondaryBtn,
            { borderColor: theme.line },
          ]}
        >
          <Text
            style={[
              styles.secondaryText,
              { color: theme.fg },
            ]}
          >
            Connection Requests
            {outgoing.filter(
              (request) => request.status === 'pending'
            ).length
              ? ` · ${outgoing.filter(
                (request) => request.status === 'pending'
              ).length
              } outgoing`
              : ''}
          </Text>
        </Pressable>

        {/* Sent requests */}
        <View style={styles.outgoingBox}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.fg },
            ]}
          >
            Sent requests
          </Text>

          {loadingRequests && outgoing.length === 0 ? (
            <ActivityIndicator color={theme.accent} />
          ) : outgoing.length === 0 ? (
            <Text style={{ color: theme.muted }}>
              No sent requests yet.
            </Text>
          ) : (
            outgoing.slice(0, 4).map((request) => (
              <View
                key={request.id}
                style={[
                  styles.requestRow,
                  { borderColor: theme.line },
                ]}
              >
                <View style={styles.requestInfo}>
                  <Text
                    style={[
                      styles.requestName,
                      { color: theme.fg },
                    ]}
                  >
                    {request.receiver_name || 'Lovenest user'}
                  </Text>

                  <Text
                    style={[
                      styles.requestStatus,
                      { color: theme.muted },
                    ]}
                  >
                    {request.status
                      ? request.status[0].toUpperCase() +
                      request.status.slice(1)
                      : 'Unknown'}
                  </Text>
                </View>

                {request.status === 'pending' ? (
                  <Pressable
                    onPress={() => cancel(request.id)}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.cancelText,
                        { color: theme.accent },
                      ]}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* Sign out */}
        <Pressable
          onPress={() => signOut()}
          style={styles.signOut}
        >
          <Text
            style={[
              styles.signOutText,
              { color: theme.muted },
            ]}
          >
            Sign out
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop:
      (Platform.OS === 'android'
        ? StatusBar.currentHeight || 0
        : 0) + 20,
  },

  content: {
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  profile: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },

  photoLabel: {
    fontWeight: '700',
  },

  heart: {
    alignItems: 'center',
    marginTop: 2,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },

  sub: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 22,
  },

  codeBox: {
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
  },

  codeLabel: {
    fontSize: 11,
    letterSpacing: 1.3,
    fontWeight: '600',
  },

  code: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 6,
  },

  shareText: {
    fontWeight: '600',
  },

  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 3,
    textAlign: 'center',
    borderWidth: 1,
  },

  error: {
    color: '#D64545',
    fontSize: 13,
    textAlign: 'center',
  },

  success: {
    color: '#248653',
    fontSize: 13,
    textAlign: 'center',
  },

  btn: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },

  secondaryBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  secondaryText: {
    fontWeight: '700',
  },

  outgoingBox: {
    gap: 5,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },

  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  requestInfo: {
    flex: 1,
  },

  requestName: {
    fontWeight: '700',
  },

  requestStatus: {
    fontSize: 12,
    marginTop: 3,
  },

  cancelText: {
    fontWeight: '700',
  },

  signOut: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },

  signOutText: {
    fontSize: 14,
  },
});