import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Kirishda xatolik yuz berdi. Ma\'lumotlarni tekshiring.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen">
      <div className="auth-left">
        <div className="auth-brand" onClick={() => navigate('/')}>HizmatTop</div>
        <div className="auth-left-content">
          <h1>Qaytganingiz bilan!</h1>
          <p>Shahardagi eng yaxshi xizmatlardan foydalanishda davom etish uchun tizimga kiring.</p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Hisobga kirish</h2>
            <p className="subtitle">Sizni yana ko'rib turganimizdan xursandmiz</p>
          </div>
          
          {error && <div className="form-error">{error}</div>}
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Parol</label>
              <input
                className="form-input"
                type="password"
                placeholder="Parolni kiriting"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button className="btn btn-lg auth-btn" type="submit" disabled={loading}>
              {loading ? 'Kirish...' : 'Kirish'}
            </button>
          </form>
          
          <div className="form-footer">
            Hisobingiz yo'qmi? <Link to="/register">Ro'yxatdan o'tish</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
