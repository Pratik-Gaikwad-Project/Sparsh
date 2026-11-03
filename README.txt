LOVENEST CHAT PIN SECURITY PATCH

Files:
- App.js (replace existing root App.js)
- src/screens/ChatPinScreen.js (new file)

Dependencies:
Run from the inner project folder (the folder containing package.json):
  npx expo install expo-secure-store expo-crypto

Then restart:
  npx expo start --clear

Behavior:
- New PIN required after Supabase login if no PIN exists for this user/device.
- PIN length: 4 to 6 digits.
- PIN verifier is stored in SecureStore with a random salt; raw PIN is not stored.
- Five failed attempts cause a 60-second lockout, persisted in SecureStore.
- App starts locked and locks again when app state leaves active.
- Forgot PIN requests a Supabase email OTP, verifies it, then allows PIN reset.

Important limitations:
- This is a device-local app lock, not a substitute for Supabase RLS.
- SecureStore data can be removed if the app is uninstalled/reinstalled or device data is cleared.
- Configure Supabase Auth email OTP templates/settings so signInWithOtp sends a 6-digit email code. Supabase may send a magic link depending on project settings.
- Review Supabase RLS policies separately. Do not add broad policies that allow any authenticated user to read messages.
- No SQL schema changes are needed for a device-local PIN. The existing profiles/messages schema does not need a PIN column.
- This patch does not modify AuthScreen.js, PairScreen.js, api.js, or useConversation.js.

PROFILE PHOTOS: run supabase/migrations/202610280004_profile_photos.sql after the earlier migrations. Photos use a private profile-photos bucket; owner and connected partner can read them.
