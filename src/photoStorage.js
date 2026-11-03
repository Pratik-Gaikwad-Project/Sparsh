
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

const BUCKET = 'chat-photos';
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

export async function uploadChatPhoto(uri, userId) {
  if (!uri || !userId) {
    throw new Error('Photo URI or user ID is missing.');
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) {
    throw new Error('The selected photo file is empty.');
  }

  const bytes = base64ToBytes(base64);

  if (!bytes.length) {
    throw new Error('Could not decode the selected photo.');
  }

  const filePath =
    `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase photo upload failed: ${error.message}`);
  }

  return data.path;
}

export async function getSignedPhotoUrl(imagePath) {
  if (!imagePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(imagePath, URL_EXPIRY_SECONDS);

  if (error) throw error;

  return data.signedUrl;
}
