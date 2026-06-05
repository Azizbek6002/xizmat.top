import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { CATEGORIES_LIST, STATUS_MAP, formatPrice, getBusinessPhoto, getCategoryMeta } from '../utils/helpers';
import { useLanguage } from '../context/LanguageContext';

// ─── AI Insights Panel ────────────────────────────────────────────────────────
const AIInsightsPanel = ({ businessId, businessName, language }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [open, setOpen]       = useState(false);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/ai-insights/${businessId}`, { language });
      setData(res.data);
      setOpen(true);
    } catch (e) {
      setError(e.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const label = {
    uz: { btn: '🤖 AI Tahlil', refresh: '🔄 Yangilash', strengths: '✅ Kuchli tomonlar', weaknesses: '⚠️ Zaif tomonlar', advice: '💡 Bugungi maslahatlar', stats: '📊 Statistika', busy: 'Band vaqt', quiet: 'Sokin vaqt', day: 'Eng band kun', services: 'Mashhur xizmatlar', provider: 'Tahlil qilindi', reviews: 'sharh', bookings: 'yozuv', revenue: 'daromad', rating: 'reyting' },
    ru: { btn: '🤖 AI Анализ', refresh: '🔄 Обновить', strengths: '✅ Сильные стороны', weaknesses: '⚠️ Слабые стороны', advice: '💡 Советы на сегодня', stats: '📊 Статистика', busy: 'Пик', quiet: 'Тихий час', day: 'Загруженный день', services: 'Топ услуги', provider: 'Анализ от', reviews: 'отзывов', bookings: 'записей', revenue: 'выручка', rating: 'рейтинг' },
    en: { btn: '🤖 AI Insights', refresh: '🔄 Refresh', strengths: '✅ Strengths', weaknesses: '⚠️ Weaknesses', advice: '💡 Today\'s advice', stats: '📊 Stats', busy: 'Peak hours', quiet: 'Quiet hours', day: 'Busiest day', services: 'Top services', provider: 'Analysis by', reviews: 'reviews', bookings: 'bookings', revenue: 'revenue', rating: 'rating' },
  }[language] || label?.uz;

  const L2 = label || {
    btn:'🤖 AI Tahlil', refresh:'🔄', strengths:'✅ Kuchli', weaknesses:'⚠️ Zaif', advice:'💡 Maslahat',
    stats:'📊 Statistika', busy:'Band', quiet:'Sokin', day:'Band kun', services:'Xizmatlar',
    provider:'Tahlil', reviews:'sharh', bookings:'yozuv', revenue:'daromad', rating:'reyting',
  };

  return (
    <div style={{ background: 'linear-gradient(135deg,#f0edff 0%,#e8f5fb 100%)', border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary),#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🤖</div>
          <div>
            <strong style={{ display: 'block', fontSize: '1rem' }}>AI Business Insights</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{businessName}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {data && <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>{L2.refresh}</button>}
          <button className="btn btn-sm" onClick={data ? () => setOpen(v => !v) : load} disabled={loading}
            style={{ background: 'linear-gradient(135deg,var(--primary),#8B5CF6)' }}>
            {loading ? '⏳ ...' : data ? (open ? '▲ Yopish' : '▼ Ko\'rish') : L2.btn}
          </button>
        </div>
      </div>

      {error && <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#FFF2F0', color: 'var(--danger)', borderRadius: 8, fontSize: '0.88rem' }}>{error}</div>}

      {/* Results */}
      {data && open && (
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Quick stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '0.65rem' }}>
            {[
              ['⭐', L2.rating, data.avgRating ? `${data.avgRating}/5` : '—'],
              ['📝', L2.reviews, data.totalReviews ?? '—'],
              ['📅', L2.bookings, data.totalBookings ?? '—'],
              ['💰', L2.revenue, data.revenue ? `${Number(data.revenue).toLocaleString('ru-RU')} so'm` : '—'],
              ['🕐', L2.busy, data.busyHour || '—'],
              ['😴', L2.quiet, data.quietHour || '—'],
            ].map(([icon, lbl, val]) => (
              <div key={lbl} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', lineHeight: 1 }}>{icon}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.15rem 0' }}>{lbl}</div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Busy day + top services */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            {data.busyDay && (
              <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{L2.day}</div>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>📆 {data.busyDay}</div>
              </div>
            )}
            {data.topServices && (
              <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{L2.services}</div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{data.topServices}</div>
              </div>
            )}
          </div>

          {/* Strengths */}
          {data.strengths?.length > 0 && (
            <div style={{ background: 'rgba(0,184,148,0.08)', border: '1px solid rgba(0,184,148,0.25)', borderRadius: 12, padding: '0.9rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '0.5rem', fontSize: '0.88rem' }}>{L2.strengths}</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {data.strengths.map((s, i) => <li key={i} style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {data.weaknesses?.length > 0 && (
            <div style={{ background: 'rgba(255,77,79,0.06)', border: '1px solid rgba(255,77,79,0.2)', borderRadius: 12, padding: '0.9rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.5rem', fontSize: '0.88rem' }}>{L2.weaknesses}</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {data.weaknesses.map((w, i) => <li key={i} style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Summary */}
          {data.summary && (
            <div style={{ background: 'rgba(90,32,255,0.07)', border: '1px solid rgba(90,32,255,0.18)', borderRadius: 12, padding: '0.9rem', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              🧠 {data.summary}
            </div>
          )}

          {/* Advice */}
          {data.advice?.length > 0 && (
            <div style={{ background: 'rgba(250,173,20,0.08)', border: '1px solid rgba(250,173,20,0.3)', borderRadius: 12, padding: '0.9rem' }}>
              <div style={{ fontWeight: 700, color: '#d48806', marginBottom: '0.6rem', fontSize: '0.88rem' }}>{L2.advice}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.advice.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ background: 'linear-gradient(135deg,var(--primary),#8B5CF6)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
            {L2.provider}: {data.provider === 'groq' ? 'Groq AI (Llama 3)' : 'HizmatTop Analytics'} · {new Date(data.generatedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

const assetUrl = (url) => {
  if (!url || /^https?:\/\//i.test(url)) return url;
  return `${api.defaults.baseURL.replace(/\/api\/?$/, '')}${url}`;
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const cityCenters = {
  Tashkent: [41.2995, 69.2401],
  Toshkent: [41.2995, 69.2401],
  Andijon: [40.7821, 72.3442],
  Samarkand: [39.6542, 66.9597],
  Samarqand: [39.6542, 66.9597],
  Bukhara: [39.7747, 64.4286],
  Buxoro: [39.7747, 64.4286],
  Fergana: [40.3842, 71.7843],
  Fargona: [40.3842, 71.7843],
  Namangan: [41.0011, 71.6683],
};

const MapRecenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13, { animate: true });
  }, [center, map]);
  return null;
};

const BusinessLocationPicker = ({ lat, lng, city, onSelect }) => {
  const selected = lat && lng ? [Number(lat), Number(lng)] : null;
  const center = selected || cityCenters[city] || cityCenters.Tashkent;

  const ClickHandler = () => {
    useMapEvents({
      click(event) {
        onSelect(event.latlng.lat.toFixed(6), event.latlng.lng.toFixed(6));
      },
    });
    return null;
  };

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <strong>Joylashuvni kartadan tanlang</strong>
        <span style={{ color: selected ? 'var(--success)' : 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {selected ? `${lat}, ${lng}` : 'Kartani bosing'}
        </span>
      </div>
      <div style={{ height: 320, overflow: 'hidden', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <MapRecenter center={center} />
          <ClickHandler />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {selected && <Marker position={selected} />}
        </MapContainer>
      </div>
    </div>
  );
};

const emptyBusinessForm = {
  name: '',
  description: '',
  category: 'barbershop',
  city: 'Tashkent',
  district: '',
  address: '',
  lat: '',
  lng: '',
  phone: '',
  photo: '',
  businessType: 'service',
};

const emptyServiceForm = {
  name: '',
  description: '',
  price: '',
  durationMinutes: '60',
  isActive: true,
  isFlashDeal: false,
  discountPrice: '',
  flashDealEndsAt: '',
  photo: '',
};

const emptyVirtualTourForm = {
  title: '',
  description: '',
  status: 'active',
  sortOrder: '0',
  previewImage: null,
  videoFile: null,
};

const allowedVirtualVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
const allowedVirtualVideoExts = ['.mp4', '.mov', '.webm'];

const hasAllowedVideoExt = (file) => {
  const name = file?.name?.toLowerCase() || '';
  return allowedVirtualVideoExts.some((ext) => name.endsWith(ext));
};

const isAllowedVirtualVideo = (file) => (
  Boolean(file) && hasAllowedVideoExt(file) && (!file.type || allowedVirtualVideoTypes.includes(file.type) || file.type.startsWith('video/'))
);

const getVideoMetadata = (file) => new Promise((resolve, reject) => {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    URL.revokeObjectURL(url);
    resolve({ duration: Number.isFinite(video.duration) ? video.duration : null });
  };
  video.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('Video faylni o\'qib bo\'lmadi'));
  };
  video.src = url;
});

const createVideoPreview = (file) => new Promise((resolve) => {
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const url = URL.createObjectURL(file);

  const cleanup = () => URL.revokeObjectURL(url);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';

  video.onloadedmetadata = () => {
    video.currentTime = Math.min(3, Math.max(0, (video.duration || 1) / 3));
  };

  video.onseeked = () => {
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      cleanup();
      if (!blob) return resolve(null);
      resolve(new File([blob], 'virtual-tour-preview.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.82);
  };

  video.onerror = () => {
    cleanup();
    resolve(null);
  };

  video.src = url;
});

const toBusinessForm = (business) => ({
  name: business.name || '',
  description: business.description || '',
  category: business.category || 'barbershop',
  city: business.city || 'Tashkent',
  district: business.district || '',
  address: business.address || '',
  lat: business.location?.coordinates?.[1] || '',
  lng: business.location?.coordinates?.[0] || '',
  phone: business.contacts?.phone || '',
  photo: business.photos?.[0] || '',
  businessType: business.businessType || 'service',
});

const toServiceForm = (service) => ({
  name: service.name || '',
  description: service.description || '',
  price: String(service.price || ''),
  durationMinutes: String(service.durationMinutes || 60),
  isActive: service.isActive !== false,
  isFlashDeal: Boolean(service.isFlashDeal),
  discountPrice: service.discountPrice ? String(service.discountPrice) : '',
  flashDealEndsAt: service.flashDealEndsAt ? service.flashDealEndsAt.slice(0, 16) : '',
  photo: service.photo || '',
});

const vrStatusMeta = {
  processing: { label: 'Processing', color: 'var(--primary)' },
  active: { label: 'Active', color: 'var(--success)' },
  inactive: { label: 'Inactive', color: 'var(--text-muted)' },
  failed: { label: 'Failed', color: 'var(--danger)' },
};

const Dashboard = () => {
  const { t, language } = useLanguage();
  const [myBusinesses, setMyBusinesses] = useState([]);
  const [bookings, setBookings] = useState({});
  const [vrTours, setVrTours] = useState({});
  const [virtualTourForms, setVirtualTourForms] = useState({});
  const [vrUploading, setVrUploading] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [businessForm, setBusinessForm] = useState(emptyBusinessForm);
  const [editingBusinessId, setEditingBusinessId] = useState(null);
  const [serviceForms, setServiceForms] = useState({});
  const [activeServiceBusinessId, setActiveServiceBusinessId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchBookings = useCallback(async (businessId) => {
    const res = await api.get(`/bookings/business/${businessId}`);
    setBookings((prev) => ({
      ...prev,
      [businessId]: res.data.sort((a, b) => new Date(b.date) - new Date(a.date)),
    }));
  }, []);

  const fetchVrTours = useCallback(async (businessId) => {
    const res = await api.get(`/business/${businessId}/virtual-tours/manage`);
    setVrTours((prev) => ({
      ...prev,
      [businessId]: res.data,
    }));
  }, []);

  const fetchMyBusinesses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/businesses/my');
      setMyBusinesses(res.data);
      await Promise.all(res.data.flatMap((business) => [
        fetchBookings(business._id),
        fetchVrTours(business._id),
      ]));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your businesses');
    } finally {
      setLoading(false);
    }
  }, [fetchBookings, fetchVrTours]);

  useEffect(() => {
    fetchMyBusinesses();
  }, [fetchMyBusinesses]);

  const allBookings = useMemo(() => Object.values(bookings).flat(), [bookings]);
  const stats = {
    revenue: allBookings.filter((item) => ['confirmed', 'completed'].includes(item.status)).reduce((sum, item) => sum + (item.totalPrice || 0), 0),
    pending: allBookings.filter((item) => item.status === 'pending').length,
    confirmed: allBookings.filter((item) => item.status === 'confirmed').length,
    cancelled: allBookings.filter((item) => ['cancelled', 'rejected'].includes(item.status)).length,
    services: myBusinesses.reduce((sum, business) => sum + (business.services?.length || 0), 0),
    rating: myBusinesses.length ? (myBusinesses.reduce((sum, business) => sum + (business.rating || 0), 0) / myBusinesses.length).toFixed(1) : '0.0',
  };

  const handleBusinessChange = (event) => {
    const { name, value } = event.target;
    setBusinessForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'city' && cityCenters[value] ? { lat: '', lng: '' } : {}),
    }));
  };

  const handleBusinessLocationSelect = (lat, lng) => {
    setBusinessForm((prev) => ({ ...prev, lat, lng }));
  };

  const businessPayload = () => ({
    name: businessForm.name,
    description: businessForm.description,
    category: businessForm.category,
    city: businessForm.city,
    district: businessForm.district,
    address: businessForm.address,
    coordinates: [Number(businessForm.lng), Number(businessForm.lat)],
    contacts: { phone: businessForm.phone },
    photos: businessForm.photo ? [businessForm.photo] : [],
    businessType: businessForm.businessType,
  });

  const handleSaveBusiness = async (event) => {
    event.preventDefault();
    if (!businessForm.lat || !businessForm.lng) {
      alert('Iltimos, biznes joylashuvini kartadan tanlang');
      return;
    }
    setSaving(true);
    try {
      if (editingBusinessId) {
        await api.put(`/businesses/${editingBusinessId}`, businessPayload());
      } else {
        await api.post('/businesses', businessPayload());
      }
      setBusinessForm(emptyBusinessForm);
      setEditingBusinessId(null);
      fetchMyBusinesses();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not save business');
    } finally {
      setSaving(false);
    }
  };

  const startEditBusiness = (business) => {
    setEditingBusinessId(business._id);
    setBusinessForm(toBusinessForm(business));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBusiness = async (businessId) => {
    if (!window.confirm(t('deleteBusinessConfirm'))) return;
    await api.delete(`/businesses/${businessId}`);
    fetchMyBusinesses();
  };

  const setServiceForm = (businessId, value) => {
    setServiceForms((prev) => ({ ...prev, [businessId]: value }));
  };

  const handleServiceChange = (businessId, event) => {
    const { name, value, type, checked } = event.target;
    setServiceForm(businessId, {
      ...(serviceForms[businessId] || emptyServiceForm),
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSaveService = async (event, businessId) => {
    event.preventDefault();
    const form = serviceForms[businessId] || emptyServiceForm;
    const payload = {
      businessId,
      name: form.name,
      description: form.description,
      price: Number(form.price),
      durationMinutes: Number(form.durationMinutes),
      isActive: form.isActive,
      isFlashDeal: form.isFlashDeal,
      discountPrice: form.isFlashDeal && form.discountPrice ? Number(form.discountPrice) : null,
      flashDealEndsAt: form.isFlashDeal ? form.flashDealEndsAt : null,
      photo: form.photo,
    };

    if (form._id) {
      await api.put(`/services/${form._id}`, payload);
    } else {
      await api.post('/services', payload);
    }
    setServiceForm(businessId, emptyServiceForm);
    setActiveServiceBusinessId(null);
    fetchMyBusinesses();
  };

  const startEditService = (businessId, service) => {
    setActiveServiceBusinessId(businessId);
    setServiceForm(businessId, { ...toServiceForm(service), _id: service._id });
  };

  const toggleService = async (businessId, service) => {
    await api.put(`/services/${service._id}`, { isActive: !service.isActive });
    fetchMyBusinesses();
  };

  const deleteService = async (serviceId) => {
    if (!window.confirm(t('deleteServiceConfirm'))) return;
    await api.delete(`/services/${serviceId}`);
    fetchMyBusinesses();
  };

  const updateBooking = async (bookingId, businessId, action) => {
    await api.patch(`/bookings/${bookingId}/${action}`);
    fetchBookings(businessId);
  };

  const handleVirtualTourFormChange = (businessId, event) => {
    const { name, value, files } = event.target;
    const file = files?.[0];
    if (name === 'previewImage' && file && !file.type.startsWith('image/')) {
      alert('Preview uchun faqat rasm yuklang');
      event.target.value = '';
      return;
    }
    if (name === 'videoFile' && file && !isAllowedVirtualVideo(file)) {
      alert('Oddiy telefon videosini MP4, MOV yoki WEBM formatida yuklang. HizmatTop uni Virtual ko\'rish formatiga tayyorlaydi.');
      event.target.value = '';
      return;
    }
    setVirtualTourForms((prev) => ({
      ...prev,
      [businessId]: {
        ...(prev[businessId] || emptyVirtualTourForm),
        [name]: files ? file : value,
      },
    }));
  };

  const uploadVrVideo = async (event, businessId) => {
    event.preventDefault();
    const form = virtualTourForms[businessId] || emptyVirtualTourForm;
    const file = form.videoFile;
    if (!file) return;
    if (!isAllowedVirtualVideo(file)) {
      alert('Oddiy telefon videosini MP4, MOV yoki WEBM formatida yuklang. HizmatTop uni Virtual ko\'rish formatiga tayyorlaydi.');
      return;
    }

    let metadata;
    try {
      metadata = await getVideoMetadata(file);
    } catch (err) {
      alert(err.message || 'Video faylni tekshirib bo\'lmadi');
      return;
    }

    if (metadata.duration && metadata.duration > 60) {
      alert('Video 60 soniyadan oshmasligi kerak');
      return;
    }

    const autoPreview = form.previewImage ? null : await createVideoPreview(file);
    const formData = new FormData();
    formData.append('title', form.title || 'Xona videosi');
    formData.append('description', form.description || '');
    formData.append('status', form.status || 'active');
    formData.append('sort_order', form.sortOrder || 0);
    formData.append('video_file', file);
    if (form.previewImage || autoPreview) formData.append('preview_image', form.previewImage || autoPreview);
    setVrUploading((prev) => ({ ...prev, [businessId]: true }));
    try {
      await api.post(`/business/${businessId}/virtual-tours`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setVirtualTourForms((prev) => ({ ...prev, [businessId]: emptyVirtualTourForm }));
      event.currentTarget.reset();
      await fetchVrTours(businessId);
    } catch (err) {
      await fetchVrTours(businessId);
      alert(err.response?.data?.message || 'Could not upload virtual tour video');
    } finally {
      setVrUploading((prev) => ({ ...prev, [businessId]: false }));
    }
  };

  const toggleVrTour = async (businessId, tour) => {
    await api.patch(`/business/${businessId}/virtual-tours/${tour._id}`, {
      status: tour.status === 'active' ? 'inactive' : 'active',
    });
    fetchVrTours(businessId);
  };

  const updateVrTourOrder = async (businessId, tour, sortOrder) => {
    await api.patch(`/business/${businessId}/virtual-tours/${tour._id}`, {
      sort_order: Number(sortOrder || 0),
    });
    fetchVrTours(businessId);
  };

  const deleteVrTour = async (businessId, tourId) => {
    if (!window.confirm(`${t('vrDelete')}?`)) return;
    await api.delete(`/business/${businessId}/virtual-tours/${tourId}`);
    fetchVrTours(businessId);
  };

  const getVrStatusLabel = (status) => ({
    processing: 'Processing',
    active: 'Active',
    inactive: 'Inactive',
    failed: 'Failed',
  }[status] || status);

  return (
    <div className="container animate-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ margin: '3rem 0 2rem' }}>
        <h1 style={{ margin: 0 }}>{t('dashTitle')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('dashSubtitle')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          [t('dashRevenue'), formatPrice(stats.revenue)],
          [t('dashPending'), stats.pending],
          [t('dashConfirmed'), stats.confirmed],
          [t('dashCancelled'), stats.cancelled],
          [t('dashServices'), stats.services],
          [t('dashAvgRating'), stats.rating],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSaveBusiness} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ marginTop: 0 }}>{editingBusinessId ? t('editBusiness') : t('createBusiness')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <input className="form-input" name="name" placeholder={t('businessName')} value={businessForm.name} onChange={handleBusinessChange} required />
          <select className="form-select" name="category" value={businessForm.category} onChange={handleBusinessChange}>
            {CATEGORIES_LIST.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
          <select className="form-select" name="businessType" value={businessForm.businessType} onChange={handleBusinessChange}>
            <option value="service">{t('businessTypeService')}</option>
            <option value="supplier">{t('businessTypeSupplier')}</option>
            <option value="both">{t('businessTypeBoth')}</option>
          </select>
          <input className="form-input" name="city" placeholder={t('city')} value={businessForm.city} onChange={handleBusinessChange} required />
          <input className="form-input" name="district" placeholder={t('district')} value={businessForm.district} onChange={handleBusinessChange} />
          <input className="form-input" name="address" placeholder={t('address')} value={businessForm.address} onChange={handleBusinessChange} required />
          <input className="form-input" name="phone" placeholder={t('phone')} value={businessForm.phone} onChange={handleBusinessChange} />
          <input className="form-input" name="photo" placeholder={t('photoUrl')} value={businessForm.photo} onChange={handleBusinessChange} />
          <textarea className="form-textarea" name="description" placeholder={t('descriptionLabel')} value={businessForm.description} onChange={handleBusinessChange} style={{ gridColumn: '1 / -1', minHeight: 90 }} />
          <BusinessLocationPicker
            lat={businessForm.lat}
            lng={businessForm.lng}
            city={businessForm.city}
            onSelect={handleBusinessLocationSelect}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button className="btn" disabled={saving}>{saving ? t('saving') : t('saveBusiness')}</button>
          {editingBusinessId && <button type="button" className="btn btn-outline" onClick={() => { setEditingBusinessId(null); setBusinessForm(emptyBusinessForm); }}>{t('cancel')}</button>}
        </div>
      </form>

      {loading && <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-xl)' }} />}
      {error && <div style={{ padding: '1rem', background: 'var(--danger)', color: '#fff', borderRadius: 'var(--radius)' }}>{error}</div>}

      {!loading && myBusinesses.map((business) => {
        const category = getCategoryMeta(business.category);
        const form = serviceForms[business._id] || emptyServiceForm;
        const businessBookings = bookings[business._id] || [];
        const businessVrTours = vrTours[business._id] || [];

        return (
          <section key={business._id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', marginBottom: '2rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '1.5rem', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img src={getBusinessPhoto(business)} alt={business.name} style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
                <div>
                  <h2 style={{ margin: '0 0 0.25rem' }}>{business.name}</h2>
                  <div style={{ color: 'var(--text-secondary)' }}>{category.label} | {business.address} | {business.status}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" onClick={() => startEditBusiness(business)}>{t('editBtn')}</button>
                <button className="btn btn-outline btn-sm" onClick={() => setActiveServiceBusinessId(activeServiceBusinessId === business._id ? null : business._id)}>{t('addService')}</button>
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDeleteBusiness(business._id)}>{t('deleteBtn')}</button>
              </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(340px, 1.5fr)', gap: '1.5rem' }} className="dash-business-grid">
              <div>
                {/* AI Insights Panel */}
                <AIInsightsPanel
                  businessId={business._id}
                  businessName={business.name}
                  language={language}
                />
                <h3>{t('dashServices')} ({business.services?.length || 0})</h3>
                {activeServiceBusinessId === business._id && (
                  <form onSubmit={(event) => handleSaveService(event, business._id)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
                    <input className="form-input" name="name" placeholder={t('businessName')} value={form.name} onChange={(event) => handleServiceChange(business._id, event)} required />
                    <input className="form-input" name="price" type="number" placeholder={t('dashRevenue')} value={form.price} onChange={(event) => handleServiceChange(business._id, event)} required style={{ marginTop: '0.75rem' }} />
                    <input className="form-input" name="durationMinutes" type="number" placeholder="Duration (min)" value={form.durationMinutes} onChange={(event) => handleServiceChange(business._id, event)} required style={{ marginTop: '0.75rem' }} />
                    <input className="form-input" name="photo" placeholder={t('photoUrl')} value={form.photo} onChange={(event) => handleServiceChange(business._id, event)} style={{ marginTop: '0.75rem' }} />
                    <input className="form-input" name="description" placeholder={t('descriptionLabel')} value={form.description} onChange={(event) => handleServiceChange(business._id, event)} style={{ marginTop: '0.75rem' }} />
                    <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}><input type="checkbox" name="isActive" checked={form.isActive} onChange={(event) => handleServiceChange(business._id, event)} /> {t('serviceActive')}</label>
                    <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}><input type="checkbox" name="isFlashDeal" checked={form.isFlashDeal} onChange={(event) => handleServiceChange(business._id, event)} /> Flash deal</label>
                    {form.isFlashDeal && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <input className="form-input" name="discountPrice" type="number" placeholder="Discount price" value={form.discountPrice} onChange={(event) => handleServiceChange(business._id, event)} />
                        <input className="form-input" name="flashDealEndsAt" type="datetime-local" value={form.flashDealEndsAt} onChange={(event) => handleServiceChange(business._id, event)} />
                      </div>
                    )}
                    <button className="btn btn-sm" style={{ marginTop: '0.75rem' }}>{form._id ? t('saveService') : t('addService')}</button>
                  </form>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {business.services?.map((service) => (
                    <div key={service._id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                          <strong>{service.name}</strong>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{service.durationMinutes} min | {service.isActive ? t('serviceActive') : t('serviceDisabled')}</div>
                        </div>
                        <strong>{formatPrice(service.discountPrice || service.price)}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => startEditService(business._id, service)}>{t('editBtn')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => toggleService(business._id, service)}>{service.isActive ? t('disableService') : t('enableService')}</button>
                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => deleteService(service._id)}>{t('deleteBtn')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1.5rem', background: 'var(--bg)' }}>
                  <h3 style={{ margin: '0 0 0.35rem' }}>{t('vrSection')}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Telefon kamerasi orqali xonani sekin va aniq video qiling. Kirish joyi, xona ichki ko'rinishi va asosiy xizmat joylarini ko'rsating. Video 20-60 soniya bo'lsin.
                  </p>

                  <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {["Xona yorug' bo'lsin", 'Telefonni sekin harakatlantiring', 'Kamera qimirlamasin', "Odamlar va shaxsiy hujjatlar ko'rinmasin", 'Har bir xona uchun alohida video yuklang'].map((tip) => (
                      <div key={tip}>- {tip}</div>
                    ))}
                  </div>

                  <form onSubmit={(event) => uploadVrVideo(event, business._id)} style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <label className="form-group" style={{ margin: 0 }}>
                      <span>Xona nomi</span>
                      <input className="form-input" name="title" placeholder="Masalan: Asosiy zal" value={(virtualTourForms[business._id] || emptyVirtualTourForm).title} onChange={(event) => handleVirtualTourFormChange(business._id, event)} />
                    </label>
                    <label className="form-group" style={{ margin: 0 }}>
                      <span>Qisqa tavsif</span>
                      <input className="form-input" name="description" placeholder="Xonaning qisqa ko'rinishi" value={(virtualTourForms[business._id] || emptyVirtualTourForm).description} onChange={(event) => handleVirtualTourFormChange(business._id, event)} />
                    </label>
                    <label className="form-group" style={{ margin: 0 }}>
                      <span>Tartib</span>
                      <input className="form-input" name="sortOrder" type="number" placeholder="0" value={(virtualTourForms[business._id] || emptyVirtualTourForm).sortOrder} onChange={(event) => handleVirtualTourFormChange(business._id, event)} />
                    </label>
                    <label className="form-group" style={{ margin: 0 }}>
                      <span>Holati</span>
                      <select className="form-select" name="status" value={(virtualTourForms[business._id] || emptyVirtualTourForm).status} onChange={(event) => handleVirtualTourFormChange(business._id, event)}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                    <label className="form-group" style={{ margin: 0 }}>
                      <span>Preview rasm ixtiyoriy</span>
                      <input className="form-input" name="previewImage" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleVirtualTourFormChange(business._id, event)} />
                    </label>
                    <label className="form-group" style={{ margin: 0 }}>
                      <span>Xona videosi MP4/MOV/WEBM</span>
                      <input className="form-input" name="videoFile" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={(event) => handleVirtualTourFormChange(business._id, event)} required />
                    </label>
                    <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Oddiy telefon videosini yuklang. HizmatTop uni Virtual ko'rish formatiga tayyorlaydi: preview, fullscreen player va VR ko'rish tugmasi avtomatik yaratiladi.
                    </div>
                    <button className="btn btn-sm" disabled={vrUploading[business._id]} style={{ gridColumn: '1 / -1' }}>
                      {vrUploading[business._id] ? t('vrUploading') : t('vrUploadVideo')}
                    </button>
                  </form>

                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {businessVrTours.length === 0 && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('vrNoTours')}</div>
                    )}
                    {businessVrTours.map((tour) => {
                      const meta = vrStatusMeta[tour.status] || vrStatusMeta.processing;
                      return (
                        <div key={tour._id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.85rem', background: 'var(--bg-card)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <div style={{ width: 92, height: 58, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#111827', color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                                {tour.previewImageUrl ? <img src={assetUrl(tour.previewImageUrl)} alt={tour.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 0 }} /> : 'No preview'}
                              </div>
                              <div>
                                <strong>{tour.title || "Xona videosi"}</strong>
                                <div style={{ color: meta.color, fontSize: '0.85rem', fontWeight: 700 }}>{getVrStatusLabel(tour.status)}</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                  {tour.mediaType} | {tour.durationSeconds ? `${tour.durationSeconds}s` : 'duration unknown'} | {new Date(tour.createdAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <input className="form-input" type="number" defaultValue={tour.sortOrder || 0} onBlur={(event) => updateVrTourOrder(business._id, tour, event.target.value)} style={{ width: 82, padding: '0.45rem 0.6rem' }} />
                              <button className="btn btn-outline btn-sm" onClick={() => toggleVrTour(business._id, tour)}>{tour.status === 'active' ? t('vrHide') : t('vrStatusActive')}</button>
                              <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => deleteVrTour(business._id, tour._id)}>{t('vrDelete')}</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <h3>{t('bookingsSection')} ({businessBookings.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {businessBookings.map((booking) => {
                    const status = STATUS_MAP[booking.status] || STATUS_MAP.pending;
                    return (
                      <div key={booking._id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <div>
                            <strong>{booking.user?.name || 'Guest'}</strong>
                            <div style={{ color: 'var(--primary)', fontWeight: 600 }}>{booking.service?.name}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{new Date(booking.date).toLocaleDateString()} | {booking.startTime}-{booking.endTime}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ color: status.color, fontWeight: 700 }}>{status.label}</span>
                            <div style={{ fontWeight: 800 }}>{formatPrice(booking.totalPrice)}</div>
                          </div>
                        </div>
                        {booking.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <button className="btn btn-sm" onClick={() => updateBooking(booking._id, business._id, 'confirm')}>{t('confirmBooking')}</button>
                            <button className="btn btn-outline btn-sm" onClick={() => updateBooking(booking._id, business._id, 'reject')}>{t('rejectBooking')}</button>
                          </div>
                        )}
                        {booking.status === 'confirmed' && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <button className="btn btn-sm" onClick={() => updateBooking(booking._id, business._id, 'complete')}>{t('completeBooking')}</button>
                            <button className="btn btn-outline btn-sm" onClick={() => updateBooking(booking._id, business._id, 'cancel')}>{t('cancelBookingOwner')}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default Dashboard;
