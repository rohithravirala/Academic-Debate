import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const ROLE_OPTIONS = [
  { label: '👨‍🎓 Student', value: 'student' },
  { label: '🧑‍⚖️ Moderator', value: 'moderator' },
  { label: '✨ Others', value: 'professional' }
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!otpSent || otpVerified) return;
    if (secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [otpSent, otpVerified, secondsLeft]);

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = setInterval(() => {
      setResendSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const formatSeconds = (value) => {
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('Full name is required');
      return;
    }

    if (!form.role) {
      setError('Please select a role');
      return;
    }

    if (!EMAIL_PATTERN.test(form.email)) {
      setError('Invalid email');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/send-otp', {
        email: form.email,
        purpose: 'signup'
      });

      setOtpSent(true);
      setOtpVerified(false);
      setOtpToken('');
      setOtp('');
      setSecondsLeft(300);
      setResendSeconds(60);
      setSuccess('OTP sent to your email');
    } catch (apiError) {
      const fallbackMessage =
        apiError?.code === 'ERR_NETWORK'
          ? 'Cannot reach server. Please ensure backend is running on port 5001.'
          : 'Failed to send OTP';
      setError(apiError.response?.data?.message || fallbackMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setSuccess('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter a valid 6-digit OTP');
      return;
    }

    if (secondsLeft <= 0) {
      setError('OTP expired. Please resend OTP.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/verify-otp', {
        email: form.email,
        otp,
        purpose: 'signup'
      });

      setOtpVerified(true);
      setOtpToken(data.otpToken || '');
      setSuccess('OTP verified. You can now set your password.');
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!otpVerified || !otpToken) {
      setError('Please verify OTP before creating your account');
      return;
    }

    if (String(form.password).length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/api/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        otpToken
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess('Account created. Redirecting...');
      navigate('/home');
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-modern-page">
      <div className="auth-modern-card">
        <div className="auth-modern-top">
          <div className="auth-logo-badge" aria-hidden="true">✨</div>
          <h2>Create Account</h2>
          <p>Sign up to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="form-grid auth-modern-form">
          <div className="auth-field-group">
            <label htmlFor="name" className="auth-field-label">Full Name</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon" aria-hidden="true">👤</span>
              <input
                id="name"
                name="name"
                placeholder="Your full name"
                value={form.name}
                onChange={updateField}
                disabled={otpSent}
                required
              />
            </div>
          </div>

          <div className="auth-field-group">
            <label className="auth-field-label" htmlFor="role-student">Role</label>
            <div className="auth-role-toggle" role="radiogroup" aria-label="Select role">
              {ROLE_OPTIONS.map((option) => (
                <button
                  id={`role-${option.value}`}
                  key={option.value}
                  type="button"
                  className={`auth-role-btn ${form.role === option.value ? 'active' : ''}`}
                  disabled={otpSent}
                  onClick={() => setForm((prev) => ({ ...prev, role: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="auth-field-group">
            <label htmlFor="email" className="auth-field-label">Email</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon" aria-hidden="true">✉️</span>
              <input
                id="email"
                name="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={updateField}
                type="email"
                disabled={otpSent}
                required
              />
            </div>
          </div>

          {!otpSent && (
            <button type="button" className="auth-signin-btn" disabled={loading} onClick={handleSendOtp}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          )}

          {otpSent && !otpVerified && (
            <>
              <div className="auth-field-group">
                <label htmlFor="otp" className="auth-field-label">Enter OTP</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">🔢</span>
                  <input
                    id="otp"
                    name="otp"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    type="text"
                    required
                  />
                </div>
                <small className="auth-inline-action" style={{ marginTop: '8px', display: 'block' }}>
                  Expires in {formatSeconds(secondsLeft)}
                </small>
              </div>

              <button type="button" className="auth-signin-btn" disabled={loading || secondsLeft <= 0} onClick={handleVerifyOtp}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                type="button"
                className="auth-text-link"
                onClick={handleSendOtp}
                disabled={loading || resendSeconds > 0}
              >
                {resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : 'Resend OTP'}
              </button>
            </>
          )}

          {otpVerified && (
            <>
              <div className="auth-field-group">
                <label htmlFor="password" className="auth-field-label">Password</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">🔒</span>
                  <input
                    id="password"
                    name="password"
                    placeholder="Minimum 6 characters"
                    value={form.password}
                    onChange={updateField}
                    type="password"
                    required
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label htmlFor="confirmPassword" className="auth-field-label">Confirm Password</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">🔒</span>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={updateField}
                    type="password"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="auth-signin-btn" disabled={loading}>
                {loading ? 'Creating...' : 'Sign Up'}
              </button>
            </>
          )}
        </form>

        <div className="auth-separator">
          <span>OR</span>
        </div>

        <button 
          type="button" 
          className="google-btn" 
          onClick={() => {
            window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api/auth/google'}`;
          }}
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google logo" className="google-icon" />
          Continue with Google
        </button>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <p className="auth-modern-bottom">
          Already have an account?{' '}
          <Link to="/login" className="auth-switch-link">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
