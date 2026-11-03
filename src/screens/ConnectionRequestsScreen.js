
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  acceptConnectionRequest,
  cancelConnectionRequest,
  listConnectionRequests,
  rejectConnectionRequest,
} from '../api';
import { supabase } from '../supabase';
import { signedProfilePhoto } from '../profilePhoto';

export default function ConnectionRequestsScreen({
  me,
  theme,
  onBack,
  onRefresh,
}) {
  const [rows, setRows] = useState([]);
  const [photoUrls, setPhotoUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);

    try {
      const requests = await listConnectionRequests();
      const list = Array.isArray(requests) ? requests : [];

      console.log('SIGNED-IN USER:', me?.id);
      console.log(
        'CONNECTION REQUESTS:',
        JSON.stringify(list, null, 2)
      );

      setRows(list);
      setError(null);

      const photoEntries = await Promise.all(
        list.map(async (request) => {
          const isIncoming = request.direction === 'incoming';

          const path = isIncoming
            ? request.sender_avatar_path
            : request.receiver_avatar_path;

          if (!path) {
            console.warn(
              'Missing avatar path for request:',
              request.id
            );
            return [request.id, null];
          }

          try {
            const url = await signedProfilePhoto(path);

            console.log('REQUEST AVATAR:', {
              requestId: request.id,
              path,
              url,
            });

            return [request.id, url || null];
          } catch (photoError) {
            console.error('REQUEST AVATAR FAILED:', {
              requestId: request.id,
              path,
              message: photoError?.message,
            });

            return [request.id, null];
          }
        })
      );

      setPhotoUrls(Object.fromEntries(photoEntries));
    } catch (e) {
      console.error('Failed to load connection requests:', e);
      setError(e?.message || 'Could not load requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me?.id]);

  useEffect(() => {
    refresh();

    if (!me?.id) return undefined;

    const channel = supabase
      .channel(`connection-requests-${me.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connection_requests',
        },
        () => refresh()
      )
      .subscribe((status) => {
        console.log('Request subscription:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id, refresh]);

  const runAction = async (request, action) => {
    if (busyId) return;

    setBusyId(request.id);
    setError(null);

    try {
      if (action === 'accept') {
        await acceptConnectionRequest(request.id);

        await refresh();

        if (onRefresh) {
          await onRefresh();
        }

        Alert.alert(
          'Connected 💗',
          'Your connection has been accepted.'
        );
      } else if (action === 'reject') {
        await rejectConnectionRequest(request.id);
        await refresh();
      } else if (action === 'cancel') {
        await cancelConnectionRequest(request.id);
        await refresh();
      }
    } catch (e) {
      console.error('Request action failed:', e);
      setError(e?.message || 'The action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingIncoming = rows.filter(
    (r) =>
      r.direction === 'incoming' &&
      String(r.status ?? '').toLowerCase() === 'pending'
  );

  const pendingOutgoing = rows.filter(
    (r) =>
      r.direction === 'outgoing' &&
      String(r.status ?? '').toLowerCase() === 'pending'
  );

  const accepted = rows.filter(
    (r) => String(r.status ?? '').toLowerCase() === 'accepted'
  );

  const getPersonName = (request) =>
    request.direction === 'incoming'
      ? request.sender_name
      : request.receiver_name;

  const getPhoto = (request) => photoUrls[request.id] || null;

  const renderRequest = (request) => {
    const name = getPersonName(request) || 'Lovenest user';
    const status = String(request.status ?? 'pending').toLowerCase();
    const isIncoming = request.direction === 'incoming';
    const isPending = status === 'pending';
    const photoUrl = getPhoto(request);

    return (
      <View
        key={request.id}
        style={[
          styles.row,
          {
            backgroundColor: theme.panel2,
            borderColor: theme.line,
          },
        ]}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.panel },
          ]}
        >
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.avatarImage}
              resizeMode="cover"
              onError={(event) => {
                console.warn('Avatar image failed to render:', {
                  requestId: request.id,
                  uri: photoUrl,
                  error: event.nativeEvent?.error,
                });
              }}
            />
          ) : (
            <Text
              style={[
                styles.avatarLetter,
                { color: theme.accent },
              ]}
            >
              {name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={styles.info}>
          <Text
            style={[styles.name, { color: theme.fg }]}
            numberOfLines={1}
          >
            {name}
          </Text>

          <Text style={[styles.meta, { color: theme.muted }]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </View>

        {isPending && isIncoming ? (
          <View style={styles.actions}>
            <Pressable
              disabled={!!busyId}
              onPress={() => runAction(request, 'accept')}
              style={[
                styles.accept,
                {
                  backgroundColor: theme.accent,
                  opacity: busyId === request.id ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.onAccent,
                  fontWeight: '800',
                }}
              >
                {busyId === request.id ? '…' : 'Accept'}
              </Text>
            </Pressable>

            <Pressable
              disabled={!!busyId}
              onPress={() =>
                Alert.alert(
                  'Reject request?',
                  `Reject the request from ${name}?`,
                  [
                    { text: 'Keep', style: 'cancel' },
                    {
                      text: 'Reject',
                      style: 'destructive',
                      onPress: () => runAction(request, 'reject'),
                    },
                  ]
                )
              }
              style={[
                styles.reject,
                { borderColor: theme.line },
              ]}
            >
              <Text style={{ color: theme.fg, fontWeight: '700' }}>
                Reject
              </Text>
            </Pressable>
          </View>
        ) : isPending && !isIncoming ? (
          <Pressable
            disabled={!!busyId}
            onPress={() =>
              Alert.alert(
                'Cancel request?',
                'Cancel your pending request?',
                [
                  { text: 'Keep', style: 'cancel' },
                  {
                    text: 'Cancel',
                    style: 'destructive',
                    onPress: () => runAction(request, 'cancel'),
                  },
                ]
              )
            }
          >
            <Text style={{ color: theme.accent, fontWeight: '800' }}>
              Cancel
            </Text>
          </Pressable>
        ) : status === 'accepted' ? (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={theme.accent}
          />
        ) : null}
      </View>
    );
  };

  const renderEmpty = (message) => (
    <Text style={[styles.emptyText, { color: theme.muted }]}>
      {message}
    </Text>
  );

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.panel },
      ]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.line },
        ]}
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons
            name="arrow-back"
            size={23}
            color={theme.fg}
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.fg }]}>
            Connection Requests
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {pendingIncoming.length} pending incoming
          </Text>
        </View>

        <Pressable
          onPress={() => refresh(true)}
          disabled={refreshing}
          hitSlop={12}
        >
          {refreshing ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <Ionicons
              name="refresh"
              size={22}
              color={theme.accent}
            />
          )}
        </Pressable>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.section, { color: theme.fg }]}>
            Incoming requests
          </Text>

          {pendingIncoming.length
            ? pendingIncoming.map(renderRequest)
            : renderEmpty('No pending incoming requests.')}

          <Text
            style={[
              styles.section,
              { color: theme.fg, marginTop: 24 },
            ]}
          >
            Sent requests
          </Text>

          {pendingOutgoing.length
            ? pendingOutgoing.map(renderRequest)
            : renderEmpty('No pending sent requests.')}

          <Text
            style={[
              styles.section,
              { color: theme.fg, marginTop: 24 },
            ]}
          >
            Accepted requests
          </Text>

          {accepted.length
            ? accepted.map(renderRequest)
            : renderEmpty('No accepted requests yet.')}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 42,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  section: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarLetter: {
    fontSize: 23,
    fontWeight: '800',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
  },
  actions: {
    gap: 6,
  },
  accept: {
    minWidth: 68,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  reject: {
    minWidth: 68,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  emptyText: {
    paddingVertical: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#D64545',
    padding: 14,
    textAlign: 'center',
  },
});
