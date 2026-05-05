import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');

    if (!EMAIL_PATTERN.test(email)) {
      setError('Invalid email');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/send-otp', { email, purpose: 'forgot_password' });
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
          : 'Unable to send OTP';
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
        email,
        otp,
        purpose: 'forgot_password'
      });
      setOtpVerified(true);
      setOtpToken(data.otpToken || '');
      setSuccess('OTP verified. Set your new password.');
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!otpVerified || !otpToken) {
      setError('Please verify OTP first');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await api.post('/api/auth/reset-password-otp', {
        email,
        password,
        confirmPassword,
        otpToken
      });
      setSuccess('Password reset successful. You can now sign in.');
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-modern-page">
      <div className="auth-modern-card">
        <div className="auth-modern-top">
          <div className="auth-logo-badge" aria-hidden="true">📩</div>
          <h2>Forgot Password</h2>
          <p>Verify OTP to reset your password securely</p>
        </div>

        <form onSubmit={handleSubmit} className="form-grid auth-modern-form">
          <div className="auth-field-group">
            <label htmlFor="email" className="auth-field-label">Email</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon" aria-hidden="true">✉️</span>
              <input
                id="email"
                name="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                <label htmlFor="password" className="auth-field-label">New Password</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">🔒</span>
                  <input
                    id="password"
                    name="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="auth-signin-btn" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </>
          )}
        </form>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <p className="auth-modern-bottom">
          Back to{' '}
          <Link to="/login" className="auth-switch-link">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
