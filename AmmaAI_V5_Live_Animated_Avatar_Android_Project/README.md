# Amma AI V5 — Live Tamil Voice (Android development project)

This project contains:
- `mobile/`: Expo React Native Android app with a live-call screen, your provided photo, microphone capture using `react-native-webrtc`, remote audio playback through WebRTC, status and transcript event display.
- `server/`: Express backend that creates OpenAI Realtime WebRTC sessions. Your standard API key stays on the server, never in the APK.

## Important: this is a development starter, not a signed APK
The code is prepared for a real Realtime connection, but it has not been run against your OpenAI API account or tested on your Android phone. A valid API key, API billing/credits, a deployed HTTPS server, and an Android development build are required.

## 1. Configure the server
1. Install Node.js 20+.
2. In `server/`, run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put your OpenAI API key in `.env` as `OPENAI_API_KEY=...`.
5. Run `npm start`.
6. Deploy this server to a host with HTTPS. Do not expose a production server without authentication/rate limiting.

## 2. Configure the Android app
1. In `mobile/App.js`, replace `https://YOUR_SERVER_HOST` in `API_BASE_URL` with your deployed HTTPS backend URL.
2. In `mobile/`, run `npm install`.
3. Run `npx expo prebuild --platform android`.
4. Build a development APK with EAS Build or Android Studio. `react-native-webrtc` requires a native development build; Expo Go is not sufficient.
5. Install the development build, grant microphone permission, and tap **Live Conversation தொடங்கு**.

## 3. What V4 does
- Requests microphone permission.
- Establishes a WebRTC peer connection to the OpenAI Realtime API through your backend.
- Uses server-side session instructions for loving, natural Chennai Tamil.
- Sends and receives live audio with voice activity detection and interruption support.
- Displays available speech transcript events in the UI.

## 4. Current limitations
- The mother's photo is displayed as a still portrait. Live audio does not automatically animate her mouth. Lip-sync avatar video is a separate V5 integration.
- The selected model/voice availability and Tamil quality depend on the API account and current model capabilities. Test Tamil speech before release.
- Transcripts are shown only when the Realtime session emits the relevant transcript events; audio conversation itself is the core feature.
- The app does not clone your mother's voice. It uses an AI-generated voice.
- Add authentication, per-user rate limits, abuse prevention, privacy policy, deletion controls, and secure logging before public release.

## 5. Troubleshooting
- `Network request failed`: check server HTTPS URL and that `/health` responds.
- `401/403`: check API key, project permissions, and billing.
- Microphone silent: grant Android microphone permission and check audio routing.
- Expo Go cannot load WebRTC: create and install a native development build.


## V5 animated-avatar prototype notes

V5 retains the V4 live WebRTC voice conversation and adds a gentle on-screen avatar scale pulse plus a speaking/listening waveform indicator. These are visual UI cues only. They do **not** animate the photographed mouth, create facial expressions, or provide true audio-synchronized lip-sync. A separate real-time portrait-animation/avatar service or model is required for that capability; no such provider is configured in this starter.

The supplied mother portrait remains a local image asset. The voice is AI-generated and is not a clone or recording of the mother's voice. This is source code, not an APK, and it has not been built or tested on the user's device. An Expo development build is required because react-native-webrtc uses native modules.
