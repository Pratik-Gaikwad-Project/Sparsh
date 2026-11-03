# Lovenest: a private chat app for couples (React Native + Expo + Supabase)

A WhatsApp-style messenger with its own branding, built for two people.
Runs on Android and iPhone. Messages are stored in a Supabase Postgres database
and sync live between both phones.

## 1. Create the database (5 minutes, free tier is enough)

1. Go to supabase.com, create an account and a new project.
2. Open **SQL Editor**, paste the whole file `supabase/schema.sql`, and press **Run**.
   This creates the tables, the security rules and the live-update setup.
3. Open **Authentication > Providers > Email**. For easy testing, turn **off**
   "Confirm email". (If you leave it on, each of you must click the link in the
   confirmation email before the first sign in.)
4. Open **Project Settings > API** and copy the **Project URL** and the **anon public** key.

## 2. Run the app on your phone

1. Install Node.js from nodejs.org.
2. Create a fresh Expo project (this keeps the Expo version matched to Expo Go):

       npx create-expo-app@latest lovenest --template blank
       cd lovenest

3. Copy `App.js`, the `src` folder, `.env.example` and the `supabase` folder from this zip
   into the `lovenest` folder. Replace the existing `App.js` when asked.
4. Install the three database packages:

       npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill

5. Copy `.env.example` to `.env` and paste in your URL and anon key.
6. Start the app:

       npx expo start -c

7. Install **Expo Go** on both phones (Play Store or App Store) and scan the QR code.
   Phone and laptop must be on the same Wi-Fi.

## 3. Use it together

1. Each of you creates an account (name, email, password). The "together since" date
   is optional, format `2024-02-14`.
2. One of you shares the 6-letter invite code shown on the connect screen.
   The other types it in and taps **Connect**.
3. Both phones open the same private chat. Messages appear instantly.

## What is in it

- Email sign in, with the session kept on the phone
- Partner pairing by invite code (only two accounts can ever be linked)
- Messages saved in Postgres, with sent and read ticks
- Live delivery, "typing…" and online status through Supabase Realtime
- Double tap a message to add a heart, saved for both of you
- Emoji tray, quick love-note chips, voice-note bubbles (tap the mic when the box is empty;
  these are placeholders and do not record audio yet)
- "Day N together" banner
- Automatic light and dark mode

## How your privacy is protected

Every table has row level security. The database itself only lets you read messages you
sent or received, only lets you send to your paired partner, and only lets you change the
read tick and heart on a message, never its text. The anon key in `.env` is meant to be
public; never put the `service_role` key in the app.

## Not built yet

- Photo, camera and real voice recording (needs Supabase Storage and Expo's media modules)
- Push notifications when the app is closed (needs Expo Notifications and a small server function)
- Unpairing, password reset screen and message deletion
- Messages are not end-to-end encrypted. They are protected by login and database rules,
  and Supabase staff with project access could technically read them.


## Profile photos
Run `supabase/migrations/202610280004_profile_photos.sql` after the earlier migrations. Users can choose a square profile photo from the device gallery using the camera button in chat or the profile-photo control on the unconnected screen. Photos are stored in the private `profile-photos` bucket; only the owner and currently connected partner can read them.
