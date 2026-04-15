// Vehicle restriction utilities — no distance caps, OSRM handles road-only routing

export const isVehicleAvailable = () => true;

export const getRestrictionErrorMessage = (vehicle, distanceKm) =>
  `${vehicle} not available for this route (${distanceKm}km)`;
