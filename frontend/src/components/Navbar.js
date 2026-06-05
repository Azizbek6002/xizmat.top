import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { language, languages, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!user) { setNotifications([]); setUnread(0); return; }
    api.get('/notifications')
      .then(res => { setNotifications(res.data.notifications || []); setUnread(res.data.unread || 0); })
      .catch(() => {});
  }, [user, location.pathname]);

  // Close notification panel on outside click
  useEffect(() => {
    if (!showNotifications) return;
    const handler = e => { if (!e.target.closest('.notif-panel-wrapper')) setShowNotifications(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const handleLogout = () => { logout(); navigate('/'); setDrawerOpen(false); };
  const isActive = path => location.pathname === path;

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setUnread(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setShowNotifications(false);
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <div className="navbar-inner">

          {/* ── Left ── */}
          <div className="navbar-left">
            <Link to="/" className="nav-brand">
              <span className="nav-brand-icon">
                <img src="/logo.svg" alt="HizmatTop" style={{ width: 42, height: 42, objectFit: 'contain', filter: 'drop-shadow(0px 3px 6px rgba(0,0,0,0.15))' }} />
              </span>
              <span className="nav-brand-text">HizmatTop</span>
            </Link>

            <div className="nav-divider" />

            <Link to="/" className={`nav-pill ${isActive('/') ? 'nav-pill--active' : ''}`}>{t('navHome')}</Link>

            {/* AI Assistant — highlighted button */}
            <Link to="/chat?tab=ai" className="nav-ai-btn">
              <span className="nav-ai-pulse" />
              🤖 AI Assistant
            </Link>

            {user && (
              <Link to="/chat" className={`nav-pill ${isActive('/chat') ? 'nav-pill--active' : ''}`}>{t('navChat')}</Link>
            )}
            {user && (user.role === 'owner' || user.role === 'admin') && (
              <Link to="/dashboard" className={`nav-pill ${isActive('/dashboard') ? 'nav-pill--active' : ''}`}>{t('navPanel')}</Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" className={`nav-pill ${isActive('/admin') ? 'nav-pill--active' : ''}`}>{t('navAdmin')}</Link>
            )}
          </div>

          {/* ── Right ── */}
          <div className="navbar-right">
            {/* Language selector */}
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="filter-input"
              style={{ width: 'auto', minWidth: 100, padding: '0.5rem 0.6rem' }}
              aria-label="Language"
            >
              {languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>

            {user ? (
              <>
                {/* Notifications */}
                <div className="notif-panel-wrapper" style={{ position: 'relative' }}>
                  <button
                    className="nav-pill"
                    onClick={() => setShowNotifications(v => !v)}
                    style={{ position: 'relative', fontSize: '1.1rem' }}
                    aria-label={t('notifications')}
                  >
                    🔔
                    {unread > 0 && (
                      <span style={{
                        position: 'absolute', top: -5, right: -5,
                        background: 'var(--danger)', color: '#fff',
                        borderRadius: 999, minWidth: 17, height: 17,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                      }}>{unread}</span>
                    )}
                  </button>
                  {showNotifications && (
                    <div style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                      width: 320, maxHeight: 380, overflowY: 'auto',
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-dropdown)', zIndex: 2000,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1rem', borderBottom: '1px solid var(--border)' }}>
                        <strong>{t('notifications')}</strong>
                        {unread > 0 && <button className="btn btn-outline btn-sm" onClick={markAllRead}>{t('markAllRead')}</button>}
                      </div>
                      {notifications.length === 0
                        ? <div style={{ padding: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{t('noNotifications')}</div>
                        : notifications.map(n => (
                          <div key={n._id} style={{ padding: '0.9rem 1rem', borderBottom: '1px solid var(--border)', background: n.isRead ? 'transparent' : 'var(--primary-light)' }}>
                            <div style={{ fontWeight: 700 }}>{n.title}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{n.message}</div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                <Link to="/profile" className={`nav-user-chip ${isActive('/profile') ? 'nav-user-chip--active' : ''}`}>
                  <span className="nav-avatar">{user.name?.charAt(0).toUpperCase()}</span>
                  <span className="nav-user-label">{user.name}</span>
                </Link>
                <button onClick={handleLogout} className="nav-logout-btn">{t('logout')}</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-pill">{t('login')}</Link>
                <Link to="/register" className="nav-cta-btn">{t('register')}</Link>
              </>
            )}

            {/* Hamburger — mobile only */}
            <button
              className={`nav-hamburger ${drawerOpen ? 'open' : ''}`}
              onClick={() => setDrawerOpen(v => !v)}
              aria-label="Menu"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile Drawer ── */}
      <div className={`nav-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="nav-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
        <div className="nav-drawer-panel">
          <div className="nav-drawer-header">
            <span style={{ fontWeight: 800, fontSize: '1.2rem', background: 'linear-gradient(135deg,#5a20ff,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>HizmatTop</span>
            <button className="nav-drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
          </div>

          <nav className="nav-drawer-links">
            <Link to="/" className={`nav-drawer-link ${isActive('/') ? 'active' : ''}`}>
              <span className="link-icon">🏠</span> {t('navHome')}
            </Link>
            <Link to="/chat?tab=ai" className="nav-drawer-link" style={{ background: 'linear-gradient(135deg,rgba(90,32,255,0.08),rgba(168,85,247,0.08))', color: '#7c3aed', fontWeight: 700 }}>
              <span className="link-icon">🤖</span> AI Assistant
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', background: '#7c3aed', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: 4, fontWeight: 800 }}>NEW</span>
            </Link>
            {user && (
              <Link to="/chat" className={`nav-drawer-link ${isActive('/chat') ? 'active' : ''}`}>
                <span className="link-icon">💬</span> {t('navChat')}
              </Link>
            )}
            {user && (user.role === 'owner' || user.role === 'admin') && (
              <Link to="/dashboard" className={`nav-drawer-link ${isActive('/dashboard') ? 'active' : ''}`}>
                <span className="link-icon">📊</span> {t('navPanel')}
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" className={`nav-drawer-link ${isActive('/admin') ? 'active' : ''}`}>
                <span className="link-icon">🛡️</span> {t('navAdmin')}
              </Link>
            )}

            <div className="nav-drawer-divider" />

            {/* Language in drawer */}
            <div style={{ padding: '0.5rem 1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Til / Язык / Language</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {languages.map(l => (
                  <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: 8,
                      border: `1.5px solid ${language === l.code ? 'var(--primary)' : 'var(--border)'}`,
                      background: language === l.code ? 'var(--primary-light)' : 'var(--bg)',
                      color: language === l.code ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: language === l.code ? 700 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >{l.label}</button>
                ))}
              </div>
            </div>
          </nav>

          <div className="nav-drawer-footer">
            {user ? (
              <>
                <Link to="/profile" className="nav-drawer-link" style={{ background: 'var(--bg)', borderRadius: 10 }} onClick={() => setDrawerOpen(false)}>
                  <span className="nav-avatar" style={{ width: 34, height: 34, fontSize: '0.9rem' }}>{user.name?.charAt(0).toUpperCase()}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{user.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                  </div>
                </Link>
                <button className="btn btn-outline" style={{ width: '100%' }} onClick={handleLogout}>{t('logout')}</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline" style={{ width: '100%', textAlign: 'center' }}>{t('login')}</Link>
                <Link to="/register" className="btn" style={{ width: '100%', textAlign: 'center', background: 'linear-gradient(135deg,var(--primary),#8B5CF6)' }}>{t('register')}</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
