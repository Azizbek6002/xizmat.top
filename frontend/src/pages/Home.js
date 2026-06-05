import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Map from '../components/Map';
import BusinessCard from '../components/BusinessCard';
import FlashDealCard from '../components/FlashDealCard';
import HeroBackground from '../components/HeroBackground';
import { CATEGORIES_LIST, isOpenNow, calculateDistance } from '../utils/helpers';
import useGeolocation from '../hooks/useGeolocation';
import { useLanguage } from '../context/LanguageContext';

const Home = () => {
  const { t } = useLanguage();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [flashDeals, setFlashDeals] = useState([]);
  const [flashDealsLoading, setFlashDealsLoading] = useState(true);

  // Geolocation & Routing
  const { location: userLocation, error: geoError, loading: isLocating, requestLocation } = useGeolocation();
  const [buildRouteTarget, setBuildRouteTarget] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  
  // Computed nearest services
  const [nearestBusinesses, setNearestBusinesses] = useState([]);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ 
    category: '', 
    city: '', 
    district: '',
    minRating: 0,
    openNow: false,
    sortBy: 'popular'
  });

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.city) params.city = filters.city;
      if (filters.district) params.district = filters.district;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/businesses', { params });
      let data = res.data;

      if (filters.minRating > 0) {
        data = data.filter(b => (b.rating || 0) >= filters.minRating);
      }
      if (filters.openNow) {
        data = data.filter(b => isOpenNow(b.workingHours));
      }

      data.sort((a, b) => {
        if (filters.sortBy === 'price_asc') return a.minPrice - b.minPrice;
        if (filters.sortBy === 'price_desc') return b.minPrice - a.minPrice;
        if (filters.sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        const popA = (a.rating || 0) * (a.reviewCount || 0);
        const popB = (b.rating || 0) * (b.reviewCount || 0);
        return popB - popA;
      });

      setBusinesses(data);
    } catch (err) {
      console.error('Failed to load businesses', err);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery]);

  const fetchFlashDeals = async () => {
    try {
      // First try admin-promoted deals, fallback to service-level flash deals
      const [promoRes, flashRes] = await Promise.allSettled([
        api.get('/admin/promoted-deals'),
        api.get('/services/flash-deals'),
      ]);
      const promos = promoRes.status === 'fulfilled' ? promoRes.value.data : [];
      const flashes = flashRes.status === 'fulfilled' ? flashRes.value.data : [];
      // Merge: promos first, then regular flash deals (deduplicate by service id)
      const promoServiceIds = new Set(promos.map(p => p.service?._id));
      const combined = [...promos, ...flashes.filter(f => !promoServiceIds.has(f._id))];
      setFlashDeals(combined);
    } catch (err) {
      console.error('Failed to load flash deals', err);
    } finally {
      setFlashDealsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashDeals();
    fetchBusinesses();
  }, [fetchBusinesses]);

  // Compute nearest businesses whenever businesses or user location changes
  useEffect(() => {
    if (businesses.length > 0 && userLocation) {
      const withDistance = businesses.map(biz => {
        const dist = calculateDistance(
          userLocation.lat, userLocation.lng,
          biz.location.coordinates[1], biz.location.coordinates[0]
        );
        return { ...biz, distance: dist };
      });
      withDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      setNearestBusinesses(withDistance.slice(0, 4));
    }
  }, [businesses, userLocation]);

  const handleRouteFound = (info) => {
    setRouteInfo(info);
  };

  const handleBuildRoute = (biz) => {
    if (!userLocation) {
      requestLocation();
      return;
    }
    setBuildRouteTarget([biz.location.coordinates[1], biz.location.coordinates[0]]);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const clearRoute = () => {
    setBuildRouteTarget(null);
    setRouteInfo(null);
  };


  const handleSearch = (e) => {
    e.preventDefault();
    fetchBusinesses();
  };

  const handleChangeFilter = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters({ ...filters, [name]: type === 'checkbox' ? checked : value });
  };

  return (
    <div>
      {/* ===== CLEAN HERO ===== */}
      <section className="hero-wrapper">
        <HeroBackground />
        <div className="container animate-in hero-content">
          <h1 className="hero-title">{t('heroTitle')}</h1>
          <p className="hero-subtitle">{t('heroSubtitle')}</p>
          
          <form className="hero-search-box" style={{ borderColor: 'var(--primary)', borderWidth: 2, borderStyle: 'solid', borderRadius: 'var(--radius)', display: 'flex', overflow: 'hidden' }} onSubmit={handleSearch}>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '1rem', border: 'none', outline: 'none' }}
            />
            <button className="btn" type="submit" style={{ borderRadius: 0 }}>{t('searchBtn')}</button>
          </form>

          <div className="category-icons-row">
             <button 
                className={`category-icon-btn ${filters.category === '' ? 'active' : ''}`}
                onClick={() => setFilters({...filters, category: ''})}
             >
                <div className="icon-circle">🔥</div>
                <span>{t('allCategories')}</span>
             </button>
             {CATEGORIES_LIST.map(cat => (
               <button 
                  key={cat.key}
                  className={`category-icon-btn ${filters.category === cat.key ? 'active' : ''}`}
                  onClick={() => setFilters({...filters, category: cat.key})}
               >
                  <div className="icon-circle">{cat.icon}</div>
                  <span>{cat.label}</span>
               </button>
             ))}
          </div>
        </div>
      </section>

      <div className="container">
        {/* ===== FILTERS ===== */}
        <div className="section animate-in animate-in-delay-1" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <select name="city" value={filters.city} onChange={handleChangeFilter} className="filter-input" style={{ width: 'auto', minWidth: '150px' }}>
              <option value="">{t('allCities')}</option>
              <option value="Tashkent">Toshkent</option>
              <option value="Andijon">Andijon</option>
              <option value="Samarkand">Samarqand</option>
              <option value="Fergana">Farg'ona</option>
              <option value="Namangan">Namangan</option>
              <option value="Bukhara">Buxoro</option>
            </select>
            <select name="district" value={filters.district} onChange={handleChangeFilter} className="filter-input" style={{ width: 'auto', minWidth: '180px' }}>
              <option value="">{t('allDistricts')}</option>
              <option value="Mirzo Ulugbek">Mirzo Ulug'bek</option>
              <option value="Chilonzor">Chilonzor</option>
              <option value="Yunusobod">Yunusobod</option>
              <option value="Yakkasaroy">Yakkasaroy</option>
              <option value="Shaykhantahur">Shayxontohur</option>
            </select>
            <select name="sortBy" value={filters.sortBy} onChange={handleChangeFilter} className="filter-input" style={{ width: 'auto', minWidth: '200px' }}>
              <option value="popular">{t('sortPopular')}</option>
              <option value="rating">{t('sortRating')}</option>
              <option value="price_asc">{t('sortPriceAsc')}</option>
              <option value="price_desc">{t('sortPriceDesc')}</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, marginLeft: 'auto', cursor: 'pointer' }}>
              <input type="checkbox" name="openNow" checked={filters.openNow} onChange={handleChangeFilter} style={{ width: '18px', height: '18px' }} />
              {t('openNow')}
            </label>
          </div>
        </div>

        {/* ===== FLASH DEALS SECTION ===== */}
        {(!flashDealsLoading && flashDeals.length > 0) && (
          <section className="deals-showcase section animate-in">
            <div className="deals-showcase-header">
              <span className="deals-kicker">Special offers</span>
              <h2>{t('flashDeals')}</h2>
            </div>
            <div className="deals-grid">
              {flashDeals.slice(0, 4).map(deal => (
                <FlashDealCard key={deal._id} deal={deal} />
              ))}
            </div>
          </section>
        )}

        {loading && (
          <div className="grid">
             {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '320px', borderRadius: 'var(--radius)' }} />)}
          </div>
        )}

        {/* ===== LOCATION ERROR/INFO ===== */}
        {geoError && (
          <div style={{ background: '#FFF2F0', color: 'var(--danger)', padding: '1rem', borderRadius: 'var(--radius-sm)', margin: '1rem 0' }}>
            ⚠️ {geoError}
          </div>
        )}

        {/* ===== NEAREST BUSINESSES ===== */}
        {userLocation && nearestBusinesses.length > 0 && (
           <div className="section animate-in" style={{ marginTop: '3rem' }}>
             <div className="section-header">
                <h2>📍 {t('nearbyServices')}</h2>
             </div>
             <div className="grid">
               {nearestBusinesses.map(biz => (
                 <BusinessCard 
                   key={biz._id} 
                   business={biz} 
                   onBuildRoute={() => handleBuildRoute(biz)}
                 />
               ))}
             </div>
           </div>
        )}

        {!loading && businesses.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <h2>{t('nothingFound')}</h2>
              <p style={{ color: 'var(--text-secondary)' }}>{t('nothingFoundHint')}</p>
           </div>
        ) : (
           <div className="section animate-in animate-in-delay-2">
             <div className="section-header">
                <h2>{searchQuery || filters.category ? t('searchResults') : t('popularNearby')}</h2>
                <span style={{ color: 'var(--text-secondary)' }}>{businesses.length}{t('resultsCount')}</span>
             </div>
             <div className="grid">
               {businesses.map(biz => {
                 // optionally compute distance for all cards if location exists
                 let dist = null;
                 if (userLocation) {
                   dist = calculateDistance(userLocation.lat, userLocation.lng, biz.location.coordinates[1], biz.location.coordinates[0]);
                 }
                 return (
                   <BusinessCard 
                     key={biz._id} 
                     business={{...biz, distance: dist}} 
                     onBuildRoute={() => handleBuildRoute(biz)}
                   />
                 );
               })}
             </div>
           </div>
        )}

        {/* MAP SECTION AND ROUTE INFO */}
        {!loading && businesses.length > 0 && (
           <div className="section animate-in animate-in-delay-3" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
             
             {/* Route Info Header */}
             {buildRouteTarget && routeInfo && (
                <div style={{ padding: '1rem', background: 'var(--primary-light)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div>
                     <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>🚗 {t('routeBuilt')}:</strong>
                     <span style={{ marginLeft: '1rem' }}>{t('routeDistance')}: <b>{(routeInfo.distance / 1000).toFixed(1)} km</b></span>
                     <span style={{ marginLeft: '1rem' }}>{t('routeTime')}: <b>{Math.round(routeInfo.time / 60)} {t('routeMinutes')}</b></span>
                   </div>
                   <button className="btn btn-sm btn-outline" onClick={clearRoute}>✕ {t('routeClose')}</button>
                </div>
             )}

             <Map 
               businesses={businesses} 
               userLocation={userLocation}
               buildRouteTarget={buildRouteTarget}
               onRouteFound={handleRouteFound}
               requestLocation={requestLocation}
               isLocating={isLocating}
             />
           </div>
        )}
      </div>
    </div>
  );
};

export default Home;
