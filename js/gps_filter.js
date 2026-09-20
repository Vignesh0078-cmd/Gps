/**
 * gps_filter.js - GPS Quality Assurance & Anomaly Filtering Engine
 * Implements Sections 13, 14, 15, and 16 of gps.docx:
 * - Check 1: Accuracy Filter (<= 50 meters)
 * - Check 2: Impossible Speed / Jump Filter (v = d/t > 120 km/h)
 * - Check 3: GPS Spike Detection (P1 -> P2 -> Spike X -> P3)
 */

class GPSFilterEngine {
  constructor(options = {}) {
    // Configurable thresholds matching Namma Lorry spec
    this.maxAllowedAccuracyMeters = options.maxAccuracy || 50.0;
    this.maxRealisticTruckSpeedKmH = options.maxSpeed || 120.0; // Highway heavy truck cap
    this.maxInstantJumpMeters = options.maxJump || 800.0; // Distance jump in single interval (<10s)
    this.spikeAngleThresholdDeg = options.spikeAngle || 35.0; // Sharp detour deflection angle
  }

  /**
   * Earth distance using Haversine formula (meters)
   */
  haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Evaluates a single incoming point against the immediate previous valid point
   */
  validatePoint(point, prevPoint) {
    // Check 1: Accuracy Threshold
    const accuracy = point.accuracy !== undefined ? point.accuracy : 10.0;
    if (accuracy > this.maxAllowedAccuracyMeters) {
      return {
        isValid: false,
        reason: 'POOR_ACCURACY',
        message: `Accuracy (${accuracy.toFixed(1)}m) exceeded 50m threshold.`
      };
    }

    // If there is no previous point, first point is valid (if accuracy passed)
    if (!prevPoint) {
      return { isValid: true, reason: 'VALID_START', speedKmH: 0 };
    }

    // Check 2: Impossible Jump / Speed
    const distMeters = this.haversineMeters(
      prevPoint.latitude,
      prevPoint.longitude,
      point.latitude,
      point.longitude
    );

    const timeDiffSeconds = Math.max(
      (new Date(point.recorded_at || Date.now()).getTime() -
       new Date(prevPoint.recorded_at || Date.now()).getTime()) / 1000,
      1.0
    );

    const speedMps = distMeters / timeDiffSeconds;
    const speedKmH = speedMps * 3.6;

    // Reject if instantaneous jump is physically impossible for a freight vehicle
    if (speedKmH > this.maxRealisticTruckSpeedKmH && distMeters > 500) {
      return {
        isValid: false,
        reason: 'IMPOSSIBLE_SPEED',
        message: `Calculated speed (${speedKmH.toFixed(1)} km/h over ${distMeters.toFixed(0)}m in ${timeDiffSeconds.toFixed(1)}s) exceeds truck limit of ${this.maxRealisticTruckSpeedKmH} km/h.`,
        speedKmH,
        distanceMeters: distMeters
      };
    }

    return {
      isValid: true,
      reason: 'ACCEPTED',
      distanceMeters: distMeters,
      speedKmH: speedKmH
    };
  }

  /**
   * Batch filtering over a list of points (incorporates Check 3: 3-point Spike Detection)
   */
  filterTrajectory(points) {
    if (!points || points.length === 0) {
      return { validPoints: [], rejectedPoints: [], stats: { total: 0, valid: 0, rejected: 0, qualityScore: 100 } };
    }

    const validPoints = [];
    const rejectedPoints = [];

    // Pass 1: Accuracy and Speed filter
    let lastValid = null;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const validation = this.validatePoint(pt, lastValid);
      if (validation.isValid) {
        validPoints.push({ ...pt, filterMetadata: validation });
        lastValid = pt;
      } else {
        rejectedPoints.push({ ...pt, filterMetadata: validation });
      }
    }

    // Pass 2: Check 3 — 3-point Spike Detection (P1 -> Spike X -> P2)
    // If point i creates a sharp acute triangle away from the path between i-1 and i+1
    const cleanedPoints = [];
    for (let i = 0; i < validPoints.length; i++) {
      if (i > 0 && i < validPoints.length - 1) {
        const pPrev = validPoints[i - 1];
        const pCurr = validPoints[i];
        const pNext = validPoints[i + 1];

        const dPrevNext = this.haversineMeters(pPrev.latitude, pPrev.longitude, pNext.latitude, pNext.longitude);
        const dPrevCurr = this.haversineMeters(pPrev.latitude, pPrev.longitude, pCurr.latitude, pCurr.longitude);
        const dCurrNext = this.haversineMeters(pCurr.latitude, pCurr.longitude, pNext.latitude, pNext.longitude);

        // If going through pCurr adds more than 2x the direct distance and detour is > 400m
        if (dPrevCurr + dCurrNext > 2.2 * dPrevNext && (dPrevCurr + dCurrNext - dPrevNext) > 400) {
          rejectedPoints.push({
            ...pCurr,
            filterMetadata: {
              isValid: false,
              reason: 'TRANSIENT_SPIKE',
              message: `Spike anomaly detected: detour of ${(dPrevCurr + dCurrNext - dPrevNext).toFixed(0)}m rejected.`
            }
          });
          continue;
        }
      }
      cleanedPoints.push(validPoints[i]);
    }

    const total = points.length;
    const valid = cleanedPoints.length;
    const rejected = rejectedPoints.length;
    const qualityScore = total > 0 ? parseFloat(((valid / total) * 100).toFixed(1)) : 100;

    return {
      validPoints: cleanedPoints,
      rejectedPoints,
      stats: {
        total,
        valid,
        rejected,
        qualityScore,
        accuracyRejections: rejectedPoints.filter(p => p.filterMetadata.reason === 'POOR_ACCURACY').length,
        speedRejections: rejectedPoints.filter(p => p.filterMetadata.reason === 'IMPOSSIBLE_SPEED').length,
        spikeRejections: rejectedPoints.filter(p => p.filterMetadata.reason === 'TRANSIENT_SPIKE').length
      }
    };
  }
}

// Attach to window
window.nlGpsFilter = new GPSFilterEngine();
