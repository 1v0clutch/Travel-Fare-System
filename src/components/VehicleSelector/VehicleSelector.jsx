import React from 'react';
import { VEHICLE_TYPES, getVehicleInfo } from '../../constants/vehicles';
import './VehicleSelector.css';

const VehicleSelector = ({ 
  selectedVehicle, 
  isVehicleActive, 
  currentSegment,
  isCalculatingRoute,
  onVehicleSelect 
}) => {
  return (
    <div className="vehicle-selection-card">
      <div className="card-content">
        <div className="vehicle-grid">
          {VEHICLE_TYPES.map((vehicle) => {
            const vehicleInfo = getVehicleInfo(vehicle);
            const isSelected = selectedVehicle === vehicle && isVehicleActive;
            
            return (
              <div key={vehicle} className="vehicle-container">
                <button 
                  className={`vehicle-option ${isSelected ? 'active' : ''}`}
                  onClick={() => onVehicleSelect(vehicle)}
                >
                  <span className="vehicle-icon">{vehicleInfo.icon}</span>
                </button>
                {isSelected && currentSegment && (
                  <div className="route-status">
                    {isCalculatingRoute ? "Calculating route..." : (
                      <>
                        {currentSegment.waypoints.length === 0 && 
                          (vehicle === 'plane' ? "Click airport marker" : 
                           vehicle === 'boat' ? "Click port marker" : "Click Point A")}
                        {currentSegment.waypoints.length === 1 && 
                          (vehicle === 'plane' ? "Click airport marker" : 
                           vehicle === 'boat' ? "Click port marker" : "Click Point B")}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VehicleSelector;
