import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryMeta, DAY_NAMES, isOpenNow, formatPrice, calculateDistance } from '../utils/helpers';
import useGeolocation from '../hooks/useGeolocation';
import RoutingMachine from '../components/RoutingMachine';
import VirtualTourModal from '../components/VirtualTourModal';

const isFlashActive = (svc) => {
  if (!svc || !svc.isFlashDeal || svc.discountPrice == null || !svc.flashDealEndsAt) return false;
  return new Date(svc.flashDealEndsAt) > new Date();
};

const assetUrl = (url) => {
  if (!url || /^https?:\/\//i.test(url)) return url;
  return `${api.defaults.baseURL.replace(/\/api\/?$/, '')}${url}`;
};

const BusinessDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [virtualTours, setVirtualTours] = useState([]);
  const [virtualTourModal, setVirtualTourModal] = useState({ open: false, initialTourId: null });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  
  const [selectedService, setSelectedService] = useState(null);
  const [bookingForm, setBookingForm] = useState({ date: todayStr });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMsg, setBookingMsg] = useState({ type: '', text: '' });
  
  // Phase 6: Booking Modal State
  const [showModal, setShowModal] = useState(false);
  const [bookingSuccessData, setBookingSuccessData] = useState(null);

  // Geolocation and Routing state
  const { location: userLocation, error: geoError, loading: isLocating, requestLocation } = useGeolocation();
  const [buildRouteLocal, setBuildRouteLocal] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);

  // Review form state
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMsg, setReviewMsg] = useState({ type: '', text: '' });
  const [userHasReview, setUserHasReview] = useState(false);

  useEffect(() => {
    // Check if coming from "Route" button anywhere else, or we just rely on local state
    if (buildRouteLocal && !userLocation && !isLocating) {
       requestLocation();
    }
  }, [buildRouteLocal, userLocation, isLocating, requestLocation]);

  useEffect(() => {
    const fetchBusiness = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/businesses/${id}`);
        setBusiness(res.data.business);
        setServices(res.data.services);
        setReviews(res.data.reviews);
        // Check if logged-in user already left a review
        if (user) {
          setUserHasReview(res.data.reviews.some(r => r.user?._id === user._id));
        }
        const vrRes = await api.get(`/business/${id}/virtual-tours`);
        setVirtualTours(vrRes.data || []);
        
        if (res.data.business?.category) {
            const simRes = await api.get(`/businesses?category=${res.data.business.category}`);
            const other = simRes.data.filter(b => b._id !== res.data.business._id).slice(0, 3);
            setSimilar(other);
        }
      } catch (err) {
        setError('Batafsil ma\'lumotni yuklashda xatolik yuz berdi.');
      } finally {
        setLoading(false);
      }
    };
    fetchBusiness();
  }, [id]);

  useEffect(() => {
    const fetchSlots = async () => {
      setSelectedSlot(null);
      if (!selectedService || !bookingForm.date) {
        setTimeSlots([]);
        return;
      }

      setSlotsLoading(true);
      try {
        const res = await api.get(`/bookings/slots/${selectedService._id}`, { params: { date: bookingForm.date } });
        setTimeSlots(res.data);
      } catch (err) {
        setTimeSlots([]);
        setBookingMsg({ type: 'error', text: 'Mavjud vaqtlarni yuklashda xatolik yuz berdi' });
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchSlots();
  }, [bookingForm.date, selectedService]);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!selectedService) { setBookingMsg({ type: 'error', text: 'Iltimos, xizmatni tanlang' }); return; }
    if (!selectedSlot) { setBookingMsg({ type: 'error', text: 'Iltimos, vaqtni tanlang' }); return; }
    
    setBookingMsg({ type: '', text: '' });
    setBookingLoading(true);

    try {
      const slot = timeSlots.find(item => item.time === selectedSlot);
      const endTime = slot?.endTime;
      if (!endTime) {
        setBookingMsg({ type: 'error', text: 'Tanlangan vaqt mavjud emas' });
        return;
      }

      const res = await api.post('/bookings', {
        businessId: id,
        serviceId: selectedService._id,
        date: bookingForm.date,
        startTime: selectedSlot,
        endTime: endTime,
      });

      setBookingSuccessData({ ...res.data, serviceName: selectedService.name });
      setShowModal(true);
    } catch (err) {
      setBookingMsg({ type: 'error', text: err.response?.data?.message || 'Band qilishda xatolik yuz berdi' });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!user) { navigate('/login'); return; }
    try {
      await api.post('/chat/conversations', { businessId: id });
      navigate('/chat');
    } catch (err) {
      alert(err.response?.data?.message || 'Chatni ochishda xatolik yuz berdi');
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) { setReviewMsg({ type: 'error', text: t('reviewLoginRequired') }); return; }
    setReviewLoading(true);
    setReviewMsg({ type: '', text: '' });
    try {
      const res = await api.post(`/businesses/${id}/reviews`, reviewForm);
      // Prepend or replace the user's existing review
      setReviews(prev => {
        const without = prev.filter(r => r.user?._id !== user._id);
        return [res.data, ...without];
      });
      setUserHasReview(true);
      setReviewMsg({ type: 'success', text: t('reviewSuccess') });
      setReviewForm({ rating: 5, comment: '' });
    } catch (err) {
      setReviewMsg({ type: 'error', text: err.response?.data?.message || t('reviewError') });
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container animate-in">
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius)', marginBottom: '2rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          <div>
            <div className="skeleton skeleton-text" style={{ width: '60%', height: 40, marginBottom: '1rem' }} />
            <div className="skeleton skeleton-text" style={{ height: 200 }} />
          </div>
          <div className="skeleton" style={{ height: 500, borderRadius: 'var(--radius)' }} />
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <h2>{t('nothingFound')}</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{t('notFoundHint')}</p>
        <button className="btn btn-outline" onClick={() => navigate('/')}>{t('goHome')}</button>
      </div>
    );
  }

  const position = business.location?.coordinates ? [business.location.coordinates[1], business.location.coordinates[0]] : [41.2995, 69.2401];
  const meta = getCategoryMeta(business.category);
  const openStatus = isOpenNow(business.workingHours);

  let currentDistance = null;
  if (userLocation) {
     currentDistance = calculateDistance(userLocation.lat, userLocation.lng, position[0], position[1]);
  }

  // Close today if we're past the working hours
  const dayIndex = new Date().getDay();
  const dayKey = Object.keys(DAY_NAMES)[dayIndex === 0 ? 6 : dayIndex - 1] || 'monday';
  const closeTimeStr = business.workingHours?.[dayKey]?.close;
  return (
    <div className="container">
      <VirtualTourModal
        tours={virtualTours}
        initialTourId={virtualTourModal.initialTourId}
        isOpen={virtualTourModal.open}
        onClose={() => setVirtualTourModal({ open: false, initialTourId: null })}
      />
      
      {/* ===== PHASE 6: BOOKING SUCCESS MODAL ===== */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
           <div className="animate-in" style={{ background: '#fff', borderRadius: 'var(--radius-xl)', padding: '2.5rem', maxWidth: '450px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
             <div style={{ width: 80, height: 80, background: 'var(--success-light)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', margin: '0 auto 1.5rem' }}>✅</div>
             <h2 style={{ marginBottom: '0.5rem' }}>{t('bookingSuccess')}</h2>
             <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{business.name} {t('bookingSuccessMsg')}</p>
             
             <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', textAlign: 'left', marginBottom: '2rem', border: '1px solid var(--border)' }}>
               <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{t('bookingService')}</div>
               <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1rem' }}>{bookingSuccessData?.serviceName}</div>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{t('date')}</div>
                    <div style={{ fontWeight: 600 }}>{new Date(bookingSuccessData?.date).toLocaleDateString('ru-RU')}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{t('time')}</div>
                    <div style={{ fontWeight: 600 }}>{bookingSuccessData?.startTime}</div>
                  </div>
               </div>

               <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{t('bookingTotal')}</div>
               <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>{formatPrice(bookingSuccessData?.totalPrice)}</div>
             </div>

             <button className="btn btn-lg" style={{ width: '100%' }} onClick={() => { setShowModal(false); navigate('/profile'); }}>{t('bookingGoProfile')}</button>
           </div>
        </div>
      )}

      <div className="animate-in">
        <div style={{ margin: '2rem 0' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Asosiy / {meta.label} / <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{business.name}</span></span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2.5rem', alignItems: 'start' }}>
          
          {/* ===== LEFT COLUMN ===== */}
          <div>
            {/* Gallery */}
            <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '2rem', aspectRatio: '16/9', border: '1px solid var(--border)' }}>
               <img src={business.photos?.[0] || 'https://placehold.co/800x450'} alt={business.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            {/* Header Info */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.85rem', fontWeight: 600 }}>
                  {meta.icon} {meta.label}
                </span>
                {openStatus !== null && (
                  <span className={openStatus ? 'status-open' : 'status-closed'} style={{ fontWeight: 600 }}>
                    <span className="status-dot" style={{ width: 10, height: 10 }} />
                    {openStatus ? `Ochiq ${closeTimeStr ? `soat ${closeTimeStr} gacha` : ''}` : 'Hozir yopiq'}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{business.name}</h1>
              
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>⭐ <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{(business.rating || 0).toFixed(1)}</span> ({business.reviewCount || 0} sharh)</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📍 {business.city}, {business.address}</div>
                 {currentDistance && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 600 }}>🧭 {(currentDistance).toFixed(1)} km masofada</div>
                 )}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--divider)', margin: '2rem 0' }} />

            {/* Description */}
            {business.description && (
              <div style={{ marginBottom: '2.5rem' }}>
                <h3>{t('description')}</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '1.05rem', margin: 0 }}>{business.description}</p>
              </div>
            )}

            {/* Virtual Tour */}
            {virtualTours.length > 0 && (
              <div style={{ marginBottom: '2.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.35rem' }}>{t('virtualTour')}</h3>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('virtualTourDesc')}</p>
                  </div>
                  <button className="btn" onClick={() => setVirtualTourModal({ open: true, initialTourId: virtualTours[0]._id })}>{t('openVR')}</button>
                </div>

                <div className="virtual-tour-card-grid">
                  {virtualTours.map((tour) => (
                    <div className="virtual-tour-card" key={tour._id}>
                      <button
                        type="button"
                        className="virtual-tour-card-preview"
                        onClick={() => setVirtualTourModal({ open: true, initialTourId: tour._id })}
                        style={{ border: 0, width: '100%', cursor: 'pointer' }}
                      >
                        {tour.previewImageUrl ? (
                          <img src={assetUrl(tour.previewImageUrl)} alt={tour.title || "Virtual ko'rish"} />
                        ) : (
                          <span>VR ko'rish</span>
                        )}
                      </button>
                      <div className="virtual-tour-card-body">
                        <strong>{tour.title || "Xonani ko'rish"}</strong>
                        {tour.description && <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>{tour.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Services List as Cards */}
            <div style={{ marginBottom: '2.5rem' }}>
               <h3 style={{ marginBottom: '1.5rem' }}>{t('selectService')}</h3>
               {services.length === 0 ? <p>{t('noServices')}</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {services.map(svc => (
                      <div 
                        key={svc._id} 
                        style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                          padding: '1.5rem', background: 'var(--bg-card)', 
                          border: `2px solid ${selectedService?._id === svc._id ? 'var(--primary)' : 'var(--border)'}`, 
                          borderRadius: 'var(--radius-lg)',
                          boxShadow: selectedService?._id === svc._id ? 'var(--shadow-card)' : 'none',
                          transition: 'all 0.2s', cursor: 'pointer'
                        }}
                        onClick={() => setSelectedService(svc)}
                      >
                         <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <h4 style={{ margin: 0, fontSize: '1.15rem', color: selectedService?._id === svc._id ? 'var(--primary)' : 'var(--text-primary)' }}>{svc.name}</h4>
                              {isFlashActive(svc) && (
                                <span style={{ fontSize: '0.75rem', background: 'var(--danger)', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                  🔥 -{Math.round((1 - svc.discountPrice / svc.price) * 100)}%
                                </span>
                              )}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{svc.description}</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>⏱ {svc.durationMinutes} daq</div>
                         </div>
                         <div style={{ textAlign: 'right' }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                              {isFlashActive(svc) ? (
                                <>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'line-through', marginBottom: '0.1rem' }}>{formatPrice(svc.price)}</div>
                                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }}>{formatPrice(svc.discountPrice)}</div>
                                </>
                              ) : (
                                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{formatPrice(svc.price)}</div>
                              )}
                            </div>
                            <button className={`btn btn-sm ${selectedService?._id === svc._id ? '' : 'btn-outline'}`} style={{ minWidth: '100px' }}>
                               {selectedService?._id === svc._id ? t('selected') : t('select')}
                            </button>
                         </div>
                      </div>
                    ))}
                  </div>
               )}
            </div>

            {/* Map & Routing */}
            <div style={{ marginBottom: '3rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>{t('addressMap')}</h3>
                  {!buildRouteLocal ? (
                    <button className="btn btn-sm" onClick={() => setBuildRouteLocal(true)} disabled={isLocating}>
                      {isLocating ? t('locating') : `🚗 ${t('buildRoute')}`}
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-outline" onClick={() => { setBuildRouteLocal(false); setRouteInfo(null); }}>
                      ✕ {t('cancelRoute')}
                    </button>
                  )}
               </div>

               {geoError && (
                 <div style={{ padding: '0.5rem', background: '#FFF2F0', color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1rem', borderRadius: '4px' }}>
                   ⚠️ {geoError}
                 </div>
               )}

               {routeInfo && (
                  <div style={{ padding: '1rem', background: 'var(--primary-light)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '1rem', display: 'flex', gap: '2rem' }}>
                     <div><strong>{t('routeDistance')}:</strong> {(routeInfo.distance / 1000).toFixed(1)} km</div>
                     <div><strong>{t('routeTime')}:</strong> {Math.round(routeInfo.time / 60)} {t('routeMinutes')}</div>
                  </div>
               )}

               <div style={{ height: '350px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', zIndex: 1, position: 'relative' }}>
                  <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={position} />
                    {userLocation && (
                       <Marker position={[userLocation.lat, userLocation.lng]} />
                    )}
                    {buildRouteLocal && userLocation && (
                       <RoutingMachine 
                          start={[userLocation.lat, userLocation.lng]} 
                          end={position} 
                          onRouteFound={setRouteInfo} 
                       />
                    )}
                  </MapContainer>
               </div>
            </div>

            {/* Reviews Section */}
            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>{t('reviews')}</h3>

              {/* Review submission form */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem' }}>{t('writeReview')}</h4>

                {!user ? (
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    {t('reviewLoginRequired')}{' '}
                    <button className="btn btn-sm btn-outline" onClick={() => navigate('/login')}>{t('login')}</button>
                  </p>
                ) : (
                  <form onSubmit={handleSubmitReview}>
                    {reviewMsg.text && (
                      <div style={{
                        padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
                        marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500,
                        background: reviewMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                        color: '#fff',
                      }}>
                        {reviewMsg.text}
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>{t('reviewRating')}</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewForm(f => ({ ...f, rating: star }))}
                            style={{
                              fontSize: '1.75rem', background: 'none', border: 'none',
                              cursor: 'pointer', padding: '0',
                              filter: star <= reviewForm.rating ? 'none' : 'grayscale(1) opacity(0.4)',
                              transition: 'filter 0.15s',
                            }}
                            aria-label={`${star} star`}
                          >
                            ⭐
                          </button>
                        ))}
                        <span style={{ alignSelf: 'center', fontWeight: 700, color: 'var(--primary)', marginLeft: '0.5rem' }}>
                          {reviewForm.rating}/5
                        </span>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>{t('reviewComment')}</label>
                      <textarea
                        className="form-textarea"
                        placeholder={t('reviewCommentPlaceholder')}
                        value={reviewForm.comment}
                        onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                        rows={3}
                        style={{ minHeight: 80 }}
                      />
                    </div>

                    <button className="btn" type="submit" disabled={reviewLoading}>
                      {reviewLoading ? t('reviewSubmitting') : (userHasReview ? t('reviewSubmit') + ' ✏️' : t('reviewSubmit'))}
                    </button>
                    {userHasReview && (
                      <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {t('reviewAlreadyLeft')}
                      </span>
                    )}
                  </form>
                )}
              </div>

              {/* Existing reviews list */}
              {reviews.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>{t('noReviews')}</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  {reviews.map(rev => (
                    <div key={rev._id} style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 600 }}>{rev.user?.name || 'Mehmon'}</span>
                        <span style={{ fontWeight: 700 }}>⭐ {rev.rating}</span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== RIGHT COLUMN (STICKY) ===== */}
          <div style={{ position: 'sticky', top: '100px' }}>
            <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-dropdown)' }}>
               <h3 style={{ margin: '0 0 1.5rem' }}>{t('bookingTitle')}</h3>
               
               {bookingMsg.text && (
                 <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', background: bookingMsg.type==='error' ? 'var(--danger)' : 'var(--success)', color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                   {bookingMsg.text}
                 </div>
               )}

               <form onSubmit={handleBooking}>
                 
                 {/* 1. Date */}
                 <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>{t('bookingDate')}</label>
                    <input className="form-input" type="date" min={todayStr} value={bookingForm.date} onChange={e => setBookingForm({...bookingForm, date: e.target.value})} required />
                 </div>

                 {/* 2. Time Slots (Phase 5) */}
                 <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {t('bookingSlots')}
                      {selectedService && <span style={{ color: 'var(--primary)' }}>({selectedService.durationMinutes} {t('bookingMinutes')})</span>}
                    </label>
                    
                    {slotsLoading ? (
                       <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('bookingSlotsLoading')}</div>
                    ) : !selectedService ? (
                       <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('bookingSelectService')}</div>
                    ) : timeSlots.length === 0 ? (
                       <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('bookingNoSlots')}</div>
                    ) : (
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                          {timeSlots.map(slot => (
                             <button
                               key={slot.time}
                               type="button"
                               disabled={slot.disabled}
                               onClick={() => setSelectedSlot(slot.time)}
                               style={{
                                 padding: '0.75rem 0', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.95rem', cursor: slot.disabled ? 'not-allowed' : 'pointer', border: '1px solid',
                                 borderColor: selectedSlot === slot.time ? 'var(--primary)' : 'var(--border)',
                                 background: selectedSlot === slot.time ? 'var(--primary)' : (slot.disabled ? 'var(--bg)' : '#fff'),
                                 color: selectedSlot === slot.time ? '#fff' : (slot.disabled ? 'var(--text-muted)' : 'var(--text-primary)'),
                                 opacity: slot.disabled ? 0.6 : 1, transition: 'all 0.2s'
                               }}
                             >
                               {slot.time}
                             </button>
                          ))}
                       </div>
                    )}
                 </div>

                 {/* Total and Submit */}
                 <div style={{ borderTop: '1px solid var(--divider)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                       <span style={{ fontWeight: 600 }}>{t('bookingService')}</span>
                       <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedService ? selectedService.name : t('bookingNotSelected')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                       <span style={{ fontWeight: 600 }}>{t('bookingTotal')}</span>
                       <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                          {selectedService 
                            ? formatPrice(isFlashActive(selectedService) ? selectedService.discountPrice : selectedService.price) 
                            : '0 UZS'}
                       </span>
                    </div>
                 </div>

                 <button 
                   type="submit" 
                   className="btn btn-lg" 
                   style={{ width: '100%', borderRadius: 'var(--radius-full)' }}
                   disabled={bookingLoading || !selectedService || !selectedSlot}
                 >
                    {bookingLoading ? t('bookingSubmitting') : t('bookingSubmit')}
                 </button>
                 <button
                   type="button"
                   className="btn btn-lg btn-outline"
                   style={{ width: '100%', borderRadius: 'var(--radius-full)', marginTop: '0.75rem' }}
                   onClick={handleStartChat}
                 >
                   {t('chatWithOwner')}
                 </button>
               </form>
            </div>
          </div>
        </div>
        
        {/* ===== PHASE 4: SIMILAR BUSINESSES ===== */}
        {similar.length > 0 && (
          <div style={{ margin: '4rem 0' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{t('similarBusinesses')}</h2>
            <div className="grid">
               {similar.map(biz => {
                 const simMeta = getCategoryMeta(biz.category);
                 return (
                   <div key={biz._id} className="card" onClick={() => { navigate(`/business/${biz._id}`); window.scrollTo(0,0); }} style={{ cursor: 'pointer' }}>
                     <div className="card-img-wrapper" style={{ aspectRatio: '16/9' }}>
                        <img className="card-img" src={biz.photos?.[0] || 'https://placehold.co/400x200'} alt={biz.name} />
                     </div>
                     <div className="card-content">
                        <div className="card-category">{simMeta.label}</div>
                        <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{biz.name}</h4>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                           <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>⭐ {(biz.rating || 0).toFixed(1)}</span>
                           <span>{formatPrice(biz.minPrice)}</span>
                        </div>
                     </div>
                   </div>
                 );
               })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BusinessDetail;
