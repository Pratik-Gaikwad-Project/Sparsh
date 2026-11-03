import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '../data';
import { getSignedPhotoUrl } from '../photoStorage';
import { getSignedVoiceUrl } from '../voiceStorage';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

function Ticks({ status, theme }) {
  if (status === 'sending') return <Ionicons name="time-outline" size={14} color={theme.muted} />;
  if (status === 'failed') return <Ionicons name="alert-circle" size={15} color="#D64545" />;
  if (status === 'sent') return <Ionicons name="checkmark" size={15} color={theme.muted} />;
  return <Ionicons name="checkmark-done" size={15} color={status === 'read' ? theme.tick : theme.muted} />;
}

function VoiceNote({ msg, theme, ink }) {
  const total = msg.voice || 0;
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { try { player.pause(); } catch (_) {} }, [player]);
  useEffect(() => {
    if (playerStatus.didJustFinish) setPlaying(false);
  }, [playerStatus.didJustFinish]);

  const toggle = async () => {
    if (loading) return;
    setError(false);
    try {
      if (playing) {
        player.pause();
        setPlaying(false);
        return;
      }
      setLoading(true);
      if (!loaded) {
        if (!msg.voicePath) throw new Error('This voice note has no audio file.');
        const url = await getSignedVoiceUrl(msg.voicePath);
        if (!url) throw new Error('Voice note is unavailable.');
        await player.replace({ uri: url });
        setLoaded(true);
      }
      player.play();
      setPlaying(true);

    } catch (_) {
      setError(true);
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  const current = playerStatus.currentTime || 0;
  const duration = playerStatus.duration || total;
  const shown = playing ? Math.max(0, Math.floor(duration - current)) : total;
  const bars = Array.from({ length: 22 }, (_, i) => 6 + ((i * 7 + total * 3) % 13));
  const done = playing && duration > 0 ? Math.round((current / duration) * bars.length) : 0;

  return <View style={styles.voice}>
    <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}>
      {loading ? <ActivityIndicator size="small" color={ink} /> : <Ionicons name={playing ? 'pause' : 'play'} size={22} color={ink} />}
    </Pressable>
    <View style={styles.bars}>
      {bars.map((h, i) => <View key={i} style={{ width: 3, height: h + 4, borderRadius: 2, backgroundColor: ink, opacity: i < done ? 1 : 0.4 }} />)}
    </View>
    <Text style={{ color: ink, fontSize: 12 }}>{error ? 'Unavailable' : `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`}</Text>
  </View>;
}

function ChatPhoto({ imagePath, theme }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setLoading(true);
    setFailed(false);
    getSignedPhotoUrl(imagePath)
      .then((signedUrl) => { if (active) setUrl(signedUrl); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [imagePath]);

  if (loading) return <View style={styles.photoPlaceholder}>
    <ActivityIndicator color={theme.accent} />
    <Text style={{ color: theme.muted, marginTop: 6 }}>Loading photo…</Text>
  </View>;

  if (failed || !url) return <View style={styles.photoPlaceholder}>
    <Ionicons name="image-outline" size={28} color={theme.muted} />
    <Text style={{ color: theme.muted, marginTop: 6 }}>Photo unavailable</Text>
  </View>;

  return <Image source={{ uri: url }} style={styles.photo} resizeMode="cover"
    onError={() => setFailed(true)} accessibilityLabel="Photo message" />;
}

export default function Bubble({ msg, theme, onReact }) {
  const lastTap = useRef(0);
  const ink = msg.me ? theme.outInk : theme.fg;
  const onPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) onReact(msg.id);
    lastTap.current = now;
  };

  return <View style={[styles.row, msg.me ? styles.rowMe : styles.rowThem]}>
    <Pressable onPress={onPress} style={[
      styles.bubble,
      msg.me ? { backgroundColor: theme.out, borderBottomRightRadius: 4 }
        : { backgroundColor: theme.incoming, borderBottomLeftRadius: 4 },
      msg.reaction && { marginBottom: 12 },
    ]}>
      {msg.imagePath ? <ChatPhoto imagePath={msg.imagePath} theme={theme} />
        : msg.voicePath || msg.voice ? <VoiceNote msg={msg} theme={theme} ink={ink} />
          : <Text style={[styles.text, { color: ink }]}>{msg.text}</Text>}
      <View style={styles.meta}>
        <Text style={[styles.time, { color: theme.muted }]}>{formatTime(msg.t)}</Text>
        {msg.me ? <Ticks status={msg.status} theme={theme} /> : null}
      </View>
      {msg.reaction ? <View style={[
        styles.reaction, { backgroundColor: theme.panel, borderColor: theme.line },
      ]}><Text style={{ fontSize: 13 }}>{msg.reaction}</Text></View> : null}
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 10, marginVertical: 2 },
  rowMe: { justifyContent: 'flex-end' },
  rowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 10, paddingTop: 7, paddingBottom: 5 },
  text: { fontSize: 16, lineHeight: 22 },
  meta: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 3, marginTop: 1 },
  time: { fontSize: 11 },
  reaction: { position: 'absolute', bottom: -12, right: 8, borderWidth: 1, borderRadius: 11, paddingHorizontal: 5, paddingVertical: 1 },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 190 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  photo: { width: 230, height: 230, borderRadius: 10, backgroundColor: '#EEEEEE' },
  photoPlaceholder: { width: 230, height: 150, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
