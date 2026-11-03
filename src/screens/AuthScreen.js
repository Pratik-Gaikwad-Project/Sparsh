import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signIn, signUp } from '../api';

export default function AuthScreen({ theme }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [since, setSince] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const isUp = mode === 'signup';

  const submit = async () => {
    setMsg(null);
    if (!email.trim() || !password) return setMsg({ text: 'Enter your email and password.' });
    if (isUp) {
      if (!name.trim()) return setMsg({ text: 'Enter your name.' });
      if (password.length < 6) return setMsg({ text: 'Password needs at least 6 characters.' });
      if (since && (!/^\d{4}-\d{2}-\d{2}$/.test(since) || Number.isNaN(Date.parse(since)))) {
        return setMsg({ text: 'Use the date format YYYY-MM-DD, for example 2024-02-14.' });
      }
    }
    setBusy(true);
    try {
      if (isUp) {
        const r = await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          togetherSince: since,
        });
        if (r.needsConfirm) {
          setMode('signin');
          setMsg({ ok: true, text: 'Account created. Confirm your email, then sign in.' });
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e) {
      setMsg({ text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const field = [styles.input, { backgroundColor: theme.panel2, color: theme.fg }];

  return (
    <ScrollView
      style={{ backgroundColor: theme.panel }}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brand}>
        <Ionicons name="heart" size={25} color={theme.accent} />
        <Text style={[styles.brandText, { color: theme.fg }]}>Sparsh </Text>
      </View>
      <Text style={[styles.sub, { color: theme.muted }]}>
        A private chat for the two of you.
      </Text>

      {isUp ? (
        <TextInput
          style={field}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={theme.muted}
        />
      ) : null}
      <TextInput
        style={field}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={field}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={theme.muted}
        secureTextEntry
        autoCapitalize="none"
      />
      {isUp ? (
        <TextInput
          style={field}
          value={since}
          onChangeText={setSince}
          placeholder="Together since (YYYY-MM-DD, optional)"
          placeholderTextColor={theme.muted}
          keyboardType="numbers-and-punctuation"
        />
      ) : null}

      {msg ? (
        <Text style={{ color: msg.ok ? theme.tick : '#D64545', fontSize: 14 }}>{msg.text}</Text>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={[styles.btn, { backgroundColor: theme.accent, opacity: busy ? 0.7 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={[styles.btnText, { color: theme.onAccent }]}>
            {isUp ? 'Create account' : 'Sign in'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setMode(isUp ? 'signin' : 'signup');
          setMsg(null);
        }}
      >
        <Text style={{ color: theme.accent, textAlign: 'center', fontSize: 15, marginTop: 4 }}>
          {isUp ? 'I already have an account' : 'New here? Create an account'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0) + 24,
  },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  brandText: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  sub: { textAlign: 'center', fontSize: 15, marginBottom: 16 },
  input: { borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 16 },
  btn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontSize: 16, fontWeight: '700' },
});
