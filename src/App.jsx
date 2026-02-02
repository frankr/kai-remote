import { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.PROD 
  ? '/api' 
  : 'http://localhost:4004/api';

function App() {
  const [pin, setPin] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [commands, setCommands] = useState([]);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [customCmd, setCustomCmd] = useState('');
  const [error, setError] = useState('');

  // Check for saved PIN
  useEffect(() => {
    const savedPin = localStorage.getItem('kai-remote-pin');
    if (savedPin) {
      verifyPin(savedPin);
    }
  }, []);

  const verifyPin = async (pinToVerify) => {
    try {
      const res = await fetch(`${API_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToVerify })
      });
      if (res.ok) {
        setPin(pinToVerify);
        setAuthenticated(true);
        localStorage.setItem('kai-remote-pin', pinToVerify);
        fetchCommands(pinToVerify);
      } else {
        setError('Invalid PIN');
        localStorage.removeItem('kai-remote-pin');
      }
    } catch (e) {
      setError('Connection failed');
    }
  };

  const fetchCommands = async (authPin) => {
    try {
      const res = await fetch(`${API_URL}/commands`, {
        headers: { 'X-Auth-Pin': authPin }
      });
      const data = await res.json();
      setCommands(data);
    } catch (e) {
      console.error('Failed to fetch commands');
    }
  };

  const runCommand = async (command) => {
    setLoading(true);
    setOutput('Running...');
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/exec`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Auth-Pin': pin
        },
        body: JSON.stringify({ command })
      });
      const data = await res.json();
      setOutput(data.output);
      if (!data.success) {
        setError(`Exit code: ${data.exitCode}`);
      }
    } catch (e) {
      setOutput('');
      setError('Failed to execute command');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    verifyPin(pin);
  };

  const handleCustomCmd = (e) => {
    e.preventDefault();
    if (customCmd.trim()) {
      runCommand(customCmd.trim());
    }
  };

  const logout = () => {
    setAuthenticated(false);
    setPin('');
    setCommands([]);
    setOutput('');
    localStorage.removeItem('kai-remote-pin');
  };

  // Group commands by category
  const groupedCommands = commands.reduce((acc, cmd) => {
    const cat = cmd.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cmd);
    return acc;
  }, {});

  if (!authenticated) {
    return (
      <div className="app">
        <div className="login-container">
          <h1>🖥️ Kai Remote</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
            <button type="submit">Unlock</button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>🖥️ Kai Remote</h1>
        <button className="logout-btn" onClick={logout}>🚪</button>
      </header>

      <div className="commands-grid">
        {Object.entries(groupedCommands).map(([category, cmds]) => (
          <div key={category} className="category">
            <h3>{category.toUpperCase()}</h3>
            <div className="buttons">
              {cmds.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => runCommand(cmd.command)}
                  disabled={loading}
                  className="cmd-btn"
                >
                  <span className="icon">{cmd.icon}</span>
                  <span className="label">{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <form className="custom-cmd" onSubmit={handleCustomCmd}>
        <input
          type="text"
          placeholder="Custom command..."
          value={customCmd}
          onChange={(e) => setCustomCmd(e.target.value)}
        />
        <button type="submit" disabled={loading || !customCmd.trim()}>
          Run
        </button>
      </form>

      <div className="output-container">
        <div className="output-header">
          <span>Output</span>
          {output && <button onClick={() => setOutput('')}>Clear</button>}
        </div>
        <pre className={`output ${error ? 'has-error' : ''}`}>
          {output || 'Run a command to see output...'}
        </pre>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

export default App;
