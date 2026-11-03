import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';

import { useAudioRecording } from '../AudioRecordingProvider';

import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
  StatusBar,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import Avatar from '../components/Avatar';
import { editProfilePhoto } from '../profilePhoto';
import Bubble from '../components/Bubble';
import { useConversation } from '../useConversation';

import {
  EMOJIS,
  QUICK_NOTES,
  dayLabel,
  daysTogether,
} from '../data';

// Smooth entrance animation for chat items.
function AnimatedChatItem({ children, itemKey }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [itemKey, opacity, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function ChatScreen({
  me,
  partner,
  theme,
  onSignOut,
  onDisconnect,
  onRefresh,
  onOpenRequests,
}) {
  const {
    msgs,
    typing,
    online,
    error,
    send,
    react,
    notifyTyping,
  } = useConversation(me, partner);

  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const {
    isRecording,
    isBusy: recorderBusy,
    startRecording,
    stopRecording,
  } = useAudioRecording();

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  const days = daysTogether(
    me.together_since || partner.together_since
  );

  // Open gallery and send the selected photo.
  const pickAndSendPhoto = async () => {
    if (photoBusy) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photo permission required',
          'Please allow photo library access to send pictures.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const imageUri = result.assets?.[0]?.uri;

      if (!imageUri) {
        Alert.alert('Photo error', 'No photo was selected.');
        return;
      }

      setPhotoBusy(true);

      await send({ imageUri });

      scrollToLatest();
    } catch (err) {
      Alert.alert(
        'Photo failed',
        err?.message || 'Could not send the photo.'
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  // Prepare chat messages and date separators.
  const items = useMemo(() => {
    const out = [];
    let lastDay = null;

    msgs.forEach((m) => {
      const label = dayLabel(m.t);

      if (label !== lastDay) {
        out.push({
          id: `day-${label}-${m.id}`,
          kind: 'day',
          label,
        });

        lastDay = label;
      }

      out.push({ kind: 'msg', ...m });
    });

    if (typing) {
      out.push({
        id: 'typing',
        kind: 'typing',
      });
    }

    return out;
  }, [msgs, typing]);

  // Scroll to latest message.
  const scrollToLatest = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({
        animated: true,
      });
    });
  };

  // Keyboard listeners.
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios'
        ? 'keyboardWillShow'
        : 'keyboardDidShow';

    const hideEvent =
      Platform.OS === 'ios'
        ? 'keyboardWillHide'
        : 'keyboardDidHide';

    const showSub = Keyboard.addListener(
      showEvent,
      scrollToLatest
    );

    const hideSub = Keyboard.addListener(
      hideEvent,
      scrollToLatest
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Send text message.
  const submit = () => {
    const value = text.trim();

    if (!value) return;

    send({ text: value });

    setText('');

    scrollToLatest();
  };

  // Record and send voice note using the persistent app-level recorder.
  const sendVoice = async () => {
    if (voiceBusy || recorderBusy) return;

    setVoiceBusy(true);

    try {
      if (isRecording) {
        const result = await stopRecording();

        if (!result?.uri) {
          throw new Error('Recording file was not created.');
        }

        await send({
          voiceUri: result.uri,
          voice: result.durationSeconds,
        });

        scrollToLatest();
        return;
      }

      await startRecording();
    } catch (error) {
      console.error('Lovenest voice recording error:', error);

      Alert.alert(
        'Voice note failed',
        error?.message || 'Could not record or send your voice note.'
      );
    } finally {
      setVoiceBusy(false);
    }
  };

  // Send button animation.
  const animateSend = (pressed) => {
    Animated.spring(sendScale, {
      toValue: pressed ? 0.88 : 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 7,
    }).start();
  };

  // Sign out confirmation.
  const confirmSignOut = () =>
    Alert.alert(
      'Sign out?',
      'Your messages stay safe. Sign in again any time.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: onSignOut,
        },
      ]
    );

  // Disconnect partner confirmation.
  const confirmDisconnect = () =>
    Alert.alert(
      'Disconnect partner?',
      `Disconnect from ${partner.name}? This permanently deletes all chat messages between you, including text, voice-message records, and photo-message records. This cannot be undone. You can connect with someone else afterward.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!onDisconnect) {
                throw new Error(
                  'Disconnect action is not configured.'
                );
              }

              await onDisconnect();

            } catch (err) {
              Alert.alert(
                'Disconnect failed',
                err?.message || 'Please try again.'
              );
            }
          },
        },
      ]
    );

  // Render chat messages.
  const renderItem = ({ item }) => {
    if (item.kind === 'day') {
      return (
        <AnimatedChatItem itemKey={item.id}>
          <View
            style={[
              styles.dayPill,
              {
                backgroundColor: theme.panel,
                borderColor: theme.line,
              },
            ]}
          >
            <Text
              style={[
                styles.dayText,
                { color: theme.muted },
              ]}
            >
              {item.label}
            </Text>
          </View>
        </AnimatedChatItem>
      );
    }

    if (item.kind === 'typing') {
      return (
        <AnimatedChatItem itemKey={item.id}>
          <View style={styles.typingRow}>
            <View
              style={[
                styles.typingBubble,
                { backgroundColor: theme.incoming },
              ]}
            >
              <Text
                style={{
                  color: theme.accent,
                  fontSize: 18,
                  letterSpacing: 3,
                }}
              >
                •••
              </Text>
            </View>
          </View>
        </AnimatedChatItem>
      );
    }

    return (
      <AnimatedChatItem itemKey={item.id}>
        <Bubble
          msg={item}
          theme={theme}
          onReact={react}
        />
      </AnimatedChatItem>
    );
  };

  const hasText = Boolean(text.trim());

  return (
    <KeyboardAvoidingView
      style={[
        styles.screen,
        { backgroundColor: theme.bg },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar
        barStyle={
          theme.isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={theme.panel}
      />

      {/* Chat header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.panel,
            borderBottomColor: theme.line,
          },
        ]}
      >
        <View style={styles.avatarWrap}>
          <Avatar
            name={partner?.name || 'Partner'}
            hue={partner?.hue || 345}
            imageUrl={partner?.avatar_url || null}
            size={56}
          />

          <View
            style={[
              styles.onlineDot,
              {
                backgroundColor: online
                  ? '#36C98F'
                  : theme.muted,
                borderColor: theme.panel,
              },
            ]}
          />
        </View>

        <View style={styles.headerInfo}>
          <Text
            style={[
              styles.name,
              { color: theme.fg },
            ]}
            numberOfLines={1}
          >
            {partner?.name || 'Partner'}
          </Text>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: typing
                    ? theme.accent
                    : online
                      ? '#36C98F'
                      : theme.muted,
                },
              ]}
            />

            <Text
              style={[
                styles.statusText,
                {
                  color: typing
                    ? theme.accent
                    : theme.muted,
                },
              ]}
            >
              {typing
                ? 'typing…'
                : online
                  ? 'online'
                  : 'offline'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => editProfilePhoto(me.id, onRefresh)}
          hitSlop={12}
          accessibilityLabel="Change profile photo"
          style={[
            styles.headerAction,
            { backgroundColor: theme.bg },
          ]}
        >
          <Ionicons
            name="camera-outline"
            size={21}
            color={theme.accent}
          />
        </Pressable>

        <Pressable
          onPress={onOpenRequests}
          hitSlop={12}
          accessibilityLabel="Connection requests"
          style={[
            styles.headerAction,
            { backgroundColor: theme.bg },
          ]}
        >
          <Ionicons
            name="person-add-outline"
            size={21}
            color={theme.accent}
          />
        </Pressable>

        <Pressable
          onPress={confirmDisconnect}
          hitSlop={12}
          accessibilityLabel="Disconnect partner"
          style={[
            styles.headerAction,
            { backgroundColor: theme.bg },
          ]}
        >
          <Ionicons
            name="unlink-outline"
            size={21}
            color="#D64545"
          />
        </Pressable>

        <Pressable
          onPress={confirmSignOut}
          hitSlop={12}
          accessibilityLabel="Sign out"
          style={[
            styles.headerAction,
            { backgroundColor: theme.bg },
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={21}
            color={theme.fg}
          />
        </Pressable>
      </View>

      {/* Relationship banner */}
      {days !== null ? (
        <View
          style={[
            styles.together,
            {
              backgroundColor: theme.panel2,
              borderBottomColor: theme.line,
            },
          ]}
        >
          <Ionicons
            name="heart"
            size={15}
            color={theme.accent}
          />

          <Text
            style={[
              styles.togetherText,
              { color: theme.muted },
            ]}
          >
            Day {days} together
          </Text>

          <View style={styles.togetherSeparator} />

          <Text
            style={[
              styles.togetherHint,
              { color: theme.muted },
            ]}
          >
            Made with love
          </Text>
        </View>
      ) : null}

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          Platform.OS === 'ios'
            ? 'interactive'
            : 'on-drag'
        }
        onContentSizeChange={scrollToLatest}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View
              style={[
                styles.heartCircle,
                { backgroundColor: theme.panel },
              ]}
            >
              <Ionicons
                name="heart"
                size={30}
                color={theme.accent}
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                { color: theme.fg },
              ]}
            >
              Your little love story
            </Text>

            <Text
              style={[
                styles.emptyText,
                { color: theme.muted },
              ]}
            >
              Send a message to {partner.name} and make their day.
            </Text>
          </View>
        }
      />

      {/* Error message */}
      {error ? (
        <View style={styles.errorBar}>
          <Ionicons
            name="alert-circle-outline"
            size={17}
            color="#fff"
          />

          <Text
            style={styles.errorText}
            numberOfLines={2}
          >
            {error}
          </Text>
        </View>
      ) : null}

      {/* Quick messages */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.quickNotes}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_NOTES.map((note) => (
          <Pressable
            key={note}
            onPress={() => send({ text: note })}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: theme.panel,
                borderColor: theme.line,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: theme.fg },
              ]}
            >
              {note}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Emoji picker */}
      {showEmoji ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.emojiRow}
          style={[
            styles.emojiBar,
            {
              backgroundColor: theme.panel,
              borderTopColor: theme.line,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {EMOJIS.map((emoji, index) => (
            <Pressable
              key={`${emoji}-${index}`}
              onPress={() => {
                setText((current) => current + emoji);
                inputRef.current?.focus();
              }}
              hitSlop={5}
            >
              <Text style={styles.emoji}>
                {emoji}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Message composer */}
      <View
        style={[
          styles.composer,
          {
            backgroundColor: theme.bg,
            borderTopColor: theme.line,
          },
        ]}
      >
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: theme.panel,
              borderColor: theme.line,
            },
          ]}
        >
          {/* Photo-send button */}
          <Pressable
            onPress={pickAndSendPhoto}
            disabled={photoBusy}
            style={[
              styles.emojiButton,
              photoBusy && styles.disabledButton,
            ]}
            hitSlop={8}
            accessibilityLabel="Send a photo"
          >
            <Ionicons
              name="image-outline"
              size={24}
              color={theme.accent}
            />
          </Pressable>

          {/* Emoji button */}
          <Pressable
            onPress={() => {
              if (!showEmoji) {
                Keyboard.dismiss();
              }

              setShowEmoji((value) => !value);
            }}
            style={styles.emojiButton}
            hitSlop={6}
            accessibilityLabel="Toggle emoji picker"
          >
            <Ionicons
              name={
                showEmoji
                  ? 'keypad-outline'
                  : 'happy-outline'
              }
              size={24}
              color={theme.accent}
            />
          </Pressable>

          {/* Message input */}
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={(value) => {
              setText(value);

              if (value) {
                notifyTyping();
              }
            }}
            onFocus={() => setShowEmoji(false)}
            placeholder="Write something sweet…"
            placeholderTextColor={theme.muted}
            style={[
              styles.input,
              { color: theme.fg },
            ]}
            multiline
            maxLength={4000}
            blurOnSubmit={false}
            returnKeyType="default"
            accessibilityLabel="Message"
          />
        </View>

        {/* Recording indicator */}
        {isRecording ? (
          <Text
            style={{
              color: theme.accent,
              textAlign: 'center',
              paddingVertical: 6,
              fontWeight: '600',
            }}
          >
            ● Recording… Tap stop to send
          </Text>
        ) : null}

        {/* Send message or voice note */}
        <Animated.View
          style={[
            styles.sendOuter,
            { transform: [{ scale: sendScale }] },
          ]}
        >
          <Pressable
            onPressIn={() => animateSend(true)}
            onPressOut={() => animateSend(false)}
            onPress={hasText ? submit : sendVoice}
            style={[
              styles.sendBtn,
              {
                backgroundColor: theme.accent,
                opacity: (hasText || isRecording) ? 1 : 0.92,
              },
            ]}
            accessibilityLabel={
              hasText
                ? 'Send message'
                : isRecording
                  ? 'Stop recording and send voice note'
                  : 'Start voice recording'
            }
          >
            <Ionicons
              name={
                hasText
                  ? 'send'
                  : isRecording
                    ? 'stop'
                    : 'mic'
              }
              size={20}
              color={theme.onAccent}
            />
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Styles
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop:
      Platform.OS === 'android'
        ? StatusBar.currentHeight || 0
        : 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  avatarWrap: {
    position: 'relative',
  },

  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },

  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },

  name: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.1,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },

  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  together: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  togetherText: {
    fontSize: 12,
    fontWeight: '700',
  },

  togetherSeparator: {
    height: 12,
    width: 1,
    backgroundColor: '#9995',
    marginHorizontal: 2,
  },

  togetherHint: {
    fontSize: 12,
  },

  messageList: {
    flex: 1,
  },

  messageContent: {
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 12,
    flexGrow: 1,
  },

  dayPill: {
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 5,
    marginVertical: 10,
  },

  dayText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  typingRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    marginVertical: 4,
  },

  typingBubble: {
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 65,
  },

  heartCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },

  errorBar: {
    backgroundColor: '#D64545',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  errorText: {
    color: '#fff',
    fontSize: 12,
    flex: 1,
  },

  quickNotes: {
    flexGrow: 0,
  },

  chips: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  chip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  emojiBar: {
    flexGrow: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  emojiRow: {
    gap: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },

  emoji: {
    fontSize: 27,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 25,
    paddingLeft: 10,
    paddingRight: 13,
    paddingVertical: 7,
    minHeight: 48,
    paddingBottom: Platform.OS === 'ios' ? 7 : 6,
  },

  emojiButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
    marginBottom: 1,
  },

  disabledButton: {
    opacity: 0.5,
  },

  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 105,
    paddingTop: 6,
    paddingBottom: 10,
    textAlignVertical: 'center',
  },

  sendOuter: {
    marginBottom: 1,
  },

  sendBtn: {
    width: 47,
    height: 47,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});