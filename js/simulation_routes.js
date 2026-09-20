/**
 * simulation_routes.js - Pre-calculated Freight Corridors with Realistic Anomalies
 * Enables smooth real-time simulation across major South India logistics highways.
 * Injects realistic GPS noise (poor accuracy and spike jumps) to test the filter engine.
 */

const SIMULATION_CORRIDORS = {
  // Corridor 1: Chennai Port Container Terminal -> Sriperumbudur Auto Hub (~42 km)
  chennai_sriperumbudur: {
    id: 'corridor_1',
    name: 'Chennai Port ➔ Sriperumbudur Auto Hub',
    origin: 'Chennai Port Container Terminal',
    destination: 'Sriperumbudur Auto Hub',
    corridorDistanceKm: 42.0,
    expectedTravelMinutes: 65,
    waypoints: [
      { lat: 13.0838, lng: 80.2985, speed: 28, accuracy: 12, name: 'Chennai Port Gate 1' },
      { lat: 13.0815, lng: 80.2850, speed: 34, accuracy: 10, name: 'Rajaji Salai' },
      { lat: 13.0800, lng: 80.2700, speed: 38, accuracy: 8, name: 'Poonamallee High Rd Entry' },
      { lat: 13.0782, lng: 80.2450, speed: 42, accuracy: 9, name: 'Kilpauk Flyover' },
      { lat: 13.0750, lng: 80.2180, speed: 45, accuracy: 7, name: 'Aminjikarai Toll Link' },
      { lat: 13.0710, lng: 80.1900, speed: 48, accuracy: 11, name: 'Koyambedu Grade Separator' },
      // Noise injection 1: Poor accuracy point (should be flagged & rejected)
      { lat: 13.0650, lng: 80.1700, speed: 50, accuracy: 78, name: 'Bad Accuracy Spike (78m)', isNoise: true },
      { lat: 13.0610, lng: 80.1600, speed: 52, accuracy: 12, name: 'Maduravoyal Bypass Junction' },
      { lat: 13.0550, lng: 80.1350, speed: 58, accuracy: 8, name: 'Vanagaram Corridor' },
      { lat: 13.0500, lng: 80.1050, speed: 64, accuracy: 9, name: 'Poonamallee Bypass' },
      // Noise injection 2: Impossible spike jump (should be detected & rejected by spike filter)
      { lat: 13.0750, lng: 80.0800, speed: 180, accuracy: 15, name: 'Satellite Bounce Spike (180 km/h)', isNoise: true },
      { lat: 13.0450, lng: 80.0750, speed: 62, accuracy: 10, name: 'Chembarambakkam Lake Bank' },
      { lat: 13.0380, lng: 80.0400, speed: 66, accuracy: 7, name: 'Irungattukottai SIPCOT' },
      { lat: 13.0250, lng: 80.0100, speed: 68, accuracy: 8, name: 'Hyundai Vendor Complex' },
      { lat: 13.0080, lng: 79.9800, speed: 65, accuracy: 11, name: 'Sriperumbudur Toll Plaza' },
      { lat: 12.9950, lng: 79.9550, speed: 40, accuracy: 9, name: 'Sriperumbudur Auto Hub Destination' }
    ]
  },

  // Corridor 2: Chennai -> Ranipet -> Vellore (~138 km)
  chennai_vellore: {
    id: 'corridor_2',
    name: 'Chennai Port ➔ Vellore Golden City Terminal',
    origin: 'Chennai Port Container Terminal',
    destination: 'Vellore Golden City Terminal',
    corridorDistanceKm: 138.0,
    expectedTravelMinutes: 180,
    waypoints: [
      { lat: 13.0838, lng: 80.2985, speed: 30, accuracy: 10, name: 'Chennai Port' },
      { lat: 13.0710, lng: 80.1900, speed: 45, accuracy: 12, name: 'Koyambedu' },
      { lat: 13.0500, lng: 80.1050, speed: 62, accuracy: 9, name: 'Poonamallee' },
      { lat: 13.0080, lng: 79.9800, speed: 70, accuracy: 8, name: 'Sriperumbudur' },
      { lat: 12.9850, lng: 79.8500, speed: 72, accuracy: 10, name: 'Kanchipuram Highway Crossing' },
      // Injected noise point
      { lat: 13.0200, lng: 79.7900, speed: 160, accuracy: 85, name: 'Anomalous GPS Leap', isNoise: true },
      { lat: 12.9600, lng: 79.7200, speed: 68, accuracy: 9, name: 'Ocheri Bridge' },
      { lat: 12.9400, lng: 79.5800, speed: 70, accuracy: 11, name: 'Walajapet Toll Plaza' },
      { lat: 12.9250, lng: 79.4800, speed: 55, accuracy: 8, name: 'Ranipet SIPCOT Industrial Hub' },
      { lat: 12.9180, lng: 79.3500, speed: 65, accuracy: 7, name: 'Arcot Bypass' },
      { lat: 12.9150, lng: 79.2200, speed: 60, accuracy: 10, name: 'Katpadi Railway Bridge Link' },
      { lat: 12.9200, lng: 79.1350, speed: 35, accuracy: 9, name: 'Vellore Golden City Terminal' }
    ]
  },

  // Corridor 3: Chennai -> Krishnagiri -> Bengaluru (~348 km)
  chennai_bengaluru: {
    id: 'corridor_3',
    name: 'Chennai Port ➔ Bengaluru Electronic City Phase 1',
    origin: 'Chennai Port Container Terminal',
    destination: 'Bengaluru Electronic City Phase 1',
    corridorDistanceKm: 348.5,
    expectedTravelMinutes: 420,
    waypoints: [
      { lat: 13.0838, lng: 80.2985, speed: 28, accuracy: 10, name: 'Chennai Port' },
      { lat: 13.0500, lng: 80.1050, speed: 60, accuracy: 8, name: 'Poonamallee' },
      { lat: 13.0080, lng: 79.9800, speed: 70, accuracy: 9, name: 'Sriperumbudur' },
      { lat: 12.9250, lng: 79.4800, speed: 72, accuracy: 11, name: 'Ranipet' },
      { lat: 12.9200, lng: 79.1350, speed: 68, accuracy: 8, name: 'Vellore' },
      { lat: 12.7800, lng: 78.7200, speed: 75, accuracy: 7, name: 'Ambur Leather Zone' },
      { lat: 12.6500, lng: 78.5800, speed: 74, accuracy: 10, name: 'Vaniyambadi' },
      // Noise injection
      { lat: 12.7200, lng: 78.3500, speed: 175, accuracy: 95, name: 'Ghat Section Satellite Glitch', isNoise: true },
      { lat: 12.5200, lng: 78.2100, speed: 70, accuracy: 8, name: 'Krishnagiri Toll Plaza' },
      { lat: 12.7300, lng: 77.8300, speed: 72, accuracy: 9, name: 'Hosur SIPCOT Border' },
      { lat: 12.7700, lng: 77.7500, speed: 60, accuracy: 10, name: 'Attibele Karnataka Toll' },
      { lat: 12.8450, lng: 77.6750, speed: 38, accuracy: 8, name: 'Bengaluru Electronic City Phase 1' }
    ]
  }
};

window.nlCorridors = SIMULATION_CORRIDORS;
