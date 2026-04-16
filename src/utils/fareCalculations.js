// ─── Philippine LTFRB Fare Rates ─────────────────────────────────────────────
//
// Jeepney (LTFRB MC 2023-016):
//   Base fare: ₱13.00 for first 4 km
//   Succeeding km: ₱1.80 per km
//
// Tricycle (LTFRB standard):
//   Base fare: ₱13.00 for first km
//   Succeeding km: ₱2.00 per km

export const calculateJeepneyFare = (distanceKm) => {
  const BASE_FARE = 13.00
  const BASE_KM   = 4
  const PER_KM    = 1.80
  if (distanceKm <= BASE_KM) return BASE_FARE
  return BASE_FARE + (distanceKm - BASE_KM) * PER_KM
}

export const calculateTricycleFare = (distanceKm) => {
  const BASE_FARE = 13.00
  const BASE_KM   = 1
  const PER_KM    = 2.00
  if (distanceKm <= BASE_KM) return BASE_FARE
  return BASE_FARE + (distanceKm - BASE_KM) * PER_KM
}

export const calculateFareByVehicle = (distanceKm, vehicle) => {
  let raw
  switch (vehicle) {
    case 'jeepney':  raw = calculateJeepneyFare(distanceKm);  break
    case 'tricycle': raw = calculateTricycleFare(distanceKm); break
    default:         raw = calculateJeepneyFare(distanceKm);  break
  }
  // Round to 2 decimal places
  return Math.round(raw * 100) / 100
}
