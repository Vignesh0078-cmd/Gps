/**
 * app.js - Main Application Coordinator & UI Controller
 * Manages view switching, telemetry updates, event wiring, and modals.
 */

document.addEventListener('DOMContentLoaded', () => {
  const store = window.nlStore;
  const tracker = window.nlTracker;
  const mapManager = window.nlMapManager;
  const syncEngine = window.nlSyncEngine;
  const testRunner = window.nlTestRunner;

  // Cache DOM Elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const viewSections = document.querySelectorAll('.view-section');

  // Telemetry HUD Elements
  const hudSpeed = document.getElementById('hudSpeed');
  const hudDistance = document.getElementById('hudDistance');
  const hudDuration = document.getElementById('hudDuration');
  const hudAccuracy = document.getElementById('hudAccuracy');
  const hudPointsCount = document.getElementById('hudPointsCount');
  const hudTripId = document.getElementById('hudTripId');
  const hudTripBadge = document.getElementById('hudTripBadge');

  // Controls & HUD Location Elements
  const btnStartTrip = document.getElementById('btnStartTrip');
  const btnEndTrip = document.getElementById('btnEndTrip');
  const btnRecalibrateGps = document.getElementById('btnRecalibrateGps');
  const gpsLockAccuracyNotice = document.getElementById('gpsLockAccuracyNotice');
  const hudStartPlace = document.getElementById('hudStartPlace');
  const hudStartCoords = document.getElementById('hudStartCoords');
  const hudStartStatus = document.getElementById('hudStartStatus');
  const hudStopPlace = document.getElementById('hudStopPlace');
  const hudStopCoords = document.getElementById('hudStopCoords');
  const hudStopStatus = document.getElementById('hudStopStatus');
  const modalStartLoc = document.getElementById('modalStartLoc');
  const modalStopLoc = document.getElementById('modalStopLoc');
  const trackingModeSelect = document.getElementById('trackingModeSelect');
  const corridorSelect = document.getElementById('corridorSelect');
  const speedPills = document.querySelectorAll('.speed-pill');
  const networkToggleBtn = document.getElementById('networkToggleBtn');
  const networkStatusDot = document.getElementById('networkStatusDot');
  const networkStatusText = document.getElementById('networkStatusText');
  const queueCounterBadge = document.getElementById('queueCounterBadge');

  // Modal Elements
  const tripSummaryModal = document.getElementById('tripSummaryModal');
  const btnCloseModal = document.getElementById('btnCloseModal');

  // Initialize Map
  mapManager.initDriverMap('driverMap');

  // Initialize UI State
  updateNetworkUI(store.isOnline());
  renderDriverProfile();
  renderDriverStats();
  renderTripHistoryTable();

  // =========================================================================
  // View Switching
  // =========================================================================
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetViewId = tab.dataset.view;

      navTabs.forEach(t => t.classList.remove('active'));
      viewSections.forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      const targetView = document.getElementById(targetViewId);
      if (targetView) {
        targetView.classList.add('active');
      }

      // Initialize map on first view display
      if (targetViewId === 'view-cockpit') {
        setTimeout(() => mapManager.driverMap && mapManager.driverMap.invalidateSize(), 150);
      } else if (targetViewId === 'view-fleet') {
        mapManager.initAdminMap('adminFleetMap');
        mapManager.renderAdminFleetVehicles();
        setTimeout(() => mapManager.adminMap && mapManager.adminMap.invalidateSize(), 150);
      } else if (targetViewId === 'view-analytics') {
        renderDriverStats();
        renderTripHistoryTable();
      }
    });
  });

  const corridorGroup = document.getElementById('corridorGroup');

  // Auto-detect driver's real current location on load
  function initRealGpsDetection() {
    if (hudStartPlace) hudStartPlace.textContent = 'Detecting your GPS location...';
    if (hudStartCoords) hudStartCoords.textContent = 'Acquiring GNSS fix...';
    if (hudStartStatus) {
      hudStartStatus.textContent = 'LOCATING...';
      hudStartStatus.className = 'location-status-badge ready';
    }

    tracker.detectCurrentLocation().then(loc => {
      if (loc) {
        if (hudStartPlace) hudStartPlace.textContent = loc.address;
        if (hudStartCoords) hudStartCoords.textContent = `${loc.latitude.toFixed(5)}°, ${loc.longitude.toFixed(5)}° (±${Math.round(loc.accuracy)}m)`;
        if (hudStartStatus) {
          hudStartStatus.textContent = 'READY TO START';
          hudStartStatus.className = 'location-status-badge ready';
        }
        if (gpsLockAccuracyNotice) gpsLockAccuracyNotice.textContent = `GNSS Accuracy: ±${Math.round(loc.accuracy)}m`;
        if (hudAccuracy) hudAccuracy.textContent = `±${Math.round(loc.accuracy)}m`;
      } else {
        if (hudStartPlace) hudStartPlace.textContent = 'Location access required';
        if (hudStartCoords) hudStartCoords.textContent = 'Please allow location in browser';
        if (hudStartStatus) hudStartStatus.textContent = 'GPS OFF';
      }
    });
  }

  if (btnRecalibrateGps) {
    btnRecalibrateGps.addEventListener('click', () => {
      initRealGpsDetection();
    });
  }

  function syncModeUI() {
    if (!trackingModeSelect) return;
    if (trackingModeSelect.value === 'device') {
      if (corridorGroup) corridorGroup.style.display = 'none';
      initRealGpsDetection();
    } else {
      if (corridorGroup) corridorGroup.style.display = 'block';
    }
  }

  // Initial detection & sync UI
  syncModeUI();

  // Mode change handler
  if (trackingModeSelect) {
    trackingModeSelect.addEventListener('change', () => {
      syncModeUI();
    });
  }

  // =========================================================================
  // Trip Start & Stop
  // =========================================================================
  btnStartTrip.addEventListener('click', () => {
    const mode = trackingModeSelect ? trackingModeSelect.value : 'device';
    const corridor = corridorSelect ? corridorSelect.value : 'chennai_sriperumbudur';

    mapManager.resetDriverMap();

    tracker.startTrip({ mode, corridorKey: corridor });

    btnStartTrip.style.display = 'none';
    btnEndTrip.style.display = 'inline-flex';
    if (trackingModeSelect) trackingModeSelect.disabled = true;
    if (corridorSelect) corridorSelect.disabled = true;

    hudTripBadge.className = 'badge badge-success';
    hudTripBadge.innerHTML = '<span class="pulsing-dot online"></span> TRIP ACTIVE';
    hudTripId.textContent = tracker.activeTripId;

    if (hudStopPlace) hudStopPlace.textContent = 'Tracking live... will capture where you stop';
    if (hudStopCoords) hudStopCoords.textContent = 'Recording live GPS track...';
    if (hudStopStatus) {
      hudStopStatus.textContent = 'TRACKING LIVE';
      hudStopStatus.className = 'location-status-badge ready';
    }
  });

  btnEndTrip.addEventListener('click', async () => {
    btnEndTrip.disabled = true;
    btnEndTrip.innerHTML = '<span>⏳ Capturing Stopping Point & Mileage...</span>';

    const tripRecord = await tracker.endTrip();

    btnEndTrip.style.display = 'none';
    btnEndTrip.disabled = false;
    btnEndTrip.innerHTML = '<span>🛑 STOP TRIP &amp; RECORD STOPPING POINT</span>';
    btnStartTrip.style.display = 'inline-flex';
    if (trackingModeSelect) trackingModeSelect.disabled = false;
    if (corridorSelect) corridorSelect.disabled = false;

    hudTripBadge.className = 'badge badge-cyan';
    hudTripBadge.innerHTML = 'COMPLETED';

    if (tripRecord) {
      if (hudStopPlace) hudStopPlace.textContent = tripRecord.destination;
      if (hudStopCoords) hudStopCoords.textContent = `Completed at ${new Date(tripRecord.endedAt).toLocaleTimeString()}`;
      if (hudStopStatus) {
        hudStopStatus.textContent = 'STOPPED';
        hudStopStatus.className = 'location-status-badge stopped';
      }

      showTripCompletedModal(tripRecord);
      renderDriverStats();
      renderTripHistoryTable();
    }
  });

  // =========================================================================
  // Simulation Speed Pills
  // =========================================================================
  speedPills.forEach(pill => {
    pill.addEventListener('click', () => {
      speedPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const speed = parseInt(pill.dataset.speed, 10) || 5;
      tracker.setSimulationSpeed(speed);
    });
  });

  // =========================================================================
  // Network Toggle (Simulate Offline / Network Loss)
  // =========================================================================
  networkToggleBtn.addEventListener('click', () => {
    const isOnline = syncEngine.toggleSimulatedNetwork();
    updateNetworkUI(isOnline);
  });

  function updateNetworkUI(isOnline) {
    if (isOnline) {
      networkStatusDot.className = 'pulsing-dot online';
      networkStatusText.textContent = 'ONLINE (SUPABASE SYNCED)';
      networkToggleBtn.style.borderColor = 'rgba(0, 176, 116, 0.4)';
    } else {
      networkStatusDot.className = 'pulsing-dot offline';
      networkStatusText.textContent = 'SIMULATED OFFLINE (LOCAL QUEUE)';
      networkToggleBtn.style.borderColor = 'rgba(255, 71, 87, 0.4)';
    }
    updateQueueBadge();
  }

  function updateQueueBadge() {
    const queue = store.getOfflineQueue();
    if (queue.length > 0) {
      queueCounterBadge.style.display = 'inline-flex';
      queueCounterBadge.textContent = `${queue.length} PENDING`;
    } else {
      queueCounterBadge.style.display = 'none';
    }
  }

  // Listen to Sync Engine updates
  syncEngine.onSyncUpdate(evt => {
    if (evt.type === 'sync_started') {
      networkStatusText.textContent = `SYNCING ${evt.count} POINTS...`;
    } else if (evt.type === 'sync_completed') {
      updateNetworkUI(store.isOnline());
    } else if (evt.type === 'point_queued') {
      updateQueueBadge();
    }
  });

  // =========================================================================
  // Tracker Telemetry Listeners
  // =========================================================================
  tracker.onUpdate(evt => {
    if (evt.type === 'location_detected') {
      if (hudStartPlace) hudStartPlace.textContent = evt.address;
      if (hudStartCoords) hudStartCoords.textContent = `${evt.point.latitude.toFixed(5)}°, ${evt.point.longitude.toFixed(5)}° (±${evt.accuracyM}m)`;
      if (hudStartStatus && !tracker.isTracking) {
        hudStartStatus.textContent = 'READY TO START';
        hudStartStatus.className = 'location-status-badge ready';
      }
      if (gpsLockAccuracyNotice) gpsLockAccuracyNotice.textContent = `GNSS Accuracy: ±${evt.accuracyM}m`;
      if (hudAccuracy) hudAccuracy.textContent = `±${evt.accuracyM}m`;
    } else if (evt.type === 'start_location_locked') {
      if (hudStartPlace) hudStartPlace.textContent = evt.address;
      if (hudStartCoords) hudStartCoords.textContent = `${evt.point.latitude.toFixed(5)}°, ${evt.point.longitude.toFixed(5)}°`;
      if (hudStartStatus) {
        hudStartStatus.textContent = 'LOCKED (ACTIVE)';
        hudStartStatus.className = 'location-status-badge locked';
      }
    } else if (evt.type === 'point_accepted') {
      hudSpeed.textContent = evt.speedKmH;
      hudDistance.textContent = evt.accumulatedDistanceKm;
      hudAccuracy.textContent = `±${evt.accuracyM}m`;
      hudPointsCount.textContent = evt.validPointsCount;

      document.getElementById('telemetryValidPoints').textContent = evt.validPointsCount;
      document.getElementById('telemetryRejectedPoints').textContent = evt.rejectedPointsCount;

      if (tracker.isTracking && hudStopCoords) {
        hudStopCoords.textContent = `Live: ${evt.point.latitude.toFixed(5)}°, ${evt.point.longitude.toFixed(5)}°`;
      }

      mapManager.updateTruckPosition(evt.point);
      if (mapManager.adminMap) {
        mapManager.renderAdminFleetVehicles();
      }
    } else if (evt.type === 'point_rejected') {
      document.getElementById('telemetryRejectedPoints').textContent = evt.rejectedPointsCount;
      mapManager.addNoiseMarker(evt.point, evt.reason, evt.message);
    } else if (evt.type === 'timer_tick') {
      hudDuration.textContent = evt.elapsedFormatted;
    }
  });

  // Center / Follow truck buttons on map
  document.getElementById('btnCenterTruck').addEventListener('click', () => {
    if (tracker.cleanedPoints.length > 0) {
      const last = tracker.cleanedPoints[tracker.cleanedPoints.length - 1];
      mapManager.driverMap.setView([last.latitude, last.longitude], 15);
    } else if (tracker.preTripLocation) {
      mapManager.driverMap.setView([tracker.preTripLocation.latitude, tracker.preTripLocation.longitude], 15);
    }
  });

  document.getElementById('btnFitRoute').addEventListener('click', () => {
    mapManager.fitBoundsToRoute();
  });

  // =========================================================================
  // Modal: Trip Completed & Multi-Model Audit
  // =========================================================================
  function showTripCompletedModal(trip) {
    document.getElementById('modalTripId').textContent = trip.id;
    document.getElementById('modalRoute').textContent = `${trip.origin} ➔ ${trip.destination}`;
    if (modalStartLoc) modalStartLoc.textContent = trip.origin;
    if (modalStopLoc) modalStopLoc.textContent = trip.destination;
    document.getElementById('modalDistance').textContent = `${trip.distanceKm} KM`;
    document.getElementById('modalDuration').textContent = `${trip.durationMinutes} min`;
    document.getElementById('modalAvgSpeed').textContent = `${trip.avgSpeedKmH} km/h`;
    document.getElementById('modalConfidence').textContent = trip.auditConfidence;
    document.getElementById('modalMethod').textContent = trip.calculationMethod;
    document.getElementById('modalRationale').textContent = trip.rationale;

    // Quality Stats
    document.getElementById('modalPointsTotal').textContent = trip.pointsCaptured;
    document.getElementById('modalPointsValid').textContent = trip.points.length;
    document.getElementById('modalPointsRejected').textContent = trip.pointsFiltered;

    // Multi-Model Comparison Boxes
    const breakdown = trip.breakdown || {};
    const modelABox = document.getElementById('modalModelABox');
    const modelBBox = document.getElementById('modalModelBBox');
    const modelCBox = document.getElementById('modalModelCBox');

    modelABox.className = 'model-box' + (trip.calculationMethod.includes('Model A') ? ' chosen' : '');
    modelBBox.className = 'model-box' + (trip.calculationMethod.includes('Model B') ? ' chosen' : '');
    modelCBox.className = 'model-box' + (trip.calculationMethod.includes('Model C') ? ' chosen' : '');

    document.getElementById('modelAKm').textContent = `${breakdown.modelA?.distanceKm !== undefined ? breakdown.modelA.distanceKm : '--'} KM`;
    document.getElementById('modelBKm').textContent = `${breakdown.modelB?.distanceKm !== undefined ? breakdown.modelB.distanceKm : '--'} KM`;
    document.getElementById('modelCKm').textContent = `${breakdown.modelC?.distanceKm !== undefined ? breakdown.modelC.distanceKm : '--'} KM`;

    tripSummaryModal.classList.add('open');
  }

  btnCloseModal.addEventListener('click', () => {
    tripSummaryModal.classList.remove('open');
  });

  // =========================================================================
  // Driver Profile & Statistics Rendering
  // =========================================================================
  function renderDriverProfile() {
    const driver = store.getActiveDriver();
    const vehicle = store.getActiveVehicle();

    document.getElementById('headerDriverName').textContent = driver.name;
    document.getElementById('headerDriverVehicle').textContent = `${vehicle.vehicleNumber} (${vehicle.capacity})`;
    document.getElementById('headerDriverAvatar').textContent = driver.avatar;
  }

  function renderDriverStats() {
    const stats = store.getDriverStats();
    const driver = store.getActiveDriver();
    const vehicle = store.getActiveVehicle();

    document.getElementById('statTodayKm').textContent = `${stats.todayKm} KM`;
    document.getElementById('statTodayTrips').textContent = stats.todayTripsCount;
    document.getElementById('statTodayHours').textContent = stats.todayDrivingHours;
    document.getElementById('statWeeklyKm').textContent = `${stats.weeklyTotalKm} KM`;
    document.getElementById('statMonthlyKm').textContent = `${stats.monthlyTotalKm} KM`;

    const chartBadge = document.getElementById('chartWeekBadge');
    if (chartBadge) chartBadge.textContent = `THIS WEEK: ${stats.weeklyTotalKm} KM`;

    const chartSub = document.getElementById('chartDriverSubtitle');
    if (chartSub && driver && vehicle) {
      chartSub.textContent = `Daily kilometer breakdown for Driver ${driver.name} (${vehicle.vehicleNumber})`;
    }

    // Render Weekly Bar Chart (Real Data Only)
    const breakdown = stats.weeklyBreakdown || {};
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const maxVal = Math.max(...Object.values(breakdown), 50);

    days.forEach(day => {
      const val = breakdown[day] || 0;
      const fillEl = document.getElementById(`barFill_${day}`);
      const valEl = document.getElementById(`barVal_${day}`);

      if (fillEl && valEl) {
        const heightPct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
        fillEl.style.height = val > 0 ? `${Math.max(8, heightPct)}%` : '4px';
        valEl.textContent = `${val.toFixed(1)} km`;
      }
    });
  }

  function renderTripHistoryTable() {
    const tbody = document.getElementById('tripHistoryTableBody');
    if (!tbody) return;

    const trips = store.getTrips();
    if (!trips || trips.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px 16px; color: var(--nl-text-muted);">
            <div style="font-size: 1.6rem; margin-bottom: 8px;">🚛</div>
            <div style="font-weight: 600; color: #ffffff; font-size: 1rem; margin-bottom: 4px;">No Real Trips Recorded Yet</div>
            <div style="font-size: 0.8rem; max-width: 480px; margin: 0 auto; line-height: 1.4;">
              All mock data removed. Start and complete a real-time GPS trip in <strong>Driver Cockpit</strong> to log authentic telemetry, distance, and calculation audit logs.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = trips.map(t => `
      <tr>
        <td><strong style="color: #ffffff; font-family: monospace;">${t.id}</strong></td>
        <td>
          <div style="font-weight: 600; color: #ffffff;">${t.destination || 'Destination'}</div>
          <div style="font-size: 0.72rem; color: #9cb1c9;">From: ${t.origin || 'Origin'}</div>
        </td>
        <td><strong style="color: #fd651e; font-size: 1.05rem; font-family: monospace;">${t.distanceKm} KM</strong></td>
        <td><span class="badge ${t.calculationMethod && t.calculationMethod.includes('Model C') ? 'badge-cyan' : 'badge-accent'}">${t.calculationMethod || 'Model B (GPS)'}</span></td>
        <td><span style="color: #9cb1c9;">${t.durationMinutes || 0} min</span></td>
        <td><span class="badge badge-success">${t.auditConfidence || 'High'}</span></td>
        <td><span class="badge badge-success">COMPLETED</span></td>
      </tr>
    `).join('');
  }

  // Dynamic Real Fleet List Panel
  window.renderFleetListPanel = function(vehicles = []) {
    const badge = document.getElementById('fleetActiveCountBadge');
    const distEl = document.getElementById('fleetTodayDistance');
    const healthEl = document.getElementById('fleetSyncHealth');
    const container = document.getElementById('fleetVehiclesContainer');

    const stats = store.getDriverStats();
    if (distEl) distEl.textContent = `${stats.todayKm} KM`;
    if (healthEl) healthEl.textContent = store.isOnline() ? '100%' : 'OFFLINE';

    if (badge) {
      badge.textContent = `${vehicles.length} ACTIVE ${vehicles.length === 1 ? 'LORRY' : 'LORRIES'}`;
      badge.className = `badge ${vehicles.length > 0 ? 'badge-success' : 'badge-warning'}`;
    }

    if (!container) return;

    if (vehicles.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: var(--nl-text-muted); background: rgba(0,0,0,0.25); border-radius: var(--radius-sm); border: 1px dashed rgba(255,255,255,0.1);">
          <div style="font-size: 1.4rem; margin-bottom: 6px;">📡</div>
          <div style="font-weight: 600; color: #ffffff; margin-bottom: 4px;">No Active Fleet Telemetry</div>
          <div style="font-size: 0.75rem;">Enable GPS in Driver Cockpit to stream authentic live vehicle coordinates to this command map.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = vehicles.map((v, idx) => `
      <div class="vehicle-card ${idx === 0 ? 'selected' : ''}" style="cursor: pointer;" data-lat="${v.lat}" data-lng="${v.lng}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h4 style="color: #ffffff;">${v.lorry}</h4>
            <div style="font-size: 0.75rem; color: var(--nl-text-secondary); margin-top: 2px;">
              Driver: ${v.driver}
            </div>
          </div>
          <span class="badge ${v.speed === '0 km/h' ? 'badge-warning' : 'badge-success'}">${v.speed}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--nl-accent); margin-top: 8px;">
          📍 ${v.status}
        </div>
        <div style="font-size: 0.7rem; color: var(--nl-text-muted); margin-top: 4px; font-family: monospace;">
          GPS: ${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.vehicle-card').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        if (mapManager.adminMap && !isNaN(lat) && !isNaN(lng)) {
          mapManager.adminMap.setView([lat, lng], 15);
        }
      });
    });
  };

  // =========================================================================
  // Algorithm Lab & Test Runner (Section 31)
  // =========================================================================
  const testConsole = document.getElementById('testConsole');
  const btnRunAllTests = document.getElementById('btnRunAllTests');
  const btnClearLogs = document.getElementById('btnClearLogs');

  testRunner.setLogListener(entry => {
    if (entry.clear) {
      testConsole.innerHTML = '';
      return;
    }
    const line = document.createElement('div');
    line.className = `log-entry log-${entry.type}`;
    line.innerHTML = `<span style="color: #627790;">[${entry.timestamp}]</span> ${entry.msg}`;
    testConsole.appendChild(line);
    testConsole.scrollTop = testConsole.scrollHeight;
  });

  btnRunAllTests.addEventListener('click', async () => {
    btnRunAllTests.disabled = true;
    btnRunAllTests.innerHTML = '<span>⏳ Executing Test Suite...</span>';
    await testRunner.runAllTests();
    btnRunAllTests.disabled = false;
    btnRunAllTests.innerHTML = '<span>⚡ Run All Section 31 Tests</span>';
    updateNetworkUI(store.isOnline());
  });

  btnClearLogs.addEventListener('click', () => {
    testRunner.clearLogs();
  });

  // Individual test buttons
  document.querySelectorAll('.btn-run-single-test').forEach(btn => {
    btn.addEventListener('click', async () => {
      const testNum = btn.dataset.test;
      btn.disabled = true;
      if (testNum === '1') await testRunner.runTest1();
      else if (testNum === '2') await testRunner.runTest2();
      else if (testNum === '3') await testRunner.runTest3();
      else if (testNum === '4') await testRunner.runTest4();
      else if (testNum === '5') await testRunner.runTest5();
      btn.disabled = false;
      updateNetworkUI(store.isOnline());
    });
  });
});
