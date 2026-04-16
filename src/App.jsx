import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import VehicleDropdown from './components/VehicleDropdown/VehicleDropdown'
import { useMapSetup } from './hooks/useMapSetup'
import { calculateFareByVehicle } from './utils/fareCalculations'

// ─── Route color palette ─────────────────────────────────────────────────────
const ROUTE_COLORS = [
  '#6FA1EC', '#4CAF50', '#FF9F43', '#FF6B6B',
  '#A29BFE', '#00CEC9', '#FDCB6E', '#E17055',
]
function getRouteColor(index) {
  return ROUTE_COLORS[index % ROUTE_COLORS.length]
}

// ─── Call OSRM directly ──────────────────────────────────────────────────────
async function fetchOSRMRoute(pointA, pointB) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${pointA.lng},${pointA.lat};${pointB.lng},${pointB.lat}` +
    `?overview=full&geometries=geojson&steps=false`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return { ok: false }
    }
    const route = data.routes[0]
    const coords = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
    return { ok: true, distanceKm: route.distance / 1000, durationSec: route.duration, coords }
  } catch {
    return { ok: false }
  }
}

function removePolyline(polyline, map) {
  try { if (polyline) map.removeLayer(polyline) } catch (_) {}
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const HISTORY_PAGE_SIZE = 5

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  const isVehicleActiveRef = useRef(false)
  const currentSegmentRef = useRef(null)
  const isCalculatingRouteRef = useRef(false)
  const routeCardsLengthRef = useRef(0)

  const [activeTab, setActiveTab] = useState('route')
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [isVehicleActive, setIsVehicleActive] = useState(false)
  const [currentSegment, setCurrentSegment] = useState(null)
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [routeError, setRouteError] = useState(null)

  const [routeCards, setRouteCards] = useState([])
  const [routeControls, setRouteControls] = useState([])
  const [routeMarkers, setRouteMarkers] = useState([])
  const [routeInfo, setRouteInfo] = useState(null)
  const [activeRouteId, setActiveRouteId] = useState(null)
  const [hoveredRouteId, setHoveredRouteId] = useState(null)
  const [historyPage, setHistoryPage] = useState(0)

  // Sync refs
  useEffect(() => { isVehicleActiveRef.current = isVehicleActive }, [isVehicleActive])
  useEffect(() => { currentSegmentRef.current = currentSegment }, [currentSegment])
  useEffect(() => { isCalculatingRouteRef.current = isCalculatingRoute }, [isCalculatingRoute])
  useEffect(() => { routeCardsLengthRef.current = routeCards.length }, [routeCards.length])

  const getVehicleInfo = (vehicle) => ({
    jeepney:  { icon: '🚌', name: 'Jeepney' },
    tricycle: { icon: '🛺', name: 'Tricycle' },
  }[vehicle] || { icon: '🚌', name: 'Jeepney' })

  const handleVehicleSelect = (vehicle) => {
    const seg = { vehicle, waypoints: [], markers: [], id: Date.now() }
    setSelectedVehicle(vehicle)
    setIsVehicleActive(true)
    setRouteError(null)
    setActiveRouteId(null)
    setCurrentSegment(seg)
    isVehicleActiveRef.current = true
    currentSegmentRef.current = seg
  }

  const handleCancelVehicle = () => {
    if (currentSegmentRef.current?.markers && map.current) {
      currentSegmentRef.current.markers.forEach(m => { try { map.current.removeLayer(m) } catch (_) {} })
    }
    setSelectedVehicle(null)
    setIsVehicleActive(false)
    setCurrentSegment(null)
    setIsCalculatingRoute(false)
    setRouteError(null)
    isVehicleActiveRef.current = false
    currentSegmentRef.current = null
    isCalculatingRouteRef.current = false
  }

  const handleAddNewRoute = () => {
    setSelectedVehicle(null)
    setIsVehicleActive(false)
    setCurrentSegment(null)
    setRouteInfo(null)
    setRouteError(null)
    setActiveRouteId(null)
    isVehicleActiveRef.current = false
    currentSegmentRef.current = null
  }

  const removeRouteCard = useCallback((cardId) => {
    setRouteControls(prev => {
      const entry = prev.find(c => c.id === cardId)
      if (entry && map.current) removePolyline(entry.polyline, map.current)
      return prev.filter(c => c.id !== cardId)
    })
    setRouteMarkers(prev => {
      const entry = prev.find(m => m.id === cardId)
      if (entry && map.current) {
        entry.markers.forEach(m => { try { map.current.removeLayer(m) } catch (_) {} })
      }
      return prev.filter(m => m.id !== cardId)
    })
    setRouteCards(prev => prev.filter(c => c.id !== cardId))
    setActiveRouteId(prev => prev === cardId ? null : prev)
  }, [])

  const toggleRouteVisibility = useCallback((cardId) => {
    setRouteCards(prev => {
      const card = prev.find(c => c.id === cardId)
      if (!card) return prev
      const show = !card.visible
      setRouteControls(rcs => {
        const entry = rcs.find(c => c.id === cardId)
        if (entry?.polyline && map.current) {
          try { show ? entry.polyline.addTo(map.current) : map.current.removeLayer(entry.polyline) } catch (_) {}
        }
        return rcs
      })
      setRouteMarkers(rms => {
        const entry = rms.find(m => m.id === cardId)
        if (entry && map.current) {
          entry.markers.forEach(m => {
            try { show ? m.addTo(map.current) : map.current.removeLayer(m) } catch (_) {}
          })
        }
        return rms
      })
      return prev.map(c => c.id === cardId ? { ...c, visible: show } : c)
    })
  }, [])

  const focusRoute = useCallback((cardId) => {
    if (!map.current || !window.L) return
    const markerEntry = routeMarkers.find(m => m.id === cardId)
    if (markerEntry && markerEntry.markers.length >= 2) {
      try {
        const latlngs = markerEntry.markers.map(m => m.getLatLng()).filter(Boolean)
        if (latlngs.length >= 2) {
          const bounds = window.L.latLngBounds(latlngs)
          if (bounds.isValid()) {
            map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true })
          }
        }
      } catch (_) {}
    }
    const polyEntry = routeControls.find(c => c.id === cardId)
    if (polyEntry?.polyline) {
      try {
        const orig = { weight: polyEntry.polyline.options.weight, opacity: polyEntry.polyline.options.opacity }
        polyEntry.polyline.setStyle({ weight: 9, opacity: 1 })
        setTimeout(() => { try { polyEntry.polyline.setStyle(orig) } catch (_) {} }, 1500)
      } catch (_) {}
    }
  }, [routeMarkers, routeControls])

  const handleHistoryCardClick = useCallback((card) => {
    setActiveRouteId(card.id)
    setRouteInfo({ distance: card.distance, time: card.time, fare: card.fare, vehicle: card.vehicle })
    setActiveTab('route')
    focusRoute(card.id)
  }, [focusRoute])

  const clearAllRoutes = useCallback(() => {
    if (map.current) {
      routeControls.forEach(rc => removePolyline(rc.polyline, map.current))
      routeMarkers.forEach(rm => rm.markers.forEach(m => { try { map.current.removeLayer(m) } catch (_) {} }))
    }
    setRouteCards([])
    setRouteControls([])
    setRouteMarkers([])
    setRouteInfo(null)
    setIsVehicleActive(false)
    setCurrentSegment(null)
    setSelectedVehicle(null)
    setRouteError(null)
    setActiveRouteId(null)
    setHistoryPage(0)
  }, [routeControls, routeMarkers])

  useMapSetup(mapContainer, map, setMapReady)

  // ── Map click handler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !map.current || !window.L) return

    const handleMapClick = async (e) => {
      const vehicleActive = isVehicleActiveRef.current
      const segment = currentSegmentRef.current
      const calculating = isCalculatingRouteRef.current

      if (!vehicleActive || !segment || segment.waypoints.length >= 2 || calculating) return

      setRouteError(null)
      const waypointIndex = segment.waypoints.length

      // ── Point A ────────────────────────────────────────────────────────────
      if (waypointIndex === 0) {
        const marker = window.L.marker(e.latlng)
          .addTo(map.current)
          .bindPopup(`Point A (${getVehicleInfo(segment.vehicle).name})`)
          .openPopup()
        const newSegment = { ...segment, waypoints: [e.latlng], markers: [marker] }
        currentSegmentRef.current = newSegment
        setCurrentSegment(newSegment)
        return
      }

      // ── Point B ────────────────────────────────────────────────────────────
      if (waypointIndex === 1) {
        const markerB = window.L.marker(e.latlng)
          .addTo(map.current)
          .bindPopup(`Point B (${getVehicleInfo(segment.vehicle).name})`)
          .openPopup()
        const updatedMarkers = [...segment.markers, markerB]

        currentSegmentRef.current = null
        isCalculatingRouteRef.current = true
        setCurrentSegment(null)
        setIsCalculatingRoute(true)

        const segmentId = segment.id
        const segmentVehicle = segment.vehicle
        const colorIndex = routeCardsLengthRef.current
        const routeColor = getRouteColor(colorIndex)

        const failRoute = (msg) => {
          updatedMarkers.forEach(m => { try { map.current.removeLayer(m) } catch (_) {} })
          isVehicleActiveRef.current = false
          isCalculatingRouteRef.current = false
          setIsVehicleActive(false)
          setIsCalculatingRoute(false)
          setRouteError(msg)
        }

        const osrm = await fetchOSRMRoute(segment.waypoints[0], e.latlng)
        if (!osrm.ok) {
          failRoute('⚠️ No road route found between these points.')
          return
        }

        const { distanceKm, durationSec, coords } = osrm
        const timeMinutes = Math.round(durationSec / 60)

        // Validate coords before drawing
        if (!coords || coords.length < 2) {
          failRoute('⚠️ Invalid route returned.')
          return
        }

        const polyline = window.L.polyline(
          coords.map(c => [c.lat, c.lng]),
          { color: routeColor, weight: 5, opacity: 0.85 }
        ).addTo(map.current)

        // Fit map — guard against invalid bounds
        try {
          const bounds = polyline.getBounds()
          if (bounds && bounds.isValid && bounds.isValid()) {
            map.current.fitBounds(bounds, { padding: [40, 40] })
          }
        } catch (_) {}

        const fare = calculateFareByVehicle(parseFloat(distanceKm.toFixed(2)), segmentVehicle)
        const routeCard = {
          id: segmentId,
          vehicle: segmentVehicle,
          distance: distanceKm.toFixed(2),
          time: timeMinutes,
          fare,
          color: routeColor,
          colorIndex,
          timestamp: Date.now(),
          visible: true,
        }

        setRouteControls(prev => [...prev, { id: segmentId, polyline }])
        setRouteMarkers(prev => [...prev, { id: segmentId, markers: updatedMarkers }])
        setRouteCards(prev => {
          routeCardsLengthRef.current = prev.length + 1
          return [...prev, routeCard]
        })
        setRouteInfo({ distance: distanceKm.toFixed(2), time: timeMinutes, fare, vehicle: segmentVehicle })
        setActiveRouteId(segmentId)
        isVehicleActiveRef.current = false
        isCalculatingRouteRef.current = false
        setIsVehicleActive(false)
        setIsCalculatingRoute(false)
      }
    }

    map.current.on('click', handleMapClick)
    return () => { if (map.current) map.current.off('click', handleMapClick) }
  }, [mapReady])

  // ── Hover highlight ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !hoveredRouteId) return
    const entry = routeControls.find(c => c.id === hoveredRouteId)
    if (!entry?.polyline) return
    let orig = null
    try {
      orig = { weight: entry.polyline.options.weight, opacity: entry.polyline.options.opacity }
      entry.polyline.setStyle({ weight: 8, opacity: 1 })
    } catch (_) {}
    return () => {
      try { if (orig) entry.polyline.setStyle(orig) } catch (_) {}
    }
  }, [hoveredRouteId, routeControls])

  const totalPages = Math.ceil(routeCards.length / HISTORY_PAGE_SIZE)
  const pagedCards = routeCards.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE)
  const activeCard = routeCards.find(c => c.id === activeRouteId)

  return (
    <div className="app-container">
      <div className="section left-section">
        <div className="left-panel">

          <nav className="app-navbar">
            <div className="navbar-brand">
              <span className="navbar-logo">🚌</span>
              <span className="navbar-title">Fare Calculator</span>
            </div>
            <div className="navbar-tabs">
              <button className={`nav-tab ${activeTab === 'route' ? 'active' : ''}`} onClick={() => setActiveTab('route')}>
                <span className="nav-tab-icon">🚗</span>
                <span className="nav-tab-label">Route</span>
              </button>
              <button className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                <span className="nav-tab-icon">🕐</span>
                <span className="nav-tab-label">History</span>
                {routeCards.length > 0 && <span className="nav-badge">{routeCards.length}</span>}
              </button>
            </div>
          </nav>

          {activeTab === 'route' && (
            <div className="tab-content">
              <VehicleDropdown
                selectedVehicle={selectedVehicle}
                isVehicleActive={isVehicleActive}
                isCalculatingRoute={isCalculatingRoute}
                currentSegment={currentSegment}
                routeComplete={!!routeInfo}
                onVehicleSelect={handleVehicleSelect}
                onCancelVehicle={handleCancelVehicle}
                getVehicleInfo={getVehicleInfo}
              />

              {routeError && <div className="land-error-banner">{routeError}</div>}

              {!routeInfo ? (
                <div className="info-card">
                  <div className="card-header"><h3>📍 Ready to Calculate Fare</h3></div>
                  <div className="card-content">
                    <div className="instruction-steps">
                      <div className="step"><span className="step-number">1</span><span className="step-text">Select your transport above</span></div>
                      <div className="step"><span className="step-number">2</span><span className="step-text">Left-click Point A on the map</span></div>
                      <div className="step"><span className="step-number">3</span><span className="step-text">Left-click Point B on the map</span></div>
                      <div className="step"><span className="step-number">💡</span><span className="step-text">Right-click + drag to pan the map</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="results-container">
                  <div className="route-result-card" style={{ borderColor: activeCard?.color || '#6FA1EC' }}>
                    <div className="route-result-header" style={{
                      background: activeCard?.color
                        ? `linear-gradient(135deg, ${activeCard.color}cc, ${activeCard.color}88)`
                        : 'linear-gradient(135deg, #6FA1EC, #2c5aa0)'
                    }}>
                      <div className="route-result-title">
                        <span className="route-color-dot" style={{ background: activeCard?.color || '#6FA1EC' }} />
                        <span>{getVehicleInfo(routeInfo.vehicle).icon} {getVehicleInfo(routeInfo.vehicle).name} Route</span>
                      </div>
                      <span className="route-badge">Direct</span>
                    </div>
                    <div className="route-result-body">
                      <div className="result-stats-row">
                        <div className="result-stat">
                          <span className="result-stat-icon">📏</span>
                          <div>
                            <div className="result-stat-label">Distance</div>
                            <div className="result-stat-value">{routeInfo.distance} km</div>
                          </div>
                        </div>
                        <div className="result-stat">
                          <span className="result-stat-icon">⏱️</span>
                          <div>
                            <div className="result-stat-label">Est. Time</div>
                            <div className="result-stat-value">{routeInfo.time} min</div>
                          </div>
                        </div>
                      </div>
                      <div className="fare-display">
                        <div className="fare-icon">💰</div>
                        <div className="fare-info">
                          <span className="fare-label">{getVehicleInfo(routeInfo.vehicle).name} Fare</span>
                          <span className="fare-amount">₱{routeInfo.fare}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button className="add-new-route-btn" onClick={handleAddNewRoute}>+ Add another route</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="tab-content">
              {routeCards.length === 0 ? (
                <div className="history-empty">
                  <div className="history-empty-icon">🕐</div>
                  <p>No routes yet. Calculate a route to see it here.</p>
                </div>
              ) : (
                <>
                  <div className="history-list">
                    {pagedCards.map((card) => (
                      <div
                        key={card.id}
                        className={`history-card ${activeRouteId === card.id ? 'history-card-active' : ''} ${!card.visible ? 'history-card-hidden' : ''} ${hoveredRouteId === card.id ? 'history-card-hovered' : ''}`}
                        style={{ borderLeftColor: card.color }}
                        onMouseEnter={() => setHoveredRouteId(card.id)}
                        onMouseLeave={() => setHoveredRouteId(null)}
                        onClick={() => handleHistoryCardClick(card)}
                      >
                        <div className="history-card-left">
                          <div className="history-color-bar" style={{ background: card.color }} />
                          <div className="history-card-info">
                            <div className="history-card-title">
                              <span>{getVehicleInfo(card.vehicle).icon}</span>
                              <span className="history-vehicle-name">{getVehicleInfo(card.vehicle).name}</span>
                              {activeRouteId === card.id && <span className="history-active-badge">Active</span>}
                            </div>
                            <div className="history-card-stats">
                              <span>📏 {card.distance} km</span>
                              <span>⏱️ {card.time} min</span>
                              <span style={{ color: card.color }}>💰 ₱{card.fare}</span>
                            </div>
                            <div className="history-card-time">{formatTime(card.timestamp)}</div>
                          </div>
                        </div>
                        <div className="history-card-actions" onClick={e => e.stopPropagation()}>
                          <button className="hc-btn hc-vis" onClick={() => toggleRouteVisibility(card.id)} title={card.visible ? 'Hide route' : 'Show route'}>
                            {card.visible ? '👁️' : '🚫'}
                          </button>
                          <button className="hc-btn hc-del" onClick={() => removeRouteCard(card.id)} title="Remove route">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="history-pagination">
                      <button className="page-btn" disabled={historyPage === 0} onClick={() => setHistoryPage(p => p - 1)}>‹</button>
                      <span className="page-info">{historyPage + 1} / {totalPages}</span>
                      <button className="page-btn" disabled={historyPage >= totalPages - 1} onClick={() => setHistoryPage(p => p + 1)}>›</button>
                    </div>
                  )}

                  <button className="clear-all-btn" onClick={clearAllRoutes}>🗑️ Clear All Routes</button>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      <div className="section right-section">
        <div ref={mapContainer} className="map-container" />
      </div>
    </div>
  )
}

export default App
