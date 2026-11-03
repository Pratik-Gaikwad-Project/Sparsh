# Lovenest push notifications for new chat messages

This adds device push notifications for incoming chat messages. It preserves the existing Expo app identity and Supabase chat. Notification text deliberately does **not** show the message body on a lock screen.

## 1. Install SDK-compatible Expo packages

From the `Lovenest` project folder run:

```powershell
npx expo install expo-notifications expo-device expo-constants
```

This selects versions compatible with the Expo SDK in this project and updates `package.json` / `package-lock.json`.

## 2. Apply the SQL migration

In Supabase Dashboard → SQL Editor, run:

`supabase/migrations/202610280003_message_push_notifications.sql`

It creates `public.push_tokens` with RLS so authenticated users can only manage their own device tokens.

## 3. Deploy the Edge Function

Install/update Supabase CLI, sign in, and link the existing project:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
npx supabase secrets set MESSAGE_PUSH_WEBHOOK_SECRET="REPLACE_WITH_A_LONG_RANDOM_SECRET"
npx supabase functions deploy push-message-notification --no-verify-jwt
```

Use the same secret in the database webhook header in the next step. Do not put the service-role key or webhook secret in the Expo app or `.env` file. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions.

## 4. Configure the database webhook

In Supabase Dashboard → Database → Webhooks, create a webhook:

- Name: `lovenest-message-push`
- Table: `public.messages`
- Events: **INSERT only**
- Type: HTTP Request
- Method: `POST`
- URL: `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/push-message-notification`
- Header: `x-webhook-secret: REPLACE_WITH_THE_SAME_LONG_RANDOM_SECRET`
- Header: `Content-Type: application/json`

Use the actual project ref and same secret as step 3. Keep the secret private. The function checks that the sender and receiver still have each other set as accepted partners before sending a push.

## 5. Configure Expo push credentials and build

Push notifications need a real physical device and platform push credentials. Configure credentials for Android/iOS using the current Expo EAS notification setup for this project, then create a new development/preview build. Expo Go or a web browser may not represent production push behavior for this SDK. Android package ID and EAS project ID remain unchanged.

```powershell
npx expo install expo-notifications expo-device expo-constants
npx expo start --clear
```

For a distributable Android app, create a new EAS build using your existing profiles after configuring credentials.

## 6. Test with two accounts

1. Install the new build on two physical devices (or use two device installs where possible).
2. Sign in on each device and allow notifications.
3. Accept the connection request so `profiles.partner_id` is mutual on both profiles.
4. Send a text, voice, and photo message from device A to B. Device B should receive a push notification; the lock-screen text says only that a message/photo/voice message arrived.
5. Disconnect the pair and send a message test; the function should refuse to notify because they are no longer connected and message sending should already be blocked by existing policies.
6. Deny notifications and confirm chat still works.

## Operational notes

- This implementation uses a Supabase Database Webhook → Edge Function → Expo Push API flow. It works when the app is backgrounded or closed, subject to OS settings, network, Expo push service, and valid platform credentials.
- Foreground banners are enabled in the app notification handler.
- The notification payload intentionally omits message text and media URLs for privacy.
- Expo push receipts and invalid-token pruning are not yet automated; production deployments should periodically process receipts and remove `DeviceNotRegistered` tokens.
- I can inspect and package the source here, but cannot verify delivery against your live Supabase project or physical devices from this environment.
