import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { getCategoryMeta, formatPrice } from '../utils/helpers';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('businesses');
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [promotedDeals, setPromotedDeals] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Promoted deal form state
  const [dealForm, setDealForm] = useState({ serviceId: '', title: '', bannerImage: '', priority: '0', expiresAt: '' });
  const [dealSaving, setDealSaving] = useState(false);
  const [dealMsg, setDealMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, businessesRes, usersRes, reviewsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/businesses'),
        api.get('/users'),
        api.get('/admin/reviews'),
      ]);
      setStats(statsRes.data);
      setBusinesses(businessesRes.data);
      setUsers(usersRes.data);
      setReviews(reviewsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPromotedDeals = useCallback(async () => {
    try {
      const [dealsRes, bizRes] = await Promise.all([
        api.get('/admin/promoted-deals/manage'),
        api.get('/businesses?includeAll=true'),
      ]);
      setPromotedDeals(dealsRes.data);
      // Collect all services from all businesses for the dropdown
      const services = [];
      for (const biz of bizRes.data) {
        try {
          const sRes = await api.get(`/businesses/${biz._id}/services`);
          sRes.data.forEach(s => services.push({ ...s, businessName: biz.name }));
        } catch {}
      }
      setAllServices(services);
    } catch (err) {
      console.error('Failed to load promoted deals', err);
    }
  }, []);

  useEffect(() => { fetchData(); fetchPromotedDeals(); }, [fetchData, fetchPromotedDeals]);

  const patchBusiness = async (id, action, reason = '') => {
    await api.patch(`/admin/${action}-business/${id}`, { reason });
    fetchData();
  };

  const rejectBusiness = async (id) => {
    const reason = window.prompt('Reason for rejection');
    if (reason === null) return;
    await patchBusiness(id, 'reject', reason || 'Rejected by admin');
  };

  const blockBusiness = async (id) => {
    const reason = window.prompt('Reason for blocking');
    if (reason === null) return;
    await patchBusiness(id, 'block', reason || 'Blocked by admin');
  };

  const blockUser = async (userId) => {
    const reason = window.prompt('Reason for blocking');
    if (reason === null) return;
    await api.patch(`/users/${userId}/block`, { reason });
    fetchData();
  };

  const unblockUser = async (userId) => {
    await api.patch(`/users/${userId}/unblock`);
    fetchData();
  };

  const changeRole = async (userId, role) => {
    await api.patch(`/users/${userId}/role`, { role });
    fetchData();
  };

  const deleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return;
    await api.delete(`/admin/reviews/${reviewId}`);
    fetchData();
  };

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    if (!dealForm.serviceId) { setDealMsg('Xizmatni tanlang'); return; }
    setDealSaving(true);
    setDealMsg('');
    try {
      await api.post('/admin/promoted-deals', {
        serviceId: dealForm.serviceId,
        title: dealForm.title,
        bannerImage: dealForm.bannerImage,
        priority: Number(dealForm.priority) || 0,
        expiresAt: dealForm.expiresAt || null,
      });
      setDealForm({ serviceId: '', title: '', bannerImage: '', priority: '0', expiresAt: '' });
      setDealMsg('✅ Aktsiya qo\'shildi!');
      fetchPromotedDeals();
    } catch (err) {
      setDealMsg(err.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setDealSaving(false);
    }
  };

  const deleteDeal = async (id) => {
    if (!window.confirm('Aktsiyani o\'chirish?')) return;
    await api.delete(`/admin/promoted-deals/${id}`);
    fetchPromotedDeals();
  };

  const statCards = [
    ['👥 Foydalanuvchilar', stats?.users || 0],
    ['🏢 Bizneslar', stats?.businesses || 0],
    ['⏳ Kutilmoqda', stats?.pendingBusinesses || 0],
    ['📅 Yozuvlar', stats?.bookings || 0],
    ['⭐ Sharhlar', stats?.reviews || 0],
    ['📢 Aktsiyalar', promotedDeals.length],
  ];

  const TABS = [
    { key: 'businesses', label: '🏢 Bizneslar' },
    { key: 'users', label: '👥 Foydalanuvchilar' },
    { key: 'deals', label: '📢 Aktsiyalar' },
    { key: 'reviews', label: '⭐ Sharhlar' },
  ];

  return (
    <div className="container animate-in" style={{ paddingBottom: '4rem' }}>
      <div style={{ margin: '3rem 0 2rem' }}>
        <h1 style={{ margin: 0 }}>Admin Paneli 🛡️</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Bizneslar, foydalanuvchilar, sharhlar va reklama aktsiyalarini boshqaring.</p>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'var(--danger)', color: '#fff', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {statCards.map(([label, value]) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`btn btn-sm ${activeTab === key ? '' : 'btn-outline'}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="skeleton" style={{ height: 260, borderRadius: 'var(--radius-xl)' }} />}

      {/* ── Businesses ── */}
      {!loading && activeTab === 'businesses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {businesses.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Hozircha bizneslar yo'q.</p>}
          {businesses.map(business => {
            const meta = getCategoryMeta(business.category);
            const statusColors = { approved: 'var(--success)', pending: 'var(--warning)', rejected: 'var(--danger)', blocked: '#636E72' };
            return (
              <div key={business._id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: meta.color, fontWeight: 700, fontSize: '0.85rem' }}>{meta.icon} {meta.label}</span>
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, background: statusColors[business.status] + '20', color: statusColors[business.status], fontSize: '0.75rem', fontWeight: 700 }}>
                        {business.status}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 0.2rem' }}>{business.name}</h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{business.city}, {business.district}, {business.address}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      Egasi: <strong>{business.owner?.name || 'Noma\'lum'}</strong> ({business.owner?.email || '—'})
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      ⭐ {(business.rating||0).toFixed(1)} · 👁 {business.viewCount||0} ko'rish
                    </div>
                    {(business.rejectionReason || business.blockedReason) && (
                      <div style={{ color: 'var(--danger)', marginTop: '0.4rem', fontSize: '0.85rem' }}>
                        ⚠️ {business.rejectionReason || business.blockedReason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignContent: 'flex-start' }}>
                    {business.status !== 'approved' && (
                      <button className="btn btn-sm" onClick={() => patchBusiness(business._id, 'verify')}>✅ Tasdiqlash</button>
                    )}
                    {business.status !== 'rejected' && (
                      <button className="btn btn-outline btn-sm" onClick={() => rejectBusiness(business._id)}>❌ Rad</button>
                    )}
                    {business.status !== 'blocked' && (
                      <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => blockBusiness(business._id)}>🚫 Bloklash</button>
                    )}
                    {business.status === 'blocked' && (
                      <button className="btn btn-outline btn-sm" onClick={() => patchBusiness(business._id, 'unblock')}>🔓 Blokdan chiqarish</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Users ── */}
      {!loading && activeTab === 'users' && (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <table className="admin-promo-table">
            <thead>
              <tr>
                <th>Foydalanuvchi</th>
                <th>Rol</th>
                <th>Holat</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>
                    <strong>{u.name}</strong>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.email}</div>
                  </td>
                  <td>
                    <select className="form-select" value={u.role} onChange={e => changeRole(u._id, e.target.value)} style={{ width: 'auto', minWidth: 100 }}>
                      <option value="user">user</option>
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    {u.isBlocked
                      ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>🚫 Bloklangan</span>
                      : <span style={{ color: 'var(--success)', fontWeight: 600 }}>✅ Faol</span>
                    }
                  </td>
                  <td>
                    {u.isBlocked
                      ? <button className="btn btn-outline btn-sm" onClick={() => unblockUser(u._id)}>🔓 Blokdan chiqarish</button>
                      : <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => blockUser(u._id)}>🚫 Bloklash</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Promoted Deals ── */}
      {!loading && activeTab === 'deals' && (
        <div>
          {/* Create form */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0 }}>📢 Yangi aktsiya qo'shish</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
              Admin aktsiyasi bosh sahifadagi "Flash Deals" bo'limida ko'rinadi. Har qanday biznesning istalgan xizmatini tanlashingiz mumkin.
            </p>

            {dealMsg && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', background: dealMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)', color: '#fff', fontWeight: 600 }}>
                {dealMsg}
              </div>
            )}

            <form onSubmit={handleCreateDeal}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Xizmatni tanlang *</label>
                  <select
                    className="form-select"
                    value={dealForm.serviceId}
                    onChange={e => setDealForm(f => ({ ...f, serviceId: e.target.value }))}
                    required
                  >
                    <option value="">— Xizmat tanlang —</option>
                    {allServices.map(s => (
                      <option key={s._id} value={s._id}>
                        [{s.businessName}] {s.name} — {formatPrice(s.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Sarlavha (ixtiyoriy)</label>
                  <input
                    className="form-input"
                    placeholder="Masalan: Yozgi chegirma!"
                    value={dealForm.title}
                    onChange={e => setDealForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Banner rasm URL (ixtiyoriy)</label>
                  <input
                    className="form-input"
                    placeholder="https://..."
                    value={dealForm.bannerImage}
                    onChange={e => setDealForm(f => ({ ...f, bannerImage: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Ustuvorlik (kattaroq — birinchi)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={dealForm.priority}
                    onChange={e => setDealForm(f => ({ ...f, priority: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Tugash vaqti (ixtiyoriy)</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={dealForm.expiresAt}
                    onChange={e => setDealForm(f => ({ ...f, expiresAt: e.target.value }))}
                  />
                </div>
              </div>

              <button className="btn" type="submit" disabled={dealSaving}>
                {dealSaving ? 'Saqlanmoqda...' : '➕ Aktsiya qo\'shish'}
              </button>
            </form>
          </div>

          {/* Existing deals table */}
          <h3>Mavjud aktsiyalar ({promotedDeals.length})</h3>
          {promotedDeals.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}>
              📢 Hozircha admin aktsiyalari yo'q. Yuqoridagi forma orqali qo'shing.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <table className="admin-promo-table">
                <thead>
                  <tr>
                    <th>Xizmat</th>
                    <th>Biznes</th>
                    <th>Narx</th>
                    <th>Ustuvorlik</th>
                    <th>Tugaydi</th>
                    <th>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {promotedDeals.map(deal => (
                    <tr key={deal.id}>
                      <td><strong>{deal.title || deal.service_name}</strong></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{deal.business_name}</td>
                      <td>
                        {deal.discount_price
                          ? <><span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: 4 }}>{formatPrice(deal.price)}</span><strong style={{ color: 'var(--danger)' }}>{formatPrice(deal.discount_price)}</strong></>
                          : formatPrice(deal.price)
                        }
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{deal.priority}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {deal.expires_at ? new Date(deal.expires_at).toLocaleString() : '—'}
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={() => deleteDeal(deal.id)}
                        >
                          🗑 O'chirish
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Reviews ── */}
      {!loading && activeTab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reviews.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Sharhlar yo'q.</p>}
          {reviews.map(review => (
            <div key={review._id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <strong>{review.business?.name}</strong>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {review.user?.name} · {'⭐'.repeat(review.rating)} ({review.rating}/5)
                  </div>
                  <p style={{ marginBottom: 0, marginTop: '0.5rem' }}>{review.comment || '—'}</p>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger)', flexShrink: 0 }}
                  onClick={() => deleteReview(review._id)}
                >
                  🗑 O'chirish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
