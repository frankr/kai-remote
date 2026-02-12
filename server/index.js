import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const app = express();
const PORT = process.env.PORT || 4004;

// Load config
const config = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf-8'));

// Security: IP filtering - only allow local network and Tailscale
function isAllowedIP(req) {
  const ip = req.socket?.remoteAddress || req.ip || '';
  const forwarded = req.headers['x-forwarded-for'] || '';
  const checkIP = forwarded.split(',')[0].trim() || ip;
  const cleanIP = checkIP.replace(/^::ffff:/, '');
  
  const allowed = [
    /^127\.0\.0\.1$/,
    /^::1$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/,
    /^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,  // Tailscale
  ];
  
  return allowed.some(pattern => pattern.test(cleanIP));
}

// Apply IP filter to all requests
app.use((req, res, next) => {
  if (!isAllowedIP(req)) {
    console.log(`[Security] Blocked request from: ${req.ip}`);
    return res.status(403).send('Forbidden');
  }
  next();
});

app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
  dest: '/tmp/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Environment variables for API keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';

// Simple PIN auth middleware
const authMiddleware = (req, res, next) => {
  const pin = req.headers['x-auth-pin'];
  if (pin !== config.pin) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }
  next();
};

// Get available commands
app.get('/api/commands', authMiddleware, (req, res) => {
  res.json(config.commands);
});

// Execute a command
app.post('/api/exec', authMiddleware, (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }

  // Security: Check if command is in allowlist OR is a custom command
  const isAllowed = config.commands.some(c => c.command === command) || 
                    config.allowCustomCommands;

  if (!isAllowed) {
    return res.status(403).json({ error: 'Command not allowed' });
  }

  // Set up environment to include common paths
  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`,
  };

  exec(command, { 
    env,
    shell: '/bin/zsh',
    timeout: 30000,
    maxBuffer: 1024 * 1024 
  }, (error, stdout, stderr) => {
    res.json({
      success: !error,
      output: stdout || stderr || (error ? error.message : 'No output'),
      exitCode: error ? error.code : 0
    });
  });
});

// Verify PIN endpoint
app.post('/api/verify', (req, res) => {
  const { pin } = req.body;
  if (pin === config.pin) {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false });
  }
});

// Transcribe audio with Whisper API
app.post('/api/transcribe', authMiddleware, upload.single('audio'), async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    const formData = new FormData();
    formData.append('file', readFileSync(req.file.path), {
      filename: 'audio.webm',
      contentType: req.file.mimetype
    });
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData
    });

    // Clean up temp file
    unlinkSync(req.file.path);

    if (!response.ok) {
      const error = await response.text();
      console.error('Whisper API error:', error);
      return res.status(response.status).json({ error: 'Transcription failed' });
    }

    const result = await response.json();
    res.json({ text: result.text });

  } catch (error) {
    console.error('Transcription error:', error);
    // Clean up temp file on error
    if (req.file) {
      try { unlinkSync(req.file.path); } catch {}
    }
    res.status(500).json({ error: error.message });
  }
});

// Chat with Kai through OpenClaw gateway
app.post('/api/chat', authMiddleware, async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    // Send message to OpenClaw gateway
    const response = await fetch(`${OPENCLAW_GATEWAY_URL}/api/sessions/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: 'agent:main:main', // Same session as Telegram DM
        message: message
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenClaw gateway error:', error);
      return res.status(response.status).json({ error: 'Failed to send message to Kai' });
    }

    const result = await response.json();
    
    // Generate TTS for the response
    let audioUrl = null;
    if (result.response) {
      try {
        audioUrl = await generateTTS(result.response);
      } catch (ttsError) {
        console.error('TTS generation failed:', ttsError);
        // Continue without audio - not critical
      }
    }

    res.json({ 
      response: result.response || 'No response from Kai',
      audioUrl 
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate TTS
async function generateTTS(text) {
  // Try sag CLI first (local, free)
  return new Promise((resolve, reject) => {
    const tempFile = `/tmp/tts-${Date.now()}.mp3`;
    
    exec(`which sag`, (error) => {
      if (error) {
        // sag not available, try ElevenLabs API
        if (ELEVENLABS_API_KEY) {
          generateElevenLabsTTS(text)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error('No TTS service available'));
        }
        return;
      }

      // Use sag CLI
      exec(`sag "${text.replace(/"/g, '\\"')}" --output "${tempFile}"`, (error) => {
        if (error) {
          reject(error);
          return;
        }
        // Return the file path - client will fetch it
        resolve(`/api/audio/${tempFile.split('/').pop()}`);
      });
    });
  });
}

// ElevenLabs TTS fallback
async function generateElevenLabsTTS(text) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    })
  });

  if (!response.ok) {
    throw new Error('ElevenLabs API error');
  }

  const audioBuffer = await response.buffer();
  const tempFile = `/tmp/tts-${Date.now()}.mp3`;
  writeFileSync(tempFile, audioBuffer);
  
  return `/api/audio/${tempFile.split('/').pop()}`;
}

// Serve audio files
app.get('/api/audio/:filename', authMiddleware, (req, res) => {
  const filename = req.params.filename;
  const filepath = `/tmp/${filename}`;
  
  if (!existsSync(filepath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  res.sendFile(filepath, (err) => {
    if (err) {
      console.error('Error sending audio file:', err);
    }
    // Clean up file after sending (with delay)
    setTimeout(() => {
      try { unlinkSync(filepath); } catch {}
    }, 5000);
  });
});

// Serve static files in production
const distPath = join(rootDir, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // Catch-all for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 kai-remote server running on port ${PORT}`);
});
