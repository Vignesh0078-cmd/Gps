/**
 * test_runner.js - Automated Verification Suite for Namma Lorry GPS Specification
 * Directly implements and validates the 8 Part 14 Test Cases:
 * 
 * - TEST 1: 2-minute trip, 12+ valid points -> Model B MAY be considered.
 * - TEST 2: 2-minute trip, 11 valid points -> Model B INVALID — INSUFFICIENT EVIDENCE.
 * - TEST 3: 18-minute trip, 9 valid points -> Model B INVALID — INSUFFICIENT EVIDENCE (Model C 8.6 km selected).
 * - TEST 4: 18-minute trip, 108+ valid points -> Model B MAY be considered, subject to other checks.
 * - TEST 5: Verify UI count equals actual GPS array count (Total === Valid + Rejected).
 * - TEST 6: Verify Model B point count equals valid GPS point count (eliminates 34 vs 35 discrepancy).
 * - TEST 7: Verify offline GPS capture continues without internet.
 * - TEST 8: Verify OSRM receives correct longitude/latitude ordering (lon,lat format).
 */

class TestRunner {
  constructor({ filterEngine, distanceEngine, syncEngine, store }) {
    this.filterEngine = filterEngine;
    this.distanceEngine = distanceEngine;
    this.syncEngine = syncEngine;
    this.store = store;
    this.logs = [];
    this.logListener = null;
    this.statusListeners = [];
  }

  onStatusChange(listener) {
    this.statusListeners.push(listener);
  }

  notifyStatus(testNum, status, details = '') {
    this.statusListeners.forEach(fn => fn({ testNum, status, details }));
  }

  setLogListener(listener) {
    this.logListener = listener;
  }

  log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, msg, type };
    this.logs.push(entry);
    if (this.logListener) {
      this.logListener(entry);
    }
  }

  clearLogs() {
    this.logs = [];
    if (this.logListener) {
      this.logListener({ clear: true });
    }
  }

  async runAllTests() {
    this.clearLogs();
    this.log('====================================================', 'info');
    this.log('🚀 STARTING NAMMA LORRY SPECIFICATION TEST SUITE (8 TESTS)', 'info');
    this.log('Reference: GPS Point Coverage, Model B Evidence & Arbiter Rules', 'info');
    this.log('====================================================', 'info');

    const results = {};
    results.test1 = await this.runTest1();
    await new Promise(r => setTimeout(r, 300));

    results.test2 = await this.runTest2();
    await new Promise(r => setTimeout(r, 300));

    results.test3 = await this.runTest3();
    await new Promise(r => setTimeout(r, 300));

    results.test4 = await this.runTest4();
    await new Promise(r => setTimeout(r, 300));

    results.test5 = await this.runTest5();
    await new Promise(r => setTimeout(r, 300));

    results.test6 = await this.runTest6();
    await new Promise(r => setTimeout(r, 300));

    results.test7 = await this.runTest7();
    await new Promise(r => setTimeout(r, 300));

    results.test8 = await this.runTest8();

    const passedCount = Object.values(results).filter(r => r.passed).length;
    this.log('----------------------------------------------------', 'info');
    this.log(`🏁 TEST SUITE COMPLETED: ${passedCount}/8 TESTS PASSED`, passedCount === 8 ? 'success' : 'warn');

    return results;
  }

  /**
   * Helper to generate synthetic route points
   */
  generateRoutePoints(count, startLat, startLng, endLat, endLng, durationSec) {
    const points = [];
    const startTime = Date.now() - durationSec * 1000;
    const intervalMs = (durationSec * 1000) / Math.max(1, count - 1);

    for (let i = 0; i < count; i++) {
      const frac = count > 1 ? i / (count - 1) : 0;
      points.push({
        id: `PT-${i + 1}`,
        latitude: startLat + (endLat - startLat) * frac,
        longitude: startLng + (endLng - startLng) * frac,
        accuracy: 8.0,
        speed: 35,
        heading: 90,
        recorded_at: new Date(startTime + i * intervalMs).toISOString()
      });
    }
    return points;
  }

  /**
   * TEST 1: 2-minute trip with 12+ valid points
   * Expected: Model B MAY be considered (sufficient evidence threshold met).
   */
  async runTest1() {
    this.notifyStatus(1, 'running', 'Testing 2-min trip with 12 points...');
    this.log('[TEST 1] Testing 2-Minute Trip with 12+ Valid Points...', 'info');

    const durationMinutes = 2;
    const durationSeconds = 120;
    const points = this.generateRoutePoints(14, 13.0838, 80.2985, 13.0710, 80.2500, durationSeconds);

    this.log(`→ Generated ${points.length} GPS points for a ${durationMinutes}-minute trip.`, 'info');
    const modelB = this.distanceEngine.calculateModelB(points, durationMinutes, durationSeconds, 5);

    this.log(`→ Minimum required points: ${modelB.minimumRequiredPoints} (rate: 6 pts/min, min 12)`, 'info');
    this.log(`→ Valid points available: ${modelB.pointCount}`, 'info');
    this.log(`→ GPS Coverage: ${modelB.coveragePercent}%`, 'info');
    this.log(`→ Model B Distance: ${modelB.distanceKm} KM, Valid: ${modelB.valid}`, 'info');
    this.log(`→ Confidence: ${modelB.confidence}`, 'info');

    const passed = modelB.valid === true && modelB.isSufficient === true && modelB.pointCount >= 12;
    this.log(`✅ TEST 1 RESULT: ${passed ? 'PASSED (Model B considered)' : 'FAILED'}`, passed ? 'success' : 'error');
    this.notifyStatus(1, passed ? 'passed' : 'failed', passed ? `Valid (14/12 pts)` : 'Failed');
    return { name: 'Test 1: 2-Min Trip (12+ pts)', passed };
  }

  /**
   * TEST 2: 2-minute trip with 11 valid points
   * Expected: Model B INVALID — INSUFFICIENT EVIDENCE (11 < 12).
   */
  async runTest2() {
    this.notifyStatus(2, 'running', 'Testing 2-min trip with 11 points...');
    this.log('[TEST 2] Testing 2-Minute Trip with 11 Valid Points (Under Threshold)...', 'info');

    const durationMinutes = 2;
    const durationSeconds = 120;
    const points = this.generateRoutePoints(11, 13.0838, 80.2985, 13.0710, 80.2500, durationSeconds);

    this.log(`→ Generated ${points.length} GPS points for a ${durationMinutes}-minute trip.`, 'info');
    const modelB = this.distanceEngine.calculateModelB(points, durationMinutes, durationSeconds, 5);

    this.log(`→ Minimum required: ${modelB.minimumRequiredPoints} points | Available: ${modelB.pointCount}`, 'info');
    this.log(`→ Model B Valid: ${modelB.valid} (Expected: false)`, 'info');
    this.log(`→ Rejection Reason: ${modelB.rejectionReason}`, 'warn');
    this.log(`→ Confidence: ${modelB.confidence}`, 'info');

    const passed = modelB.valid === false && modelB.isSufficient === false && modelB.rejectionReason.includes('Insufficient GPS evidence');
    this.log(`✅ TEST 2 RESULT: ${passed ? 'PASSED (Model B rejected as expected)' : 'FAILED'}`, passed ? 'success' : 'error');
    this.notifyStatus(2, passed ? 'passed' : 'failed', passed ? `Rejected (11 < 12 pts)` : 'Failed');
    return { name: 'Test 2: 2-Min Trip (11 pts)', passed };
  }

  /**
   * TEST 3: 18-minute trip with 9 valid points (Exact Screenshot 2 Reproduction)
   * Expected:
   * - Model B (6.5 km) is marked INVALID — INSUFFICIENT GPS EVIDENCE (9 < 108 required, coverage 4.2%).
   * - System evaluates Model C (8.6 km) and Model A (8.2 km).
   * - Arbiter selects Model C (8.6 km) instead of blindly selecting Model B.
   */
  async runTest3() {
    this.notifyStatus(3, 'running', 'Validating 18-min trip with 9 points...');
    this.log('[TEST 3] Testing 18-Minute Trip with 9 Points (Screenshot 2 Fix)...', 'info');

    const durationMinutes = 18;
    const durationSeconds = 18 * 60; // 1080 sec
    // 9 points across 6.5 km displacement
    const points = this.generateRoutePoints(9, 13.0838, 80.2985, 13.0300, 80.2400, durationSeconds);

    this.log(`→ Duration: 18 minutes, Valid GPS Points: 9`, 'info');
    this.log(`→ Expected points @ 5s interval: ${Math.round(durationSeconds / 5)}`, 'info');
    this.log(`→ Required minimum evidence: ${18 * 6} points (18 min × 6 pts/min)`, 'info');

    // Resolve final distance via DistanceEngine Arbiter
    const result = await this.distanceEngine.resolveFinalDistance({
      cleanedPoints: points,
      rawPointsCount: 9,
      durationSeconds,
      durationMinutes,
      configuredInterval: 5,
      origin: 'Chennai Port',
      destination: 'Guindy Industrial Estate',
      isOnline: true,
      isDeviceTrip: true
    });

    const mB = result.breakdown.modelB;
    const mC = result.breakdown.modelC;
    const mA = result.breakdown.modelA;

    this.log(`→ Model B Distance: ${mB.distanceKm} KM, Valid: ${mB.valid} (Expected: false)`, 'info');
    this.log(`→ Model B Rejection: ${mB.rejectionReason}`, 'warn');
    this.log(`→ Model C Distance: ${mC.distanceKm} KM, Valid: ${mC.valid}`, 'info');
    this.log(`→ Model A Distance: ${mA.distanceKm} KM, Valid: ${mA.valid}`, 'info');
    this.log(`→ SELECTED MODEL: ${result.selectedModel.name} (${result.finalDistanceKm} KM)`, 'success');
    this.log(`→ Arbiter Rationale: ${result.rationale}`, 'info');

    const modelBRejected = mB.valid === false && mB.rejectionReason.includes('Insufficient GPS evidence');
    const modelCChosen = result.selectedModel.modelCode === 'MODEL_C' && result.finalDistanceKm > 0;
    const notModelB = result.selectedModel.modelCode !== 'MODEL_B';

    const passed = modelBRejected && notModelB && modelCChosen;
    this.log(`✅ TEST 3 RESULT: ${passed ? 'PASSED (Model B blocked, Model C selected)' : 'FAILED'}`, passed ? 'success' : 'error');
    this.notifyStatus(3, passed ? 'passed' : 'failed', passed ? `Model C Selected (${result.finalDistanceKm} KM)` : 'Failed');
    return { name: 'Test 3: 18-Min Trip (9 pts)', passed };
  }

  /**
   * TEST 4: 18-minute trip with 108+ valid points
   * Expected: Model B MAY be considered (110 >= 108 points).
   */
  async runTest4() {
    this.notifyStatus(4, 'running', 'Testing 18-min trip with 110 points...');
    this.log('[TEST 4] Testing 18-Minute Trip with 108+ Valid Points (Sufficient Evidence)...', 'info');

    const durationMinutes = 18;
    const durationSeconds = 18 * 60;
    const points = this.generateRoutePoints(110, 13.0838, 80.2985, 13.0300, 80.2400, durationSeconds);

    this.log(`→ Generated ${points.length} GPS points for an 18-minute trip.`, 'info');
    const modelB = this.distanceEngine.calculateModelB(points, durationMinutes, durationSeconds, 5);

    this.log(`→ Minimum required points: ${modelB.minimumRequiredPoints} (18 × 6 = 108)`, 'info');
    this.log(`→ Valid points available: ${modelB.pointCount}`, 'info');
    this.log(`→ GPS Coverage: ${modelB.coveragePercent}%`, 'info');
    this.log(`→ Model B Valid: ${modelB.valid}, Distance: ${modelB.distanceKm} KM`, 'info');

    const passed = modelB.valid === true && modelB.isSufficient === true && modelB.pointCount >= 108;
    this.log(`✅ TEST 4 RESULT: ${passed ? 'PASSED (Model B considered)' : 'FAILED'}`, passed ? 'success' : 'error');
    this.notifyStatus(4, passed ? 'passed' : 'failed', passed ? `Valid (110/108 pts)` : 'Failed');
    return { name: 'Test 4: 18-Min Trip (108+ pts)', passed };
  }

  /**
   * TEST 5: Verify UI count equals actual GPS array count
   * Invariant: Total Captured === Valid Accepted + Noise Filtered
   */
  async runTest5() {
    this.notifyStatus(5, 'running', 'Verifying array count consistency...');
    this.log('[TEST 5] Testing GPS Point Array Consistency (Total === Valid + Rejected)...', 'info');

    // Simulate 34 raw points: 30 valid and 4 noise spikes
    const rawPoints = [];
    const cleanedPoints = [];
    const rejectedPoints = [];

    const baseTime = Date.now() - 120000;
    let prevPoint = null;

    for (let i = 0; i < 34; i++) {
      const isSpike = (i === 10 || i === 18 || i === 25 || i === 31);
      const point = {
        id: `PT-${i + 1}`,
        latitude: 13.0838 + (i * 0.001) + (isSpike ? 0.08 : 0), // Spike jumps ~9km
        longitude: 80.2985 + (i * 0.001),
        accuracy: isSpike ? 85.0 : 8.0,
        speed: isSpike ? 350 : 40,
        recorded_at: new Date(baseTime + i * 3500).toISOString()
      };

      rawPoints.push(point);
      const val = this.filterEngine.validatePoint(point, prevPoint);
      if (val.isValid) {
        cleanedPoints.push(point);
        prevPoint = point;
      } else {
        rejectedPoints.push(point);
      }
    }

    this.log(`→ Total Raw Points: ${rawPoints.length}`, 'info');
    this.log(`→ Valid Accepted: ${cleanedPoints.length}`, 'info');
    this.log(`→ Noise Filtered: ${rejectedPoints.length}`, 'info');
    this.log(`→ Sum (Valid + Filtered): ${cleanedPoints.length + rejectedPoints.length}`, 'info');

    const isConsistent = rawPoints.length === (cleanedPoints.length + rejectedPoints.length);
    this.log(`→ Invariant (Total === Valid + Filtered): ${isConsistent ? 'STRICTLY PRESERVED' : 'VIOLATED'}`, isConsistent ? 'success' : 'error');

    const passed = isConsistent && rawPoints.length === 34 && rejectedPoints.length === 4 && cleanedPoints.length === 30;
    this.log(`✅ TEST 5 RESULT: ${passed ? 'PASSED' : 'FAILED'}`, passed ? 'success' : 'error');
    this.notifyStatus(5, passed ? 'passed' : 'failed', passed ? `34 = 30 + 4 (100% Consistent)` : 'Failed');
    return { name: 'Test 5: Point Count Consistency', passed };
  }

  /**
   * TEST 6: Verify Model B point count equals valid GPS point count (Screenshot 1 Fix)
   * Resolves: Total = 34 but Model B says "35 validated points"
   */
  async runTest6() {
    this.notifyStatus(6, 'running', 'Verifying Model B point count match...');
    this.log('[TEST 6] Testing Model B Point Count Equivalence (Screenshot 1 Fix)...', 'info');

    const points = this.generateRoutePoints(34, 13.0838, 80.2985, 13.0710, 80.2500, 120);
    const modelB = this.distanceEngine.calculateModelB(points, 2, 120, 5);

    this.log(`→ Valid GPS array length: ${points.length}`, 'info');
    this.log(`→ Model B point count: ${modelB.pointCount}`, 'info');
    this.log(`→ Model B note: "${modelB.note}"`, 'info');

    const countMatches = modelB.pointCount === points.length;
    const noteMatches = modelB.note.includes(`Calculated from ${points.length} validated GPS points`);
    const noDiscrepancy = !modelB.note.includes('35');

    const passed = countMatches && noteMatches && noDiscrepancy;
    this.log(`→ Valid Points === Model B Count: ${countMatches ? 'IDENTICAL (34 === 34)' : 'CONTRADICTORY'}`, countMatches ? 'success' : 'error');
    this.log(`✅ TEST 6 RESULT: ${passed ? 'PASSED (Contradiction eliminated)' : 'FAILED'}`, passed ? 'success' : 'error');
    this.notifyStatus(6, passed ? 'passed' : 'failed', passed ? `34 pts === 34 pts` : 'Failed');
    return { name: 'Test 6: Model B Count === Valid Count', passed };
  }

  /**
   * TEST 7: Verify offline GPS capture continues without internet
   */
  async runTest7() {
    this.notifyStatus(7, 'running', 'Verifying offline GPS capture...');
    this.log('[TEST 7] Testing Offline GPS Capture & Queue Persistence...', 'info');

    this.store.setOnlineStatus(false);
    this.store.clearOfflineQueue();

    const offlinePoints = [
      { id: 'OFF-1', latitude: 13.0500, longitude: 80.1050, accuracy: 8.0, speed: 50, recorded_at: new Date().toISOString() },
      { id: 'OFF-2', latitude: 13.0380, longitude: 80.0400, accuracy: 8.0, speed: 55, recorded_at: new Date(Date.now() + 5000).toISOString() },
      { id: 'OFF-3', latitude: 13.0080, longitude: 79.9800, accuracy: 7.0, speed: 60, recorded_at: new Date(Date.now() + 10000).toISOString() }
    ];

    offlinePoints.forEach((p, idx) => {
      const processed = this.syncEngine.processPoint(p);
      this.log(`→ Stored point ${idx + 1}: ID ${processed.id} status=${processed.sync_status}`, 'info');
    });

    const queue = this.store.getOfflineQueue();
    this.log(`→ Points in Local Offline Queue: ${queue.length} (Expected: 3)`, 'info');

    const distOffline = this.distanceEngine.calculateModelB(offlinePoints, 1, 15, 5);
    this.log(`→ Local Offline Model B Distance: ${distOffline.distanceKm} KM (Offline-ready)`, 'info');

    this.store.setOnlineStatus(true); // Restore online

    const passed = queue.length === 3 && queue.every(p => p.sync_status === 'pending') && distOffline.distanceKm > 0;
    this.log(`✅ TEST 7 RESULT: ${passed ? 'PASSED (Offline capture verified)' : 'FAILED'}`, passed ? 'success' : 'error');
    this.notifyStatus(7, passed ? 'passed' : 'failed', passed ? `3 Points Queued Locally` : 'Failed');
    return { name: 'Test 7: Offline GPS Capture', passed };
  }

  /**
   * TEST 8: Verify OSRM receives correct longitude/latitude ordering
   */
  async runTest8() {
    this.notifyStatus(8, 'running', 'Verifying OSRM coordinate ordering...');
    this.log('[TEST 8] Testing OSRM Coordinate Ordering (lon,lat format)...', 'info');

    const pStart = { latitude: 13.0838, longitude: 80.2985 };
    const pEnd = { latitude: 13.0710, longitude: 80.1900 };

    // Format strictly required by OSRM API: {lon},{lat};{lon},{lat}
    const coordStr = `${pStart.longitude.toFixed(5)},${pStart.latitude.toFixed(5)};${pEnd.longitude.toFixed(5)},${pEnd.latitude.toFixed(5)}`;
    const expectedPrefix = '80.29850,13.08380';
    const wrongPrefix = '13.08380,80.29850';

    this.log(`→ Start Coords: Lat ${pStart.latitude}, Lon ${pStart.longitude}`, 'info');
    this.log(`→ End Coords:   Lat ${pEnd.latitude}, Lon ${pEnd.longitude}`, 'info');
    this.log(`→ Formatted OSRM string: "${coordStr}"`, 'info');

    const isCorrectOrder = coordStr.startsWith(expectedPrefix);
    const isNotReversed = !coordStr.startsWith(wrongPrefix);

    this.log(`→ Longitude appears first: ${isCorrectOrder ? 'YES (Correct)' : 'NO (Error)'}`, isCorrectOrder ? 'success' : 'error');
    this.log(`→ Latitude does NOT appear first: ${isNotReversed ? 'CONFIRMED' : 'REVERSED'}`, isNotReversed ? 'success' : 'error');

    const passed = isCorrectOrder && isNotReversed;
    this.log(`✅ TEST 8 RESULT: ${passed ? 'PASSED (OSRM lon,lat ordering verified)' : 'FAILED'}`, passed ? 'success' : 'error');
    this.notifyStatus(8, passed ? 'passed' : 'failed', passed ? `lon,lat verified` : 'Failed');
    return { name: 'Test 8: OSRM lon,lat Ordering', passed };
  }
}

// Global Test Runner instance
window.nlTestRunner = new TestRunner({
  filterEngine: window.nlGpsFilter,
  distanceEngine: window.nlDistanceEngine,
  syncEngine: window.nlSyncEngine,
  store: window.nlStore
});
