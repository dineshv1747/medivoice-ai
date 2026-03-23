import React, { useState } from 'react';
import './LoginPage.css';

function LoginPage({ onLogin, onGoRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('medivoice_users') || '[]');
      const user = users.find(u => u.username === username.trim() && u.password === password);
      if (!user) {
        setError('Invalid username or password. Please try again.');
        setIsLoading(false);
        return;
      }
      const sessionData = { username: user.username, loginTime: Date.now() };
      localStorage.setItem('medivoice_current_user', JSON.stringify(sessionData));
      if (rememberMe) {
        localStorage.setItem('medivoice_remember', username.trim());
      } else {
        localStorage.removeItem('medivoice_remember');
      }
      setIsLoading(false);
      onLogin(user.username);
    }, 700);
  };

  React.useEffect(() => {
    const remembered = localStorage.getItem('medivoice_remember');
    if (remembered) { setUsername(remembered); setRememberMe(true); }
  }, []);

  return (
    <div className="auth-page">
      {/* Left panel — brand */}
      <div className="auth-left">
        <div className="auth-left-inner">
          <div className="auth-brand">
            <span className="auth-brand-icon">🏥</span>
            <h1>MediVoice AI</h1>
            <p className="auth-brand-tagline">Intelligent Health Assistant</p>
          </div>
          <div className="auth-features">
            <div className="auth-feature-item">
              <span className="af-icon">🎤</span>
              <div>
                <strong>Voice Analysis</strong>
                <p>Speak your symptoms naturally</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="af-icon">🤖</span>
              <div>
                <strong>AI Health Guidance</strong>
                <p>Instant analysis powered by AI</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="af-icon">🔒</span>
              <div>
                <strong>Private &amp; Secure</strong>
                <p>Your health data stays safe</p>
              </div>
            </div>
          </div>
          <div className="auth-left-disclaimer">
            ⚠️ For informational purposes only. Always consult a healthcare professional.
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-right">
        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h2>Welcome back</h2>
            <p>Sign in to your MediVoice AI account</p>
          </div>

          {error && (
            <div className="auth-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShowPass(s => !s)}
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="auth-remember">
              <label className="remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <span>Remember me</span>
              </label>
            </div>

            <button className="auth-submit-btn" type="submit" disabled={isLoading}>
              {isLoading ? (
                <><span className="auth-spinner" /> Signing in...</>
              ) : (
                'Sign In →'
              )}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account?{' '}
            <button type="button" className="auth-link" onClick={onGoRegister}>
              Create account
            </button>
          </p>

          <p className="auth-footer-note">
            AI-powered health guidance · Available 24/7
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
