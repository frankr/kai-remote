# TTS Setup for Voice Chat

## Current Status
- `sag` CLI is installed at `/opt/homebrew/bin/sag`
- ElevenLabs API key is configured but may need refresh/verification
- Backend has fallback to ElevenLabs API if sag fails

## Option 1: Using sag CLI (Preferred)

### Setup
```bash
# Install sag (if not installed)
brew install tobi/tap/sag

# Test with specific voice
sag "Hello, this is a test" --voice "Rachel" --output /tmp/test.mp3

# Or use macOS built-in say as fallback
say "Hello, this is a test" -o /tmp/test.aiff
```

### Usage in kai-remote
The backend automatically tries sag first:
```javascript
exec(`sag '${text}' --output "${tempFile}"`)
```

## Option 2: ElevenLabs API (Fallback)

### Verify API Key
```bash
# Test the API key
curl -X GET https://api.elevenlabs.io/v1/voices \
  -H "xi-api-key: $ELEVENLABS_API_KEY"

# Should return list of available voices
```

### Get New API Key (if needed)
1. Go to https://elevenlabs.io/
2. Sign in with Frank's account
3. Go to Profile → API Keys
4. Create new key or copy existing
5. Update `.env` file:
   ```
   ELEVENLABS_API_KEY=your_new_key_here
   ```

## Option 3: macOS say (Simplest)

If both sag and ElevenLabs fail, use macOS built-in TTS:

### Update server code to add macOS say fallback:
```javascript
// In generateTTS function, add this as final fallback:
exec(`say "${escapedText}" -o "${tempFile}.aiff" && ffmpeg -i "${tempFile}.aiff" "${tempFile}" && rm "${tempFile}.aiff"`, ...)
```

### Note: Requires ffmpeg
```bash
brew install ffmpeg
```

## Testing TTS

### Test sag
```bash
sag "This is a test message" --voice "Rachel" --output /tmp/test-sag.mp3
afplay /tmp/test-sag.mp3
```

### Test ElevenLabs API
```bash
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from ElevenLabs","model_id":"eleven_monolingual_v1"}' \
  --output /tmp/test-elevenlabs.mp3
afplay /tmp/test-elevenlabs.mp3
```

### Test macOS say
```bash
say "This is a test message" -o /tmp/test-say.aiff
afplay /tmp/test-say.aiff
```

## Recommended Solution

For fastest setup with best quality:
1. Use **sag with a default voice** specified in .env
2. Add to `.env`:
   ```
   ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Rachel voice
   ```
3. Update sag command in server.js:
   ```javascript
   const sagCmd = `sag '${escapedText}' --voice-id ${process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'} --output "${tempFile}"`;
   ```

## Voice IDs (ElevenLabs)

Common voices:
- Rachel: `21m00Tcm4TlvDq8ikWAM`
- Domi: `AZnzlk1XvdvUeBnXmlld`
- Bella: `EXAVITQu4vr4xnSDxMaL`
- Antoni: `ErXwobaYiN019PkySvjV`
- Elli: `MF3mGyEYCl7XYWbV9V6O`

List all voices:
```bash
sag --voice '?'
```
