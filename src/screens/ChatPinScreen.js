import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;

const pinKey = (userId) => `lovenest.chatpin.v1.${userId}`;
const attemptsKey = (userId) => `lovenest.chatpin.attempts.v1.${userId}`;
const lockKey = (userId) => `lovenest.chatpin.lockuntil.v1.${userId}`;

function randomSalt() {
  return Crypto.getRandomBytesAsync(16).then((bytes) =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  );
}

async function hashPin(userId, salt, pin) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `lovenest-chat-pin-v1:${userId}:${salt}:${pin}`
  );
}

async function savePin(userId, pin) {
  const salt = await randomSalt();
  const hash = await hashPin(userId, salt, pin);
  await SecureStore.setItemAsync(pinKey(userId), JSON.stringify({ salt, hash }));
  await SecureStore.deleteItemAsync(attemptsKey(userId));
  await SecureStore.deleteItemAsync(lockKey(userId));
}

export default function ChatPinScreen({ userId, email, theme, onUnlocked }) {
  const [loading, setLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [mode, setMode] = useState('pin'); // pin | recover
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [otp, setOtp] = useState('');
  const [verifiedForReset, setVerifiedForReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lockUntil, setLockUntil] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(pinKey(userId));
        const until = Number(await SecureStore.getItemAsync(lockKey(userId)) || 0);
        if (!alive) return;
        setHasPin(Boolean(stored));
        setLockUntil(until);
      } catch (e) {
        if (alive) setError('Could not read secure storage. Please restart the app.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [lockUntil]);

  const validPin = (value) => /^\d{4,6}$/.test(value);

  const handleCreateOrUnlock = async () => {
    setError('');
    setMessage('');
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'recover') {
        if (!verifiedForReset) {
          if (!email) throw new Error('Your account has no registered email address.');
          if (!/^\d{6}$/.test(otp)) throw new Error('Enter the 6-digit email verification code.');
          const { error: verifyError } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email',
          });
          if (verifyError) throw verifyError;
          setVerifiedForReset(true);
          setPin('');
          setConfirmPin('');
          setMessage('Email verified. Create your new chat PIN below.');
          return;
        }

        if (!validPin(pin)) throw new Error('Choose a PIN containing 4 to 6 digits.');
        if (pin !== confirmPin) throw new Error('The PINs do not match.');
        await savePin(userId, pin);
        setHasPin(true);
        setMode('pin');
        setVerifiedForReset(false);
        setOtp('');
        setPin('');
        setConfirmPin('');
        setMessage('Your chat PIN has been reset.');
        onUnlocked();
        return;
      }

      if (!hasPin) {
        if (!validPin(pin)) throw new Error('Choose a PIN containing 4 to 6 digits.');
        if (pin !== confirmPin) throw new Error('The PINs do not match.');
        await savePin(userId, pin);
        setHasPin(true);
        setPin('');
        setConfirmPin('');
        onUnlocked();
        return;
      }

      const until = Number(await SecureStore.getItemAsync(lockKey(userId)) || 0);
      if (until > Date.now()) {
        setLockUntil(until);
        throw new Error(`Too many incorrect attempts. Try again in ${Math.ceil((until - Date.now()) / 1000)} seconds.`);
      }

      if (!validPin(pin)) throw new Error('Enter your 4–6 digit PIN.');
      const storedRaw = await SecureStore.getItemAsync(pinKey(userId));
      if (!storedRaw) {
        setHasPin(false);
        throw new Error('No PIN is set. Please create a new PIN.');
      }
      const stored = JSON.parse(storedRaw);
      const candidate = await hashPin(userId, stored.salt, pin);

      if (candidate !== stored.hash) {
        const count = Number(await SecureStore.getItemAsync(attemptsKey(userId)) || 0) + 1;
        if (count >= MAX_ATTEMPTS) {
          const untilNext = Date.now() + LOCK_MS;
          await SecureStore.setItemAsync(attemptsKey(userId), '0');
          await SecureStore.setItemAsync(lockKey(userId), String(untilNext));
          setLockUntil(untilNext);
          throw new Error('Five incorrect attempts. Chat is locked for 60 seconds.');
        }
        await SecureStore.setItemAsync(attemptsKey(userId), String(count));
        throw new Error(`Incorrect PIN. ${MAX_ATTEMPTS - count} attempt(s) remaining.`);
      }

      await SecureStore.deleteItemAsync(attemptsKey(userId));
      await SecureStore.deleteItemAsync(lockKey(userId));
      setLockUntil(0);
      setPin('');
      onUnlocked();
    } catch (e) {
      setError(e?.message || 'Security action failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const requestRecoveryCode = async () => {
    setError('');
    setMessage('');
    if (!email) {
      setError('Your account has no registered email address.');
      return;
    }
    setBusy(true);
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (sendError) throw sendError;
      setMode('recover');
      setVerifiedForReset(false);
      setMessage(`A verification code was requested for ${email}. Check your email and enter the code.`);
    } catch (e) {
      setError(e?.message || 'Could not send the verification email.');
    } finally {
      setBusy(false);
    }
  };

  const switchToRecovery = () => {
    setMode('recover');
    setVerifiedForReset(false);
    setOtp('');
    setPin('');
    setConfirmPin('');
    setMessage('');
    setError('');
  };

  const switchToPin = () => {
    setMode('pin');
    setVerifiedForReset(false);
    setOtp('');
    setPin('');
    setConfirmPin('');
    setMessage('');
    setError('');
  };

  const fieldStyle = [
    styles.input,
    { backgroundColor: theme.panel2, color: theme.fg, borderColor: theme.line },
  ];

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.panel }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  const isSetup = !hasPin && mode === 'pin';
  const isRecovering = mode === 'recover';

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.panel }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.iconCircle, { backgroundColor: theme.panel2 }]}>
          <Ionicons name="lock-closed" size={34} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.fg }]}>
          {isRecovering
            ? verifiedForReset ? 'Create a new PIN' : 'Recover chat PIN'
            : isSetup ? 'Create your chat PIN' : 'Unlock Sparsh chat 🤞'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          {isRecovering
            ? verifiedForReset
              ? 'Email verified. Set a new 4–6 digit PIN.'
              : `We’ll verify your registered email${email ? ` (${email})` : ''} before you reset your PIN.`
            : isSetup
              ? 'Set a separate 4–6 digit PIN to protect your private chat.'
              : 'Enter your PIN to open your private chat.'}
        </Text>

        {isRecovering && !verifiedForReset ? (
          <>
            <Pressable
              onPress={requestRecoveryCode}
              disabled={busy}
              style={[styles.secondaryBtn, { borderColor: theme.line }]}
            >
              <Text style={[styles.secondaryText, { color: theme.accent }]}>
                {busy ? 'Sending code…' : 'Send verification code to email'}
              </Text>
            </Pressable>
            <TextInput
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit email code"
              placeholderTextColor={theme.muted}
              keyboardType="number-pad"
              maxLength={6}
              style={fieldStyle}
              autoComplete="one-time-code"
            />
          </>
        ) : null}

        {(!isRecovering || verifiedForReset) ? (
          <>
            <TextInput
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
              placeholder={isSetup || verifiedForReset ? 'Create 4–6 digit PIN' : 'Enter chat PIN'}
              placeholderTextColor={theme.muted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={fieldStyle}
              autoComplete="off"
            />
            {(isSetup || verifiedForReset) ? (
              <TextInput
                value={confirmPin}
                onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="Confirm PIN"
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                style={fieldStyle}
                autoComplete="off"
              />
            ) : null}
          </>
        ) : null}

        {secondsLeft > 0 && !isRecovering ? (
          <Text style={[styles.notice, { color: theme.muted }]}>
            Try again in {secondsLeft} seconds.
          </Text>
        ) : null}

        {message ? <Text style={[styles.notice, { color: theme.accent }]}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleCreateOrUnlock}
          disabled={busy || (secondsLeft > 0 && !isRecovering)}
          style={[
            styles.primaryBtn,
            { backgroundColor: theme.accent, opacity: busy || (secondsLeft > 0 && !isRecovering) ? 0.6 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={[styles.primaryText, { color: theme.onAccent }]}>
              {isRecovering
                ? verifiedForReset ? 'Save new PIN' : 'Verify email code'
                : isSetup ? 'Save PIN' : 'Unlock chat'}
            </Text>
          )}
        </Pressable>

        {!isSetup && !isRecovering ? (
          <Pressable onPress={switchToRecovery} style={styles.linkBtn}>
            <Text style={[styles.linkText, { color: theme.accent }]}>Forgot PIN? Verify email</Text>
          </Pressable>
        ) : null}

        {isRecovering ? (
          <Pressable onPress={switchToPin} style={styles.linkBtn}>
            <Text style={[styles.linkText, { color: theme.muted }]}>Back to PIN unlock</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 26, gap: 14 },
  iconCircle: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 25, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 8 },
  input: { height: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 20, letterSpacing: 5, textAlign: 'center' },
  primaryBtn: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 4 },
  primaryText: { fontSize: 16, fontWeight: '800' },
  secondaryBtn: { minHeight: 46, borderWidth: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontWeight: '700' },
  linkBtn: { padding: 10, alignItems: 'center' },
  linkText: { fontWeight: '700', fontSize: 14 },
  notice: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  error: { color: '#D64545', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
