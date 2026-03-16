import React, { useState, useRef } from 'react';
import './ResponseDisplay.css';

const DISCLAIMER = "⚠️ MEDICAL DISCLAIMER: This information is for educational purposes only and does not replace professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.";

/**
 * ResponseDisplay - shows the full medical analysis result.
 * Displays transcription, analysis text, image analysis,
 * and provides audio playback control.
 */
function ResponseDisplay({ result }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);

  const playAudio = async () => {
    if (!result.audioBase64 || isPlayingAudio) return;

    try {
      setIsPlayingAudio(true);

      // Stop any existing playback
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch (e) {}
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });
      audioContextRef.current = audioContext;

      // Decode base64 PCM audio (16-bit LPCM from Nova Sonic)
      const binaryString = atob(result.audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit signed PCM to float32
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
      audioSourceRef.current = source;

      source.onended = () => {
        setIsPlayingAudio(false);
      };

      source.start();

    } catch (err) {
      console.error('Audio playback error:', err);
      setIsPlayingAudio(false);
    }
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) {}
    }
    setIsPlayingAudio(false);
  };

  const formatAnalysis = (text) => {
    if (!text) return null;
    // Split into paragraphs and render
    return text.split('\n').filter(line => line.trim()).map((line, i) => {
      // Render disclaimer lines specially
      if (line.includes('MEDICAL DISCLAIMER') || line.includes('⚠️')) {
        return (
          <p key={i} className="response-disclaimer-line">{line}</p>
        );
      }
      // Bold headers (lines ending with colon or all caps)
      if (line.endsWith(':') || line === line.toUpperCase()) {
        return <p key={i} className="response-section-header">{line}</p>;
      }
      return <p key={i} className="response-paragraph">{line}</p>;
    });
  };

  if (!result) return null;

  return (
    <div className="response-container">
      {/* Header */}
      <div className="response-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="response-header-left">
          <span className="response-icon">🏥</span>
          <h2>MediVoice AI Analysis</h2>
          <span className="nova-tag">Amazon Nova</span>
        </div>
        <button className="expand-btn" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {isExpanded && (
        <div className="response-body">
          {/* Disclaimer */}
          <div className="top-disclaimer">
            <p>{DISCLAIMER}</p>
          </div>

          {/* Transcribed Text */}
          {result.transcribedText && (
            <div className="response-section">
              <div className="section-label">
                <span className="section-icon">🎙️</span>
                <span>Nova Sonic transcribed:</span>
              </div>
              <div className="transcription-box">
                <p>"{result.transcribedText}"</p>
              </div>
            </div>
          )}

          {/* Image Analysis */}
          {result.imageAnalysis && (
            <div className="response-section">
              <div className="section-label">
                <span className="section-icon">📸</span>
                <span>Nova Multimodal image analysis:</span>
              </div>
              <div className="image-analysis-box">
                {formatAnalysis(result.imageAnalysis)}
              </div>
            </div>
          )}

          {/* Main Analysis */}
          {result.analysisText && (
            <div className="response-section">
              <div className="section-label">
                <span className="section-icon">🩺</span>
                <span>Nova Lite medical analysis:</span>
              </div>
              <div className="analysis-box">
                {formatAnalysis(result.analysisText)}
              </div>
            </div>
          )}

          {/* Audio Controls */}
          {result.audioBase64 && (
            <div className="audio-controls-section">
              <div className="section-label">
                <span className="section-icon">🔊</span>
                <span>Nova Sonic voice response:</span>
              </div>
              <div className="audio-controls">
                {!isPlayingAudio ? (
                  <button className="play-audio-btn" onClick={playAudio}>
                    ▶ Play Voice Response
                  </button>
                ) : (
                  <button className="stop-audio-btn" onClick={stopAudio}>
                    ⏹ Stop Audio
                  </button>
                )}
                {isPlayingAudio && (
                  <div className="playing-indicator">
                    <span className="sound-wave">🔊</span>
                    <span>Nova Sonic speaking...</span>
                    <div className="sound-bars">
                      <div className="sound-bar" />
                      <div className="sound-bar" />
                      <div className="sound-bar" />
                      <div className="sound-bar" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* S3 Storage info */}
          {result.s3ImageUrl && (
            <div className="s3-info">
              <span>📦 Image securely stored in AWS S3</span>
            </div>
          )}

          {/* Nova models used */}
          <div className="models-used">
            <p>Powered by:</p>
            <div className="model-chips">
              <span className="model-chip sonic">🎙️ Nova Sonic (STT + TTS)</span>
              <span className="model-chip lite">🧠 Nova Lite (Analysis)</span>
              <span className="model-chip embed">🔬 Nova Embed (Image)</span>
            </div>
          </div>

          {/* Emergency Notice */}
          <div className="emergency-notice">
            <strong>🚨 Emergency?</strong> If you are experiencing chest pain, difficulty breathing,
            severe bleeding, or any life-threatening symptoms — call <strong>911</strong> immediately.
          </div>
        </div>
      )}
    </div>
  );
}

export default ResponseDisplay;
