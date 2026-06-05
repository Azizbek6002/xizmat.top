import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const PrivateRoute = ({ children, roles = [] }) => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '60vh', gap: '1rem', color: 'var(--text-secondary)',
        fontSize: '1.1rem',
      }}>
        <div className="spinner" style={{
          width: 28, height: 28,
          border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        {t('loading')}
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  if (roles.length && !roles.includes(user.role)) return <Navigate to="/" />;

  return children;
};

export default PrivateRoute;
