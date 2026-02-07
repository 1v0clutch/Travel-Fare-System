import React from 'react';
import { getVehicleInfo } from '../../constants/vehicles';

const RouteCard = ({ card, onToggleVisibility, onRemove }) => {
  const vehicleInfo = getVehicleInfo(card.vehicle);
  
  return (
    <div className={`route-card ${!card.visible ? 'route-hidden' : ''}`}>
      <div className="route-card-header">
        <div className="route-card-title">
          <span className="vehicle-icon">{vehicleInfo.icon}</span>
          <span className="vehicle-name">{vehicleInfo.name}</span>
        </div>
        <div className="route-card-actions">
          <button 
            className="toggle-route-btn"
            onClick={() => onToggleVisibility(card.id)}
            title={card.visible ? "Hide route" : "Show route"}
          >
            {card.visible ? '👁️' : '👁️‍🗨️'}
          </button>
          <button 
            className="close-route-btn"
            onClick={() => onRemove(card.id)}
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
  );
};

export default RouteCard;
