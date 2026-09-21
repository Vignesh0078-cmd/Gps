/**
 * lab_simulator.js - Interactive Freight Corridor Simulator for Algorithm Lab (view-lab)
 * Runs pre-calculated logistics corridor simulations completely isolated from real device GPS.
 * Features:
 * - Route selection (Chennai -> Sriperumbudur, Vellore, Bengaluru)
 * - Speed multipliers (1x, 2x, 5x, 10x, 20x)
 * - Live GPS filter ingestion & anomaly rejection visualizer
 * - Real-time Multi-Model distance calculation (Model A vs Model B vs Model C)
 * - Manual GPS jump/spike injection to test filter resilience in real time
 */

class LabSimulator {
  constructor({ filterEngine, distanceEngine, mapManager }) {
    this.filterEngine = filterEngine;
    this.distanceEngine = distanceEngine;
    this.mapManager = mapManager;

    this.activeCorridorKey = 'chennai_sriperumbudur';
    this.simulationSpeed = 5;
    this.isRunning = false;
    this.isPaused = false;
    this.currentStep = 0;
    this.timerId = null;

    this.rawPoints = [];
    this.validPoints = [];
    this.rejectedPoints = [];
    this.accumulatedKm = 0.0;
    this.currentSpeedKmH = 0.0;

    this.listeners = [];
  }

  onUpdate(listener) {
    this.listeners.push(listener);
  }

  notify(data) {
    this.listeners.forEach(fn => fn(data));
  }

  setCorridor(key) {
    if (this.isRunning) this.reset();
    this.activeCorridorKey = key;
    this.notify({ type: 'corridor_changed', key });
  }

  setSpeed(speed) {
    this.simulationSpeed = Math.max(1, speed);
    if (this.isRunning && !this.isPaused) {
      if (this.timerId) clearTimeout(this.timerId);
      this.scheduleNextStep();
    }
  }

  start() {
    if (this.isRunning && !this.isPaused) return;

    if (this.isPaused) {
      this.isPaused = false;
      this.isRunning = true;
      this.scheduleNextStep();
      this.notify({ type: 'resumed' });
      return;
    }

    this.reset();
    this.isRunning = true;
    this.isPaused = false;

    const corridor = window.nlCorridors[this.activeCorridorKey] || window.nlCorridors.chennai_sriperumbudur;
    this.mapManager.resetLabMap();
    if (corridor.waypoints.length > 0) {
      const p0 = corridor.waypoints[0];
      this.mapManager.setLabStartMarker({ latitude: p0.lat, longitude: p0.lng });
      this.mapManager.centerLabMap(p0.lat, p0.lng, 12);
    }

    this.notify({ type: 'started', corridor });
    this.scheduleNextStep();
  }

  pause() {
    if (!this.isRunning) return;
    this.isPaused = true;
    if (this.timerId) clearTimeout(this.timerId);
    this.notify({ type: 'paused' });
  }

  reset() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentStep = 0;
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = null;

    this.rawPoints = [];
    this.validPoints = [];
    this.rejectedPoints = [];
    this.accumulatedKm = 0.0;
    this.currentSpeedKmH = 0.0;

    this.mapManager.resetLabMap();
    this.notify({ type: 'reset' });
  }

  scheduleNextStep() {
    const baseDelayMs = 2200;
    const delay = Math.max(200, Math.floor(baseDelayMs / this.simulationSpeed));
    this.timerId = setTimeout(() => this.executeStep(), delay);
  }

  async executeStep() {
    if (!this.isRunning || this.isPaused) return;

    const corridor = window.nlCorridors[this.activeCorridorKey] || window.nlCorridors.chennai_sriperumbudur;
    const waypoints = corridor.waypoints;

    if (this.currentStep >= waypoints.length) {
      this.finishSimulation();
      return;
    }

    const wp = waypoints[this.currentStep];
    const prevWp = this.currentStep > 0 ? waypoints[this.currentStep - 1] : null;

    // Calculate heading
    let heading = 0;
    if (prevWp) {
      const y = Math.sin((wp.lng - prevWp.lng) * Math.PI / 180) * Math.cos(wp.lat * Math.PI / 180);
      const x = Math.cos(prevWp.lat * Math.PI / 180) * Math.sin(wp.lat * Math.PI / 180) -
                Math.sin(prevWp.lat * Math.PI / 180) * Math.cos(wp.lat * Math.PI / 180) * Math.cos((wp.lng - prevWp.lng) * Math.PI / 180);
      heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    const point = {
      id: `SIM-LAB-${this.currentStep}`,
      latitude: wp.lat,
      longitude: wp.lng,
      accuracy: wp.accuracy,
      speed: wp.speed,
      heading: Math.round(heading),
      name: wp.name,
      isNoise: wp.isNoise || false,
      recorded_at: new Date().toISOString()
    };

    this.processSimulatedPoint(point);
    this.currentStep++;

    if (this.currentStep < waypoints.length) {
      this.scheduleNextStep();
    } else {
      this.finishSimulation();
    }
  }

  processSimulatedPoint(point) {
    this.rawPoints.push(point);

    const prevValid = this.validPoints.length > 0
      ? this.validPoints[this.validPoints.length - 1]
      : null;

    // Run Filter Engine validation (Sections 13-16 of gps.docx)
    const filterVerdict = this.filterEngine.validatePoint(point, prevValid);

    if (filterVerdict.isValid) {
      // Smooth with Kalman
      const smoothed = this.filterEngine.kalmanFilter(point.latitude, point.longitude, point.accuracy);
      const cleanPt = {
        ...point,
        latitude: smoothed.latitude,
        longitude: smoothed.longitude
      };

      if (prevValid) {
        const segKm = this.filterEngine.haversineKm(
          prevValid.latitude, prevValid.longitude,
          cleanPt.latitude, cleanPt.longitude
        );
        this.accumulatedKm = parseFloat((this.accumulatedKm + segKm).toFixed(2));
      }

      this.validPoints.push(cleanPt);
      this.currentSpeedKmH = point.speed || 45;

      // Update dedicated Lab Map
      this.mapManager.updateLabTruck(cleanPt);

      this.notify({
        type: 'step_valid',
        point: cleanPt,
        verdict: filterVerdict,
        stepIndex: this.currentStep + 1,
        totalSteps: (window.nlCorridors[this.activeCorridorKey] || window.nlCorridors.chennai_sriperumbudur).waypoints.length,
        speedKmH: this.currentSpeedKmH,
        accumulatedKm: this.accumulatedKm,
        validCount: this.validPoints.length,
        rejectedCount: this.rejectedPoints.length
      });
    } else {
      this.rejectedPoints.push({ point, verdict: filterVerdict });
      this.mapManager.addLabNoiseMarker(point, filterVerdict.reason, `Rejected: ${filterVerdict.reason}`);

      this.notify({
        type: 'step_rejected',
        point,
        verdict: filterVerdict,
        stepIndex: this.currentStep + 1,
        totalSteps: (window.nlCorridors[this.activeCorridorKey] || window.nlCorridors.chennai_sriperumbudur).waypoints.length,
        speedKmH: this.currentSpeedKmH,
        accumulatedKm: this.accumulatedKm,
        validCount: this.validPoints.length,
        rejectedCount: this.rejectedPoints.length
      });
    }
  }

  injectAnomaly(type = 'jump') {
    if (!this.isRunning) {
      this.start();
    }

    const prevValid = this.validPoints.length > 0
      ? this.validPoints[this.validPoints.length - 1]
      : { latitude: 13.0827, longitude: 80.2707 };

    let badPoint;
    if (type === 'jump') {
      badPoint = {
        id: `INJECT-${Date.now()}`,
        latitude: prevValid.latitude + 0.08,
        longitude: prevValid.longitude + 0.08,
        accuracy: 12,
        speed: 195,
        heading: 45,
        name: '⚡ Manually Injected Impossible Jump (195 km/h)',
        recorded_at: new Date().toISOString()
      };
    } else {
      badPoint = {
        id: `INJECT-${Date.now()}`,
        latitude: prevValid.latitude + 0.005,
        longitude: prevValid.longitude + 0.005,
        accuracy: 88,
        speed: 40,
        heading: 45,
        name: '⚡ Manually Injected Degraded Signal (±88m accuracy)',
        recorded_at: new Date().toISOString()
      };
    }

    this.processSimulatedPoint(badPoint);
  }

  finishSimulation() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.timerId) clearTimeout(this.timerId);

    const corridor = window.nlCorridors[this.activeCorridorKey] || window.nlCorridors.chennai_sriperumbudur;
    const lastPoint = this.validPoints[this.validPoints.length - 1];
    if (lastPoint) {
      this.mapManager.setLabFinishMarker(lastPoint);
    }

    this.notify({
      type: 'completed',
      corridor,
      totalKm: this.accumulatedKm,
      validPointsCount: this.validPoints.length,
      rejectedPointsCount: this.rejectedPoints.length
    });
  }
}

// Global Lab Simulator instance
window.nlLabSimulator = new LabSimulator({
  filterEngine: window.nlGpsFilter,
  distanceEngine: window.nlDistanceEngine,
  mapManager: window.nlMapManager
});
