import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'user' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Parol kamida 6 ta belgidan iborat bo\'lishi kerak');
      return;
    }

    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Ro\'yxatdan o\'tishda xatolik yuz berdi. Qaytadan urinib ko\'ring.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen">
      <div className="auth-left register-bg">
        <div className="auth-brand" onClick={() => navigate('/')}>HizmatTop</div>
        <div className="auth-left-content">
          <h1>Bizga qo'shiling</h1>
          <p>Yangi imkoniyatlarni kashf eting va eng yaxshi xizmatlarni oson va tez toping.</p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Ro'yxatdan o'tish</h2>
            <p className="subtitle">Yangi hisob yarating</p>
          </div>
          
          {error && <div className="form-error">{error}</div>}
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Ism</label>
              <input className="form-input" type="text" name="name" placeholder="Ismingiz" value={form.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" name="email" placeholder="your@email.com" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Telefon</label>
              <input className="form-input" type="tel" name="phone" placeholder="+998 90 123 45 67" value={form.phone} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Parol</label>
              <input className="form-input" type="password" name="password" placeholder="Kamida 6 belgi" value={form.password} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Hisob turi</label>
              <select className="form-select" name="role" value={form.role} onChange={handleChange}>
                <option value="user">Foydalanuvchi (Mijoz)</option>
                <option value="owner">Biznes egasi</option>
              </select>
            </div>
            <button className="btn btn-lg auth-btn" type="submit" disabled={loading}>
              {loading ? 'Hisob yaratilmoqda...' : 'Ro\'yxatdan o\'tish'}
            </button>
          </form>
          
          <div className="form-footer">
            Hisobingiz bormi? <Link to="/login">Kirish</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
