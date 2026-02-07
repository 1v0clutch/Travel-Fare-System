// Fare calculation utilities for different vehicle types

export const calculateJeepneyFare = (distanceKm) => {
  if (distanceKm <= 3) {
    return 13; // Base fare for first 3km
  }
  const additionalKm = distanceKm - 3;
  return 13 + (additionalKm * 1);
};

export const calculateTricycleFare = (distanceKm) => {
  if (distanceKm <= 1) {
    return 15; // Base fare for first 1km
  }
  const additionalKm = distanceKm - 1;
  return 15 + (additionalKm * 10);
};

export const calculateTaxiFare = (distanceKm) => {
  return distanceKm * 14; // 14 pesos per km
};

export const calculateBusFare = (distanceKm) => {
  if (distanceKm <= 3) {
    return 15; // Base fare for first 3km
  }
  const additionalKm = distanceKm - 3;
  return 15 + (additionalKm * 1);
};

export const calculateMotorcycleFare = (distanceKm) => {
  if (distanceKm <= 2) {
    return 50; // Base fare for first 2km
  }
  const additionalKm = distanceKm - 2;
  return 50 + (additionalKm * 10);
};

export const calculateBoatFare = (distanceKm) => {
  if (distanceKm <= 10) {
    return 50; // Base fare for first 10km
  }
  const additionalKm = distanceKm - 10;
  return 50 + (additionalKm * 5);
};

export const calculatePlaneFare = (distanceKm) => {
  const baseFare = 2500; // Base domestic fare
  const distanceFactor = Math.max(0, distanceKm - 100) * 2;
  return baseFare + distanceFactor;
};

export const calculateFareByVehicle = (distanceKm, vehicle) => {
  let fare;
  
  switch (vehicle) {
    case 'jeepney':
      fare = calculateJeepneyFare(distanceKm);
      break;
    case 'tricycle':
      fare = calculateTricycleFare(distanceKm);
      break;
    case 'taxi':
      fare = calculateTaxiFare(distanceKm);
      break;
    case 'bus':
      fare = calculateBusFare(distanceKm);
      break;
    case 'motorcycle':
      fare = calculateMotorcycleFare(distanceKm);
      break;
    case 'boat':
      fare = calculateBoatFare(distanceKm);
      break;
    case 'plane':
      fare = calculatePlaneFare(distanceKm);
      break;
    default:
      fare = calculateJeepneyFare(distanceKm);
  }
  
  // Round to 2 decimal places
  return Math.round(fare * 100) / 100;
};
