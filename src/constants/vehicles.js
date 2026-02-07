// Vehicle configuration and metadata
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
  },
  taxi: { 
    icon: '🚕', 
    name: 'Taxi',
    maxDistance: 50,
    color: '#FFD93D'
  },
  bus: { 
    icon: '🚍', 
    name: 'Bus',
    maxDistance: 300,
    color: '#28A745'
  },
  motorcycle: { 
    icon: '🏍️', 
    name: 'Motorcycle',
    maxDistance: 100,
    color: '#FF6B6B'
  },
  boat: { 
    icon: '🚤', 
    name: 'Boat',
    maxDistance: null, // No restriction
    color: '#4ECDC4',
    requiresMarker: true
  },
  plane: { 
    icon: '✈️', 
    name: 'Plane',
    maxDistance: null, // No restriction
    color: '#A8E6CF',
    requiresMarker: true
  }
};

export const VEHICLE_TYPES = Object.keys(VEHICLES);

export const getVehicleInfo = (vehicleType) => {
  return VEHICLES[vehicleType] || VEHICLES.jeepney;
};
