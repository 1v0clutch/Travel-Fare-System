import React from 'react';
import RouteCard from './RouteCard';
import './RouteCards.css';

const RouteCards = ({ cards, onToggleVisibility, onRemove, onClearAll }) => {
  if (cards.length === 0) return null;
  
  return (
    <div className="route-cards-container">
      <div className="card-header">
        <h3>🗂️ Your Routes</h3>
      </div>
      <div className="route-cards-list">
        {cards.map((card) => (
          <RouteCard
            key={card.id}
            card={card}
            onToggleVisibility={onToggleVisibility}
            onRemove={onRemove}
          />
        ))}
      </div>
      {cards.length > 1 && (
        <div className="route-cards-actions">
          <button onClick={onClearAll} className="clear-all-routes-btn">
            Clear All Routes
          </button>
        </div>
      )}
    </div>
  );
};

export default RouteCards;
