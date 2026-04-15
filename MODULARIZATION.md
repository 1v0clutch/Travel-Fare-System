# Modularization Plan

## Created Files

### Constants
- `src/constants/locations.js` - All airports, piers, and train stations data

### Components
- `src/components/VehicleDropdown/` - Vehicle selection dropdown with categories
- `src/components/RouteCardsList/` - Route cards display with scroll and hover

### Hooks
- `src/hooks/useMapSetup.js` - Map initialization logic
- `src/hooks/useSpecialMarkers.js` - Airport/pier/station marker management

### Existing Files (Already Modular)
- `src/utils/fareCalculations.js` - Fare calculation functions
- `src/utils/vehicleRestrictions.js` - Vehicle availability checks
- `src/constants/vehicles.js` - Vehicle metadata

## App.jsx Reduction
- Original: ~1734 lines
- Target: ~400-500 lines
- Reduction: ~70% smaller

## What Remains in App.jsx
- Main state management
- Route processing logic
- Map click handlers
- Route control management
- Core routing functionality
