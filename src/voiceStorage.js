
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

const BUCKET = 'chat-audio';
const URL_EXPIRY_SECONDS = 300;

function base64ToBytes(base64) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    if (char === '=') break;

    const value = alphabet.indexOf(char);
    if (value < 0) continue;

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }

  return new Uint8Array(bytes);
}

export async function uploadChatVoice(uri, userId) {
  if (!uri || !userId) {
    throw new Error('Voice recording or user ID is missing.');
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) {
    throw new Error('The voice recording is empty.');
  }

  const bytes = base64ToBytes(base64);

  if (!bytes.length) {
    throw new Error('Could not read the voice recording.');
  }

  const path =
    `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.m4a`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: 'audio/mp4',
      upsert: false,
    });

  if (error) {
    throw new Error(`Voice upload failed: ${error.message}`);
  }

  return data.path;
}

export async function getSignedVoiceUrl(path) {
  if (typeof path !== 'string' || !path.trim()) {
    throw new Error('Voice file path is missing.');
  }

  const cleanPath = path.trim().replace(/^\/+/, '');

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`Session error: ${sessionError.message}`);
  }

  if (!session?.user) {
    throw new Error('Please sign in to play voice messages.');
  }

  const { data, error } = await supabase.storage
    .from('chat-audio')
    .createSignedUrl(cleanPath, 300);

  if (error) {
    console.error('Signed voice URL failed:', {
      message: error.message,
      statusCode: error.statusCode,
      path: cleanPath,
    });

    throw new Error(
      error.statusCode === '404'
        ? 'Voice file not found or access denied. Please try again.'
        : `Could not access voice file: ${error.message}`
    );
  }

  if (!data?.signedUrl) {
    throw new Error('Supabase did not return a voice playback URL.');
  }

  return data.signedUrl;
}
