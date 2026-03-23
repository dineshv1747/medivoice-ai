import { useState } from 'react';
import './LoginPage.css';

function RegisterPage({ onGoLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPass, setShowPass] = useState(false);

  const passwordStrength = () => {
    if (password.length === 0) return { width: '0%', color: '#E5E7EB' };
    if (password.length < 6) return { width: '25%', color: '#EF4444' };
    if (password.length < 10) return { width: '60%', color: '#F59E0B' };
    return { width: '100%', color: '#10B981' };
  };

  const validate = () => {
    if (username.trim().length < 3) return 'Username must be at least 3 characters.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const users = JSON.parse(localStorage.getItem('medivoice_users') || '[]');
    if (users.some(u => u.username === username.trim())) {
      setError('Username already exists. Please choose a different one.');
      return;
    }

    users.push({ username: username.trim(), password });
    localStorage.setItem('medivoice_users', JSON.stringify(users));
    setSuccess('Account created! Redirecting to sign in...');
    setTimeout(() => onGoLogin(), 1200);
  };

  const strength = passwordStrength();

  return (
    <div className="auth-page">
      {/* Left panel */}
      <div className="auth-left">
        <div className="auth-left-inner">
          <div className="auth-brand">
            <span className="auth-brand-icon">🏥</span>
            <h1>MediVoice AI</h1>
            <p className="auth-brand-tagline">Intelligent Health Assistant</p>
          </div>
          <div className="auth-features">
            <div className="auth-feature-item">
              <span className="af-icon">🩺</span>
              <div>
                <strong>Instant Health Guidance</strong>
                <p>AI analysis in seconds</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="af-icon">📋</span>
              <div>
                <strong>Full Search History</strong>
                <p>All your consultations saved</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="af-icon">🌐</span>
              <div>
                <strong>Available 24/7</strong>
                <p>Health guidance anytime, anywhere</p>
              </div>
            </div>
          </div>
          <div className="auth-left-disclaimer">
            ⚠️ For informational purposes only. Always consult a healthcare professional.
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h2>Create account</h2>
            <p>Join MediVoice AI for free health guidance</p>
          </div>

          {error && (
            <div className="auth-error"><span>⚠️</span> {error}</div>
          )}
          {success && (
            <div className="auth-success"><span>✅</span> {success}</div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                type="text"
                placeholder="At least 3 characters"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="reg-password">Password</label>
              <div className="password-wrap">
                <input
                  id="reg-password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
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
              {password.length > 0 && (
                <div className="pass-strength">
                  <div className="pass-strength-bar" style={{ width: strength.width, background: strength.color }} />
                </div>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="reg-confirm">Confirm Password</label>
              <input
                id="reg-confirm"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <ul className="auth-rules">
              <li className={username.trim().length >= 3 ? 'ok' : ''}>Username: min 3 characters</li>
              <li className={password.length >= 6 ? 'ok' : ''}>Password: min 6 characters</li>
              <li className={password && password === confirmPassword ? 'ok' : ''}>Passwords match</li>
            </ul>

            <button className="auth-submit-btn" type="submit">
              Create Account →
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <button type="button" className="auth-link" onClick={onGoLogin}>Sign in</button>
          </p>

          <p className="auth-footer-note">
            AI-powered health guidance · Available 24/7
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
