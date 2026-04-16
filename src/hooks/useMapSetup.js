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
        // Disable default left-click drag — we use left-click for routing.
        // Right-click drag is handled via contextmenu + mousemove below.
        map.current = window.L.map(mapContainer.current, {
          dragging: false,       // disable default left-drag
          scrollWheelZoom: true,
          doubleClickZoom: true,
          boxZoom: false,
          contextmenu: false,
        }).setView([12.8797, 121.7740], 6);

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

        // ── Right-click drag implementation ──────────────────────────────────
        // Track right-mouse-button drag manually on the map container element.
        const container = mapContainer.current;
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        const onMouseDown = (e) => {
          if (e.button !== 2) return; // right button only
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
          // Pan the map by the pixel delta
          map.current.panBy([-dx, -dy], { animate: false });
        };

        const onMouseUp = (e) => {
          if (e.button !== 2) return;
          isDragging = false;
          container.style.cursor = '';
        };

        const onContextMenu = (e) => {
          // Suppress the browser context menu when right-clicking on the map
          e.preventDefault();
        };

        container.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        container.addEventListener('contextmenu', onContextMenu);

        // Store cleanup refs on the map object for teardown
        map.current._rightDragCleanup = () => {
          container.removeEventListener('mousedown', onMouseDown);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          container.removeEventListener('contextmenu', onContextMenu);
        };

        // Signal that the map is ready so click handlers can attach
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
