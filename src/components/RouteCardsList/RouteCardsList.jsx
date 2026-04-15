import React from 'react';
import './RouteCardsList.css';

const RouteCardsList = ({ 
  routeCards, 
  hoveredRouteId,
  selectedRouteId,
  onRouteHover,
  onRouteLeave,
  onRouteClick,
  onToggleVisibility,
  onRemoveRoute,
  onClearAll,
  getVehicleInfo 
}) => {
  if (routeCards.length === 0) return null;

  return (
    <div className="route-cards-container">
      <div className="card-header">
        <h3>🗂️ Your Routes</h3>
      </div>
      <div className="route-cards-list">
        {routeCards.map((card) => (
          <div 
            key={card.id} 
            className={`route-card ${!card.visible ? 'route-hidden' : ''} ${hoveredRouteId === card.id ? 'route-hovered' : ''} ${selectedRouteId === card.id ? 'route-selected' : ''}`}
            onMouseEnter={() => onRouteHover(card.id)}
            onMouseLeave={onRouteLeave}
            onClick={() => onRouteClick(card.id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="route-card-header">
              <div className="route-card-title">
                <span className="vehicle-icon">{getVehicleInfo(card.vehicle).icon}</span>
                <span className="vehicle-name">{getVehicleInfo(card.vehicle).name}</span>
              </div>
              <div className="route-card-actions">
                <button 
                  className="toggle-route-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(card.id);
                  }}
                  title={card.visible ? "Hide route" : "Show route"}
                >
                  {card.visible ? '👁️' : '👁️‍🗨️'}
                </button>
                <button 
                  className="close-route-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRoute(card.id);
                  }}
                  title="Remove this route"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="route-card-content">
              <div className="route-card-stats">
                <div className="route-stat">
                  <span className="stat-icon">📏</span>
                  <span className="stat-value">{card.distance} km</span>
                </div>
                <div className="route-stat">
                  <span className="stat-icon">⏱️</span>
                  <span className="stat-value">{card.time} min</span>
                </div>
                <div className="route-stat">
                  <span className="stat-icon">💰</span>
                  <span className="stat-value">₱{card.fare}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {routeCards.length > 1 && (
        <div className="route-cards-actions">
          <button onClick={onClearAll} className="clear-all-routes-btn">
            Clear All Routes
          </button>
        </div>
      )}
    </div>
  );
};

export default RouteCardsList;
