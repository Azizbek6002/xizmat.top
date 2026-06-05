import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatPrice, getBusinessPhoto, getCategoryMeta, isOpenNow } from '../utils/helpers';

const BusinessCard = ({ business, onBuildRoute }) => {
  const meta = getCategoryMeta(business.category);
  const photoUrl = getBusinessPhoto(business);
  const openStatus = isOpenNow(business.workingHours);
  const { user, updateFavorites } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const favoriteIds = Array.isArray(user?.favorites) ? user.favorites : [];
  const isFav = favoriteIds.includes(business._id);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const toggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { showToast(t('loginToFav')); return; }
    try {
      const res = await api.post(`/auth/favorites/${business._id}`);
      updateFavorites(res.data.favorites);
    } catch {
      showToast(t('favError'));
    }
  };

  const startChat = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { showToast(t('loginToChat')); return; }
    try {
      await api.post('/chat/conversations', { businessId: business._id });
      navigate('/chat');
    } catch {
      showToast(t('chatError'));
    }
  };

  return (
    <div className="card" style={{ position: 'relative' }}>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10,
          background: 'var(--text-primary)', color: '#fff',
          padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem', fontWeight: 500, textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}

      <div className="card-img-wrapper">
        {business.rating >= 4.8 && <span className="card-badge-top">{t('topRated')}</span>}
        <button
          className={`card-fav-btn ${isFav ? 'active' : ''}`}
          onClick={toggleFavorite}
          title={t('addFavorite')}
        >
          {isFav ? '♥' : '♡'}
        </button>
        <img className="card-img" src={photoUrl} alt={business.name} loading="lazy" />
      </div>

      <div className="card-content">
        <div className="card-category" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{meta.label} {business.district ? `| ${business.district}` : ''}</span>
          {business.distance !== undefined && business.distance !== null && (
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
              {Number(business.distance).toFixed(1)} km
            </span>
          )}
        </div>

        <h3 className="card-title">
          <Link to={`/business/${business._id}`} style={{ color: 'inherit' }}>{business.name}</Link>
        </h3>

        <div className="card-rating-row">
          <span className="card-rating">⭐ {(business.rating || 0).toFixed(1)}</span>
          <span style={{ color: 'var(--text-muted)' }}>({business.reviewCount || 0})</span>
          {business.viewCount > 0 && (
            <span className="card-views">👁 {business.viewCount >= 1000 ? `${(business.viewCount/1000).toFixed(1)}k` : business.viewCount}</span>
          )}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            {openStatus !== null && (
              <span className={openStatus ? 'status-open' : 'status-closed'}>
                <span className="status-dot" />
                {openStatus ? t('open') : t('closed')}
              </span>
            )}
          </span>
        </div>

        <div className="card-footer" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div className="card-price-label">{t('priceFrom')}</div>
            <div className="card-price-value">{formatPrice(business.minPrice || 0)}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
            {onBuildRoute && (
              <button
                className="btn btn-sm btn-outline"
                onClick={(e) => { e.stopPropagation(); onBuildRoute(); }}
              >
                {t('routeBtn')}
              </button>
            )}
            <button className="btn btn-sm btn-outline" onClick={startChat}>{t('chatOwner')}</button>
            <Link to={`/business/${business._id}`} className="btn btn-sm">{t('bookBtn')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessCard;
