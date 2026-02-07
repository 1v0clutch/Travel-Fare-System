import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const routingControl = useRef(null)
  const [waypoints, setWaypoints] = useState([])
  const [isSettingRoute, setIsSettingRoute] = useState(false)
  const [routeInfo, setRouteInfo] = useState(null)
  const [isAddingWaypoint, setIsAddingWaypoint] = useState(false)
  const [multiModalRoute, setMultiModalRoute] = useState(null)
  const [selectedVehicle, setSelectedVehicle] = useState(null) // No default vehicle
  const [leg1Vehicle, setLeg1Vehicle] = useState('bus') // A → C vehicle
  const [leg2Vehicle, setLeg2Vehicle] = useState('tricycle') // C → B vehicle
  const [routeCards, setRouteCards] = useState([]) // Store route cards
  const [routeControls, setRouteControls] = useState([]) // Store routing controls for each route
  const [routeMarkers, setRouteMarkers] = useState([]) // Store markers for each route
  const [isVehicleActive, setIsVehicleActive] = useState(false) // Track if vehicle is active for plotting
  const [currentSegment, setCurrentSegment] = useState(null) // Track current route segment
  const [routeSegments, setRouteSegments] = useState([]) // Store all route segments
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false) // Track route calculation
  const [airportMarkers, setAirportMarkers] = useState([]) // Store airport markers
  const [pierMarkers, setPierMarkers] = useState([]) // Store pier markers

  // Calculate jeepney fare - 13 pesos for first 3km, then 1 peso per km
  const calculateJeepneyFare = (distanceKm) => {
    if (distanceKm <= 3) {
      return 13 // Base fare for first 3km
    } else {
      const additionalKm = distanceKm - 3
      return 13 + (additionalKm * 1) // 13 base + 1 peso per additional km
    }
  }

  // Calculate tricycle fare - 15 pesos for first 1km, then 10 pesos per km
  const calculateTricycleFare = (distanceKm) => {
    if (distanceKm <= 1) {
      return 15 // Base fare for first 1km
    } else {
      const additionalKm = distanceKm - 1
      return 15 + (additionalKm * 10) // 15 base + 10 peso per additional km
    }
  }

  // Calculate taxi fare - 13-15 pesos per kilometer
  const calculateTaxiFare = (distanceKm) => {
    return distanceKm * 14 // 14 pesos per km (average of 13-15)
  }

  // Calculate bus fare - 15 pesos for first 3km, then 1 peso per km
  const calculateBusFare = (distanceKm) => {
    if (distanceKm <= 3) {
      return 15 // Base fare for first 3km
    } else {
      const additionalKm = distanceKm - 3
      return 15 + (additionalKm * 1) // 15 base + 1 peso per additional km
    }
  }

  // Calculate motorcycle fare - 50 pesos for first 2km, then 10 pesos per km
  const calculateMotorcycleFare = (distanceKm) => {
    if (distanceKm <= 2) {
      return 50 // Base fare for first 2km
    } else {
      const additionalKm = distanceKm - 2
      return 50 + (additionalKm * 10) // 50 base + 10 peso per additional km
    }
  }

  // Calculate boat fare based on Philippine rates
  const calculateBoatFare = (distanceKm) => {
    if (distanceKm <= 10) {
      return 50 // Base fare for first 10km
    } else {
      const additionalKm = distanceKm - 10
      return 50 + (additionalKm * 5) // 50 base + 5 peso per additional km
    }
  }

  // Calculate plane fare based on Philippine domestic rates
  const calculatePlaneFare = (distanceKm) => {
    const baseFare = 2500 // Base domestic fare
    const distanceFactor = Math.max(0, distanceKm - 100) * 2 // Additional cost for long distances
    return baseFare + distanceFactor
  }

  // Calculate fare based on vehicle type with restrictions
  const calculateFareByVehicle = (distanceKm, vehicle) => {
    // Check vehicle availability first
    if (!isVehicleAvailable(vehicle, distanceKm)) {
      return null
    }
    
    let fare
    switch (vehicle) {
      case 'jeepney':
        fare = calculateJeepneyFare(distanceKm)
        break
      case 'tricycle':
        fare = calculateTricycleFare(distanceKm)
        break
      case 'taxi':
        fare = calculateTaxiFare(distanceKm)
        break
      case 'bus':
        fare = calculateBusFare(distanceKm)
        break
      case 'motorcycle':
        fare = calculateMotorcycleFare(distanceKm)
        break
      case 'boat':
        fare = calculateBoatFare(distanceKm)
        break
      case 'plane':
        fare = calculatePlaneFare(distanceKm)
        break
      default:
        fare = calculateJeepneyFare(distanceKm)
    }
    
    // Round to 2 decimal places
    return Math.round(fare * 100) / 100
  }

  // Check if vehicle is available for the distance
  const isVehicleAvailable = (vehicle, distanceKm) => {
    switch (vehicle) {
      case 'jeepney':
        return distanceKm <= 100 // Jeepney restricted to 100km
      case 'tricycle':
        return distanceKm <= 20 // Tricycle restricted to 20km
      case 'taxi':
        return distanceKm <= 50 // Taxi restricted to 50km
      case 'bus':
        return distanceKm <= 300 // Bus restricted to 300km
      case 'motorcycle':
        return distanceKm <= 100 // Motorcycle restricted to 100km
      case 'boat':
        return true // Boat has no distance restrictions
      case 'plane':
        return true // Plane has no distance restrictions
      default:
        return true
    }
  }

  // Get vehicle display info
  const getVehicleInfo = (vehicle) => {
    const vehicleData = {
      jeepney: { icon: '🚌', name: 'Jeepney' },
      tricycle: { icon: '🛺', name: 'Tricycle' },
      taxi: { icon: '🚕', name: 'Taxi' },
      bus: { icon: '🚍', name: 'Bus' },
      motorcycle: { icon: '🏍️', name: 'Motorcycle' },
      boat: { icon: '🚤', name: 'Boat' },
      plane: { icon: '✈️', name: 'Plane' }
    }
    return vehicleData[vehicle] || vehicleData.jeepney
  }

  const handleVehicleSelect = (vehicle) => {
    console.log(`Selecting vehicle: ${vehicle}`)
    setSelectedVehicle(vehicle)
    setIsVehicleActive(true)
    setCurrentSegment({
      vehicle: vehicle,
      waypoints: [],
      markers: [], // Initialize markers array
      startTime: Date.now(),
      id: Date.now() // Add unique ID for route card
    })
    
    console.log(`Selected vehicle: ${vehicle}, isVehicleActive will be set to true`)
  }

  const removeRouteCard = (cardId) => {
    // Find the route control associated with this card
    const routeControlIndex = routeControls.findIndex(control => control.id === cardId)
    
    if (routeControlIndex !== -1 && map.current) {
      // Remove the routing control from the map
      const controlToRemove = routeControls[routeControlIndex].control
      try {
        // Check if it's a pseudo control (plane/boat) or regular routing control
        if (controlToRemove.remove) {
          controlToRemove.remove()
        } else {
          map.current.removeControl(controlToRemove)
        }
        console.log(`Removed route control for card ${cardId}`)
      } catch (e) {
        console.log('Error removing route control:', e)
      }
      
      // Remove from routeControls array
      setRouteControls(prev => prev.filter(control => control.id !== cardId))
    }
    
    // Find and remove markers associated with this card
    const markersToRemove = routeMarkers.filter(m => m.id === cardId)
    if (map.current && markersToRemove.length > 0) {
      markersToRemove.forEach(markerObj => {
        markerObj.markers.forEach(marker => {
          try {
            map.current.removeLayer(marker)
            console.log(`Removed marker for card ${cardId}`)
          } catch (e) {
            console.log('Error removing marker:', e)
          }
        })
      })
      
      // Remove from routeMarkers array
      setRouteMarkers(prev => prev.filter(m => m.id !== cardId))
    }
    
    // Remove the route card
    setRouteCards(prev => prev.filter(card => card.id !== cardId))
    
    // Clear route info if this was the displayed route
    if (routeInfo && routeInfo.vehicle) {
      const removedCard = routeCards.find(c => c.id === cardId)
      if (removedCard && routeInfo.vehicle === removedCard.vehicle) {
        setRouteInfo(null)
      }
    }
    
    console.log(`Removed route card ${cardId}`)
  }

  const toggleRouteVisibility = (cardId) => {
    const card = routeCards.find(c => c.id === cardId)
    if (!card) return
    
    const newVisibility = !card.visible
    
    // Toggle routing control visibility
    const routeControl = routeControls.find(control => control.id === cardId)
    if (routeControl && map.current) {
      if (newVisibility) {
        // Show route
        try {
          // Check if it's a pseudo control (plane/boat) or regular routing control
          if (routeControl.control._line) {
            // Pseudo control - add polyline back
            routeControl.control._line.addTo(map.current)
          } else {
            // Regular routing control
            routeControl.control.addTo(map.current)
          }
        } catch (e) {
          console.log('Route already on map or error:', e)
        }
      } else {
        // Hide route
        try {
          // Check if it's a pseudo control (plane/boat) or regular routing control
          if (routeControl.control._line) {
            // Pseudo control - remove polyline
            map.current.removeLayer(routeControl.control._line)
          } else {
            // Regular routing control
            map.current.removeControl(routeControl.control)
          }
        } catch (e) {
          console.log('Error hiding route:', e)
        }
      }
    }
    
    // Toggle markers visibility
    const markers = routeMarkers.find(m => m.id === cardId)
    if (markers && map.current) {
      markers.markers.forEach(marker => {
        if (newVisibility) {
          marker.addTo(map.current)
        } else {
          map.current.removeLayer(marker)
        }
      })
    }
    
    // Update card visibility state
    setRouteCards(prev => prev.map(c => 
      c.id === cardId ? { ...c, visible: newVisibility } : c
    ))
  }

  // Major airports in the Philippines
  const airports = [
    // Luzon
    { name: "Ninoy Aquino International Airport (NAIA)", lat: 14.5086, lng: 121.0194 },
    { name: "Clark International Airport", lat: 15.1859, lng: 120.5602 },
    { name: "Baguio Airport", lat: 16.3751, lng: 120.6200 },
    { name: "Laoag International Airport", lat: 18.1781, lng: 120.5320 },
    { name: "Tuguegarao Airport", lat: 17.6434, lng: 121.7340 },
    { name: "Cauayan Airport", lat: 16.9298, lng: 121.7527 },
    { name: "Basco Airport", lat: 20.4513, lng: 121.9799 },
    { name: "San Jose Airport (Mindoro)", lat: 12.3625, lng: 121.0468 },
    { name: "Mamburao Airport", lat: 13.2081, lng: 120.6058 },
    
    // Visayas
    { name: "Mactan-Cebu International Airport", lat: 10.3077, lng: 123.9792 },
    { name: "Iloilo International Airport", lat: 10.8331, lng: 122.4925 },
    { name: "Bacolod-Silay Airport", lat: 10.7764, lng: 123.0153 },
    { name: "Dumaguete Airport", lat: 9.3337, lng: 123.3006 },
    { name: "Tagbilaran Airport", lat: 9.6656, lng: 123.8531 },
    { name: "Roxas Airport", lat: 11.5977, lng: 122.7517 },
    { name: "Kalibo International Airport", lat: 11.6794, lng: 122.3758 },
    { name: "Caticlan Airport", lat: 11.9244, lng: 121.9539 },
    { name: "Tacloban Airport", lat: 11.2279, lng: 125.0278 },
    { name: "Ormoc Airport", lat: 11.0578, lng: 124.5653 },
    
    // Mindanao
    { name: "Francisco Bangoy International Airport (Davao)", lat: 7.1255, lng: 125.6456 },
    { name: "Laguindingan Airport", lat: 8.6158, lng: 124.4606 },
    { name: "Butuan Airport", lat: 8.9515, lng: 125.4789 },
    { name: "Surigao Airport", lat: 9.7558, lng: 125.4811 },
    { name: "Tandag Airport", lat: 9.0722, lng: 126.1711 },
    { name: "Bislig Airport", lat: 8.1956, lng: 126.3211 },
    { name: "Zamboanga International Airport", lat: 6.9222, lng: 122.0597 },
    { name: "Jolo Airport", lat: 6.0536, lng: 121.0111 },
    { name: "Tawi-Tawi Airport", lat: 5.1306, lng: 119.7397 },
    { name: "Cotabato Airport", lat: 7.1653, lng: 124.2097 },
    { name: "General Santos Airport", lat: 6.0581, lng: 125.0969 },
    { name: "Dipolog Airport", lat: 8.6019, lng: 123.3419 },
    { name: "Ozamiz Airport", lat: 8.1781, lng: 123.8419 },
    { name: "Pagadian Airport", lat: 7.8306, lng: 123.4597 }
  ]

  // Major ports and piers in the Philippines
  const piers = [
    // Luzon Ports
    { name: "Manila North Harbor", lat: 14.6167, lng: 120.9667 },
    { name: "Manila South Harbor", lat: 14.5833, lng: 120.9667 },
    { name: "Batangas Port", lat: 13.7565, lng: 121.0583 },
    { name: "Subic Bay Port", lat: 14.8167, lng: 120.2667 },
    { name: "San Fernando Port (La Union)", lat: 16.6167, lng: 120.3167 },
    { name: "Currimao Port", lat: 17.9833, lng: 120.4833 },
    { name: "Salomague Port", lat: 17.5833, lng: 120.4833 },
    { name: "Aparri Port", lat: 18.3667, lng: 121.6333 },
    { name: "Lucena Port", lat: 14.0000, lng: 121.6167 },
    { name: "Calapan Port", lat: 13.4167, lng: 121.1833 },
    { name: "Puerto Princesa Port", lat: 9.7392, lng: 118.7353 },
    { name: "Coron Port", lat: 12.0067, lng: 120.2067 },
    { name: "El Nido Port", lat: 11.1944, lng: 119.4028 },
    
    // Visayas Ports
    { name: "Cebu Port", lat: 10.2929, lng: 123.9061 },
    { name: "Iloilo Port", lat: 10.6953, lng: 122.5621 },
    { name: "Bacolod Port", lat: 10.6667, lng: 122.9500 },
    { name: "Dumaguete Port", lat: 9.3067, lng: 123.3067 },
    { name: "Tagbilaran Port", lat: 9.6500, lng: 123.8667 },
    { name: "Ormoc Port", lat: 11.0167, lng: 124.6000 },
    { name: "Tacloban Port", lat: 11.2500, lng: 125.0000 },
    { name: "Catbalogan Port", lat: 11.7667, lng: 124.8833 },
    { name: "Calbayog Port", lat: 12.0667, lng: 124.6000 },
    { name: "Roxas Port", lat: 11.5833, lng: 122.7500 },
    { name: "Kalibo Port", lat: 11.7000, lng: 122.3667 },
    { name: "Caticlan Port", lat: 11.9167, lng: 121.9500 },
    { name: "San Carlos Port (Negros)", lat: 10.4833, lng: 123.4167 },
    { name: "Toledo Port", lat: 10.3833, lng: 123.6333 },
    
    // Mindanao Ports
    { name: "Davao Port", lat: 7.0833, lng: 125.6167 },
    { name: "Cagayan de Oro Port", lat: 8.4833, lng: 124.6500 },
    { name: "Iligan Port", lat: 8.2333, lng: 124.2333 },
    { name: "Butuan Port", lat: 8.9500, lng: 125.5333 },
    { name: "Surigao Port", lat: 9.7833, lng: 125.5000 },
    { name: "Zamboanga Port", lat: 6.9167, lng: 122.0833 },
    { name: "Jolo Port", lat: 6.0500, lng: 121.0000 },
    { name: "Bongao Port", lat: 5.0333, lng: 119.7667 },
    { name: "General Santos Port", lat: 6.1167, lng: 125.1667 },
    { name: "Cotabato Port", lat: 7.2167, lng: 124.2500 },
    { name: "Dipolog Port", lat: 8.5833, lng: 123.3333 },
    { name: "Ozamiz Port", lat: 8.1500, lng: 123.8333 },
    { name: "Pagadian Port", lat: 7.8167, lng: 123.4333 },
    { name: "Nasipit Port", lat: 8.9833, lng: 125.3500 },
    { name: "Bohol Port (Tubigon)", lat: 10.0500, lng: 123.9833 }
  ]

  const showVehicleSpecificMarkers = (vehicle) => {
    if (!map.current || !window.L) return

    // Clear existing special markers first
    clearSpecialMarkers()

    if (vehicle === 'plane') {
      // Show airports
      const newAirportMarkers = airports.map(airport => {
        const marker = window.L.marker([airport.lat, airport.lng], {
          icon: window.L.divIcon({
            html: '<div style="background: rgba(168, 230, 207, 0.95); border: 3px solid #A8E6CF; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 12px rgba(168, 230, 207, 0.6); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform=\'scale(1.2)\'; this.style.boxShadow=\'0 6px 16px rgba(168, 230, 207, 0.8)\';" onmouseout="this.style.transform=\'scale(1)\'; this.style.boxShadow=\'0 4px 12px rgba(168, 230, 207, 0.6)\';">✈️</div>',
            className: 'airport-marker-container',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          })
        })
        .addTo(map.current)
        .bindPopup(`<strong>${airport.name}</strong><br><small>Click to select this airport</small>`)
        
        return marker
      })
      setAirportMarkers(newAirportMarkers)
      console.log(`Added ${newAirportMarkers.length} airport markers`)
      
    } else if (vehicle === 'boat') {
      // Show piers
      const newPierMarkers = piers.map(pier => {
        const marker = window.L.marker([pier.lat, pier.lng], {
          icon: window.L.divIcon({
            html: '<div style="background: rgba(78, 205, 196, 0.95); border: 3px solid #4ECDC4; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 12px rgba(78, 205, 196, 0.6); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform=\'scale(1.2)\'; this.style.boxShadow=\'0 6px 16px rgba(78, 205, 196, 0.8)\';" onmouseout="this.style.transform=\'scale(1)\'; this.style.boxShadow=\'0 4px 12px rgba(78, 205, 196, 0.6)\';">⚓</div>',
            className: 'pier-marker-container',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          })
        })
        .addTo(map.current)
        .bindPopup(`<strong>${pier.name}</strong><br><small>Click to select this port</small>`)
        
        return marker
      })
      setPierMarkers(newPierMarkers)
      console.log(`Added ${newPierMarkers.length} pier markers`)
    }
  }

  const clearSpecialMarkers = () => {
    if (!map.current) return
    
    // Clear airport markers
    airportMarkers.forEach(marker => {
      try {
        map.current.removeLayer(marker)
      } catch (e) {
        console.log('Error removing airport marker:', e)
      }
    })
    setAirportMarkers([])

    // Clear pier markers
    pierMarkers.forEach(marker => {
      try {
        map.current.removeLayer(marker)
      } catch (e) {
        console.log('Error removing pier marker:', e)
      }
    })
    setPierMarkers([])
    
    console.log('Cleared all special markers')
  }

  useEffect(() => {
    // Load Leaflet CSS and JS
    const link = document.createElement('link')
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      // Load Leaflet Routing Machine
      const routingScript = document.createElement('script')
      routingScript.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js'
      routingScript.onload = () => {
        const routingCSS = document.createElement('link')
        routingCSS.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css'
        routingCSS.rel = 'stylesheet'
        document.head.appendChild(routingCSS)

        // Initialize map
        if (mapContainer.current && !map.current) {
          map.current = window.L.map(mapContainer.current).setView([12.8797, 121.7740], 6) // Center on Philippines

          // Add OpenStreetMap tiles
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map.current)
          
          // Restrict map bounds to Philippines
          const philippinesBounds = window.L.latLngBounds(
            window.L.latLng(4.5, 116.0), // Southwest corner
            window.L.latLng(21.0, 127.0)  // Northeast corner
          )
          map.current.setMaxBounds(philippinesBounds)
          map.current.setMinZoom(5)
          map.current.setMaxZoom(18)
        }
      }
      document.head.appendChild(routingScript)
    }
    document.head.appendChild(script)

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Separate useEffect for handling map click
  useEffect(() => {
    if (!map.current || !window.L) return

    const completeWaypointSelection = (waypoint, locationName, waypointIndex) => {
      console.log('completeWaypointSelection called:', { waypoint, locationName, waypointIndex })
      const isFirstPoint = waypointIndex === 0
      const isSecondPoint = waypointIndex === 1
        
      // Add marker
      const markerLabel = isFirstPoint ? 'A' : 'B'
      const popupText = locationName ? 
        `Point ${markerLabel} (${getVehicleInfo(currentSegment.vehicle).name})<br><small>${locationName}</small>` :
        `Point ${markerLabel} (${getVehicleInfo(currentSegment.vehicle).name})`
          
      const marker = window.L.marker(waypoint)
        .addTo(map.current)
        .bindPopup(popupText)
        .openPopup()
      
      // Store marker temporarily in current segment
      const updatedSegment = {
        ...currentSegment,
        waypoints: [...currentSegment.waypoints, waypoint],
        markers: currentSegment.markers ? [...currentSegment.markers, marker] : [marker]
      }
      setCurrentSegment(updatedSegment)
      
      if (isSecondPoint) {
        console.log('Creating route for second point')
        setIsCalculatingRoute(true) // Start calculating
        
        // Complete the route for this vehicle
        const waypoints = updatedSegment.waypoints
        
        // Check if this is a plane or boat route (direct line instead of road routing)
        const isDirectRoute = currentSegment.vehicle === 'plane' || currentSegment.vehicle === 'boat'
        
        if (isDirectRoute) {
          // For planes and boats, draw a direct dashed line
          const latlngs = [waypoints[0], waypoints[1]]
          
          // Calculate straight-line distance
          const distanceMeters = map.current.distance(waypoints[0], waypoints[1])
          const distanceKm = (distanceMeters / 1000).toFixed(2)
          
          // Estimate time based on vehicle type
          let timeMinutes
          if (currentSegment.vehicle === 'plane') {
            // Average plane speed: 800 km/h
            timeMinutes = Math.round((parseFloat(distanceKm) / 800) * 60)
          } else {
            // Average boat speed: 40 km/h
            timeMinutes = Math.round((parseFloat(distanceKm) / 40) * 60)
          }
          
          console.log('Direct route details:', { distanceKm, timeMinutes, vehicle: currentSegment.vehicle })
          
          const fare = calculateFareByVehicle(parseFloat(distanceKm), currentSegment.vehicle)
          console.log('Calculated fare:', fare)
          
          // Draw dashed line for plane/boat
          const lineColor = currentSegment.vehicle === 'plane' ? '#A8E6CF' : '#4ECDC4'
          const polyline = window.L.polyline(latlngs, {
            color: lineColor,
            weight: 3,
            opacity: 0.8,
            dashArray: '10, 10' // Dashed line
          }).addTo(map.current)
          
          // Create a pseudo routing control object to store the polyline
          const pseudoControl = {
            _line: polyline,
            remove: function() {
              if (map.current && this._line) {
                map.current.removeLayer(this._line)
              }
            }
          }
          
          // Create route card
          const routeCard = {
            id: currentSegment.id,
            vehicle: currentSegment.vehicle,
            distance: distanceKm,
            time: timeMinutes,
            fare: fare,
            timestamp: Date.now(),
            type: 'single',
            visible: true
          }
          
          // Store the pseudo control with the route ID
          setRouteControls(prev => [...prev, {
            id: currentSegment.id,
            control: pseudoControl
          }])
          
          // Store the markers with the route ID
          if (updatedSegment.markers) {
            setRouteMarkers(prev => [...prev, {
              id: currentSegment.id,
              markers: updatedSegment.markers
            }])
          }
          
          // Add to route cards
          setRouteCards(prev => [...prev, routeCard])
          
          // Set route info for display
          setRouteInfo({
            distance: distanceKm,
            time: timeMinutes,
            fare: fare,
            vehicle: currentSegment.vehicle,
            alternatives: []
          })
          
          // Deactivate vehicle after completing route
          setIsVehicleActive(false)
          setCurrentSegment(null)
          setIsCalculatingRoute(false)
          
          // Clear special markers after route completion
          clearSpecialMarkers()
          
          console.log('Direct route created successfully')
        } else {
          // For land vehicles, use road routing
          const newRoutingControl = window.L.Routing.control({
          waypoints: waypoints,
          routeWhileDragging: true,
          addWaypoints: false,
          router: window.L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            timeout: 30000 // 30 second timeout
          }),
          createMarker: function() { return null }, // Don't create default markers
          fitSelectedRoutes: true,
          showAlternatives: true, // Enable alternatives for better routing options
          lineOptions: {
            styles: [
              {color: '#6FA1EC', weight: 4, opacity: 0.7},
              {color: '#2c5aa0', weight: 6, opacity: 0.8}
            ]
          }
        }).on('routesfound', function(e) {
          console.log('Route found:', e.routes)
          const routes = e.routes
          if (routes && routes.length > 0) {
            const mainRoute = routes[0]
            const distanceKm = (mainRoute.summary.totalDistance / 1000).toFixed(2)
            const timeMinutes = Math.round(mainRoute.summary.totalTime / 60)
            
            console.log('Route details:', { distanceKm, timeMinutes, vehicle: currentSegment.vehicle })
            
            // Check if selected vehicle is available for this distance
            if (!isVehicleAvailable(currentSegment.vehicle, parseFloat(distanceKm))) {
              console.log('Vehicle not available for this distance - removing route from map')
              let errorMessage = ''
              switch (currentSegment.vehicle) {
                case 'jeepney':
                  errorMessage = `Jeepney is restricted to 100km maximum. Current route: ${distanceKm}km`
                  break
                case 'tricycle':
                  errorMessage = `Tricycle is restricted to 20km maximum. Current route: ${distanceKm}km`
                  break
                case 'taxi':
                  errorMessage = `Taxi is restricted to 50km maximum. Current route: ${distanceKm}km`
                  break
                case 'bus':
                  errorMessage = `Bus is restricted to 300km maximum. Current route: ${distanceKm}km`
                  break
                case 'motorcycle':
                  errorMessage = `Motorcycle is restricted to 100km maximum. Current route: ${distanceKm}km`
                  break
                default:
                  errorMessage = `${currentSegment.vehicle} not available for this route`
              }
              
              // Remove the routing control from the map immediately
              if (map.current) {
                try {
                  map.current.removeControl(newRoutingControl)
                  console.log('Removed invalid routing control from map')
                } catch (e) {
                  console.log('Error removing routing control:', e)
                }
              }
              
              // Remove the markers from the map
              if (updatedSegment.markers && map.current) {
                updatedSegment.markers.forEach(marker => {
                  try {
                    map.current.removeLayer(marker)
                    console.log('Removed marker from map')
                  } catch (e) {
                    console.log('Error removing marker:', e)
                  }
                })
              }
              
              // Show error message
              setRouteInfo({
                distance: distanceKm,
                time: timeMinutes,
                fare: null,
                vehicle: currentSegment.vehicle,
                error: errorMessage,
                alternatives: []
              })
              
              // Deactivate vehicle and clear current segment
              setIsVehicleActive(false)
              setCurrentSegment(null)
              setIsCalculatingRoute(false)
              clearSpecialMarkers()
              
              return
            }
            
            const fare = calculateFareByVehicle(parseFloat(distanceKm), currentSegment.vehicle)
            console.log('Calculated fare:', fare)
            
            // Create route card
            const routeCard = {
              id: currentSegment.id,
              vehicle: currentSegment.vehicle,
              distance: distanceKm,
              time: timeMinutes,
              fare: fare,
              timestamp: Date.now(),
              type: 'single',
              visible: true // Add visibility toggle
            }
            
            // Store the routing control with the route ID
            setRouteControls(prev => [...prev, {
              id: currentSegment.id,
              control: newRoutingControl
            }])
            
            // Store the markers with the route ID
            if (updatedSegment.markers) {
              setRouteMarkers(prev => [...prev, {
                id: currentSegment.id,
                markers: updatedSegment.markers
              }])
            }
            
            // Add to route cards
            setRouteCards(prev => [...prev, routeCard])
            
            // Set route info for display
            setRouteInfo({
              distance: distanceKm,
              time: timeMinutes,
              fare: fare,
              vehicle: currentSegment.vehicle,
              alternatives: []
            })
            
            console.log('Route info set successfully')
          } else {
            console.log('No routes found')
          }
        }).on('routingerror', function(e) {
          console.error('Routing error:', e)
          setIsCalculatingRoute(false) // Stop calculating on error
        }).addTo(map.current)
        
        // Deactivate vehicle after completing route
        setIsVehicleActive(false)
        setCurrentSegment(null)
        setIsCalculatingRoute(false) // Stop calculating
        
        // Clear special markers after route completion
        clearSpecialMarkers()
        } // Close else block for land vehicles
      }
    }

    const handleMapClick = (e) => {
      console.log('Map clicked:', { isVehicleActive, currentSegment })
      if (isVehicleActive && currentSegment && currentSegment.waypoints.length < 2) {
        const newWaypoint = e.latlng
        const waypointIndex = currentSegment.waypoints.length
        const isFirstPoint = waypointIndex === 0
        const isSecondPoint = waypointIndex === 1
        let locationName = '' // Initialize locationName for all vehicles
        
        // Handle special routing for planes and boats - MUST click on markers directly
        if (currentSegment.vehicle === 'plane') {
          // Find nearest airport marker - must be very close
          const nearestAirport = airports.find(airport => {
            const distance = map.current.distance([airport.lat, airport.lng], newWaypoint)
            return distance < 2000 // Within 2km of airport marker - must click on or very near marker
          })
          
          if (!nearestAirport) {
            alert('✈️ Please click directly on an airport marker (green circles with ✈️)')
            return
          } else {
            locationName = nearestAirport.name
            // Snap to exact airport location
            newWaypoint.lat = nearestAirport.lat
            newWaypoint.lng = nearestAirport.lng
          }
        } else if (currentSegment.vehicle === 'boat') {
          // Find nearest pier marker - must be very close
          const nearestPier = piers.find(pier => {
            const distance = map.current.distance([pier.lat, pier.lng], newWaypoint)
            return distance < 2000 // Within 2km of pier marker - must click on or very near marker
          })
          
          if (!nearestPier) {
            alert('🚤 Please click directly on a port/pier marker (teal circles with ⚓)')
            return
          } else {
            locationName = nearestPier.name
            // Snap to exact pier location
            newWaypoint.lat = nearestPier.lat
            newWaypoint.lng = nearestPier.lng
          }
        }
        // For other vehicles (jeepney, tricycle, taxi, motorcycle), locationName stays empty
        
        // Complete waypoint selection for all vehicles
        console.log('Completing waypoint selection:', {
          vehicle: currentSegment.vehicle,
          waypoint: newWaypoint,
          locationName: locationName,
          waypointIndex: waypointIndex
        })
        completeWaypointSelection(newWaypoint, locationName, waypointIndex)
      }
    }

    map.current.on('click', handleMapClick)

    return () => {
      if (map.current) {
        map.current.off('click', handleMapClick)
      }
    }
  }, [isVehicleActive, currentSegment, calculateFareByVehicle, isVehicleAvailable, getVehicleInfo])

  // Separate useEffect to handle vehicle-specific markers
  useEffect(() => {
    if (selectedVehicle && isVehicleActive && map.current) {
      showVehicleSpecificMarkers(selectedVehicle)
    } else {
      clearSpecialMarkers()
    }
  }, [selectedVehicle, isVehicleActive])

  const startRouting = () => {
    // Clear existing waypoints and markers
    setWaypoints([])
    setIsSettingRoute(true)
    setIsAddingWaypoint(false)
    setRouteInfo(null)
    setMultiModalRoute(null)
    
    if (map.current) {
      // Clear only markers and routing control, not the tile layer
      map.current.eachLayer((layer) => {
        if (layer instanceof window.L.Marker) {
          map.current.removeLayer(layer)
        }
      })
      
      if (routingControl.current) {
        map.current.removeControl(routingControl.current)
        routingControl.current = null
      }
    }
  }

  const addWaypoint = () => {
    if (waypoints.length === 2 && !isAddingWaypoint) {
      setIsAddingWaypoint(true)
    }
  }

  const clearRoute = () => {
    setWaypoints([])
    setIsSettingRoute(false)
    setIsAddingWaypoint(false)
    setRouteInfo(null)
    setMultiModalRoute(null)
    setIsVehicleActive(false)
    setCurrentSegment(null)
    setRouteSegments([])
    setSelectedVehicle(null)
    
    // Clear special markers
    clearSpecialMarkers()
    
    if (map.current) {
      // Clear only markers and routing control, not the tile layer
      map.current.eachLayer((layer) => {
        if (layer instanceof window.L.Marker) {
          map.current.removeLayer(layer)
        }
      })
      
      if (routingControl.current) {
        map.current.removeControl(routingControl.current)
        routingControl.current = null
      }
    }
  }

  const clearAllRoutes = () => {
    // Remove all routing controls from the map
    if (map.current) {
      routeControls.forEach(routeControl => {
        try {
          map.current.removeControl(routeControl.control)
        } catch (e) {
          console.log('Error removing route control:', e)
        }
      })
      
      // Remove all markers from the map
      routeMarkers.forEach(markerObj => {
        markerObj.markers.forEach(marker => {
          try {
            map.current.removeLayer(marker)
          } catch (e) {
            console.log('Error removing marker:', e)
          }
        })
      })
    }
    
    // Clear all state
    setRouteCards([])
    setRouteControls([])
    setRouteMarkers([])
    clearRoute()
  }

  return (
    <div className="app-container">
      {/* Left Section - Jeepney Fare Calculator */}
      <div className="section left-section">
        <div className="fare-calculator">
          <div className="header-card">
          <h1>🚌 Transport Fare Calculator</h1>
            <p>Calculate fares for various transport modes in the Philippines</p>
          </div>
          {/* Vehicle Selection */}
          <div className="vehicle-selection-card">
            <div className="card-content">
              <div className="vehicle-grid">
                {['jeepney', 'tricycle', 'taxi', 'bus', 'motorcycle', 'boat', 'plane'].map((vehicle) => {
                  const vehicleInfo = getVehicleInfo(vehicle)
                  const isSelected = selectedVehicle === vehicle && isVehicleActive
                  return (
                    <div key={vehicle} className="vehicle-container">
                      <button 
                        className={`vehicle-option ${isSelected ? 'active' : ''}`}
                        onClick={() => handleVehicleSelect(vehicle)}
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
                  )
                })}
              </div>
              {routeCards.length > 0 && !isVehicleActive && (
                <div className="route-connection-options">
                  <p className="connection-text">Next route will be separate or you can connect to existing routes</p>
                </div>
              )}
            </div>
          </div>
          

          

          {/* Multi-Modal Vehicle Selection */}
          {waypoints.length === 2 && !multiModalRoute && (
            <div className="multi-modal-selection">
              <div className="card-header">
                <h3>🚌🛺 Multi-Modal Setup</h3>
              </div>
              <div className="card-content">
                <div className="leg-selectors">
                  <div className="leg-selector">
                    <label>A → C Vehicle:</label>
                    <div className="mini-vehicle-options">
                      {['jeepney', 'tricycle', 'taxi', 'bus', 'motorcycle', 'boat', 'plane'].map((vehicle) => {
                        const vehicleInfo = getVehicleInfo(vehicle)
                        return (
                          <button 
                            key={vehicle}
                            className={`mini-vehicle ${leg1Vehicle === vehicle ? 'active' : ''}`}
                            onClick={() => setLeg1Vehicle(vehicle)}
                            title={vehicleInfo.name}
                          >
                            {vehicleInfo.icon}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="leg-selector">
                    <label>C → B Vehicle:</label>
                    <div className="mini-vehicle-options">
                      {['jeepney', 'tricycle', 'taxi', 'bus', 'motorcycle', 'boat', 'plane'].map((vehicle) => {
                        const vehicleInfo = getVehicleInfo(vehicle)
                        return (
                          <button 
                            key={vehicle}
                            className={`mini-vehicle ${leg2Vehicle === vehicle ? 'active' : ''}`}
                            onClick={() => setLeg2Vehicle(vehicle)}
                            title={vehicleInfo.name}
                          >
                            {vehicleInfo.icon}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {!routeInfo && !multiModalRoute ? (
            <div className="info-card">
              <div className="card-header">
                <h3>📍 Ready to Calculate Fare</h3>
              </div>
              <div className="card-content">
                <div className="instruction-steps">
                  <div className="step">
                    <span className="step-number">1</span>
                    <span className="step-text">Select your transport above</span>
                  </div>
                  <div className="step">
                    <span className="step-number">2</span>
                    <span className="step-text">Click on map (or markers for ✈️/🚤)</span>
                  </div>
                  <div className="step">
                    <span className="step-number">3</span>
                    <span className="step-text">Click destination the same way</span>
                  </div>
                </div>
                <div className="transport-note">
                  <p><strong>Note:</strong> ✈️ Plane and 🚤 Boat require clicking on their respective markers</p>
                </div>
              </div>
            </div>
          ) : multiModalRoute ? (
            <div className="results-container">
              <div className="multi-modal-header">
                <h2>🚌🛺 Multi-Modal Journey</h2>
                <p>A → C → B with selected vehicles</p>
              </div>
              
              <div className="route-legs">
                <div className={`route-leg ${multiModalRoute.leg1.vehicle}-leg`}>
                  <div className="leg-header">
                    <h3>{getVehicleInfo(multiModalRoute.leg1.vehicle).icon} Leg 1: A → C ({getVehicleInfo(multiModalRoute.leg1.vehicle).name})</h3>
                  </div>
                  <div className="leg-stats">
                    <div className="leg-stat">
                      <span className="stat-icon">📏</span>
                      <span className="stat-value">{multiModalRoute.leg1.distance} km</span>
                    </div>
                    <div className="leg-stat">
                      <span className="stat-icon">⏱️</span>
                      <span className="stat-value">{multiModalRoute.leg1.time} min</span>
                    </div>
                    <div className="leg-fare">
                      <span className="fare-label">Fare:</span>
                      <span className="fare-value">₱{multiModalRoute.leg1.fare}</span>
                    </div>
                  </div>
                </div>

                <div className={`route-leg ${multiModalRoute.leg2.vehicle}-leg`}>
                  <div className="leg-header">
                    <h3>{getVehicleInfo(multiModalRoute.leg2.vehicle).icon} Leg 2: C → B ({getVehicleInfo(multiModalRoute.leg2.vehicle).name})</h3>
                  </div>
                  <div className="leg-stats">
                    <div className="leg-stat">
                      <span className="stat-icon">📏</span>
                      <span className="stat-value">{multiModalRoute.leg2.distance} km</span>
                    </div>
                    <div className="leg-stat">
                      <span className="stat-icon">⏱️</span>
                      <span className="stat-value">{multiModalRoute.leg2.time} min</span>
                    </div>
                    <div className="leg-fare">
                      <span className="fare-label">Fare:</span>
                      <span className="fare-value">₱{multiModalRoute.leg2.fare}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="total-summary">
                <div className="summary-header">
                  <h3>💰 Total Journey Cost</h3>
                </div>
                <div className="summary-stats">
                  <div className="summary-item">
                    <span className="summary-label">Total Distance:</span>
                    <span className="summary-value">{multiModalRoute.total.distance} km</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Time:</span>
                    <span className="summary-value">{multiModalRoute.total.time} min</span>
                  </div>
                  <div className="summary-item total-fare">
                    <span className="summary-label">Total Fare:</span>
                    <span className="summary-value">₱{multiModalRoute.total.fare}</span>
                  </div>
                  <div className="fare-breakdown">
                    <small>
                      {getVehicleInfo(multiModalRoute.leg1.vehicle).name}: ₱{multiModalRoute.leg1.fare} + {getVehicleInfo(multiModalRoute.leg2.vehicle).name}: ₱{multiModalRoute.leg2.fare}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="results-container">
              {routeInfo.error ? (
                <div className="error-card">
                  <div className="card-header error">
                    <h2>⚠️ Vehicle Not Available</h2>
                  </div>
                  <div className="card-content">
                    <p className="error-message">{routeInfo.error}</p>
                    <div className="error-stats">
                      <span>📏 Distance: {routeInfo.distance} km</span>
                      <span>⏱️ Time: {routeInfo.time} min</span>
                    </div>
                    <p className="error-suggestion">Please select a different transport option above.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="main-route-card">
                    <div className="card-header primary">
                      <h2>{getVehicleInfo(routeInfo.vehicle).icon} {getVehicleInfo(routeInfo.vehicle).name} Route</h2>
                      <div className="route-badge">Direct</div>
                    </div>
                    <div className="card-content">
                      <div className="stats-grid">
                        <div className="stat-item">
                          <div className="stat-icon">�</div>
                          <div className="stat-info">
                            <span className="stat-label">Distance</span>
                            <span className="stat-value">{routeInfo.distance} km</span>
                          </div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-icon">⏱️</div>
                          <div className="stat-info">
                            <span className="stat-label">Time</span>
                            <span className="stat-value">{routeInfo.time} min</span>
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

                  {routeInfo.alternatives && routeInfo.alternatives.length > 0 && (
                    <div className="alternatives-section">
                      <h3>🛣️ Alternative Routes ({getVehicleInfo(routeInfo.vehicle).name})</h3>
                      {routeInfo.alternatives.map((alt, index) => (
                        <div key={index} className={`alt-route-card alt-${index + 1}`}>
                          <div className="card-header">
                            <h4>{index === 0 ? '🔴' : '🟠'} Route {index + 2}</h4>
                            <div className="route-badge alt">Alt</div>
                          </div>
                          <div className="card-content compact">
                            <div className="alt-stats">
                              <span className="alt-stat">📏 {alt.distance}km</span>
                              <span className="alt-stat">⏱️ {alt.time}min</span>
                              <span className="alt-fare">₱{alt.fare}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Route Cards Display */}
          {routeCards.length > 0 && (
            <div className="route-cards-container">
              <div className="card-header">
                <h3>🗂️ Your Routes</h3>
              </div>
              <div className="route-cards-list">
                {routeCards.map((card) => (
                  <div key={card.id} className={`route-card ${!card.visible ? 'route-hidden' : ''}`}>
                    <div className="route-card-header">
                      <div className="route-card-title">
                        <span className="vehicle-icon">{getVehicleInfo(card.vehicle).icon}</span>
                        <span className="vehicle-name">{getVehicleInfo(card.vehicle).name}</span>
                      </div>
                      <div className="route-card-actions">
                        <button 
                          className="toggle-route-btn"
                          onClick={() => toggleRouteVisibility(card.id)}
                          title={card.visible ? "Hide route" : "Show route"}
                        >
                          {card.visible ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button 
                          className="close-route-btn"
                          onClick={() => removeRouteCard(card.id)}
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
                  <button onClick={clearAllRoutes} className="clear-all-routes-btn">
                    Clear All Routes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Section - OSRM Routing */}
      <div className="section right-section">
        <div ref={mapContainer} className="map-container" />
        
        {/* Airport and pier markers are shown when respective vehicles are selected */}
        
        {/* Waypoint Control - Only show when adding waypoint */}
        {waypoints.length === 2 && !multiModalRoute && isAddingWaypoint && (
          <div className="waypoint-control">
            <button 
              className="waypoint-btn active"
              disabled={true}
            >
              Click Point C on map
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
