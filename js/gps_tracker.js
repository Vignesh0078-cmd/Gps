/**
 * gps_tracker.js - Live Tracking Controller & Replay Simulation Manager
 * Orchestrates:
 * - Real Device Geolocation (HTML5 navigator.geolocation)
 * - Corridor Replay Simulator with adjustable playback speeds
 * - Live telemetry callbacks (Speed, Distance, Signal Quality)
 * - Filtering pipeline execution
 */

class GPSTracker {
  constructor({ filterEngine, distanceEngine, syncEngine, store }) {
    this.filterEngine = filterEngine;
    this.distanceEngine = distanceEngine;
    this.syncEngine = syncEngine;
    this.store = store;

    this.isTracking = false;
    this.trackingMode = 'device'; // 'device' (real GPS) or 'simulation'
    this.activeTripId = null;
    this.activeCorridorKey = 'chennai_sriperumbudur';
    this.simulationSpeed = 5;

    this.rawPoints = [];
    this.cleanedPoints = [];
    this.rejectedPoints = [];
    this.startPoint = null;
    this.endPoint = null;
    this.startPointAddress = '';
    this.endPointAddress = '';
    this.preTripLocation = null;
    this.accumulatedDistanceKm = 0.0;
    this.currentSpeedKmH = 0.0;
    this.currentAccuracyM = 10.0;
    this.tripStartTime = null;
    this.timerIntervalId = null;
    this.simulationStepIndex = 0;
    this.simulationTimerId = null;
    this.deviceWatchId = null;
    this.wakeLock = null;
    this.heartbeatIntervalId = null;
    this.lastPositionTimestamp = null;

    this.listeners = [];
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('[GPSTracker] Screen WakeLock acquired (prevents mobile OS GPS throttling).');
        this.wakeLock.addEventListener('release', () => {
          console.log('[GPSTracker] Screen WakeLock was released.');
        });
      } catch (err) {
        console.warn('[GPSTracker] WakeLock request error:', err.message);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
        this.wakeLock = null;
      } catch (e) {}
    }
  }

  onUpdate(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[GPSTracker] Listener error:', e);
      }
    }
  }

  /**
   * Pre-trip GPS detection: Acquires driver's real current location before starting
   */
  async detectCurrentLocation() {
    if (!('geolocation' in navigator)) return null;
    if (this.isTracking) return this.startPoint || this.preTripLocation;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const pt = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 8,
            speed: 0,
            heading: 0,
            recorded_at: new Date(pos.timestamp).toISOString()
          };
          this.currentAccuracyM = pt.accuracy;
          this.preTripLocation = pt;

          if (window.nlMapManager) {
            window.nlMapManager.centerOn(pt.latitude, pt.longitude, 15);
            if (window.nlMapManager.truckMarker) {
              window.nlMapManager.truckMarker.setLatLng([pt.latitude, pt.longitude]);
            }
          }

          const address = await this.resolvePlaceName(pt, 'Current Location');
          pt.address = address;
          this.notify({
            type: 'location_detected',
            point: pt,
            address,
            accuracyM: Math.round(pt.accuracy)
          });
          resolve(pt);
        },
        (err) => {
          console.warn('[GPSTracker] Detect location error:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 7000 }
      );
    });
  }

  setSimulationSpeed(speedMultiplier) {
    this.simulationSpeed = speedMultiplier;
    if (this.isTracking && this.trackingMode === 'simulation') {
      this.restartSimulationLoop();
    }
  }

  setCorridor(corridorKey) {
    this.activeCorridorKey = corridorKey;
  }

  startTrip({ mode = 'device', corridorKey } = {}) {
    if (this.isTracking) return;

    this.isTracking = true;
    this.trackingMode = mode;
    if (corridorKey) this.activeCorridorKey = corridorKey;

    this.activeTripId = `TRP-${Date.now().toString().slice(-6)}`;
    this.tripStartTime = new Date();
    this.rawPoints = [];
    this.cleanedPoints = [];
    this.rejectedPoints = [];
    this.startPoint = null;
    this.endPoint = null;
    this.startPointAddress = '';
    this.endPointAddress = '';
    this.accumulatedDistanceKm = 0.0;
    this.currentSpeedKmH = 0.0;
    this.simulationStepIndex = 0;

    // Start clock timer
    this.timerIntervalId = setInterval(() => {
      const elapsedSec = Math.floor((new Date() - this.tripStartTime) / 1000);
      this.notify({
        type: 'timer_tick',
        elapsedSeconds: elapsedSec,
        elapsedFormatted: this.formatDuration(elapsedSec)
      });
    }, 1000);

    if (this.trackingMode === 'device') {
      this.requestWakeLock();

      // 1. If pre-trip location was already acquired with good accuracy, ingest it immediately!
      // All points MUST enter through ingestLocationPoint to ensure rawPoints.length === cleanedPoints.length + rejectedPoints.length
      if (this.preTripLocation) {
        const startPt = {
          latitude: this.preTripLocation.latitude,
          longitude: this.preTripLocation.longitude,
          accuracy: this.preTripLocation.accuracy || 8,
          speed: 0,
          heading: 0,
          recorded_at: new Date().toISOString(),
          trip_id: this.activeTripId
        };
        this.startPointAddress = this.preTripLocation.address || 'Start Location (GPS Fixed)';
        this.ingestLocationPoint(startPt);
      }

      // 2. Fetch GNSS fix to confirm or lock if preTrip wasn't ready
      if ('geolocation' in navigator && !this.startPoint) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (!this.isTracking || this.startPoint) return;
            const pt = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy || 8,
              speed: 0,
              heading: pos.coords.heading || 0,
              recorded_at: new Date(pos.timestamp).toISOString(),
              trip_id: this.activeTripId
            };
            this.ingestLocationPoint(pt);
          },
          (err) => console.warn('[GPSTracker] Initial start position warning:', err.message),
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
      }
      this.startDeviceGPS();
    } else {
      this.startSimulationLoop();
    }

    this.notify({
      type: 'trip_started',
      tripId: this.activeTripId,
      mode: this.trackingMode,
      startedAt: this.tripStartTime.toISOString()
    });
  }

  async endTrip() {
    if (!this.isTracking) return null;

    this.isTracking = false;
    clearInterval(this.timerIntervalId);
    if (this.simulationTimerId) clearTimeout(this.simulationTimerId);
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    if (this.deviceWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.deviceWatchId);
      this.deviceWatchId = null;
    }
    this.releaseWakeLock();

    const tripEndTime = new Date();
    const durationSeconds = Math.max(1, Math.floor((tripEndTime - this.tripStartTime) / 1000));
    const durationMinutes = Math.round(durationSeconds / 60) || 1;

    // In real GPS mode, immediately capture current stopping position
    let finalStopPoint = null;
    if (this.trackingMode === 'device' && 'geolocation' in navigator) {
      try {
        const pos = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
            enableHighAccuracy: true,
            timeout: 3000
          });
        });
        if (pos) {
          finalStopPoint = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 8,
            speed: 0,
            heading: 0,
            recorded_at: new Date(pos.timestamp).toISOString(),
            trip_id: this.activeTripId
          };
          this.ingestLocationPoint(finalStopPoint);
        }
      } catch (e) {
        // Fallback to last recorded point
      }
    }

    // Capture final point as finish location
    const lastPoint = finalStopPoint || this.cleanedPoints[this.cleanedPoints.length - 1] || this.rawPoints[this.rawPoints.length - 1] || this.startPoint;

    // Check if vehicle stayed stationary (< 60m displacement & < 0.05 km accumulated)
    let isStationaryTrip = false;
    if (this.trackingMode === 'device' && this.startPoint && lastPoint) {
      const netDisplacementMeters = this.filterEngine.haversineMeters(
        this.startPoint.latitude,
        this.startPoint.longitude,
        lastPoint.latitude,
        lastPoint.longitude
      );
      if (this.accumulatedDistanceKm < 0.05 && netDisplacementMeters < 60) {
        isStationaryTrip = true;
      }
    }

    if (isStationaryTrip) {
      // Vehicle remained at home/origin
      this.endPoint = this.startPoint;
      if (window.nlMapManager) {
        window.nlMapManager.setFinishMarker(this.startPoint, true);
      }
    } else if (lastPoint) {
      this.endPoint = lastPoint;
      if (window.nlMapManager) {
        window.nlMapManager.setFinishMarker(lastPoint, false);
        window.nlMapManager.fitBoundsToRoute();
      }
    }

    let origin = 'GPS Start Location';
    let destination = 'GPS Stopping Location';

    if (this.trackingMode === 'device') {
      if (this.startPoint) {
        origin = this.startPointAddress || await this.resolvePlaceName(this.startPoint, 'Start Location');
      }
      if (isStationaryTrip) {
        destination = origin;
      } else if (this.endPoint) {
        destination = await this.resolvePlaceName(this.endPoint, 'Stopping Location');
      }
      this.endPointAddress = destination;
    } else {
      const corridor = window.nlCorridors[this.activeCorridorKey] || window.nlCorridors.chennai_sriperumbudur;
      origin = corridor.origin;
      destination = corridor.destination;
    }

    const isOnline = this.store.isOnline();

    // Trigger Multi-Model Distance Calculation with point sufficiency and duration
    const calculation = await this.distanceEngine.resolveFinalDistance({
      cleanedPoints: this.cleanedPoints,
      rawPointsCount: this.rawPoints.length,
      durationSeconds,
      durationMinutes,
      configuredInterval: 5,
      origin,
      destination,
      isOnline,
      isDeviceTrip: (this.trackingMode === 'device'),
      startPoint: this.startPoint,
      endPoint: this.endPoint
    });

    // Comprehensive GPS Audit & Consistency Logging (Part 1 requirement)
    const firstPoint = this.cleanedPoints[0] || this.rawPoints[0];
    const lastPointRec = this.cleanedPoints[this.cleanedPoints.length - 1] || this.rawPoints[this.rawPoints.length - 1];

    const actualIntervalsSec = [];
    for (let i = 1; i < this.cleanedPoints.length; i++) {
      const t1 = new Date(this.cleanedPoints[i - 1].recorded_at).getTime();
      const t2 = new Date(this.cleanedPoints[i].recorded_at).getTime();
      actualIntervalsSec.push(Math.round((t2 - t1) / 1000));
    }

    const gpsAuditLog = {
      tripId: this.activeTripId,
      firstGpsTimestamp: firstPoint ? firstPoint.recorded_at : null,
      lastGpsTimestamp: lastPointRec ? lastPointRec.recorded_at : null,
      configuredCaptureIntervalSec: 5,
      actualIntervalsBetweenPointsSec: actualIntervalsSec,
      totalCapturedPoints: this.rawPoints.length,
      validPoints: this.cleanedPoints.length,
      rejectedPoints: this.rejectedPoints.length,
      rejectionReasons: this.rejectedPoints.map(p => ({
        pointId: p.id || p.recorded_at,
        reason: p.filterMetadata?.reason || 'NOISE_FILTERED',
        message: p.filterMetadata?.message || ''
      })),
      modelBPointCount: this.cleanedPoints.length,
      modelBValid: calculation.breakdown?.modelB?.valid,
      modelBRejectionReason: calculation.breakdown?.modelB?.rejectionReason,
      minRequiredPoints: calculation.breakdown?.modelB?.minimumRequiredPoints,
      expectedPoints: calculation.breakdown?.modelB?.expectedPoints,
      coveragePercent: calculation.breakdown?.modelB?.coveragePercent,
      selectedModel: calculation.selectedModel?.modelCode,
      finalDistanceKm: calculation.finalDistanceKm
    };

    console.log('====================================================');
    console.log('[GPS AUDIT & CONSISTENCY LOG]', JSON.stringify(gpsAuditLog, null, 2));
    console.log('====================================================');

    const activeDriver = this.store.getActiveDriver();
    const activeVehicle = this.store.getActiveVehicle();

    const tripRecord = {
      id: this.activeTripId,
      driverId: activeDriver.id,
      vehicleId: activeVehicle.id,
      origin,
      destination,
      startedAt: this.tripStartTime.toISOString(),
      endedAt: tripEndTime.toISOString(),
      status: calculation.status === 'NEEDS_REVIEW' ? 'needs_review' : 'completed',
      distanceKm: calculation.finalDistanceKm,
      directDistance: calculation.directDistance,
      calculationMethod: calculation.selectedModel.name,
      durationMinutes,
      pointsCaptured: this.rawPoints.length,
      pointsFiltered: this.rejectedPoints.length,
      avgSpeedKmH: durationSeconds > 0 ? parseFloat(((calculation.finalDistanceKm / (durationSeconds / 3600))).toFixed(1)) : 0.0,
      auditConfidence: calculation.confidenceScore,
      breakdown: calculation.breakdown,
      rationale: calculation.rationale,
      decisionLog: calculation.decisionLog,
      points: this.cleanedPoints,
      rejectedPoints: this.rejectedPoints
    };

    // Save trip into local store
    this.store.addTrip(tripRecord);

    // Persist trip to Supabase
    this.syncEngine.saveTrip(tripRecord);

    // Flush any remaining offline queue points to Supabase
    if (isOnline) {
      this.syncEngine.triggerSync();
    }

    this.notify({
      type: 'trip_ended',
      trip: tripRecord
    });

    return tripRecord;
  }

  /**
   * Device Geolocation using HTML5 API with Heartbeat Polling
   * Overcomes mobile background sleep and OS watchPosition throttling.
   */
  startDeviceGPS() {
    if (!('geolocation' in navigator)) {
      console.error('[GPSTracker] Geolocation API not available in this browser environment.');
      this.notify({
        type: 'gps_error',
        message: 'Location services not supported or restricted. Please ensure HTTPS and allow location access.'
      });
      return;
    }

    this.lastPositionTimestamp = Date.now();

    this.deviceWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.lastPositionTimestamp = Date.now();
        // Accurately capture speed without falsy fallback
        const hasSpeed = pos.coords.speed !== null && pos.coords.speed !== undefined && !isNaN(pos.coords.speed) && pos.coords.speed >= 0;
        const speedKmH = hasSpeed ? pos.coords.speed * 3.6 : 0;

        const point = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 10,
          speed: speedKmH,
          heading: pos.coords.heading || 0,
          recorded_at: new Date(pos.timestamp).toISOString(),
          trip_id: this.activeTripId
        };
        this.ingestLocationPoint(point);
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
        this.notify({
          type: 'gps_error',
          code: err.code,
          message: err.code === 1
            ? 'Location permission denied. Please allow location in browser settings.'
            : (err.message || 'Acquiring satellite fix...')
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Prevent stale cached points
      }
    );

    // Fallback heartbeat poll:
    // If mobile OS suspends or throttles watchPosition callbacks, actively poll GNSS hardware
    // every 8 seconds to ensure continuous point capture!
    this.heartbeatIntervalId = setInterval(() => {
      if (!this.isTracking || this.trackingMode !== 'device') return;
      const elapsedSinceLastFix = Date.now() - (this.lastPositionTimestamp || 0);
      if (elapsedSinceLastFix >= 8000) {
        console.log(`[GPSTracker Heartbeat] No watch callback for ${Math.round(elapsedSinceLastFix / 1000)}s; polling getCurrentPosition...`);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!this.isTracking) return;
            this.lastPositionTimestamp = Date.now();
            const hasSpeed = pos.coords.speed !== null && pos.coords.speed !== undefined && !isNaN(pos.coords.speed) && pos.coords.speed >= 0;
            const point = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy || 10,
              speed: hasSpeed ? pos.coords.speed * 3.6 : 0,
              heading: pos.coords.heading || 0,
              recorded_at: new Date(pos.timestamp).toISOString(),
              trip_id: this.activeTripId
            };
            this.ingestLocationPoint(point);
          },
          (err) => console.warn('[GPSTracker Heartbeat] Poll error:', err.message),
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
      }
    }, 5000);
  }

  /**
   * Corridor Replay Simulation Loop
   */
  startSimulationLoop() {
    const corridor = window.nlCorridors[this.activeCorridorKey] || window.nlCorridors.chennai_sriperumbudur;
    const waypoints = corridor.waypoints;

    const step = () => {
      if (!this.isTracking) return;

      if (this.simulationStepIndex >= waypoints.length) {
        // Automatically end trip once route reached destination
        this.endTrip();
        return;
      }

      const wp = waypoints[this.simulationStepIndex];
      const prevWp = this.simulationStepIndex > 0 ? waypoints[this.simulationStepIndex - 1] : null;

      // Calculate bearing heading
      let heading = 0;
      if (prevWp) {
        const y = Math.sin((wp.lng - prevWp.lng) * Math.PI / 180) * Math.cos(wp.lat * Math.PI / 180);
        const x = Math.cos(prevWp.lat * Math.PI / 180) * Math.sin(wp.lat * Math.PI / 180) -
                  Math.sin(prevWp.lat * Math.PI / 180) * Math.cos(wp.lat * Math.PI / 180) * Math.cos((wp.lng - prevWp.lng) * Math.PI / 180);
        heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      }

      const point = {
        latitude: wp.lat,
        longitude: wp.lng,
        accuracy: wp.accuracy,
        speed: wp.speed,
        heading: Math.round(heading),
        name: wp.name,
        isNoise: wp.isNoise || false,
        recorded_at: new Date().toISOString(),
        trip_id: this.activeTripId
      };

      this.ingestLocationPoint(point);
      this.simulationStepIndex++;

      // Next step delay adjusted by simulation speed (e.g., base 2.5s / multiplier)
      const baseDelayMs = 2500;
      const delay = Math.max(250, Math.floor(baseDelayMs / this.simulationSpeed));
      this.simulationTimerId = setTimeout(step, delay);
    };

    step();
  }

  restartSimulationLoop() {
    if (this.simulationTimerId) clearTimeout(this.simulationTimerId);
    this.startSimulationLoop();
  }

  /**
   * Unified Ingest pipeline:
   * 1. Raw point captured
   * 2. GPS Filter evaluation (Section 13-16)
   * 3. Sync Engine processing (Section 11-12)
   * 4. Distance summation (Section 17)
   */
  ingestLocationPoint(point) {
    this.rawPoints.push(point);

    const prevValid = this.cleanedPoints.length > 0
      ? this.cleanedPoints[this.cleanedPoints.length - 1]
      : null;

    // Filter Check
    const validation = this.filterEngine.validatePoint(point, prevValid);

    if (validation.isValid) {
      // Valid point accepted
      point.filterMetadata = validation;
      this.cleanedPoints.push(point);

      // Record first location as start point if not locked
      if (!this.startPoint) {
        this.startPoint = point;
        if (window.nlMapManager) {
          window.nlMapManager.setStartMarker(point);
          window.nlMapManager.centerOn(point.latitude, point.longitude);
        }
        if (!this.startPointAddress) {
          this.resolvePlaceName(point, 'Start Location').then(addr => {
            this.startPointAddress = addr;
            this.notify({
              type: 'start_location_locked',
              point,
              address: addr,
              accuracyM: Math.round(point.accuracy || 8)
            });
          });
        } else {
          this.notify({
            type: 'start_location_locked',
            point,
            address: this.startPointAddress,
            accuracyM: Math.round(point.accuracy || 8)
          });
        }
      }

      const rawSpeed = (point.speed !== undefined && point.speed !== null && !isNaN(point.speed))
        ? Math.max(0, point.speed)
        : 0;

      if (prevValid) {
        const stepMeters = this.filterEngine.haversineMeters(
          prevValid.latitude,
          prevValid.longitude,
          point.latitude,
          point.longitude
        );

        const timeDiffSec = Math.max(
          1,
          (new Date(point.recorded_at || Date.now()).getTime() - new Date(prevValid.recorded_at || Date.now()).getTime()) / 1000
        );
        const empiricalSpeedKmH = (stepMeters / timeDiffSec) * 3.6;

        // Anti-Jitter Stationary Deadband:
        // When stationary at home, GNSS drifts 5-18m with walking-speed spikes.
        // Ignore micro-drift when vehicle is stopped so phantom distance is NOT accumulated!
        const isStationaryDrift = this.trackingMode === 'device' && stepMeters < 18 && (empiricalSpeedKmH < 3.5 || rawSpeed < 2.5);

        if (isStationaryDrift) {
          this.currentSpeedKmH = 0;
        } else {
          const stepDistKm = stepMeters / 1000;
          this.accumulatedDistanceKm += stepDistKm;
          this.currentSpeedKmH = Math.round(rawSpeed > 0 ? rawSpeed : empiricalSpeedKmH);
        }
      } else {
        this.currentSpeedKmH = Math.round(rawSpeed);
      }

      this.currentAccuracyM = point.accuracy || 8;

      // Send to sync engine (offline storage or online sync)
      this.syncEngine.processPoint(point);

      this.notify({
        type: 'point_accepted',
        point,
        accumulatedDistanceKm: parseFloat(this.accumulatedDistanceKm.toFixed(2)),
        speedKmH: Math.round(this.currentSpeedKmH),
        accuracyM: Math.round(this.currentAccuracyM),
        validPointsCount: this.cleanedPoints.length,
        rejectedPointsCount: this.rejectedPoints.length
      });
    } else {
      // Point rejected by filter
      point.filterMetadata = validation;
      this.rejectedPoints.push(point);

      this.notify({
        type: 'point_rejected',
        point,
        reason: validation.reason,
        message: validation.message,
        validPointsCount: this.cleanedPoints.length,
        rejectedPointsCount: this.rejectedPoints.length
      });
    }
  }

  async resolvePlaceName(point, defaultPrefix) {
    if (!point) return defaultPrefix;
    if (point.name) return point.name;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.latitude}&lon=${point.longitude}`, {
        headers: { 'Accept-Language': 'en' }
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address;
        const place = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || addr.county;
        const sec = addr.city || addr.state_district || addr.state;
        if (place && sec && place !== sec) return `${place}, ${sec}`;
        if (place) return place;
        if (data.display_name) return data.display_name.split(',').slice(0, 2).join(',');
      }
    } catch (e) {
      // Offline fallback
    }
    return `${defaultPrefix} (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`;
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// Global Tracker instance
window.nlTracker = new GPSTracker({
  filterEngine: window.nlGpsFilter,
  distanceEngine: window.nlDistanceEngine,
  syncEngine: window.nlSyncEngine,
  store: window.nlStore
});
