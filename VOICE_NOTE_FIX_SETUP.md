LOVENEST REAL VOICE NOTE FIX

This update replaces the previous placeholder voice-note button (which generated a random duration without recording audio) with actual microphone recording, upload, and playback.

1. Back up your current project and merge these source files into it:
   - src/screens/ChatScreen.js
   - src/useConversation.js
   - src/components/Bubble.js
   - src/voiceStorage.js
   - supabase/migrations/202610280005_real_voice_notes.sql
2. Run the SQL migration in Supabase SQL Editor after your previous migrations.
3. Install/verify the SDK-compatible audio package:
   npx expo install expo-audio expo-file-system
4. Restart Metro:
   npx expo start --clear
5. Test on a physical device (microphone recording is not reliably testable in web preview):
   - Tap the microphone button to start recording.
   - Grant microphone permission when prompted.
   - Tap the stop button to stop and send the recording.
   - On the other account, tap Play to stream the private audio using a short-lived signed URL.

Notes:
- Voice recordings are stored in the private Supabase Storage bucket chat-audio; the database stores voice_secs and voice_path.
- No service-role key is used in the mobile app.
- The migration adds voice_path but does not delete existing old placeholder voice rows. Old rows without voice_path cannot play audio; they will show as unavailable.
- Disconnect cleanup of database message rows does not automatically remove uploaded audio objects from Storage. Add a trusted cleanup function if permanent media-file deletion on disconnect is required.
- I checked the source modifications and ZIP integrity, but cannot test recording, storage permissions, or playback on your live Supabase project/device from this environment.
