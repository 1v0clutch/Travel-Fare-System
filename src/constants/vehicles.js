export const VEHICLES = {
  jeepney: { 
    icon: '🚌', 
    name: 'Jeepney',
    maxDistance: 100,
    color: '#6FA1EC'
  },
  tricycle: { 
    icon: '🛺', 
    name: 'Tricycle',
    maxDistance: 20,
    color: '#FF9F43'
  }
};

export const VEHICLE_TYPES = Object.keys(VEHICLES);

export const getVehicleInfo = (vehicleType) => {
  return VEHICLES[vehicleType] || VEHICLES.jeepney;
};
