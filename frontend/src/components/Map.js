import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import RoutingMachine from './RoutingMachine';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryMeta, formatPrice } from '../utils/helpers';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MapController = ({ center }) => {
  const map = useMap();
  React.useEffect(() => {
    if (center) map.setView(center, 14, { animate: true });
  }, [center, map]);
  return null;
};

const defaultCenter = [41.2995, 69.2401];

const Map = ({ businesses, userLocation, buildRouteTarget, onRouteFound, requestLocation, isLocating }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const mapCenter = buildRouteTarget
    ? buildRouteTarget
    : userLocation
    ? [userLocation.lat, userLocation.lng]
    : defaultCenter;

  return (
    <div style={{ position: 'relative', height: '500px', width: '100%' }}>
      {requestLocation && (
        <button
          className="btn btn-sm"
          onClick={requestLocation}
          disabled={isLocating}
          style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          {isLocating
            ? t('mapLocating')
            : userLocation
            ? `📍 ${t('mapMyLocation')}`
            : `📍 ${t('mapLocate')}`}
        </button>
      )}

      <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
        <MapController center={mapCenter} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />

        {businesses.map((biz) => {
          // Guard against null/zero coordinates
          const coords = biz.location?.coordinates;
          if (!coords || !coords[0] || !coords[1]) return null;
          const lat = Number(coords[1]);
          const lng = Number(coords[0]);
          if (!isFinite(lat) || !isFinite(lng)) return null;

          const meta = getCategoryMeta(biz.category);

          return (
            <Marker key={biz._id} position={[lat, lng]}>
              <Popup>
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: '0.4rem' }}>{biz.name}</h3>
                  <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#636E72' }}>
                    {meta.icon} {meta.label}
                  </p>
                  <p style={{ margin: '0.2rem 0' }}>{biz.address}</p>
                  {biz.minPrice > 0 && (
                    <p style={{ margin: '0.2rem 0' }}>
                      <b>{t('mapPriceFrom')}</b> {formatPrice(biz.minPrice)}
                    </p>
                  )}
                  <button
                    className="btn btn-sm"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => navigate(`/business/${biz._id}`)}
                  >
                    {t('mapDetails')}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>
                <strong>📍 {t('mapYouAreHere')}</strong>
              </Popup>
            </Marker>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={300}
              pathOptions={{ color: '#E17055', fillColor: '#E17055', fillOpacity: 0.1 }}
            />
          </>
        )}

        {userLocation && buildRouteTarget && (
          <RoutingMachine
            start={[userLocation.lat, userLocation.lng]}
            end={buildRouteTarget}
            onRouteFound={onRouteFound}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default Map;
