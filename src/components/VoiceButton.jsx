import { useState, useRef } from 'react';
import './VoiceButton.css';

function VoiceButton({ onRecordingComplete, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimize for speech
        } 
      });

      // Use webm with opus codec for better compression
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000, // 32kbps - good for speech
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Only send if recording is at least 0.5 seconds
        if (recordingDuration >= 0.5) {
          onRecordingComplete(audioBlob);
        }
        
        setRecordingDuration(0);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      // Start duration timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingDuration((Date.now() - startTime) / 1000);
      }, 100);

    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    if (!disabled) {
      startRecording();
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    stopRecording();
  };

  const handleMouseDown = () => {
    if (!disabled) {
      startRecording();
    }
  };

  const handleMouseUp = () => {
    stopRecording();
  };

  return (
    <div className="voice-button-container">
      <button
        className={`voice-button ${isRecording ? 'recording' : ''} ${disabled ? 'disabled' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        disabled={disabled}
      >
        <span className="voice-icon">
          {isRecording ? '🔴' : '🎤'}
        </span>
        <span className="voice-label">
          {isRecording ? `Recording... ${recordingDuration.toFixed(1)}s` : 'Hold to Talk'}
        </span>
        {isRecording && (
          <span className="recording-pulse"></span>
        )}
      </button>
    </div>
  );
}

export default VoiceButton;
