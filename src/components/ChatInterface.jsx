import { useState, useEffect, useRef } from 'react';
import VoiceButton from './VoiceButton';
import './ChatInterface.css';

const API_URL = import.meta.env.PROD 
  ? '/api' 
  : 'http://localhost:4004/api';

function ChatInterface({ pin }) {
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleVoiceRecording = async (audioBlob) => {
    setIsProcessing(true);
    
    // Add user's voice message (will show transcription when ready)
    const userMsgId = Date.now();
    setMessages(prev => [...prev, {
      id: userMsgId,
      type: 'user',
      isVoice: true,
      text: 'Transcribing...',
      timestamp: new Date()
    }]);

    try {
      // 1. Transcribe audio with Whisper
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const transcribeRes = await fetch(`${API_URL}/transcribe`, {
        method: 'POST',
        headers: { 'X-Auth-Pin': pin },
        body: formData
      });

      if (!transcribeRes.ok) {
        throw new Error('Transcription failed');
      }

      const { text: transcribedText } = await transcribeRes.json();
      
      // Update message with transcription
      setMessages(prev => prev.map(msg => 
        msg.id === userMsgId 
          ? { ...msg, text: transcribedText }
          : msg
      ));

      // 2. Send to OpenClaw gateway
      const kaiRes = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Auth-Pin': pin 
        },
        body: JSON.stringify({ message: transcribedText })
      });

      if (!kaiRes.ok) {
        throw new Error('Failed to get response from Kai');
      }

      const { response, audioUrl } = await kaiRes.json();

      // 3. Add Kai's response to chat
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'kai',
        text: response,
        audioUrl,
        timestamp: new Date()
      }]);

      // 4. Auto-play TTS if available
      if (audioUrl) {
        playAudio(audioUrl);
      }

    } catch (error) {
      console.error('Voice message error:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        text: `Error: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = (url) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    
    audio.play().catch(err => {
      console.error('Audio playback error:', err);
      setIsPlaying(false);
    });
  };

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🎤</span>
            <p>Hold the button below to talk to Kai</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`message ${msg.type}`}>
              <div className="message-header">
                <span className="message-icon">
                  {msg.type === 'user' ? (msg.isVoice ? '🎤' : '💬') : '🤖'}
                </span>
                <span className="message-time">
                  {msg.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              <div className="message-text">{msg.text}</div>
              {msg.audioUrl && (
                <button 
                  className="play-audio-btn"
                  onClick={() => playAudio(msg.audioUrl)}
                  disabled={isPlaying}
                >
                  {isPlaying ? '🔊' : '▶️'} Play
                </button>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="voice-controls">
        <VoiceButton 
          onRecordingComplete={handleVoiceRecording}
          disabled={isProcessing}
        />
        {isProcessing && (
          <div className="processing-indicator">
            <span className="spinner"></span>
            <span>Processing...</span>
          </div>
        )}
        {isPlaying && (
          <div className="playing-indicator">
            <span className="audio-wave">🔊</span>
            <span>Playing...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatInterface;
