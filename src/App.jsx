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

// ─── Haversine ───────────────────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

// ─── Nominatim reverse geocode ───────────────────────────────────────────────
// Returns { onLand, islandKey }
// islandKey is the OSM `island` tag — only set when the point is on a named island polygon.
async function checkLocation(latlng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    if (!data || !data.address) return { onLand: false, islandKey: null }
    const addr = data.address
    const islandKey = addr.island || addr.archipelago || null
    return { onLand: true, islandKey }
  } catch {
    return { onLand: true, islandKey: null }   // fail open on network error
  }
}

// ─── Nominatim land check for a single point ────────────────────────────────
async function isPointOnLand(latlng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    return !!(data && data.address && data.display_name)
  } catch {
    return true   // fail open
  }
}

// ─── Sample N evenly-spaced points along a polyline ─────────────────────────
function samplePolyline(coords, n) {
  if (coords.length < 2) return []
  const cumDist = [0]
  for (let i = 1; i < coords.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineKm(coords[i - 1], coords[i]))
  }
  const total = cumDist[cumDist.length - 1]
  const result = []
  for (let s = 1; s <= n; s++) {
    const target = (s / (n + 1)) * total
    let idx = cumDist.findIndex(d => d >= target)
    if (idx <= 0) idx = 1
    const t = cumDist[idx] > cumDist[idx - 1]
      ? (target - cumDist[idx - 1]) / (cumDist[idx] - cumDist[idx - 1])
      : 0
    result.push({
      lat: coords[idx - 1].lat + (coords[idx].lat - coords[idx - 1].lat) * t,
      lng: coords[idx - 1].lng + (coords[idx].lng - coords[idx - 1].lng) * t,
    })
  }
  return result
}

// ─── Check every sampled point on the route geometry ────────────────────────
// Returns true if ANY sampled point is over water.
// We check ALL samples in parallel for speed, then evaluate.
async function geometryCrossesWater(coords) {
  // Use more samples for longer routes
  const numSamples = Math.min(8, Math.max(4, Math.floor(coords.length / 20)))
  const samples = samplePolyline(coords, numSamples)
  if (samples.length === 0) return false

  const results = await Promise.all(samples.map(pt => isPointOnLand(pt)))
  // If any sample is NOT on land → route crosses water
  return results.some(onLand => !onLand)
}

// ─── Call OSRM directly and return route data ────────────────────────────────
// Returns { ok, distanceKm, durationSec, coords } or { ok: false, error }
async function fetchOSRMRoute(pointA, pointB) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${pointA.lng},${pointA.lat};${pointB.lng},${pointB.lat}` +
    `?overview=full&geometries=geojson&steps=false`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return { ok: false, error: 'no_route' }
    }
    const route = data.routes[0]
    const coords = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
    return {
      ok: true,
      distanceKm: route.distance / 1000,
      durationSec: route.duration,
      coords,
    }
  } catch {
    return { ok: false, error: 'network' }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

  const [activeTab, setActiveTab] = useState('route')

  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [isVehicleActive, setIsVehicleActive] = useState(false)
  const [currentSegment, setCurrentSegment] = useState(null)
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [landCheckPending, setLandCheckPending] = useState(false)
  const [landError, setLandError] = useState(null)

  // routeControls now stores { id, polyline } — plain Leaflet polylines
  const [routeCards, setRouteCards] = useState([])
  const [routeControls, setRouteControls] = useState([])   // { id, polyline }
  const [routeMarkers, setRouteMarkers] = useState([])     // { id, markers[] }

  const [routeInfo, setRouteInfo] = useState(null)
  const [activeRouteId, setActiveRouteId] = useState(null)
  const [hoveredRouteId, setHoveredRouteId] = useState(null)

  const [historyPage, setHistoryPage] = useState(0)

  const getVehicleInfo = (vehicle) => ({
    jeepney:  { icon: '🚌', name: 'Jeepney' },
    tricycle: { icon: '🛺', name: 'Tricycle' },
  }[vehicle] || { icon: '🚌', name: 'Jeepney' })

  // ── Vehicle selection ──────────────────────────────────────────────────────
  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicle(vehicle)
    setIsVehicleActive(true)
    setLandError(null)
    setActiveRouteId(null)
    setCurrentSegment({ vehicle, waypoints: [], markers: [], startTime: Date.now(), id: Date.now() })
  }

  const handleCancelVehicle = () => {
    if (currentSegment?.markers && map.current) {
      currentSegment.markers.forEach(m => { try { map.current.removeLayer(m) } catch (_) {} })
    }
    setSelectedVehicle(null)
    setIsVehicleActive(false)
    setCurrentSegment(null)
    setLandError(null)
  }

  const handleAddNewRoute = () => {
    setSelectedVehicle(null)
    setIsVehicleActive(false)
    setCurrentSegment(null)
    setRouteInfo(null)
    setLandError(null)
    setActiveRouteId(null)
  }

  // ── Route card management ──────────────────────────────────────────────────
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
          try {
            show ? entry.polyline.addTo(map.current) : map.current.removeLayer(entry.polyline)
          } catch (_) {}
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
    if (!map.current) return
    setRouteMarkers(rms => {
      const entry = rms.find(m => m.id === cardId)
      if (entry && entry.markers.length >= 2) {
        try {
          const bounds = window.L.latLngBounds(entry.markers.map(m => m.getLatLng()))
          map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true })
        } catch (_) {}
      }
      return rms
    })
    // Flash the polyline
    setRouteControls(rcs => {
      const entry = rcs.find(c => c.id === cardId)
      if (entry?.polyline) {
        try {
          const orig = { weight: entry.polyline.options.weight, opacity: entry.polyline.options.opacity }
          entry.polyline.setStyle({ weight: 9, opacity: 1 })
          setTimeout(() => { try { entry.polyline.setStyle(orig) } catch (_) {} }, 1500)
        } catch (_) {}
      }
      return rcs
    })
  }, [])

  const handleHistoryCardClick = useCallback((card) => {
    setActiveRouteId(card.id)
    setRouteInfo({ distance: card.distance, time: card.time, fare: card.fare, vehicle: card.vehicle })
    setActiveTab('route')
    focusRoute(card.id)
  }, [focusRoute])

  const clearAllRoutes = useCallback(() => {
    if (map.current) {
      setRouteControls(prev => {
        prev.forEach(rc => removePolyline(rc.polyline, map.current))
        return []
      })
      setRouteMarkers(prev => {
        prev.forEach(rm => rm.markers.forEach(m => { try { map.current.removeLayer(m) } catch (_) {} }))
        return []
      })
    }
    setRouteCards([])
    setRouteInfo(null)
    setIsVehicleActive(false)
    setCurrentSegment(null)
    setSelectedVehicle(null)
    setLandError(null)
    setActiveRouteId(null)
    setHistoryPage(0)
  }, [])

  // ── Map init ───────────────────────────────────────────────────────────────
  useMapSetup(mapContainer, map)

  // ── Map click handler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !window.L) return

    const handleMapClick = async (e) => {
      if (!isVehicleActive || !currentSegment || currentSegment.waypoints.length >= 2) return
      if (landCheckPending || isCalculatingRoute) return

      setLandError(null)
      setLandCheckPending(true)
      const { onLand, islandKey } = await checkLocation(e.latlng)
      setLandCheckPending(false)

      if (!onLand) {
        setLandError('⚠️ Please click on a land location, not water.')
        return
      }

      const waypointIndex = currentSegment.waypoints.length

      // ── Point A ────────────────────────────────────────────────────────────
      if (waypointIndex === 0) {
        const marker = window.L.marker(e.latlng)
          .addTo(map.current)
          .bindPopup(`Point A (${getVehicleInfo(currentSegment.vehicle).name})`)
          .openPopup()
        setCurrentSegment({ ...currentSegment, waypoints: [e.latlng], markers: [marker], islandKeyA: islandKey })
        return
      }

      // ── Point B ────────────────────────────────────────────────────────────
      if (waypointIndex === 1) {
        const islandKeyA = currentSegment.islandKeyA

        // Fast reject: named islands differ → definitely cross-island
        if (islandKeyA && islandKey && islandKeyA !== islandKey) {
          setLandError(
            `⚠️ Cannot route between islands. Point A is on "${islandKeyA}" and Point B is on "${islandKey}". Jeepney and tricycle cannot cross water.`
          )
          return
        }

        const pointA = currentSegment.waypoints[0]
        const pointB = e.latlng
        const straightKm = haversineKm(pointA, pointB)

        // Place Point B marker
        const markerB = window.L.marker(pointB)
          .addTo(map.current)
          .bindPopup(`Point B (${getVehicleInfo(currentSegment.vehicle).name})`)
          .openPopup()
        const updatedMarkers = [...currentSegment.markers, markerB]

        setIsCalculatingRoute(true)
        setIsVehicleActive(false)
        setCurrentSegment(null)

        const segmentId = currentSegment.id
        const segmentVehicle = currentSegment.vehicle
        const colorIndex = routeCards.length
        const routeColor = getRouteColor(colorIndex)

        // Helper: clean up and show error
        const failRoute = (msg) => {
          updatedMarkers.forEach(m => { try { map.current.removeLayer(m) } catch (_) {} })
          setIsCalculatingRoute(false)
          setLandError(msg)
        }

        // ── 1. Fetch route from OSRM directly (no LRM, no premature rendering) ──
        const osrm = await fetchOSRMRoute(pointA, pointB)

        if (!osrm.ok) {
          failRoute('⚠️ No road route found between these points. They may be on separate islands with no bridge.')
          return
        }

        const { distanceKm, durationSec, coords } = osrm
        const timeMinutes = Math.round(durationSec / 60)

        // ── 2. Detour ratio check ──────────────────────────────────────────────
        // Road distance > 3.5× straight-line AND straight line > 1 km
        // → almost certainly routing around a distant bridge to another island
        const detourRatio = straightKm > 0 ? distanceKm / straightKm : 1
        if (detourRatio > 3.5 && straightKm > 1) {
          failRoute(
            `⚠️ No direct road connection. Route would be ${Math.round(distanceKm)} km ` +
            `(${Math.round(straightKm)} km straight-line). ` +
            `These locations appear to be on separate islands with no bridge.`
          )
          return
        }

        // ── 3. Geometry water-crossing check ──────────────────────────────────
        // Sample points along the actual OSRM polyline and check each for land.
        // This runs BEFORE we draw anything on the map.
        const crosses = await geometryCrossesWater(coords)
        if (crosses) {
          failRoute(
            '⚠️ The route crosses water. Jeepney and tricycle can only travel on connected land roads. ' +
            'These points appear to be on separate islands.'
          )
          return
        }

        // ── 4. All checks passed — draw the polyline and save the route ───────
        const polyline = window.L.polyline(
          coords.map(c => [c.lat, c.lng]),
          { color: routeColor, weight: 5, opacity: 0.85 }
        ).addTo(map.current)

        // Fit map to route
        try { map.current.fitBounds(polyline.getBounds(), { padding: [40, 40] }) } catch (_) {}

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
        setRouteCards(prev => [...prev, routeCard])
        setRouteInfo({ distance: distanceKm.toFixed(2), time: timeMinutes, fare, vehicle: segmentVehicle })
        setActiveRouteId(segmentId)
        setIsCalculatingRoute(false)
      }
    }

    map.current.on('click', handleMapClick)
    return () => { if (map.current) map.current.off('click', handleMapClick) }
  }, [isVehicleActive, currentSegment, landCheckPending, isCalculatingRoute, routeCards.length])

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

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(routeCards.length / HISTORY_PAGE_SIZE)
  const pagedCards = routeCards.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE)
  const activeCard = routeCards.find(c => c.id === activeRouteId)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <div className="section left-section">
        <div className="left-panel">

          {/* NAV BAR */}
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

          {/* ROUTE TAB */}
          {activeTab === 'route' && (
            <div className="tab-content">
              <VehicleDropdown
                selectedVehicle={selectedVehicle}
                isVehicleActive={isVehicleActive}
                isCalculatingRoute={isCalculatingRoute || landCheckPending}
                currentSegment={currentSegment}
                onVehicleSelect={handleVehicleSelect}
                onCancelVehicle={handleCancelVehicle}
                getVehicleInfo={getVehicleInfo}
              />

              {landError && <div className="land-error-banner">{landError}</div>}

              {!routeInfo ? (
                <div className="info-card">
                  <div className="card-header"><h3>📍 Ready to Calculate Fare</h3></div>
                  <div className="card-content">
                    <div className="instruction-steps">
                      <div className="step"><span className="step-number">1</span><span className="step-text">Select your transport above</span></div>
                      <div className="step"><span className="step-number">2</span><span className="step-text">Click Point A on the map (land only)</span></div>
                      <div className="step"><span className="step-number">3</span><span className="step-text">Click Point B on the map (land only)</span></div>
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

          {/* HISTORY TAB */}
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
