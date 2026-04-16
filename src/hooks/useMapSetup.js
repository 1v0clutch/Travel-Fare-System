import { useEffect } from 'react';

export const useMapSetup = (mapContainer, map, onReady) => {
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
        const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        map.current = window.L.map(mapContainer.current, {
          // On touch: enable native drag. On desktop: disable (we use right-click drag).
          dragging: isTouchDevice,
          tap: false,              // disable Leaflet's tap handler — causes shaking on mobile
          tapTolerance: 15,
          touchZoom: true,
          bounceAtZoomLimits: false,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          boxZoom: false,
          contextmenu: false,
        }).setView([12.8797, 121.7740], 6);

        // Smoother touch zoom on mobile
        if (isTouchDevice && map.current.touchZoom) {
          map.current.touchZoom.enable();
        }

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

        // ── Right-click drag (desktop only) ──────────────────────────────────
        const container = mapContainer.current;
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        const onMouseDown = (e) => {
          if (e.button !== 2) return;
          isDragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          container.style.cursor = 'grabbing';
          e.preventDefault();
        };

        const onMouseMove = (e) => {
          if (!isDragging) return;
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
          map.current.panBy([-dx, -dy], { animate: false });
        };

        const onMouseUp = (e) => {
          if (e.button !== 2) return;
          isDragging = false;
          container.style.cursor = '';
        };

        const onContextMenu = (e) => e.preventDefault();

        if (!isTouchDevice) {
          container.addEventListener('mousedown', onMouseDown);
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
          container.addEventListener('contextmenu', onContextMenu);
        }

        map.current._rightDragCleanup = () => {
          container.removeEventListener('mousedown', onMouseDown);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          container.removeEventListener('contextmenu', onContextMenu);
        };

        if (onReady) onReady(true);
      }
    };
    document.head.appendChild(script);

    return () => {
      if (map.current) {
        if (map.current._rightDragCleanup) map.current._rightDragCleanup();
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
};
