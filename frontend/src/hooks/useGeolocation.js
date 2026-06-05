import { useState, useCallback } from 'react';

const useGeolocation = () => {
  const [location, setLocation] = useState(null); // { lat, lng }
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(() => {
    setLoading(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolokatsiya bu brauzerda qo`llab-quvvatlanmaydi.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
             setError('Joylashuvni aniqlashga ruxsat berilmadi.');
             break;
          case err.POSITION_UNAVAILABLE:
             setError('Joylashuv ma`lumotlari mavjud emas.');
             break;
          case err.TIMEOUT:
             setError('So`rov vaqti tugadi.');
             break;
          default:
             setError('Noma`lum xatolik yuz berdi.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  return { location, error, loading, requestLocation };
};

export default useGeolocation;
