LOVENEST COMPLETE PROJECT + CHAT PIN PATCH

1. Extract this ZIP. Open the Lovenest folder containing package.json.
2. Create .env from .env.example and fill in your own Supabase URL and anon/publishable key. Do not share .env or service-role keys.
3. In a terminal in this folder run:
   npm install
   npx expo install expo-secure-store expo-crypto
   npx expo start --clear
4. The PIN patch changes App.js and adds src/screens/ChatPinScreen.js.
5. Configure Supabase email OTP recovery and review RLS_NOTES.sql.

This source bundle excludes node_modules, .git, local Expo cache, platform build output, and your .env secrets. Dependencies are restored with npm install. The PIN patch has not been tested against your live Supabase project or device.

PROFILE PHOTOS: run supabase/migrations/202610280004_profile_photos.sql after the earlier migrations. Photos use a private profile-photos bucket; owner and connected partner can read them.
