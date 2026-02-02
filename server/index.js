import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
