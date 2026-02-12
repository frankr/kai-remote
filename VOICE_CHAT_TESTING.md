# Voice Chat Feature - Testing Guide

## Overview
The push-to-talk voice chat feature allows users to record audio, transcribe it using OpenAI Whisper, send it to Kai via OpenClaw gateway, and receive TTS audio responses.

## Architecture

### Flow
1. **User holds voice button** → Records audio via Web Audio API (MediaRecorder)
2. **User releases button** → Audio stops recording, sends to `/api/transcribe`
3. **Backend transcribes** → Sends audio to OpenAI Whisper API
4. **Transcribed text** → Displays in chat, sends to `/api/chat`
5. **OpenClaw integration** → Sends message to Kai's session (agent:main:main)
6. **Kai responds** → Response text sent back to client
7. **TTS generation** → Converts response to audio using sag or ElevenLabs
8. **Audio playback** → Client plays TTS audio automatically

## Testing Steps

### 1. Access the App
- **Desktop:** http://localhost:4004 or http://100.67.197.44:4004
- **Mobile:** http://100.67.197.44:4004 (Tailscale)

### 2. Login
- Default PIN: `1337` (configured in `server/config.json`)

### 3. Navigate to Chat
- Click the "💬 Chat" button in the header

### 4. Test Voice Recording
- **Hold the microphone button** to start recording
- You should see:
  - Button turns red with pulsing animation
  - Recording duration counter
  - "Recording..." text
- **Release the button** to stop recording
- Minimum recording length: 0.5 seconds

### 5. Expected Behavior
After releasing:
1. Message shows "Transcribing..." while processing
2. Transcribed text appears in chat (your message)
3. "Processing..." indicator appears
4. Kai's response appears in chat
5. If TTS is available, audio auto-plays
6. "Playing..." indicator shows during playback

### 6. Test TTS Playback
- Each of Kai's responses should have a "▶️ Play" button
- Click to replay audio
- Button shows "🔊" while playing

## Testing Transcription API Directly

```bash
# Record a test audio file (use your browser's recording or any audio file)
# Then test the transcription endpoint:

curl -X POST http://localhost:4004/api/transcribe \
  -H "X-Auth-Pin: 1337" \
  -F "audio=@test-audio.webm"

# Expected response:
# {"text":"your transcribed text here"}
```

## Testing Chat API Directly

```bash
curl -X POST http://localhost:4004/api/chat \
  -H "X-Auth-Pin: 1337" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello Kai, this is a test"}' \
  | jq

# Expected response:
# {
#   "response": "...",
#   "audioUrl": "/api/audio/tts-1234567890.mp3"
# }
```

## Environment Setup

### Required
- `OPENAI_API_KEY` - For Whisper transcription
- Already configured in `.env`

### Optional (for TTS)
- `sag` CLI installed (ElevenLabs TTS wrapper) - **Preferred**
- `ELEVENLABS_API_KEY` in `.env` - Fallback if sag not available

### Check sag availability
```bash
which sag
# Should return: /opt/homebrew/bin/sag (or similar)

# Test sag
sag "Hello, this is a test" --output /tmp/test-tts.mp3
```

## Common Issues

### Transcription Fails
- Check `OPENAI_API_KEY` is set correctly in `.env`
- Check server logs: `pm2 logs kai-remote`
- Verify API key has Whisper API access

### TTS Not Working
- Check if `sag` is installed: `which sag`
- If not installed, set `ELEVENLABS_API_KEY` in `.env`
- TTS is optional - chat still works without audio responses

### Microphone Permission
- Browser will prompt for microphone access on first use
- Grant permission when prompted
- Check browser settings if blocked

### Audio Not Playing
- Check browser console for errors
- Verify audio file URL is accessible: `/api/audio/<filename>`
- Some mobile browsers require user interaction before playing audio

## OpenClaw Integration (TODO)

Currently using mock responses for testing. To complete integration:

1. **Understand OpenClaw gateway API**
   - Check documentation for proper session messaging API
   - Current endpoint `/api/sessions/send` may not be correct

2. **Alternative: Use OpenClaw CLI**
   - Already attempted in code
   - Need to find proper CLI command for sending messages

3. **Test with Real Session**
   - Verify messages appear in Telegram DM (agent:main:main session)
   - Ensure responses come back properly

## Mobile Testing Checklist

- [ ] Button is large enough to hold comfortably
- [ ] Visual feedback is clear (color change, pulse animation)
- [ ] Recording stops reliably on release
- [ ] Works in both portrait and landscape
- [ ] No layout issues on small screens
- [ ] Audio playback works on iOS/Android
- [ ] Microphone permissions handled gracefully

## Performance Notes

- Audio recordings are compressed (webm/opus codec, 32kbps)
- Typical voice message: 10 seconds = ~40KB
- Whisper transcription: ~1-2 seconds
- TTS generation (sag): ~2-4 seconds
- Total round-trip: ~3-6 seconds

## Next Steps

1. Complete OpenClaw gateway integration
2. Add message history sync with Telegram DM
3. Add voice message playback (play recorded audio before transcription)
4. Add speaker identification icons
5. Improve error handling and user feedback
6. Add retry logic for failed requests
7. Add offline message queue
