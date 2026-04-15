import { useEffect } from 'react';
import { airports, piers, trainStations } from '../constants/locations';

export const useSpecialMarkers = (
  selectedVehicle,
  isVehicleActive,
  map,
  airportMarkers,
  setAirportMarkers,
  pierMarkers,
  setPierMarkers
) => {
  useEffect(() => {
    if (selectedVehicle && isVehicleActive && map.current) {
      showVehicleSpecificMarkers(selectedVehicle);
    } else {
      clearSpecialMarkers();
    }
  }, [selectedVehicle, isVehicleActive]);

  const showVehicleSpecificMarkers = (vehicle) => {
    if (!map.current || !window.L) return;

    clearSpecialMarkers();

    if (vehicle === 'plane') {
      const newAirportMarkers = airports.map(airport => {
        const marker = window.L.marker([airport.lat, airport.lng], {
          icon: window.L.divIcon({
            html: '<div style="background: rgba(168, 230, 207, 0.95); border: 3px solid #A8E6CF; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 12px rgba(168, 230, 207, 0.6); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform=\'scale(1.2)\'; this.style.boxShadow=\'0 6px 16px rgba(168, 230, 207, 0.8)\';" onmouseout="this.style.transform=\'scale(1)\'; this.style.boxShadow=\'0 4px 12px rgba(168, 230, 207, 0.6)\';">✈️</div>',
            className: 'airport-marker-container',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          })
        })
        .addTo(map.current)
        .bindPopup(`<strong>${airport.name}</strong><br><small>Click to select this airport</small>`);
        
        marker.airportData = airport;
        return marker;
      });
      setAirportMarkers(newAirportMarkers);
      
    } else if (vehicle === 'boat') {
      const newPierMarkers = piers.map(pier => {
        const marker = window.L.marker([pier.lat, pier.lng], {
          icon: window.L.divIcon({
            html: '<div style="background: rgba(78, 205, 196, 0.95); border: 3px solid #4ECDC4; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 12px rgba(78, 205, 196, 0.6); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform=\'scale(1.2)\'; this.style.boxShadow=\'0 6px 16px rgba(78, 205, 196, 0.8)\';" onmouseout="this.style.transform=\'scale(1)\'; this.style.boxShadow=\'0 4px 12px rgba(78, 205, 196, 0.6)\';">⚓</div>',
            className: 'pier-marker-container',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          })
        })
        .addTo(map.current)
        .bindPopup(`<strong>${pier.name}</strong><br><small>Click to select this port</small>`);
        
        marker.pierData = pier;
        return marker;
      });
      setPierMarkers(newPierMarkers);
      
    } else if (vehicle === 'train') {
      const newTrainMarkers = trainStations.map(station => {
        const marker = window.L.marker([station.lat, station.lng], {
          icon: window.L.divIcon({
            html: '<div style="background: rgba(255, 179, 71, 0.95); border: 3px solid #FFB347; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 12px rgba(255, 179, 71, 0.6); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform=\'scale(1.2)\'; this.style.boxShadow=\'0 6px 16px rgba(255, 179, 71, 0.8)\';" onmouseout="this.style.transform=\'scale(1)\'; this.style.boxShadow=\'0 4px 12px rgba(255, 179, 71, 0.6)\';">🚆</div>',
            className: 'train-marker-container',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          })
        })
        .addTo(map.current)
        .bindPopup(`<strong>${station.name}</strong><br><small>${station.line}</small><br><small>Click to select this station</small>`);
        
        marker.stationData = station;
        return marker;
      });
      setAirportMarkers(newTrainMarkers);
    }
  };

  const clearSpecialMarkers = () => {
    if (!map.current) return;
    
    if (airportMarkers && airportMarkers.length > 0) {
      airportMarkers.forEach(marker => {
        try {
          if (marker && map.current.hasLayer(marker)) {
            map.current.removeLayer(marker);
          }
        } catch (e) {
          console.log('Error removing airport marker:', e);
        }
      });
    }
    setAirportMarkers([]);

    if (pierMarkers && pierMarkers.length > 0) {
      pierMarkers.forEach(marker => {
        try {
          if (marker && map.current.hasLayer(marker)) {
            map.current.removeLayer(marker);
          }
        } catch (e) {
          console.log('Error removing pier marker:', e);
        }
      });
    }
    setPierMarkers([]);
  };
};
