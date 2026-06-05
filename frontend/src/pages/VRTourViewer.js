import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useLanguage } from '../context/LanguageContext';

const VRTourViewer = () => {
  const { tourId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTour = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/vr-tours/${tourId}`);
        setTour(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load 3D/VR tour');
      } finally {
        setLoading(false);
      }
    };
    fetchTour();
  }, [tourId]);

  const getStatusText = (status) => ({
    uploaded: t('vrStatusUploaded'),
    queued: t('vrStatusQueued'),
    processing: t('vrStatusProcessing'),
    ready: t('vrStatusReady'),
    published: t('vrStatusPublished'),
    failed: t('vrStatusFailed'),
    archived: t('vrStatusArchived'),
  }[status] || status);

  if (loading) {
    return (
      <div className="container animate-in" style={{ padding: '3rem 0' }}>
        <div className="skeleton" style={{ height: 520, borderRadius: 'var(--radius-xl)' }} />
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <h2>{t('vrTitle')}</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error || 'This tour is not available.'}</p>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>{t('vrBackToBusiness')}</button>
      </div>
    );
  }

  return (
    <div className="container animate-in" style={{ padding: '2rem 0 3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.35rem' }}>HizmatTop {t('vrTitle')}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{getStatusText(tour.status)}</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate(`/business/${tour.businessId}`)}>{t('vrBackToBusiness')}</button>
      </div>

      <section style={{ minHeight: 560, borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', overflow: 'hidden', background: '#07111f', position: 'relative' }}>
        {tour.resultType === 'external_url' && tour.resultUrl ? (
          <iframe title="3D/VR tour viewer" src={tour.resultUrl} style={{ width: '100%', height: 620, border: 0 }} />
        ) : (
          <div style={{ minHeight: 560, display: 'grid', placeItems: 'center', color: '#fff', padding: '2rem', textAlign: 'center', background: 'radial-gradient(circle at 35% 30%, rgba(20,184,166,0.5), transparent 28%), radial-gradient(circle at 70% 55%, rgba(37,99,235,0.55), transparent 32%), linear-gradient(135deg, #07111f, #0f172a)' }}>
            <div style={{ maxWidth: 720 }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>3D</div>
              <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>AI 3D/VR Tour Generator</h2>
              <p style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.7 }}>
                {t('vrViewerPlaceholder')}
              </p>
              <div style={{ marginTop: '2rem', height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                <div style={{ width: `${tour.processingProgress || 0}%`, height: '100%', background: '#14b8a6' }} />
              </div>
            </div>
          </div>
        )}
      </section>

      <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <span>Result type: {tour.resultType}</span>
        <span>Progress: {tour.processingProgress || 0}%</span>
      </div>
    </div>
  );
};

export default VRTourViewer;
