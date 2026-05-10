import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Handle redirect from Google OAuth
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');
    const authError = searchParams.get('error');

    if (token && userStr) {
      try {
        const userObj = JSON.parse(decodeURIComponent(userStr));
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userObj));
        setSuccess('Google Login successful. Redirecting...');
        setTimeout(() => {
          navigate('/home');
        }, 1000);
      } catch (err) {
        setError('Failed to process Google authentication.');
      }
    } else if (authError) {
      setError('Google authentication failed.');
    }
  }, [searchParams, navigate]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await api.post('/api/auth/login', {
        email: form.email,
        password: form.password
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess('Login successful. Redirecting...');
      navigate('/home');
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-modern-page">
      <div className="auth-modern-card">
        <div className="auth-modern-top">
          <div className="auth-logo-badge" aria-hidden="true">🔐</div>
          <h2>Welcome Back</h2>
          <p>Sign in to continue to debate dashboard</p>
        </div>

        {error && <div className="modern-alert error"><span className="icon">⚠️</span>{error}</div>}
        {success && <div className="modern-alert success"><span className="icon">✅</span>{success}</div>}

        <form onSubmit={handleSubmit} className="auth-modern-form">
          <div className="modern-input-group">
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
                required
              />
            </div>
          </div>

          <div className="modern-input-group">
            <label htmlFor="password" className="auth-field-label">Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon" aria-hidden="true">🔒</span>
              <input
                id="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={updateField}
                type="password"
                required
              />
            </div>

            <div className="auth-inline-action">
              <Link to="/forgot-password" className="auth-text-link">Forgot Password?</Link>
            </div>
          </div>

          <button type="submit" className="modern-btn modern-btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-separator">
          <span>OR</span>
        </div>

        <button 
          type="button" 
          className="google-btn" 
          onClick={() => {
            setLoading(true);
            window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/google`;
          }}
          disabled={loading}
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google logo" className="google-icon" />
          Continue with Google
        </button>

        <p className="modern-auth-footer">
          Don't have an account? <Link to="/signup">Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
