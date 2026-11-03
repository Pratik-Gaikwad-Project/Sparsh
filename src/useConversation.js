import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';
import { uploadChatPhoto } from './photoStorage';
import { uploadChatVoice } from './voiceStorage';

const toMsg = (row, meId) => ({
  id: row.id,
  me: row.sender_id === meId,
  text: row.body ?? undefined,
  voice: row.voice_secs ?? undefined,
  voicePath: row.voice_path ?? undefined,
  imagePath: row.image_path ?? undefined,
  t: Date.parse(row.created_at),
  status: row.status,
  reaction: row.reaction ?? undefined,
});

const byTime = (a, b) => a.t - b.t;

export function useConversation(me, partner) {
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  const merge = useCallback((msg) => {
    setMsgs((prev) => {
      const i = prev.findIndex((m) => m.id === msg.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...prev[i], ...msg };
        return copy;
      }
      return [...prev, msg].sort(byTime);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const markRead = () =>
      supabase.from('messages').update({ status: 'read' })
        .eq('receiver_id', me.id)
        .eq('sender_id', partner.id)
        .neq('status', 'read')
        .then(() => { });

    const load = async () => {
      const pair =
        `and(sender_id.eq.${me.id},receiver_id.eq.${partner.id}),` +
        `and(sender_id.eq.${partner.id},receiver_id.eq.${me.id})`;
      const { data, error: err } = await supabase.from('messages')
        .select('*').or(pair)
        .order('created_at', { ascending: false }).limit(200);

      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      setMsgs((data || []).map((r) => toMsg(r, me.id)).reverse());
      markRead();
    };

    const isOurs = (row) =>
      (row.sender_id === me.id && row.receiver_id === partner.id) ||
      (row.sender_id === partner.id && row.receiver_id === me.id);

    const channel = supabase.channel(`chat-${[me.id, partner.id].sort().join('-')}`, {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        if (!isOurs(p.new)) return;
        merge(toMsg(p.new, me.id));
        if (p.new.sender_id === partner.id) markRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        if (isOurs(p.new)) merge(toMsg(p.new, me.id));
      })
      .on('broadcast', { event: 'typing' }, () => {
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3000);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnline((state[partner.id] || []).length > 0);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ at: Date.now() });
      });

    channelRef.current = channel;
    load();
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });

    return () => {
      cancelled = true;
      appState.remove();
      clearTimeout(typingTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [me.id, partner.id, merge]);

  const send = useCallback(async ({ text, voice, voiceUri, imageUri }) => {
    setError(null);
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMsgs((p) => [...p, {
      id: tmpId, me: true, text, voice, voicePath: undefined, imagePath: undefined,
      t: Date.now(), status: 'sending',
    }]);

    try {
      const imagePath = imageUri ? await uploadChatPhoto(imageUri, me.id) : null;
      const voicePath = voiceUri ? await uploadChatVoice(voiceUri, me.id) : null;
      const { data, error: err } = await supabase.from('messages').insert({
        sender_id: me.id,
        receiver_id: partner.id,
        body: text ?? null,
        voice_secs: voice ?? null,
        voice_path: voicePath,
        image_path: imagePath,
      }).select().single();

      if (err) throw err;
      const real = toMsg(data, me.id);
      setMsgs((p) => {
        const rest = p.filter((m) => m.id !== tmpId);
        if (rest.some((m) => m.id === real.id)) return rest;
        return [...rest, real].sort(byTime);
      });
    } catch (err) {
      setMsgs((p) => p.map((m) => m.id === tmpId ? { ...m, status: 'failed' } : m));
      setError(err?.message || 'Could not send the message.');
    }
  }, [me.id, partner.id]);

  const react = useCallback(async (id) => {
    if (String(id).startsWith('tmp-')) return;
    let next = null;
    setMsgs((p) => p.map((m) => {
      if (m.id !== id) return m;
      next = m.reaction ? null : '❤️';
      return { ...m, reaction: next ?? undefined };
    }));
    const { error: err } = await supabase.from('messages').update({ reaction: next }).eq('id', id);
    if (err) {
      setError(err.message);
      setMsgs((p) => p.map((m) => m.id === id
        ? { ...m, reaction: next ? undefined : '❤️' } : m));
    }
  }, []);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000 || !channelRef.current) return;
    lastTypingSent.current = now;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: {} });
  }, []);

  return { msgs, typing, online, error, send, react, notifyTyping };
}
