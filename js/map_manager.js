/**
 * map_manager.js - Leaflet Map Integration & Spatial Visualization
 * Handles:
 * - Driver cockpit live map & Admin fleet command map
 * - Real-time animated truck marker with directional heading
 * - Multi-layer rendering: Valid GPS polyline, OSM road line, rejected noise dots
 * - Auto-centering and zoom controls
 */

class MapManager {
  constructor() {
    this.driverMap = null;
    this.adminMap = null;
    this.labMap = null;

    this.truckMarker = null;
    this.startMarker = null;
    this.finishMarker = null;
    this.gpsPolyline = null;
    this.roadPolyline = null;
    this.noiseMarkersLayer = null;
    this.followTruck = true;

    this.labTruckMarker = null;
    this.labStartMarker = null;
    this.labFinishMarker = null;
    this.labGpsPolyline = null;
    this.labNoiseLayer = null;

    this.adminMarkers = {};
  }

  initDriverMap(elementId = 'driverMap') {
    const el = document.getElementById(elementId);
    if (!el || this.driverMap) return;

    // Initial map view (will auto-center as soon as GPS location is retrieved)
    this.driverMap = L.map(elementId, {
      zoomControl: false,
      attributionControl: false
    }).setView([13.0827, 80.2707], 13);

    L.control.zoom({ position: 'bottomright' }).addTo(this.driverMap);

    // High quality OpenStreetMap tiles (100% free, crisp, no API key required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.driverMap);

    // Initialize Layers
    this.gpsPolyline = L.polyline([], {
      color: '#00b074',
      weight: 4.5,
      opacity: 0.9,
      lineCap: 'round'
    }).addTo(this.driverMap);

    this.roadPolyline = L.polyline([], {
      color: '#00d2d3',
      weight: 3,
      opacity: 0.75,
      dashArray: '6, 6'
    }).addTo(this.driverMap);

    this.noiseMarkersLayer = L.layerGroup().addTo(this.driverMap);

    // Initial Truck Marker Pin
    const truckIcon = L.divIcon({
      className: 'custom-truck-pin',
      html: `
        <div style="
          width: 38px; height: 38px;
          background: #001428;
          border: 2px solid #fd651e;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #ffffff;
          box-shadow: 0 0 16px rgba(253, 101, 30, 0.7);
          transform-origin: center center;
          font-size: 18px;
        ">🚚</div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    this.truckMarker = L.marker([13.0827, 80.2707], { icon: truckIcon }).addTo(this.driverMap);

    // Automatically detect & move marker to real current position immediately
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLatLng = [pos.coords.latitude, pos.coords.longitude];
          this.driverMap.setView(userLatLng, 15);
          this.truckMarker.setLatLng(userLatLng);
        },
        (err) => console.warn('[MapManager] Initial location fetch warning:', err.message),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }

  updateTruckPosition(point) {
    if (!this.driverMap || !this.truckMarker) return;

    const latLng = [point.latitude, point.longitude];
    this.truckMarker.setLatLng(latLng);

    // Append to live GPS polyline
    this.gpsPolyline.addLatLng(latLng);

    // Update truck icon rotation heading if available
    const heading = point.heading || 0;
    const iconEl = this.truckMarker.getElement();
    if (iconEl) {
      const inner = iconEl.querySelector('div');
      if (inner) {
        inner.style.transform = `rotate(${heading}deg)`;
      }
    }

    if (this.followTruck) {
      this.driverMap.panTo(latLng, { animate: true, duration: 0.5 });
    }
  }

  centerOn(latitude, longitude, zoom = 15) {
    if (!this.driverMap) return;
    this.driverMap.setView([latitude, longitude], zoom);
  }

  addNoiseMarker(point, reason, message) {
    if (!this.noiseMarkersLayer) return;

    const latLng = [point.latitude, point.longitude];
    const noiseIcon = L.divIcon({
      className: 'noise-dot-pin',
      html: `
        <div style="
          width: 14px; height: 14px;
          background: #ff4757;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(255, 71, 87, 0.9);
          animation: pulse-live 1s infinite;
        "></div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker(latLng, { icon: noiseIcon })
      .bindPopup(`
        <div style="color: #0b1c30; font-family: sans-serif; font-size: 12px; padding: 4px;">
          <strong style="color: #ff4757;">⚠️ Filtered Anomaly</strong><br>
          <b>Type:</b> ${reason}<br>
          <b>Detail:</b> ${message || 'Rejected by GPS quality rules'}
        </div>
      `);

    this.noiseMarkersLayer.addLayer(marker);
  }

  setStartMarker(point) {
    if (!this.driverMap || !point) return;
    if (this.startMarker) {
      this.driverMap.removeLayer(this.startMarker);
    }
    const latLng = [point.latitude, point.longitude];
    const startIcon = L.divIcon({
      className: 'start-flag-pin',
      html: `
        <div style="
          background: #00b074;
          color: #ffffff;
          border: 2px solid #ffffff;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          box-shadow: 0 0 10px rgba(0, 176, 116, 0.8);
          white-space: nowrap;
        ">🟢 Start Point</div>
      `,
      iconSize: [85, 26],
      iconAnchor: [42, 13]
    });
    this.startMarker = L.marker(latLng, { icon: startIcon }).addTo(this.driverMap);
  }

  setFinishMarker(point, isStationary = false) {
    if (!this.driverMap || !point) return;
    if (this.finishMarker) {
      this.driverMap.removeLayer(this.finishMarker);
      this.finishMarker = null;
    }
    const latLng = [point.latitude, point.longitude];
    const text = isStationary ? '🛑 Stopped at Start (0.0 KM)' : '🏁 Finish Point';
    const bg = isStationary ? '#e67e22' : '#ff4757';
    const shadowColor = isStationary ? 'rgba(230, 126, 34, 0.8)' : 'rgba(255, 71, 87, 0.8)';
    const finishIcon = L.divIcon({
      className: 'finish-flag-pin',
      html: `
        <div style="
          background: ${bg};
          color: #ffffff;
          border: 2px solid #ffffff;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          box-shadow: 0 0 10px ${shadowColor};
          white-space: nowrap;
        ">${text}</div>
      `,
      iconSize: [isStationary ? 140 : 90, 26],
      iconAnchor: [isStationary ? 70 : 45, 13]
    });
    this.finishMarker = L.marker(latLng, { icon: finishIcon }).addTo(this.driverMap);
  }

  setRoadSnappedGeometry(geojsonCoords) {
    if (!this.roadPolyline || !geojsonCoords) return;
    // OSRM coordinates are in [lon, lat] format -> convert to [lat, lon]
    const latLngs = geojsonCoords.map(c => [c[1], c[0]]);
    this.roadPolyline.setLatLngs(latLngs);
  }

  resetDriverMap() {
    if (this.gpsPolyline) this.gpsPolyline.setLatLngs([]);
    if (this.roadPolyline) this.roadPolyline.setLatLngs([]);
    if (this.noiseMarkersLayer) this.noiseMarkersLayer.clearLayers();
    if (this.startMarker) {
      this.driverMap.removeLayer(this.startMarker);
      this.startMarker = null;
    }
    if (this.finishMarker) {
      this.driverMap.removeLayer(this.finishMarker);
      this.finishMarker = null;
    }
  }

  fitBoundsToRoute() {
    if (!this.driverMap || !this.gpsPolyline) return;
    const bounds = this.gpsPolyline.getBounds();
    if (bounds.isValid()) {
      this.driverMap.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  toggleFollowTruck() {
    this.followTruck = !this.followTruck;
    return this.followTruck;
  }

  /* Admin Fleet Command Map — Real Fleet Telemetry Only */
  initAdminMap(elementId = 'adminFleetMap') {
    const el = document.getElementById(elementId);
    if (!el || this.adminMap) {
      if (this.adminMap) {
        this.renderAdminFleetVehicles();
      }
      return;
    }

    this.adminMap = L.map(elementId, {
      zoomControl: false,
      attributionControl: false
    }).setView([13.0827, 80.2707], 11);

    L.control.zoom({ position: 'bottomright' }).addTo(this.adminMap);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.adminMap);

    this.renderAdminFleetVehicles();
  }

  async renderAdminFleetVehicles() {
    if (!this.adminMap || !window.nlStore) return;

    // Remove existing markers
    Object.values(this.adminMarkers).forEach(m => this.adminMap.removeLayer(m));
    this.adminMarkers = {};

    const store = window.nlStore;
    const tracker = window.nlTracker;
    const syncEngine = window.nlSyncEngine;

    const activeDriver = store.getActiveDriver();
    const activeVehicle = store.getActiveVehicle();

    const realFleet = [];

    // 1. Check if the active tracker has a live location or current GPS point
    const livePoint = tracker ? (
      (tracker.cleanedPoints && tracker.cleanedPoints.length > 0 ? tracker.cleanedPoints[tracker.cleanedPoints.length - 1] : null) ||
      tracker.startPoint ||
      tracker.preTripLocation
    ) : null;

    if (livePoint) {
      const spd = Math.round(tracker.currentSpeedKmH || livePoint.speed || 0);
      realFleet.push({
        id: activeVehicle.id,
        driverId: activeDriver.id,
        driver: activeDriver.name,
        lorry: activeVehicle.vehicleNumber,
        lat: livePoint.latitude,
        lng: livePoint.longitude,
        speed: `${spd} km/h`,
        status: tracker.isTracking ? '🟢 Active Live Trip Tracking' : '📍 Real Device GPS (Active)',
        recordedAt: livePoint.recorded_at || new Date().toISOString(),
        isLive: true
      });
    }

    // 2. Query Supabase for any other real driver locations stored in DB
    if (syncEngine && store.isOnline()) {
      try {
        const dbLocations = await syncEngine.fetchFleetLocations();
        for (const loc of dbLocations) {
          if (!loc.latitude || !loc.longitude) continue;
          // Filter out any test artifacts
          if (loc.id && (String(loc.id).startsWith('TEST') || String(loc.id).startsWith('T1') || String(loc.id).startsWith('T2') || String(loc.id).startsWith('T3') || String(loc.id).startsWith('T4') || String(loc.id).startsWith('T5'))) continue;
          // If we already have live real-time telemetry for this driver, use live telemetry
          if (realFleet.some(f => f.driverId === loc.driver_id)) continue;

          const driverObj = store.data.drivers.find(d => d.id === loc.driver_id) || { name: loc.driver_id };
          const vehicleObj = store.data.vehicles.find(v => v.driverId === loc.driver_id) || { id: `VEH-${loc.driver_id}`, vehicleNumber: loc.driver_id };

          const spd = Math.round(loc.speed || 0);
          realFleet.push({
            id: vehicleObj.id,
            driverId: loc.driver_id,
            driver: driverObj.name,
            lorry: vehicleObj.vehicleNumber,
            lat: loc.latitude,
            lng: loc.longitude,
            speed: `${spd} km/h`,
            status: 'Cloud Synced Real GPS',
            recordedAt: loc.recorded_at,
            isLive: false
          });
        }
      } catch (e) {
        console.warn('[MapManager] fetchFleetLocations error:', e.message);
      }
    }

    // 3. If no vehicles have real points yet, obtain driver's real physical device GPS location immediately
    if (realFleet.length === 0 && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const spd = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
          const userVehicle = {
            id: activeVehicle.id,
            driverId: activeDriver.id,
            driver: activeDriver.name,
            lorry: activeVehicle.vehicleNumber,
            lat,
            lng,
            speed: `${spd} km/h`,
            status: '📍 Real Device GPS (Active)',
            isLive: true
          };
          this._addRealVehicleMarker(userVehicle);
          if (this.adminMap) {
            this.adminMap.setView([lat, lng], 15);
          }
          if (window.renderFleetListPanel) {
            window.renderFleetListPanel([userVehicle]);
          }
        },
        err => {
          console.warn('[MapManager] Geolocation unavailable for fleet:', err.message);
          if (window.renderFleetListPanel) {
            window.renderFleetListPanel([]);
          }
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
      return;
    }

    const bounds = [];
    realFleet.forEach(v => {
      this._addRealVehicleMarker(v);
      bounds.push([v.lat, v.lng]);
    });

    if (bounds.length > 0 && this.adminMap) {
      if (bounds.length === 1) {
        this.adminMap.setView(bounds[0], 14);
      } else {
        this.adminMap.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    if (window.renderFleetListPanel) {
      window.renderFleetListPanel(realFleet);
    }
  }

  _addRealVehicleMarker(v) {
    if (!this.adminMap) return;
    const isStationary = v.speed === '0 km/h' || v.speed === '0km/h' || v.speed === '0';
    const pinColor = isStationary ? '#ffaa00' : '#00b074';
    const pinIcon = L.divIcon({
      className: 'fleet-truck-pin',
      html: `
        <div style="
          background: #001428;
          border: 2px solid ${pinColor};
          padding: 5px 10px;
          border-radius: 14px;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0,0,0,0.7);
        ">
          <span>🚚</span> ${v.lorry}
        </div>
      `,
      iconSize: [120, 32],
      iconAnchor: [60, 16]
    });

    const marker = L.marker([v.lat, v.lng], { icon: pinIcon })
      .addTo(this.adminMap)
      .bindPopup(`
        <div style="color: #0b1c30; font-family: sans-serif; padding: 4px; min-width: 160px;">
          <h4 style="margin: 0 0 4px 0; color: #001428; font-size: 1rem;">${v.lorry}</h4>
          <div style="margin-bottom: 2px;"><b>Driver:</b> ${v.driver}</div>
          <div style="margin-bottom: 2px;"><b>Speed:</b> ${v.speed}</div>
          <div style="margin-bottom: 2px;"><b>Status:</b> ${v.status}</div>
          <div style="font-size: 0.75rem; color: #666; margin-top: 4px;">GPS: ${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}</div>
        </div>
      `);

    this.adminMarkers[v.id] = marker;
  }

  /* =========================================================================
     Algorithm Lab Map (view-lab)
     ========================================================================= */
  initLabMap(elementId = 'labMap') {
    const el = document.getElementById(elementId);
    if (!el || this.labMap) return;

    this.labMap = L.map(elementId, {
      zoomControl: true,
      attributionControl: false
    }).setView([13.0827, 80.2707], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.labMap);

    this.labGpsPolyline = L.polyline([], {
      color: '#00b074',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round'
    }).addTo(this.labMap);

    this.labNoiseLayer = L.layerGroup().addTo(this.labMap);

    const truckIcon = L.divIcon({
      className: 'lab-truck-pin',
      html: `
        <div style="
          width: 36px; height: 36px;
          background: #001428;
          border: 2px solid #00d2d3;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #ffffff;
          box-shadow: 0 0 16px rgba(0, 210, 211, 0.8);
          transform-origin: center center;
          font-size: 18px;
        ">🚛</div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    this.labTruckMarker = L.marker([13.0827, 80.2707], { icon: truckIcon }).addTo(this.labMap);
  }

  updateLabTruck(point) {
    if (!this.labMap || !this.labTruckMarker) return;
    const latLng = [point.latitude, point.longitude];
    this.labTruckMarker.setLatLng(latLng);

    if (this.labGpsPolyline) {
      this.labGpsPolyline.addLatLng(latLng);
    }

    const heading = point.heading || 0;
    const iconEl = this.labTruckMarker.getElement();
    if (iconEl) {
      const inner = iconEl.querySelector('div');
      if (inner) inner.style.transform = `rotate(${heading}deg)`;
    }

    this.labMap.panTo(latLng, { animate: true, duration: 0.4 });
  }

  setLabStartMarker(point) {
    if (!this.labMap || !point) return;
    if (this.labStartMarker) this.labMap.removeLayer(this.labStartMarker);

    const icon = L.divIcon({
      className: 'lab-start-pin',
      html: `<div style="background: #00b074; color: #fff; border: 2px solid #fff; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: bold; white-space: nowrap; box-shadow: 0 0 10px rgba(0,176,116,0.8);">🟢 Corridor Origin</div>`,
      iconSize: [95, 24],
      iconAnchor: [47, 12]
    });
    this.labStartMarker = L.marker([point.latitude, point.longitude], { icon }).addTo(this.labMap);
  }

  setLabFinishMarker(point) {
    if (!this.labMap || !point) return;
    if (this.labFinishMarker) this.labMap.removeLayer(this.labFinishMarker);

    const icon = L.divIcon({
      className: 'lab-finish-pin',
      html: `<div style="background: #ff4757; color: #fff; border: 2px solid #fff; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: bold; white-space: nowrap; box-shadow: 0 0 10px rgba(255,71,87,0.8);">🏁 Destination Reached</div>`,
      iconSize: [120, 24],
      iconAnchor: [60, 12]
    });
    this.labFinishMarker = L.marker([point.latitude, point.longitude], { icon }).addTo(this.labMap);
  }

  addLabNoiseMarker(point, reason, message) {
    if (!this.labNoiseLayer) return;
    const noiseIcon = L.divIcon({
      className: 'lab-noise-pin',
      html: `<div style="width: 16px; height: 16px; background: #ff4757; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 12px rgba(255,71,87,1); animation: pulse-live 1s infinite;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = L.marker([point.latitude, point.longitude], { icon: noiseIcon })
      .bindPopup(`
        <div style="color: #0b1c30; font-family: sans-serif; font-size: 11px; padding: 2px;">
          <strong style="color: #ff4757;">⚠️ Filter Anomaly Detected</strong><br>
          <b>Rule Check:</b> ${reason}<br>
          <b>Detail:</b> ${message || 'Rejected by GPS quality checks'}
        </div>
      `);
    this.labNoiseLayer.addLayer(marker);
  }

  centerLabMap(lat, lng, zoom = 12) {
    if (this.labMap) this.labMap.setView([lat, lng], zoom);
  }

  resetLabMap() {
    if (this.labGpsPolyline) this.labGpsPolyline.setLatLngs([]);
    if (this.labNoiseLayer) this.labNoiseLayer.clearLayers();
    if (this.labStartMarker && this.labMap) {
      this.labMap.removeLayer(this.labStartMarker);
      this.labStartMarker = null;
    }
    if (this.labFinishMarker && this.labMap) {
      this.labMap.removeLayer(this.labFinishMarker);
      this.labFinishMarker = null;
    }
  }
}

window.nlMapManager = new MapManager();
