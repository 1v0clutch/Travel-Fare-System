// Vehicle restriction utilities

import { VEHICLES } from '../constants/vehicles';

export const isVehicleAvailable = (vehicle, distanceKm) => {
  const vehicleInfo = VEHICLES[vehicle];
  
  if (!vehicleInfo) return true;
  
  // If maxDistance is null, no restriction
  if (vehicleInfo.maxDistance === null) return true;
  
  // Check if distance is within limit
  return distanceKm <= vehicleInfo.maxDistance;
};

export const getRestrictionErrorMessage = (vehicle, distanceKm) => {
  const vehicleInfo = VEHICLES[vehicle];
  
  if (!vehicleInfo || vehicleInfo.maxDistance === null) {
    return `${vehicle} not available for this route`;
  }
  
  return `${vehicleInfo.name} is restricted to ${vehicleInfo.maxDistance}km maximum. Current route: ${distanceKm}km`;
};

export const requiresMarkerClick = (vehicle) => {
  const vehicleInfo = VEHICLES[vehicle];
  return vehicleInfo?.requiresMarker || false;
};
