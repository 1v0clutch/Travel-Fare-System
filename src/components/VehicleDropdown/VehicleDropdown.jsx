import './VehicleDropdown.css';

const VEHICLES = [
  { value: 'jeepney',  icon: '🚌', name: 'Jeepney',  desc: 'Km-based fare' },
  { value: 'tricycle', icon: '🛺', name: 'Tricycle', desc: 'Km-based fare' },
];

const VehicleDropdown = ({
  selectedVehicle,
  isVehicleActive,
  isCalculatingRoute,
  currentSegment,
  routeComplete,
  onVehicleSelect,
  onCancelVehicle,
  getVehicleInfo,
}) => {
  const selected = VEHICLES.find(v => v.value === selectedVehicle);

  // Once a route is complete, collapse to a compact "done" chip
  if (routeComplete && !isVehicleActive) {
    return (
      <div className="vd-card vd-done">
        <div className="vd-done-row">
          <span className="vd-done-icon">{selected?.icon || '🚌'}</span>
          <span className="vd-done-name">{selected?.name || 'Vehicle'}</span>
          <span className="vd-done-tag">Route complete</span>
        </div>
      </div>
    )
  }

  return (
    <div className="vd-card">
      <div className="vd-label">Transportation Mode</div>

      {/* ── Idle: show the custom tile picker ── */}
      {!isVehicleActive && (
        <div className="vd-tiles">
          {VEHICLES.map(v => (
            <button
              key={v.value}
              className={`vd-tile ${selectedVehicle === v.value ? 'vd-tile-selected' : ''}`}
              onClick={() => onVehicleSelect(v.value)}
            >
              <span className="vd-tile-icon">{v.icon}</span>
              <span className="vd-tile-name">{v.name}</span>
              <span className="vd-tile-desc">{v.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Active: show selected vehicle + status + cancel ── */}
      {isVehicleActive && selected && (
        <div className="vd-active">
          <div className="vd-active-vehicle">
            <span className="vd-active-icon">{selected.icon}</span>
            <div className="vd-active-info">
              <span className="vd-active-name">{selected.name}</span>
              <span className="vd-active-desc">{selected.desc}</span>
            </div>
            {!isCalculatingRoute && (
              <button className="vd-cancel-btn" onClick={onCancelVehicle} title="Cancel selection">
                ✕
              </button>
            )}
          </div>

          <div className={`vd-status ${isCalculatingRoute ? 'vd-status-calc' : 'vd-status-pick'}`}>
            {isCalculatingRoute ? (
              <>
                <span className="vd-status-dot vd-dot-spin">⏳</span>
                <span>Checking route…</span>
              </>
            ) : (
              <>
                <span className="vd-status-dot">📍</span>
                <span>
                  {!currentSegment || currentSegment.waypoints.length === 0
                    ? 'Left-click Point A on the map'
                    : 'Left-click Point B on the map'}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleDropdown;
