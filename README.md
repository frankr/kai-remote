# kai-remote

Mobile-friendly web dashboard for sending terminal commands remotely.

## Features

- 📱 Mobile-first responsive design
- 🔐 PIN authentication
- ⚡ Quick-action buttons for common commands
- 🎯 Custom command input
- 🔧 Config-driven (easy to add more buttons)

## Setup

```bash
npm install
npm run dev
```

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
