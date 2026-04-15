import { useEffect } from 'react';

export const useMapSetup = (mapContainer, map) => {
  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      if (mapContainer.current && !map.current) {
        map.current = window.L.map(mapContainer.current).setView([12.8797, 121.7740], 6);

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map.current);

        // Restrict to Philippines
        const philippinesBounds = window.L.latLngBounds(
          window.L.latLng(4.5, 116.0),
          window.L.latLng(21.0, 127.0)
        );
        map.current.setMaxBounds(philippinesBounds);
        map.current.setMinZoom(5);
        map.current.setMaxZoom(18);
      }
    };
    document.head.appendChild(script);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
};
