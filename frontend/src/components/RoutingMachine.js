import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

export default function RoutingMachine({ start, end, onRouteFound }) {
  const map = useMap();

  const startLat = start?.[0];
  const startLng = start?.[1];
  const endLat = end?.[0];
  const endLng = end?.[1];

  useEffect(() => {
    if (!startLat || !startLng || !endLat || !endLng) return;

    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(startLat, startLng),
        L.latLng(endLat, endLng)
      ],
      lineOptions: {
        styles: [{ color: '#2563EB', weight: 4 }]
      },
      show: false, // Don't show the turn-by-turn panel
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      createMarker: () => null, // don't create default markers since we manage them
    }).addTo(map);

    routingControl.on('routesfound', function(e) {
      if (onRouteFound) {
        var routes = e.routes;
        var summary = routes[0].summary;
        // distance in meters, time in seconds
        onRouteFound({
          distance: summary.totalDistance,
          time: summary.totalTime
        });
      }
    });

    return () => {
      if (map && routingControl) {
        map.removeControl(routingControl);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, startLat, startLng, endLat, endLng]);

  return null;
}
