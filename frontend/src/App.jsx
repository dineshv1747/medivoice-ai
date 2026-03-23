import { useState, useEffect } from 'react';
import VoiceButton from './VoiceButton';
import ImageUpload from './ImageUpload';
import ResponseDisplay from './ResponseDisplay';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import HistoryPanel from './HistoryPanel';
import './App.css';

const DISCLAIMER = "MediVoice AI provides general health information for educational purposes only. Always consult a qualified healthcare professional for medical advice.";

function App() {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [activeTab, setActiveTab] = useState('voice'); // 'voice' | 'text' | 'image'

  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [authPage, setAuthPage] = useState('login'); // 'login' | 'register'

  // History state
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const historyKey = (user) => `medivoice_history_${user}`;

  useEffect(() => {
    const saved = localStorage.getItem('medivoice_current_user');
    if (saved) {
      try {
        const session = JSON.parse(saved);
        setCurrentUser(session.username);
        const h = JSON.parse(localStorage.getItem(historyKey(session.username)) || '[]');
        setHistory(h);
      } catch {
        localStorage.removeItem('medivoice_current_user');
      }
    }
  }, []);

  const saveToHistory = (type, symptoms, result) => {
    if (!currentUser) return;
    const entry = {
      id: Date.now() + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      type,
      symptoms: symptoms || '',
      analysisText: result.analysisText || '',
      imageAnalysis: result.imageAnalysis || '',
    };
    setHistory(prev => {
      const updated = [entry, ...prev];
      localStorage.setItem(historyKey(currentUser), JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteHistory = (id) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(historyKey(currentUser), JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearAllHistory = () => {
    setHistory([]);
    localStorage.setItem(historyKey(currentUser), '[]');
  };

  const handleLogin = (username) => {
    setCurrentUser(username);
    setAuthPage('login');
    const h = JSON.parse(localStorage.getItem(historyKey(username)) || '[]');
    setHistory(h);
  };

  const handleLogout = () => {
    localStorage.removeItem('medivoice_current_user');
    setCurrentUser(null);
    setAnalysisResult(null);
    setError(null);
    setHistory([]);
    setShowHistory(false);
  };

  // Show auth pages when not logged in
  if (!currentUser) {
    if (authPage === 'register') {
      return <RegisterPage onGoLogin={() => setAuthPage('login')} />;
    }
    return <LoginPage onLogin={handleLogin} onGoRegister={() => setAuthPage('register')} />;
  }

  const handleVoiceResult = (result) => {
    setAnalysisResult(result);
    setError(null);
    saveToHistory('voice', result.transcribedText, result);
  };

  const handleImageResult = (result) => {
    setAnalysisResult(result);
    setError(null);
    saveToHistory('image', result.symptoms || '', result);
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
        saveToHistory('text', symptoms.trim(), data);
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
              <p className="subtitle">Intelligent Health Assistant</p>
            </div>
          </div>
          <div className="header-right">
            <button className="history-toggle-btn" onClick={() => setShowHistory(s => !s)}>
              📋 History
              {history.length > 0 && (
                <span className="history-badge">{history.length}</span>
              )}
            </button>
            <div className="user-info">
              <span className="welcome-msg">👤 {currentUser}</span>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      </header>

      {/* Disclaimer Banner */}
      <div className="disclaimer-banner">
        <p>{DISCLAIMER}</p>
      </div>

      {/* Main Content */}
      <main className="app-main">
        {/* Hero + Feature Cards */}
        <div className="hero-section">
          <h2>How can we help you today?</h2>
          <p>Choose a method below to get instant AI-powered health guidance</p>
          <div className="feature-cards">
            <div
              className={`feature-card ${activeTab === 'voice' ? 'active' : ''}`}
              onClick={() => setActiveTab('voice')}
            >
              <span className="feature-card-icon">🎤</span>
              <div className="feature-card-title">Voice Analysis</div>
              <div className="feature-card-desc">Speak your symptoms aloud</div>
            </div>
            <div
              className={`feature-card ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              <span className="feature-card-icon">⌨️</span>
              <div className="feature-card-title">Symptom Check</div>
              <div className="feature-card-desc">Type your symptoms in detail</div>
            </div>
            <div
              className={`feature-card ${activeTab === 'image' ? 'active' : ''}`}
              onClick={() => setActiveTab('image')}
            >
              <span className="feature-card-icon">📸</span>
              <div className="feature-card-title">Image Analysis</div>
              <div className="feature-card-desc">Upload a photo for visual AI review</div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'voice' && (
            <div className="tab-panel">
              <p className="tab-description">
                Click the microphone and describe your symptoms.
                MediVoice AI will analyze your symptoms and provide guidance.
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
                Type your symptoms below and receive instant AI-powered health guidance.
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
                Upload a photo (skin condition, injury, rash, etc.) for AI-powered visual health analysis.
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
              <p>Analyzing your symptoms...</p>
              <p className="loading-subtext">Please wait</p>
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

      {/* History Panel (slide-in) */}
      {showHistory && (
        <HistoryPanel
          history={history}
          onDelete={handleDeleteHistory}
          onClearAll={handleClearAllHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Footer */}
      <footer className="app-footer">
        <p className="footer-tagline">AI-powered health guidance for everyone</p>
        <p className="footer-disclaimer">{DISCLAIMER}</p>
        <div className="footer-links">
          <a href="#privacy">Privacy Policy</a>
          <span>|</span>
          <a href="#terms">Terms of Service</a>
          <span>|</span>
          <a href="#contact">Contact</a>
        </div>
        <p className="footer-copyright">© 2026 MediVoice AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
