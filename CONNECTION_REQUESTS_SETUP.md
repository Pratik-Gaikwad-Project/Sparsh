# Lovenest Connection Requests — setup and verification

This patch updates the existing Expo app; it does not replace authentication, chat, the profile table, Android application ID, or EAS project ID.

## 1. Apply the database migration

1. Open the existing Supabase project used by this app.
2. In **SQL Editor**, create a new query and paste the complete contents of `supabase/migrations/202610280001_connection_requests.sql`.
3. Run it and verify that it completes without errors.
4. Do not put a Supabase service-role key in the Expo `.env` file. The app uses only the project URL and anon/publishable key; authorization is enforced in PostgreSQL.

The migration reuses `profiles.id`, `profiles.name`, `profiles.hue`, `profiles.invite_code`, and `profiles.partner_id`. The existing schema has no profile-photo field, so request rows show the existing name and avatar hue rather than inventing a photo URL. It creates `connection_requests`, RLS, indexes, and RPC functions. Direct writes to the request table are revoked; send/accept/reject/cancel happen through authenticated database functions. It also revokes authenticated execution of the old immediate-pairing `pair_with_code(text)` function so the old client flow cannot bypass consent.

**Important:** apply this migration before installing the updated app. Old app builds that still call `pair_with_code` will no longer be able to pair users, by design. If you need a staged rollout with old clients, coordinate the release; do not re-grant the old function to clients.

## 2. Install the updated source

1. Extract this ZIP.
2. Copy the `Lovenest` folder over a backup of the existing project, or compare the changed files before replacing them.
3. Keep your existing `.env` values. Required variables remain `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. In the project directory run:

```powershell
npm install
npx expo start --clear
```

The Android package remains `com.pratik_10122006.lovenest` and the EAS project ID remains `e1ab536b-57a2-457a-afaf-3e14e5bc1247`.

## 3. Behavior

- Entering a code creates only a pending request; it does not pair users.
- Incoming requests appear under **Connection Requests**, with Accept and Reject actions.
- The recipient's accept RPC locks the request and both profiles and updates request status plus both `partner_id` values in one transaction.
- Reject and cancel do not create a connection. Only the sender can cancel their own pending request; only the recipient can accept or reject it.
- Outgoing request status is shown in the Pair screen and Connection Requests screen.
- Realtime table-change subscriptions refresh the screen, and a low-frequency refresh is also used on the Pair screen as a fallback.
- Existing chat remains gated by `profiles.partner_id` and existing message RLS policies.

## 4. Manual test checklist

Use two test accounts, A and B, in the same Supabase project. Run tests against a development project first.

- [ ] A enters a nonexistent code: an invalid-code error is shown; no request/connection is created.
- [ ] A enters A's own code: self-request is rejected.
- [ ] A sends B's code: one pending row is created; A sees Pending; B sees an incoming request.
- [ ] A sends B's code again: duplicate pending request is rejected and there is still one pending row.
- [ ] B rejects: status becomes `rejected`, and neither profile's `partner_id` changes.
- [ ] A sends a new request after rejection: it can be sent again because the previous request is no longer pending.
- [ ] B accepts: status becomes `accepted`, both profiles' `partner_id` values point to each other, and both clients can open their existing chat.
- [ ] A tries to accept or reject a request addressed to B: the RPC rejects it.
- [ ] A tries to cancel B's incoming request: the RPC rejects it.
- [ ] A cancels A's own pending outgoing request: status becomes `cancelled` and B cannot accept it.
- [ ] Attempt a direct client insert/update to `connection_requests`: permission denied.
- [ ] Try to call `pair_with_code` as authenticated: permission denied.
- [ ] Disconnect and reconnect the test clients or temporarily disable network to confirm errors are shown and retry works.
- [ ] Confirm a pending request updates on the other device via Realtime; if Realtime is not configured for the table, the screen refresh action still works.

## 5. Security and rollout notes

- The list RPC returns only existing profile name/hue and request metadata for rows involving the signed-in user.
- No service-role secret is used in client code.
- `connection_requests` permits participant-only reads under RLS and no direct client writes. State changes go through `SECURITY DEFINER` functions that validate `auth.uid()`.
- Database integration tests have not been run as part of preparing this source package because it is not connected to your Supabase database. Complete the checklist above in a development project before production release.

## 6. Delete chat history when disconnecting

After applying the connection-request migration, run `supabase/migrations/202610280002_delete_messages_on_disconnect.sql` in Supabase SQL Editor. This replaces the `disconnect_partner()` RPC used by the existing Disconnect button. The function verifies the authenticated user is one of the connected partners, locks both profiles, permanently deletes all `public.messages` rows between the pair, clears both `partner_id` values, and closes any pending requests involving either account in one transaction. The app's confirmation dialog warns users that message history deletion is permanent.

This deletes message database rows (including photo-message records), not necessarily the underlying binary objects in the Supabase Storage `chat-photos` bucket. If your app stores uploaded photos there, those objects require a separate trusted cleanup job/function with appropriate Storage permissions; do not expose a service-role key in the mobile app. Verify the bucket's retention and deletion policy before production rollout.

Additional manual tests:
- [ ] Send text, voice, and photo messages between A and B; disconnect from A; verify no message rows remain for either direction and both profiles have `partner_id IS NULL`.
- [ ] Verify B's chat refresh no longer displays the old messages after disconnect.
- [ ] Attempt `disconnect_partner()` while signed out and as an account not connected to the target: it must fail without deleting messages.
- [ ] Confirm the app displays the permanent-deletion warning before proceeding.
