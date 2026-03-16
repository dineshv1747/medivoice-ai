import React, { useState } from 'react';
import VoiceButton from './VoiceButton';
import ImageUpload from './ImageUpload';
import ResponseDisplay from './ResponseDisplay';
import './App.css';

const DISCLAIMER = "⚠️ MEDICAL DISCLAIMER: MediVoice AI is for informational purposes only. It does NOT replace professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical concerns. In case of emergency, call 911 immediately.";

function App() {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [activeTab, setActiveTab] = useState('voice'); // 'voice' | 'text' | 'image'

  const handleVoiceResult = (result) => {
    setAnalysisResult(result);
    setError(null);
  };

  const handleImageResult = (result) => {
    setAnalysisResult(result);
    setError(null);
  };

  const handleError = (err) => {
    setError(err);
    setIsLoading(false);
  };

  const handleTextSubmit = async () => {
    if (!symptoms.trim()) return;
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/medivoice/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: symptoms.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setAnalysisResult(data);
      } else {
        setError(data.errorMessage || 'Analysis failed. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please check the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🏥</span>
            <div>
              <h1>MediVoice AI</h1>
              <p className="subtitle">Powered by Amazon Nova</p>
            </div>
          </div>
          <div className="nova-badge">
            <span>🤖 Nova Sonic + Nova Lite + Nova Embed</span>
          </div>
        </div>
      </header>

      {/* Disclaimer Banner */}
      <div className="disclaimer-banner">
        <p>{DISCLAIMER}</p>
      </div>

      {/* Main Content */}
      <main className="app-main">
        {/* Tab Navigation */}
        <div className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            🎙️ Voice Input
          </button>
          <button
            className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            ⌨️ Type Symptoms
          </button>
          <button
            className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
            onClick={() => setActiveTab('image')}
          >
            📷 Upload Photo
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'voice' && (
            <div className="tab-panel">
              <p className="tab-description">
                Press the microphone button and describe your symptoms out loud.
                Nova Sonic will transcribe your voice and Nova Lite will analyze your symptoms.
              </p>
              <VoiceButton
                onResult={handleVoiceResult}
                onError={handleError}
                onLoadingChange={setIsLoading}
              />
            </div>
          )}

          {activeTab === 'text' && (
            <div className="tab-panel">
              <p className="tab-description">
                Type your symptoms below. Nova Lite will analyze them and
                Nova Sonic will read the response back to you.
              </p>
              <div className="text-input-section">
                <textarea
                  className="symptoms-textarea"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe your symptoms here... (e.g., I have a headache and fever for 2 days, along with sore throat)"
                  rows={5}
                  aria-label="Symptom description"
                />
                <button
                  className="analyze-btn"
                  onClick={handleTextSubmit}
                  disabled={isLoading || !symptoms.trim()}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner" />
                      Analyzing...
                    </>
                  ) : (
                    <>🔍 Analyze Symptoms</>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'image' && (
            <div className="tab-panel">
              <p className="tab-description">
                Upload a photo (skin condition, injury, etc.). Nova Multimodal Embeddings
                and Nova Lite will analyze it for medical context.
              </p>
              <ImageUpload
                onResult={handleImageResult}
                onError={handleError}
                onLoadingChange={setIsLoading}
              />
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="loading-spinner-large" />
              <p>Amazon Nova is analyzing...</p>
              <p className="loading-subtext">Nova Sonic + Nova Lite + Nova Embed at work</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error-card">
            <span>⚠️</span>
            <div>
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Results Display */}
        {analysisResult && !isLoading && (
          <ResponseDisplay result={analysisResult} />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          MediVoice AI uses <strong>Amazon Nova Sonic</strong> (voice),{' '}
          <strong>Amazon Nova Lite</strong> (analysis), and{' '}
          <strong>Amazon Nova Multimodal Embeddings</strong> (image understanding)
        </p>
        <p className="footer-disclaimer">{DISCLAIMER}</p>
        <p className="footer-copyright">
          Built with Amazon Bedrock · AWS SDK for Java v2 · LangChain4j · Spring Boot 3 · React
        </p>
      </footer>
    </div>
  );
}

export default App;
