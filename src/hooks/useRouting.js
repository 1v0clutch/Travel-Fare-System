import { useState, useCallback } from 'react';
import { calculateFareByVehicle } from '../utils/fareCalculations';
import { isVehicleAvailable, getRestrictionErrorMessage } from '../utils/vehicleRestrictions';

export const useRouting = () => {
  const [routeCards, setRouteCards] = useState([]);
  const [routeControls, setRouteControls] = useState([]);
  const [routeMarkers, setRouteMarkers] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  const createRouteCard = useCallback((segment, distanceKm, timeMinutes) => {
    const fare = calculateFareByVehicle(parseFloat(distanceKm), segment.vehicle);
    
    return {
      id: segment.id,
      vehicle: segment.vehicle,
      distance: distanceKm,
      time: timeMinutes,
      fare: fare,
      timestamp: Date.now(),
      type: 'single',
      visible: true
    };
  }, []);

  const addRouteCard = useCallback((card, control, markers) => {
    setRouteCards(prev => [...prev, card]);
    setRouteControls(prev => [...prev, { id: card.id, control }]);
    if (markers) {
      setRouteMarkers(prev => [...prev, { id: card.id, markers }]);
    }
  }, []);

  const removeRouteCard = useCallback((cardId, map) => {
    // Remove routing control
    const routeControlIndex = routeControls.findIndex(control => control.id === cardId);
    if (routeControlIndex !== -1 && map) {
      const controlToRemove = routeControls[routeControlIndex].control;
      try {
        if (controlToRemove.remove) {
          controlToRemove.remove();
        } else {
          map.removeControl(controlToRemove);
        }
      } catch (e) {
        console.log('Error removing route control:', e);
      }
      setRouteControls(prev => prev.filter(control => control.id !== cardId));
    }

    // Remove markers
    const markersToRemove = routeMarkers.filter(m => m.id === cardId);
    if (map && markersToRemove.length > 0) {
      markersToRemove.forEach(markerObj => {
        markerObj.markers.forEach(marker => {
          try {
            map.removeLayer(marker);
          } catch (e) {
            console.log('Error removing marker:', e);
          }
        });
      });
      setRouteMarkers(prev => prev.filter(m => m.id !== cardId));
    }

    // Remove card
    setRouteCards(prev => prev.filter(card => card.id !== cardId));

    // Clear route info if needed
    setRouteInfo(prev => {
      if (prev && prev.vehicle) {
        const removedCard = routeCards.find(c => c.id === cardId);
        if (removedCard && prev.vehicle === removedCard.vehicle) {
          return null;
        }
      }
      return prev;
    });
  }, [routeCards, routeControls, routeMarkers]);

  const toggleRouteVisibility = useCallback((cardId, map) => {
    const card = routeCards.find(c => c.id === cardId);
    if (!card || !map) return;

    const newVisibility = !card.visible;
    const routeControl = routeControls.find(control => control.id === cardId);

    if (routeControl) {
      try {
        if (newVisibility) {
          if (routeControl.control._line) {
            routeControl.control._line.addTo(map);
          } else {
            routeControl.control.addTo(map);
          }
        } else {
          if (routeControl.control._line) {
            map.removeLayer(routeControl.control._line);
          } else {
            map.removeControl(routeControl.control);
          }
        }
      } catch (e) {
        console.log('Error toggling route:', e);
      }
    }

    // Toggle markers
    const markers = routeMarkers.find(m => m.id === cardId);
    if (markers) {
      markers.markers.forEach(marker => {
        if (newVisibility) {
          marker.addTo(map);
        } else {
          map.removeLayer(marker);
        }
      });
    }

    setRouteCards(prev => prev.map(c => 
      c.id === cardId ? { ...c, visible: newVisibility } : c
    ));
  }, [routeCards, routeControls, routeMarkers]);

  const clearAllRoutes = useCallback((map) => {
    if (map) {
      routeControls.forEach(routeControl => {
        try {
          if (routeControl.control.remove) {
            routeControl.control.remove();
          } else {
            map.removeControl(routeControl.control);
          }
        } catch (e) {
          console.log('Error removing route control:', e);
        }
      });

      routeMarkers.forEach(markerObj => {
        markerObj.markers.forEach(marker => {
          try {
            map.removeLayer(marker);
          } catch (e) {
            console.log('Error removing marker:', e);
          }
        });
      });
    }

    setRouteCards([]);
    setRouteControls([]);
    setRouteMarkers([]);
  }, [routeControls, routeMarkers]);

  const validateRoute = useCallback((vehicle, distanceKm) => {
    if (!isVehicleAvailable(vehicle, parseFloat(distanceKm))) {
      return {
        valid: false,
        error: getRestrictionErrorMessage(vehicle, distanceKm)
      };
    }
    return { valid: true };
  }, []);

  return {
    routeCards,
    routeInfo,
    isCalculatingRoute,
    setRouteInfo,
    setIsCalculatingRoute,
    createRouteCard,
    addRouteCard,
    removeRouteCard,
    toggleRouteVisibility,
    clearAllRoutes,
    validateRoute
  };
};
