
import { supabase } from './supabase';
import { signedProfilePhoto } from './profilePhoto';

// ===============================
// SIGN UP
// ===============================
export async function signUp({
  name,
  email,
  password,
  togetherSince,
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'sparsh://',
      data: {
        name,
        together_since: togetherSince || '',
      },
    },
  });

  if (error) throw error;

  return {
    needsConfirm: !data.session,
  };
}

// ===============================
// SIGN IN
// ===============================
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
}

// ===============================
// SIGN OUT
// ===============================
export const signOut = () => supabase.auth.signOut();

// ===============================
// LOAD USER PROFILE
// ===============================
export async function loadMe(userId) {
  const { data: me, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;

  me.avatar_url = await signedProfilePhoto(me.avatar_path);

  let partner = null;

  if (me.partner_id) {
    const { data, error: partnerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', me.partner_id)
      .single();

    if (!partnerError && data) {
      partner = data;

      partner.avatar_url = await signedProfilePhoto(
        partner.avatar_path
      );
    }
  }

  return {
    me,
    partner,
  };
}

// ===============================
// DISCONNECT PARTNER
// ===============================
export async function disconnectPartner() {
  const { error } = await supabase.rpc('disconnect_partner');

  if (error) throw error;
}

// ===============================
// SEND CONNECTION REQUEST
// ===============================
export async function sendConnectionRequest(code) {
  if (!code?.trim()) {
    throw new Error('Please enter a connection code.');
  }

  const { data, error } = await supabase.rpc(
    'send_connection_request',
    {
      code: code.trim().toUpperCase(),
    }
  );

  if (error) throw error;

  return data;
}

// ===============================
// LIST CONNECTION REQUESTS
// ===============================
export async function listConnectionRequests() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!user) {
    throw new Error('Please sign in to view connection requests.');
  }

  const { data, error } = await supabase.rpc(
    'list_connection_requests'
  );

  if (error) {
    console.error('Connection request RPC failed:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

// ===============================
// ACCEPT CONNECTION REQUEST
// ===============================
export async function acceptConnectionRequest(requestId) {
  const { error } = await supabase.rpc(
    'accept_connection_request',
    {
      request_id: requestId,
    }
  );

  if (error) throw error;
}

// ===============================
// REJECT CONNECTION REQUEST
// ===============================
export async function rejectConnectionRequest(requestId) {
  const { error } = await supabase.rpc(
    'reject_connection_request',
    {
      request_id: requestId,
    }
  );

  if (error) throw error;
}

// ===============================
// CANCEL CONNECTION REQUEST
// ===============================
export async function cancelConnectionRequest(requestId) {
  const { error } = await supabase.rpc(
    'cancel_connection_request',
    {
      request_id: requestId,
    }
  );

  if (error) throw error;
}
