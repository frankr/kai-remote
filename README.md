# kai-remote

Mobile-friendly web dashboard for sending terminal commands remotely + voice chat with Kai.

## Features

- 📱 Mobile-first responsive design
- 🔐 PIN authentication
- ⚡ Quick-action buttons for common commands
- 🎯 Custom command input
- 🔧 Config-driven (easy to add more buttons)
- 🎤 **NEW: Push-to-talk voice chat with Kai**
  - Voice recording with Web Audio API
  - Whisper API transcription
  - OpenClaw session integration (syncs with Telegram DM)
  - Text-to-speech responses

## Setup

```bash
npm install

# Copy environment template and configure
cp .env.example .env
# Edit .env and add your API keys

npm run dev
```

### Environment Variables

- `OPENAI_API_KEY` - Required for voice transcription (Whisper API)
- `ELEVENLABS_API_KEY` - Optional for TTS (will use local `sag` CLI if available)
- `OPENCLAW_GATEWAY_URL` - OpenClaw gateway URL (default: http://localhost:18789)
- `PORT` - Server port (default: 4004)

## Production

```bash
npm run build
npm start
```

## Configuration

Edit `server/config.json` to:
- Change the PIN (default: `1337`)
- Add/remove quick-action buttons
- Toggle custom command support

## Adding Commands

Add entries to `server/config.json`:

```json
{
  "id": "my-command",
  "label": "My Command",
  "command": "echo hello",
  "icon": "👋",
  "category": "custom"
}
```
