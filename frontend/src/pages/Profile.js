import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { STATUS_MAP, formatPrice } from '../utils/helpers';
import BusinessCard from '../components/BusinessCard';

const LOCALE_MAP = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

const Profile = () => {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const locale = LOCALE_MAP[language] || 'uz-UZ';
  
  const [activeTab, setActiveTab] = useState('bookings'); // bookings | favorites
  const [bookings, setBookings] = useState([]);
  const [favorites, setFavorites] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'bookings') {
         const res = await api.get('/bookings/my');
         const sorted = res.data.sort((a,b) => new Date(b.date) - new Date(a.date));
         setBookings(sorted);
      } else if (activeTab === 'favorites') {
         const res = await api.get('/auth/favorites');
         setFavorites(res.data);
      }
    } catch (err) {
      setError('Ma\'lumotlarni yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancel = async (bookingId) => {
    if (!window.confirm(t('confirmCancel'))) return;
    try {
      await api.patch(`/bookings/${bookingId}/cancel`);
      setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, status: 'cancelled' } : b));
    } catch (err) {
      alert(err.response?.data?.message || 'Bekor qilishda xatolik yuz berdi');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'U';
  const roleLabel = user?.role === 'owner' ? t('roleOwner') : user?.role === 'admin' ? t('roleAdmin') : t('roleClient');

  const activeBookingsCount = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length;
  const completedBookingsCount = bookings.filter(b => b.status === 'completed').length;
  
  return (
    <div className="container animate-in" style={{ paddingBottom: '5rem' }}>
      
      {/* HEADER & TABS */}
      <div style={{ margin: '3rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
         <div>
            <h1 style={{ fontSize: '2.5rem', margin: '0 0 1rem' }}>{t('myProfile')}</h1>
            <div style={{ display: 'flex', gap: '2rem' }}>
               <button 
                  onClick={() => setActiveTab('bookings')} 
                  style={{ background: 'none', border: 'none', padding: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 600, color: activeTab === 'bookings' ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', borderBottom: activeTab === 'bookings' ? '3px solid var(--primary)' : '3px solid transparent', transform: 'translateY(17px)' }}
               >
                  {t('myBookings')}
               </button>
               <button 
                  onClick={() => setActiveTab('favorites')} 
                  style={{ background: 'none', border: 'none', padding: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 600, color: activeTab === 'favorites' ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', borderBottom: activeTab === 'favorites' ? '3px solid var(--primary)' : '3px solid transparent', transform: 'translateY(17px)' }}
               >
                  {t('myFavorites')} ❤️
               </button>
            </div>
         </div>
         <button className="btn btn-outline" onClick={handleLogout}>{t('logout')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2.5fr', gap: '3rem', alignItems: 'start' }} className="profile-grid">
        
        {/* ===== USER CARD & STATS ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', fontSize: '2.5rem', margin: '0 auto 1.5rem', background: 'var(--bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 700 }}>
               {initials}
            </div>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>{user?.name}</h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)' }}>{user?.email}</p>
            <span style={{ display: 'inline-block', padding: '0.3rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-full)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
               {roleLabel}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.25rem 1rem', borderRadius: 'var(--radius-lg)' }}>
               <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{activeBookingsCount}</div>
               <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('activeBookings')}</div>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.25rem 1rem', borderRadius: 'var(--radius-lg)' }}>
               <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{completedBookingsCount}</div>
               <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('completedBookings')}</div>
            </div>
          </div>
        </div>

        {/* ===== MAIN CONTENT AREA ===== */}
        <div>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />)}
            </div>
          )}

          {error && <div style={{ padding: '2rem', background: 'var(--danger)', color: '#fff', borderRadius: 'var(--radius)' }}>{error}</div>}

          {!loading && !error && activeTab === 'bookings' && bookings.length === 0 && (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
              <h3>{t('noBookings')}</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{t('noBookingsHint')}</p>
              <button className="btn btn-lg" onClick={() => navigate('/')}>{t('findService')}</button>
            </div>
          )}

          {!loading && !error && activeTab === 'favorites' && favorites.length === 0 && (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❤️</div>
              <h3>{t('noFavorites')}</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{t('noFavoritesHint')}</p>
              <button className="btn btn-lg btn-outline" onClick={() => navigate('/')}>{t('exploreServices')}</button>
            </div>
          )}

          {!loading && !error && activeTab === 'bookings' && bookings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {bookings.map(b => {
                const status = STATUS_MAP[b.status] || STATUS_MAP.pending;
                const isPast = new Date(b.date) < new Date(new Date().toDateString());
                
                return (
                  <div key={b._id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', opacity: (b.status==='cancelled' || b.status==='completed' || isPast) ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                         <span style={{ padding: '0.2rem 0.6rem', background: status.color + '20', color: status.color, borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem' }}>
                           {status.label}
                         </span>
                         <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>№ {b._id.slice(-6).toUpperCase()}</span>
                      </div>
                      
                      <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>{b.business?.name || t('bookingNotSelected')}</h4>
                      <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.75rem' }}>{b.service?.name || t('bookingNotSelected')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({b.service?.durationMinutes} {t('bookingMinutes')})</span></div>
                      
                      <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                         <div><span style={{ color: 'var(--text-secondary)' }}>{t('date')}:</span> <strong>{new Date(b.date).toLocaleDateString(locale)}</strong></div>
                         <div><span style={{ color: 'var(--text-secondary)' }}>{t('time')}:</span> <strong>{b.startTime}</strong></div>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
                      <div style={{ textAlign: 'right', marginBottom: '0.5rem' }}>
                        {b.wasFlashDeal && (
                          <div style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: 'rgba(255, 69, 0, 0.1)', color: 'var(--danger)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                             🔥 {t('flashApplied')}
                          </div>
                        )}
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: b.wasFlashDeal ? 'var(--danger)' : 'inherit' }}>
                           {formatPrice(b.finalPrice || b.totalPrice)}
                        </div>
                        {b.wasFlashDeal && b.originalPrice && (
                           <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              {formatPrice(b.originalPrice)}
                           </div>
                        )}
                      </div>
                      {b.status === 'pending' && (
                        <button className="btn btn-sm btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleCancel(b._id)}>{t('cancelBooking')}</button>
                      )}
                      {(b.status === 'completed' || b.status === 'cancelled') && (
                        <button className="btn btn-sm btn-outline" onClick={() => navigate(`/business/${b.business?._id}`)}>{t('viewBusiness')}</button>
                      )}
                      {b.status === 'completed' && b.business?._id && (
                        <button className="btn btn-sm" onClick={() => navigate(`/business/${b.business._id}#reviews`)}>{t('leaveReview')} ⭐</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !error && activeTab === 'favorites' && favorites.length > 0 && (
            <div className="grid">
               {favorites.map(biz => (
                  <BusinessCard key={biz._id} business={biz} />
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
