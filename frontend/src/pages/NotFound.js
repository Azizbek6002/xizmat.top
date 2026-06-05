import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const NotFound = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="container animate-in" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '70vh', textAlign: 'center', gap: '1.5rem',
    }}>
      <div style={{ fontSize: '6rem', lineHeight: 1 }}>🔍</div>
      <h1 style={{ fontSize: '5rem', fontWeight: 900, color: 'var(--primary)', margin: 0 }}>
        {t('error404')}
      </h1>
      <h2 style={{ margin: 0 }}>{t('notFound')}</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 420 }}>{t('notFoundHint')}</p>
      <button className="btn btn-lg" onClick={() => navigate('/')}>{t('goHome')}</button>
    </div>
  );
};

export default NotFound;
