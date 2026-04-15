// Fare calculation utilities

export const calculateJeepneyFare = (distanceKm) => {
  if (distanceKm <= 3) return 13;
  return 13 + (distanceKm - 3) * 1;
};

export const calculateTricycleFare = (distanceKm) => {
  if (distanceKm <= 1) return 15;
  if (distanceKm > 1) return (distanceKm - 1) * 15;
};

export const calculateFareByVehicle = (distanceKm, vehicle) => {
  switch (vehicle) {
    case 'jeepney': return Math.round(calculateJeepneyFare(distanceKm) * 100) / 100;
    case 'tricycle': return Math.round(calculateTricycleFare(distanceKm) * 100) / 100;
    default: return Math.round(calculateJeepneyFare(distanceKm) * 100) / 100;
  }
};
