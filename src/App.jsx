import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import VehicleDropdown from './components/VehicleDropdown/VehicleDropdown'
import { useMapSetup } from './hooks/useMapSetup'
import { calculateFareByVehicle } from './utils/fareCalculations'
import { Analytics } from "@vercel/analytics/react"
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

// ─── Simplify route (Douglas-Peucker algorithm) ──────────────────────────────
function simplifyCoordinates(coords, tolerance = 0.0001) {
  if (coords.length <= 2) return coords
  function perpendicularDistance(point, line) {
    const p1 = line[0], p2 = line[1]
    const num = Math.abs((p2.lat - p1.lat) * point.lng - (p2.lng - p1.lng) * point.lat + p2.lng * p1.lat - p2.lat * p1.lng)
    const den = Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lng - p1.lng, 2))
    return den === 0 ? 0 : num / den
  }
  function simplify(segment) {
    let maxDist = 0, maxIdx = 0
    for (let i = 1; i < segment.length - 1; i++) {
      const dist = perpendicularDistance(segment[i], [segment[0], segment[segment.length - 1]])
      if (dist > maxDist) { maxDist = dist; maxIdx = i }
    }
    if (maxDist > tolerance) {
      const left = simplify(segment.slice(0, maxIdx + 1))
      const right = simplify(segment.slice(maxIdx))
      return [...left.slice(0, -1), ...right]
    }
    return [segment[0], segment[segment.length - 1]]
  }
  const simplified = simplify(coords)
  console.log(`Simplified route from ${coords.length} to ${simplified.length} points`)
  return simplified
}

// ─── Filter and clean coordinates ─────────────────────────────────────────────
function filterCoordinates(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return []
  const MIN_DISTANCE = 0.00001 // 1+ meter, very strict
  const filtered = []
  
  for (const coord of coords) {
    if (!coord || typeof coord !== 'object') continue
    if (coord.lat === undefined || coord.lat === null || coord.lng === undefined || coord.lng === null) continue
    if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') continue
    if (isNaN(coord.lat) || isNaN(coord.lng)) continue
    if (!isFinite(coord.lat) || !isFinite(coord.lng)) continue
    if (coord.lat < -90 || coord.lat > 90 || coord.lng < -180 || coord.lng > 180) continue
    
    // Skip if very close to previous point
    if (filtered.length > 0) {
      const prev = filtered[filtered.length - 1]
      const latDiff = Math.abs(coord.lat - prev.lat)
      const lngDiff = Math.abs(coord.lng - prev.lng)
      const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
      if (dist < MIN_DISTANCE) {
        console.log(`Skipping duplicate: dist=${dist.toFixed(8)}`)
        continue
      }
    }
    
    const cleanCoord = { lat: Number(coord.lat), lng: Number(coord.lng) }
    filtered.push(cleanCoord)
  }
  
  console.log(`filterCoordinates: ${filtered.length} valid coords from ${coords.length}`)
  
  // If too many points, simplify
  if (filtered.length > 150) {
    console.log(`Simplifying from ${filtered.length} to ~${Math.ceil(filtered.length / 1.5)}`)
    return simplifyCoordinates(filtered, 0.00005)
  }
  
  return filtered
}

// ─── Validate coordinates before rendering ────────────────────────────────────
function validateCoordinates(coords) {
  if (!Array.isArray(coords) || coords.length === 0) {
    console.warn('Coordinates array is empty or invalid')
    return false
  }
  
  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i]
    if (!coord || typeof coord !== 'object') {
      console.warn(`Coordinate ${i} is not an object:`, coord)
      return false
    }
    if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') {
      console.warn(`Coordinate ${i} has invalid lat/lng:`, coord)
      return false
    }
    if (isNaN(coord.lat) || isNaN(coord.lng)) {
      console.warn(`Coordinate ${i} has NaN values:`, coord)
      return false
    }
    if (!isFinite(coord.lat) || !isFinite(coord.lng)) {
      console.warn(`Coordinate ${i} has infinite values:`, coord)
      return false
    }
    // Check reasonable bounds (latitude -90 to 90, longitude -180 to 180)
    if (coord.lat < -90 || coord.lat > 90 || coord.lng < -180 || coord.lng > 180) {
      console.warn(`Coordinate ${i} is outside valid bounds:`, coord)
      return false
    }
  }
  
  return true
}

// ─── Check if a coordinate is on water via Nominatim ─────────────────────────
async function isWaterBody(latlng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&zoom=10`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return false
    const data = await res.json()

    // If Nominatim returns no address or only a sea/ocean/water type, it's water
    const waterTypes = new Set([
      'sea', 'ocean', 'bay', 'strait', 'lake', 'river', 'water', 'waterway',
      'reservoir', 'lagoon', 'gulf', 'fjord', 'estuary',
    ])
    const type = data?.type?.toLowerCase() || ''
    const cls  = data?.class?.toLowerCase() || ''
    const name = (data?.name || data?.display_name || '').toLowerCase()

    if (waterTypes.has(type) || waterTypes.has(cls)) return true

    // No address at all usually means open sea
    if (!data.address || Object.keys(data.address).length === 0) return true

    // Address has only sea/ocean keys
    const addr = data.address
    const landKeys = ['road','suburb','city','town','village','county','state','country','postcode','neighbourhood','hamlet','municipality']
    const hasLand = landKeys.some(k => addr[k])
    if (!hasLand && (addr.sea || addr.ocean || addr.bay || addr.water || addr.lake)) return true

    return false
  } catch {
    // On timeout or error, allow the point (fail open)
    return false
  }
}

function isMapReady(map) {
  if (!map) return false
  // Check if map has valid container and is initialized
  if (!map._container || !map._size) return false
  // Check if map has valid bounds
  try {
    if (!map.getBounds || typeof map.getBounds !== 'function') return false
    const bounds = map.getBounds()
    if (!bounds || typeof bounds.isValid !== 'function') return false
    return bounds.isValid()
  } catch (error) {
    console.warn('Map not ready:', error.message)
    return false
  }
}

function safeAddPolylineToMap(map, coords, options = {}) {
  try {
    if (!isMapReady(map)) {
      console.error('Map not ready')
      return null
    }
    
    const cleanedCoords = filterCoordinates(coords)
    if (cleanedCoords.length < 2) {
      console.error('Not enough coordinates')
      return null
    }
    
    console.log(`Creating polyline: ${cleanedCoords.length} coords`)
    
    // Super aggressive reduction - Leaflet's SVG clipping is buggy
    let finalCoords = cleanedCoords
    if (cleanedCoords.length > 50) {
      const sampleRate = Math.ceil(cleanedCoords.length / 40)
      finalCoords = cleanedCoords.filter((_, i) => i % sampleRate === 0)
      console.log(`Reduced to ${finalCoords.length} points`)
    }
    
    // Build LatLng objects
    const latLngPoints = []
    for (const coord of finalCoords) {
      if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') continue
      if (!isFinite(coord.lat) || !isFinite(coord.lng)) continue
      if (coord.lat < -90 || coord.lat > 90 || coord.lng < -180 || coord.lng > 180) continue
      latLngPoints.push(new window.L.LatLng(coord.lat, coord.lng))
    }
    
    if (latLngPoints.length < 2) {
      console.error('Not enough valid points')
      return null
    }
    
    console.log(`Final: ${latLngPoints.length} points`)
    
    // Use a fresh SVG renderer per polyline to avoid stale renderer state across routes
    try {
      const renderer = window.L.svg({ padding: 0.5 })
      const polyline = window.L.polyline(latLngPoints, {
        color: options.color || '#6FA1EC',
        weight: options.weight || 5,
        opacity: options.opacity || 0.85,
        renderer,
      })
      polyline.addTo(map)
      console.log('Polyline added successfully')
      return polyline
    } catch (err) {
      console.error('Polyline creation failed:', err.message)
      return null
    }
  } catch (error) {
    console.error('safeAddPolylineToMap error:', error.message)
    return null
  }
}

function removePolyline(polyline, map) {
  try { if (polyline) map.removeLayer(polyline) } catch (_) {}
}

function safeFitBounds(map, bounds, options = {}) {
  if (!map || !bounds) return false
  
  try {
    // Validate bounds object has necessary properties
    if (typeof bounds.isValid !== 'function') {
      console.warn('Bounds object missing isValid method')
      return false
    }
    
    if (!bounds.isValid()) {
      console.warn('Bounds are invalid')
      return false
    }
    
    // Check if bounds has valid coordinates before fitting
    try {
      const boundsArray = bounds.toBBoxString ? bounds.toBBoxString().split(',') : null
      if (!boundsArray || boundsArray.length !== 4 || boundsArray.some(v => !v || isNaN(parseFloat(v)))) {
        console.warn('Bounds coordinates invalid:', boundsArray)
        return false
      }
    } catch (bboxError) {
      console.warn('Error converting bounds to bbox:', bboxError)
      return false
    }
    
    // Wrap fitBounds in try-catch in case Leaflet throws
    map.fitBounds(bounds, options)
    return true
  } catch (error) {
    console.error('Error fitting bounds - this is safe, route still created:', error)
    return false
  }
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
  const [routeStatusMsg, setRouteStatusMsg] = useState('Calculating route...')
  const [routeError, setRouteError] = useState(null)

  const [routeCards, setRouteCards] = useState([])
  const [routeControls, setRouteControls] = useState([])
  const [routeMarkers, setRouteMarkers] = useState([])
  const [routeInfo, setRouteInfo] = useState(null)
  const [activeRouteId, setActiveRouteId] = useState(null)
  const [hoveredRouteId, setHoveredRouteId] = useState(null)
  const [historyPage, setHistoryPage] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)

  // Note: refs are kept in sync manually at each mutation site to avoid async useEffect timing issues

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
    // Clean up all markers from the current segment
    if (map.current && currentSegmentRef.current) {
      const markers = currentSegmentRef.current.markers
      if (markers && Array.isArray(markers)) {
        markers.forEach(marker => {
          try {
            if (marker && marker.remove) {
              marker.remove()
            } else if (marker) {
              map.current.removeLayer(marker)
            }
          } catch (e) {
            console.log('Error removing marker:', e)
          }
        })
      }
    }
    
    setSelectedVehicle(null)
    setIsVehicleActive(false)
    setCurrentSegment(null)
    setIsCalculatingRoute(false)
    setRouteError(null)
    setFailedAttempts(0)
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
    setFailedAttempts(0)
    setActiveRouteId(null)
    isVehicleActiveRef.current = false
    currentSegmentRef.current = null
    isCalculatingRouteRef.current = false
  }

  const handleRerouteRoute = () => {
    // Clean up all markers from the current segment
    if (map.current && currentSegmentRef.current) {
      const markers = currentSegmentRef.current.markers
      if (markers && Array.isArray(markers)) {
        markers.forEach(marker => {
          try {
            if (marker && marker.remove) {
              marker.remove()
            } else if (marker) {
              map.current.removeLayer(marker)
            }
          } catch (e) {
            console.log('Error removing marker:', e)
          }
        })
      }
    }
    
    // Reset to vehicle selection screen, keep vehicle selected
    setCurrentSegment({ vehicle: selectedVehicle, waypoints: [], markers: [], id: Date.now() })
    currentSegmentRef.current = { vehicle: selectedVehicle, waypoints: [], markers: [], id: Date.now() }
    setRouteError(null)
    setFailedAttempts(0)
    isCalculatingRouteRef.current = false
    setIsCalculatingRoute(false)
  }

  const handleResetRoute = () => {
    // Clean up all markers from the current segment
    if (map.current && currentSegmentRef.current) {
      const markers = currentSegmentRef.current.markers
      if (markers && Array.isArray(markers)) {
        markers.forEach(marker => {
          try {
            if (marker && marker.remove) {
              marker.remove()
            } else if (marker) {
              map.current.removeLayer(marker)
            }
          } catch (e) {
            console.log('Error removing marker:', e)
          }
        })
      }
    }
    
    setCurrentSegment({ vehicle: selectedVehicle, waypoints: [], markers: [], id: Date.now() })
    currentSegmentRef.current = { vehicle: selectedVehicle, waypoints: [], markers: [], id: Date.now() }
    setRouteError(null)
    setFailedAttempts(0)
    isCalculatingRouteRef.current = false
    setIsCalculatingRoute(false)
  }

  const handleCancelRoute = () => {
    // Clean up all markers from the current segment
    if (map.current && currentSegmentRef.current) {
      const markers = currentSegmentRef.current.markers
      if (markers && Array.isArray(markers)) {
        markers.forEach(marker => {
          try {
            if (marker && marker.remove) {
              marker.remove()
            } else if (marker) {
              map.current.removeLayer(marker)
            }
          } catch (e) {
            console.log('Error removing marker:', e)
          }
        })
      }
    }
    
    isVehicleActiveRef.current = false
    isCalculatingRouteRef.current = false
    setIsVehicleActive(false)
    setIsCalculatingRoute(false)
    setCurrentSegment(null)
    currentSegmentRef.current = null
    setRouteError(null)
    setFailedAttempts(0)
  }

  const getDetailedRouteError = (vehicle, pointA, pointB) => {
    const vehicleInfo = getVehicleInfo(vehicle)
    const attempts = failedAttempts + 1
    
    if (attempts === 1) {
      return `⚠️ Cannot route between water and land. Please select two points both on land or both on water.`
    } else if (attempts === 2) {
      return `❌ Still cannot route water-to-land after ${attempts} attempts. Try selecting different points on the same terrain type.`
    } else {
      return `❌ Unable to calculate route after ${attempts} attempts. Make sure both points are on land or both on water.`
    }
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
          safeFitBounds(map.current, bounds, { padding: [50, 50], maxZoom: 15, animate: true })
        }
      } catch (error) {
        console.error('Error in focusRoute bounds:', error)
      }
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
    setFailedAttempts(0)
    setActiveRouteId(null)
    setHistoryPage(0)
    isVehicleActiveRef.current = false
    currentSegmentRef.current = null
    isCalculatingRouteRef.current = false
    routeCardsLengthRef.current = 0
  }, [routeControls, routeMarkers])

  useMapSetup(mapContainer, map, setMapReady)

  // ── Map click handler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !map.current || !window.L) return

    const handleMapClick = async (e) => {
      try {
        // Extra safety check that map is ready
        if (!isMapReady(map.current)) {
          console.warn('Map not ready when click occurred')
          return
        }
        
        const vehicleActive = isVehicleActiveRef.current
        const segment = currentSegmentRef.current
        const calculating = isCalculatingRouteRef.current

        if (!vehicleActive || !segment || segment.waypoints.length >= 2 || calculating) return

        setRouteError(null)
        const waypointIndex = segment.waypoints.length

        // ── Point A ────────────────────────────────────────────────────────────
        if (waypointIndex === 0) {
          // Check for water body before placing marker
          isCalculatingRouteRef.current = true
          setIsCalculatingRoute(true)
          setRouteStatusMsg('Checking location…')
          const onWater = await isWaterBody(e.latlng)
          isCalculatingRouteRef.current = false
          setIsCalculatingRoute(false)

          if (onWater) {
            setRouteError('🌊 Point A is on a water body. Please select a point on land.')
            return
          }

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
          // Check for water body before placing marker
          isCalculatingRouteRef.current = true
          setIsCalculatingRoute(true)
          setRouteStatusMsg('Checking location…')
          const onWater = await isWaterBody(e.latlng)
          if (onWater) {
            isCalculatingRouteRef.current = false
            setIsCalculatingRoute(false)
            setRouteError('🌊 Point B is on a water body. Please select a point on land.')
            return
          }
          setRouteStatusMsg('Calculating route…')

          const markerB = window.L.marker(e.latlng)
            .addTo(map.current)
            .bindPopup(`Point B (${getVehicleInfo(segment.vehicle).name})`)
            .openPopup()
          const updatedMarkers = [...segment.markers, markerB]

          currentSegmentRef.current = null
          setCurrentSegment(null)
          // isCalculatingRoute already true from water check above

          const segmentId = segment.id
          const segmentVehicle = segment.vehicle
          const colorIndex = routeCardsLengthRef.current
          const routeColor = getRouteColor(colorIndex)

          const failRoute = (msg) => {
            // Properly remove all markers from map and state
            if (updatedMarkers && Array.isArray(updatedMarkers)) {
              updatedMarkers.forEach(m => {
                try {
                  if (m && m.remove) {
                    m.remove()
                  } else if (m) {
                    map.current.removeLayer(m)
                  }
                } catch (e) {
                  console.log('Error removing marker in failRoute:', e)
                }
              })
            }
            
            isVehicleActiveRef.current = false
            isCalculatingRouteRef.current = false
            setIsVehicleActive(false)
            setIsCalculatingRoute(false)
            setFailedAttempts(prev => prev + 1)
            setRouteError(msg)
            
            // Keep the segment with waypoints for retry, but NO markers in state
            // since we already removed them from the map
            const retrySegment = { 
              vehicle: segmentVehicle, 
              waypoints: [segment.waypoints[0], e.latlng], 
              markers: [], 
              id: segmentId 
            }
            currentSegmentRef.current = retrySegment
            setCurrentSegment(retrySegment)
          }

          const osrm = await fetchOSRMRoute(segment.waypoints[0], e.latlng)
          if (!osrm.ok) {
            const errorMsg = getDetailedRouteError(segmentVehicle, segment.waypoints[0], e.latlng)
            failRoute(errorMsg)
            return
          }

          const { distanceKm, durationSec, coords } = osrm
          const timeMinutes = Math.round(durationSec / 60)

          // Validate coords before drawing
          if (!coords || coords.length < 2) {
            failRoute('⚠️ Invalid route returned.')
            return
          }
          
          // Validate all coordinates are valid numbers and within bounds
          if (!validateCoordinates(coords)) {
            failRoute('⚠️ Route contains invalid coordinates. This route cannot be displayed.')
            return
          }

          let polyline = null
          
          try {
            // Check if map is ready before adding polyline
            if (!isMapReady(map.current)) {
              failRoute('⚠️ Map is not ready. Please wait a moment and try again.')
              return
            }
            
            polyline = safeAddPolylineToMap(map.current, coords, {
              color: routeColor,
              weight: 5,
              opacity: 0.85
            })
            
            if (!polyline) {
              failRoute('⚠️ Could not display route on map.')
              return
            }
            
            // Try to fit bounds, but don't fail if it doesn't work
            try {
              const bounds = polyline.getBounds()
              if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
                safeFitBounds(map.current, bounds, { padding: [40, 40] })
              }
            } catch (boundsError) {
              console.warn('Could not fit map bounds, continuing anyway:', boundsError.message)
              // Don't fail - route is already created and visible
            }
          } catch (polylineError) {
            console.error('Error creating polyline or fitting bounds:', polylineError)
            failRoute('⚠️ Could not display route on map.')
            return
          }

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
          currentSegmentRef.current = null
          setIsVehicleActive(false)
          setIsCalculatingRoute(false)
          setCurrentSegment(null)
        }
      } catch (error) {
        console.error('Unexpected error in map click handler:', error)
        // Clean up state
        isVehicleActiveRef.current = false
        isCalculatingRouteRef.current = false
        setIsVehicleActive(false)
        setIsCalculatingRoute(false)
        // Clean up any markers that were added
        if (currentSegmentRef.current?.markers && map.current) {
          currentSegmentRef.current.markers.forEach(m => {
            try {
              if (m && m.remove) {
                m.remove()
              } else if (m) {
                map.current.removeLayer(m)
              }
            } catch (_) {}
          })
        }
        // Show user-friendly error
        setRouteError('❌ An unexpected error occurred. Please try again or reset your route.')
      }
    }

    map.current.on('click', handleMapClick)
    return () => { if (map.current) map.current.off('click', handleMapClick) }
  }, [mapReady])

  // ── Global error handler ────────────────────────────────────────────────────
  useEffect(() => {
    const handleError = (event) => {
      // Check if it's a Bounds error or other map-related error
      const isBoundsError = event.filename?.includes('Bounds') || 
                            event.message?.includes('reading \'x\'') ||
                            event.message?.includes('reading \'y\'') ||
                            event.message?.includes('Cannot read properties of undefined')
      
      if (event.message && (isBoundsError || 
          event.message.includes("Cannot read property") ||
          event.filename?.includes('Bounds'))) {
        event.preventDefault()
        console.error('Caught map bounds error:', event.message, event.filename)
        
        // Clear calculation state if it was running
        if (isCalculatingRouteRef.current) {
          isCalculatingRouteRef.current = false
          setIsCalculatingRoute(false)
          // Clean up markers properly
          if (currentSegmentRef.current?.markers && Array.isArray(currentSegmentRef.current.markers) && map.current) {
            currentSegmentRef.current.markers.forEach(m => {
              try {
                if (m && m.remove) {
                  m.remove()
                } else if (m) {
                  map.current.removeLayer(m)
                }
              } catch (_) {}
            })
          }
        }
        // Show error to user
        setRouteError('❌ Error displaying map. Please try again or reset your route.')
        return true
      }
    }

    const handleUnhandledRejection = (event) => {
      if (event.reason && typeof event.reason.message === 'string' && 
          (event.reason.message.includes('Cannot read properties') || 
           event.reason.message.includes('Cannot read property') ||
           event.reason.message.includes('reading \'x\'') ||
           event.reason.message.includes('reading \'y\''))) {
        event.preventDefault()
        console.error('Caught unhandled promise rejection:', event.reason)
        
        if (isCalculatingRouteRef.current) {
          isCalculatingRouteRef.current = false
          setIsCalculatingRoute(false)
          if (currentSegmentRef.current?.markers && Array.isArray(currentSegmentRef.current.markers) && map.current) {
            currentSegmentRef.current.markers.forEach(m => {
              try {
                if (m && m.remove) {
                  m.remove()
                } else if (m) {
                  map.current.removeLayer(m)
                }
              } catch (_) {}
            })
          }
        }
        setRouteError('❌ Error displaying map. Please try again or reset your route.')
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

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

              {isCalculatingRoute && !routeError && (
                <div className="calculating-card">
                  <div className="calculating-content">
                    <div className="calculating-spinner">⏳</div>
                    <div className="calculating-text">{routeStatusMsg}</div>
                    <button 
                      className="calculating-cancel-btn"
                      onClick={handleCancelRoute}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                </div>
              )}

              {routeError && (
                <div className="error-card">
                  <div className="error-card-content">
                    <div className="error-message">{routeError}</div>
                    <div className="error-actions">
                      <button 
                        className="error-btn error-btn-reroute"
                        onClick={handleRerouteRoute}
                        disabled={isCalculatingRoute}
                      >
                        🔄 Reroute
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!routeInfo ? (
                <div className="info-card">
                  <div className="card-header"><h3>📍 Ready to Calculate Fare</h3></div>
                  <div className="card-content">
                    <div className="instruction-steps">
                      <div className="step"><span className="step-number">1</span><span className="step-text">Select your transport above</span></div>
                      <div className="step"><span className="step-number">2</span><span className="step-text">Tap Point A on the map</span></div>
                      <div className="step"><span className="step-number">3</span><span className="step-text">Tap Point B on the map</span></div>
                    </div>
                    <div className="tip-steps">
                      <div className="tip"><span className="tip-icon">🚫</span><span className="tip-text">Points on water bodies are not allowed</span></div>
                      <div className="tip desktop-only"><span className="tip-icon">💡</span><span className="tip-text">Right-click + drag to pan the map</span></div>
                      <div className="tip mobile-only"><span className="tip-icon">💡</span><span className="tip-text">Drag with one finger to pan</span></div>
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
