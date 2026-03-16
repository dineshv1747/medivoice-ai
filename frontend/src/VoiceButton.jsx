import React, { useState, useRef, useEffect } from 'react';
import './VoiceButton.css';

/**
 * VoiceButton - Microphone button that:
 * 1. Uses browser Web Speech API for real-time transcription (fast & reliable)
 * 2. Sends transcribed text to backend → Nova Lite analysis → Nova Sonic TTS
 * 3. Plays back the audio response (LPCM PCM from Nova Sonic)
 *
 * Why Web Speech API for STT instead of Nova Sonic STT?
 * Browser records in audio/webm;codecs=opus — Nova Sonic expects raw 16-bit LPCM.
 * The Web Speech API gives instant, reliable transcription without format conversion.
 * Nova Sonic is still used for TTS (text→audio) on the backend.
 */
function VoiceButton({ onResult, onError, onLoadingChange }) {
  const [recordingState, setRecordingState] = useState('idle'); // idle | listening | processing
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError('Speech recognition is not supported in your browser. Please use Chrome or Edge, or use the Text tab.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    finalTranscriptRef.current = '';
    setLiveTranscript('');

    recognition.onstart = () => {
      setRecordingState('listening');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text + ' ';
        } else {
          interim += text;
        }
      }
      if (final) {
        finalTranscriptRef.current += final;
      }
      setLiveTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        onError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (event.error !== 'aborted') {
        onError(`Speech recognition error: ${event.error}. Try again.`);
      }
      setRecordingState('idle');
    };

    recognition.onend = () => {
      // Only send if we have a transcript and we're not already processing
      if (finalTranscriptRef.current.trim()) {
        sendTranscriptToBackend(finalTranscriptRef.current.trim());
      } else if (recordingState === 'listening') {
        setRecordingState('idle');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop(); // triggers onend → sendTranscriptToBackend
    }
  };

  const sendTranscriptToBackend = async (transcript) => {
    setRecordingState('processing');
    onLoadingChange(true);

    try {
      const controller = new AbortController();
      // 60s timeout: Nova Lite analysis (~10s) + Nova Sonic TTS (~40s) = ~50s
      const fetchTimeout = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/medivoice/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ symptoms: transcript }),
      });
      clearTimeout(fetchTimeout);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Include the transcribed text in the result so it shows on screen
        const result = { ...data, transcribedText: transcript };
        onResult(result);

        // Play TTS audio response from Nova Sonic
        if (data.audioBase64) {
          await playAudioResponse(data.audioBase64);
        }
      } else {
        onError(data.errorMessage || 'Analysis failed. Please try again.');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        onError('Request timed out. The analysis is taking too long — please try again.');
      } else {
        onError('Failed to analyze symptoms. Please check your connection and try again.');
      }
      console.error('Analysis error:', err);
    } finally {
      setRecordingState('idle');
      onLoadingChange(false);
    }
  };

  const playAudioResponse = async (audioBase64) => {
    try {
      setIsPlayingAudio(true);
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000,
      });

      // Nova Sonic returns 16-bit signed LPCM, base64-encoded
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => setIsPlayingAudio(false);
      source.start();
    } catch (err) {
      console.error('Audio playback failed:', err);
      setIsPlayingAudio(false);
    }
  };

  const handleButtonClick = () => {
    if (recordingState === 'idle') {
      startListening();
    } else if (recordingState === 'listening') {
      stopListening();
    }
    // do nothing if processing
  };

  if (!speechSupported) {
    return (
      <div className="voice-section">
        <div className="voice-status">
          <p className="status-main">⚠️ Voice not supported in this browser</p>
          <p className="status-sub">Please use Chrome or Edge, or switch to the "Type Symptoms" tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-section">
      {/* Main Mic Button */}
      <div className="mic-wrapper">
        {recordingState === 'listening' && (
          <>
            <div className="pulse-ring ring-1" />
            <div className="pulse-ring ring-2" />
          </>
        )}

        <button
          className={`mic-button mic-${recordingState}`}
          onClick={handleButtonClick}
          disabled={recordingState === 'processing'}
          aria-label={recordingState === 'listening' ? 'Stop and analyze' : 'Start speaking'}
        >
          {recordingState === 'idle' && <MicIcon size={52} />}
          {recordingState === 'listening' && <StopIcon size={42} />}
          {recordingState === 'processing' && (
            <div className="processing-icon">
              <div className="dot-spinner">
                <span /><span /><span />
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Status Text */}
      <div className="voice-status">
        {recordingState === 'idle' && !isPlayingAudio && (
          <>
            <p className="status-main">Tap to Speak</p>
            <p className="status-sub">Press and describe your symptoms</p>
          </>
        )}
        {recordingState === 'listening' && (
          <>
            <p className="status-main recording">🔴 Listening...</p>
            <p className="status-sub">Tap again to stop and analyze</p>
          </>
        )}
        {recordingState === 'processing' && (
          <>
            <p className="status-main">Analyzing with Amazon Nova...</p>
            <p className="status-sub">Nova Lite analysis + Nova Sonic TTS</p>
          </>
        )}
        {isPlayingAudio && (
          <>
            <p className="status-main">🔊 Nova Sonic is speaking...</p>
            <p className="status-sub">Listen to the analysis</p>
          </>
        )}
      </div>

      {/* Live transcript preview */}
      {liveTranscript && (
        <div className="transcription-preview">
          <p className="transcription-label">Nova heard:</p>
          <p className="transcription-text">"{liveTranscript}"</p>
        </div>
      )}

      {/* Instructions */}
      <div className="voice-instructions">
        <div className="instruction">
          <span className="step">1</span>
          <span>Tap the microphone</span>
        </div>
        <div className="instruction-arrow">→</div>
        <div className="instruction">
          <span className="step">2</span>
          <span>Describe symptoms</span>
        </div>
        <div className="instruction-arrow">→</div>
        <div className="instruction">
          <span className="step">3</span>
          <span>Hear AI analysis</span>
        </div>
      </div>
    </div>
  );
}

function MicIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export default VoiceButton;
