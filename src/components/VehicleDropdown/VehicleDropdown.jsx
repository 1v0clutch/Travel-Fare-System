import './VehicleDropdown.css';

const VehicleDropdown = ({ 
  selectedVehicle, 
  isVehicleActive, 
  isCalculatingRoute,
  currentSegment,
  onVehicleSelect,
  onCancelVehicle,
  getVehicleInfo 
}) => {
  return (
    <div className="vehicle-selection-card">
      <div className="card-content">
        <div className="vehicle-dropdown-container">
          <label htmlFor="vehicle-select" className="dropdown-label">
            Select Transportation Mode
          </label>
          <div className="dropdown-row">
            <select 
              id="vehicle-select"
              className="vehicle-dropdown"
              value={selectedVehicle || ''}
              onChange={(e) => { if (e.target.value) onVehicleSelect(e.target.value); }}
              disabled={isVehicleActive}
            >
              <optgroup label="= Vehicle type =">
                <option value="jeepney">🚌 Jeepney</option>
                <option value="tricycle">🛺 Tricycle</option>
              </optgroup>
            </select>
            {isVehicleActive && selectedVehicle && !isCalculatingRoute && (
              <button
                className="cancel-vehicle-btn"
                onClick={onCancelVehicle}
                title="Cancel and choose another vehicle"
              >
              </button>
            )}
          </div>
          
          {isVehicleActive && selectedVehicle && currentSegment && (
            <div className="route-status-box">
              {isCalculatingRoute ? (
                <span className="status-text calculating">⏳ Calculating route...</span>
              ) : (
                <span className="status-text">
                  {currentSegment.waypoints.length === 0 ? '📍 Click Point A on the map' : '📍 Click Point B on the map'}
                </span>
              )}
            </div>
          )}
          
          {selectedVehicle && isVehicleActive && (
            <div className="selected-vehicle-info">
              <span className="vehicle-badge">
                {getVehicleInfo(selectedVehicle).icon} {getVehicleInfo(selectedVehicle).name}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VehicleDropdown;
