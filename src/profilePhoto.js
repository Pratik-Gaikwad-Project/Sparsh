
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

const BUCKET = 'chat-photos';

function decodeBase64(base64) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;

  for (const ch of clean) {
    if (ch === '=') break;

    const value = alphabet.indexOf(ch);
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

export async function chooseAndUploadProfilePhoto(userId) {
  if (!userId) {
    throw new Error('You must be signed in to upload a profile photo.');
  }

  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      'Allow photo library access to choose a profile photo.'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.82,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];

  if (!asset?.uri) {
    throw new Error('No photo was selected.');
  }

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const bytes = decodeBase64(base64 || '');

  if (!bytes.length) {
    throw new Error('Could not read the selected photo.');
  }

  const path =
    `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId);

  if (profileError) {
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (removeError) {
      console.warn('Could not remove unused uploaded photo:', removeError);
    }

    throw new Error(
      `Could not save your profile photo: ${profileError.message}`
    );
  }

  return path;
}

export async function signedProfilePhoto(path) {
  if (!path || typeof path !== 'string') {
    console.warn('Profile photo path is missing.');
    return null;
  }

  // Preserve the stored object path; remove only leading slashes.
  const cleanPath = path.trim().replace(/^\/+/, '');

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(cleanPath, 3600);

  if (error) {
    console.error('Profile photo signed URL failed:', {
      message: error.message,
      statusCode: error.statusCode,
      path: cleanPath,
      bucket: BUCKET,
    });

    throw new Error(`Could not load profile photo: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error('Supabase returned no profile photo URL.');
  }

  return data.signedUrl;
}

export async function editProfilePhoto(userId, onSaved) {
  try {
    const path = await chooseAndUploadProfilePhoto(userId);

    if (path) {
      await onSaved?.(path);
    }
  } catch (error) {
    Alert.alert(
      'Profile photo',
      error?.message || 'Could not update your profile photo.'
    );
  }
}
