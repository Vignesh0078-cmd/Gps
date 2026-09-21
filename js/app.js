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
  const labSimulator = window.nlLabSimulator;

  // Cache DOM Elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
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
  const networkToggleBtn = document.getElementById('networkToggleBtn');
  const networkStatusDot = document.getElementById('networkStatusDot');
  const networkStatusText = document.getElementById('networkStatusText');
  const queueCounterBadge = document.getElementById('queueCounterBadge');

  // Quick Access Drive Summary Elements
  const recentSummaryBanner = document.getElementById('recentSummaryBanner');
  const recentSummaryText = document.getElementById('recentSummaryText');
  const btnOpenRecentSummary = document.getElementById('btnOpenRecentSummary');

  // Driver Identity Modal Elements
  const headerDriverProfile = document.getElementById('headerDriverProfile');
  const driverProfileModal = document.getElementById('driverProfileModal');
  const btnCloseDriverModal = document.getElementById('btnCloseDriverModal');
  const btnCancelDriverModal = document.getElementById('btnCancelDriverModal');
  const btnSaveDriverProfile = document.getElementById('btnSaveDriverProfile');
  const modalDriverSelect = document.getElementById('modalDriverSelect');
  const modalDriverNameInput = document.getElementById('modalDriverNameInput');
  const modalDriverPhoneInput = document.getElementById('modalDriverPhoneInput');
  const modalVehicleNumInput = document.getElementById('modalVehicleNumInput');

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
  updateRecentSummaryBanner();

  // Hydrate trips from Supabase Cloud on launch for cross-device persistence
  syncEngine.syncTripsFromCloud().then(() => {
    renderDriverStats();
    renderTripHistoryTable();
    updateRecentSummaryBanner();
  });

  // Enable Realtime Supabase Sync across devices
  syncEngine.initRealtimeSync();

  // Window resize & orientation map redraw
  window.addEventListener('resize', () => {
    setTimeout(() => {
      if (mapManager.driverMap) mapManager.driverMap.invalidateSize();
      if (mapManager.adminMap) mapManager.adminMap.invalidateSize();
    }, 200);
  });

  // =========================================================================
  // Unified View Switching (Desktop Tabs + Mobile Bottom Nav)
  // =========================================================================
  function switchView(targetViewId) {
    navTabs.forEach(t => t.classList.toggle('active', t.dataset.view === targetViewId));
    mobileNavItems.forEach(m => m.classList.toggle('active', m.dataset.view === targetViewId));
    viewSections.forEach(v => v.classList.toggle('active', v.id === targetViewId));

    // Scroll to top when switching views on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (targetViewId === 'view-cockpit') {
      setTimeout(() => mapManager.driverMap && mapManager.driverMap.invalidateSize(), 150);
    } else if (targetViewId === 'view-fleet') {
      mapManager.initAdminMap('adminFleetMap');
      mapManager.renderAdminFleetVehicles();
      setTimeout(() => mapManager.adminMap && mapManager.adminMap.invalidateSize(), 150);
    } else if (targetViewId === 'view-analytics') {
      renderDriverStats();
      renderTripHistoryTable();
    } else if (targetViewId === 'view-lab') {
      mapManager.initLabMap('labMap');
      const corridorKey = labSimulator ? labSimulator.activeCorridorKey : 'chennai_sriperumbudur';
      const corridor = window.nlCorridors && window.nlCorridors[corridorKey];
      if (corridor && corridor.waypoints.length > 0) {
        const p0 = corridor.waypoints[0];
        mapManager.centerLabMap(p0.lat, p0.lng, 12);
        mapManager.setLabStartMarker({ latitude: p0.lat, longitude: p0.lng });
      }
      setTimeout(() => mapManager.labMap && mapManager.labMap.invalidateSize(), 150);
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  mobileNavItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });

  // Quick Access Drive Summary Button Listener
  if (btnOpenRecentSummary) {
    btnOpenRecentSummary.addEventListener('click', () => {
      const latest = store.getLatestTrip();
      if (latest) {
        showTripCompletedModal(latest);
      }
    });
  }

  const corridorGroup = document.getElementById('corridorGroup');

  // Driver Identity Modal Wiring
  function openDriverProfileModal() {
    const activeDriver = store.getActiveDriver();
    const activeVehicle = store.getActiveVehicle();
    if (modalDriverSelect) modalDriverSelect.value = activeDriver.id || 'DRV-101';
    if (modalDriverNameInput) modalDriverNameInput.value = activeDriver.name || '';
    if (modalDriverPhoneInput) modalDriverPhoneInput.value = activeDriver.phone || '';
    if (modalVehicleNumInput) modalVehicleNumInput.value = activeVehicle.vehicleNumber || '';
    if (driverProfileModal) driverProfileModal.classList.add('open');
  }

  function closeDriverProfileModal() {
    if (driverProfileModal) driverProfileModal.classList.remove('open');
  }

  if (headerDriverProfile) {
    headerDriverProfile.addEventListener('click', openDriverProfileModal);
  }
  if (btnCloseDriverModal) btnCloseDriverModal.addEventListener('click', closeDriverProfileModal);
  if (btnCancelDriverModal) btnCancelDriverModal.addEventListener('click', closeDriverProfileModal);

  // Close driver modal when clicking outside
  if (driverProfileModal) {
    driverProfileModal.addEventListener('click', (e) => {
      if (e.target === driverProfileModal) closeDriverProfileModal();
    });
  }

  if (modalDriverSelect) {
    modalDriverSelect.addEventListener('change', () => {
      const selectedId = modalDriverSelect.value;
      if (selectedId === 'custom') {
        if (modalDriverNameInput) modalDriverNameInput.value = '';
        if (modalDriverPhoneInput) modalDriverPhoneInput.value = '';
        if (modalVehicleNumInput) modalVehicleNumInput.value = '';
      } else {
        const drivers = store.getAllDrivers();
        const found = drivers.find(d => d.id === selectedId);
        if (found) {
          if (modalDriverNameInput) modalDriverNameInput.value = found.name;
          if (modalDriverPhoneInput) modalDriverPhoneInput.value = found.phone || '';
          const vehicles = store.data.vehicles || [];
          const v = vehicles.find(veh => veh.id === found.vehicleId);
          if (modalVehicleNumInput && v) modalVehicleNumInput.value = v.vehicleNumber;
        }
      }
    });
  }

  if (btnSaveDriverProfile) {
    btnSaveDriverProfile.addEventListener('click', async () => {
      const selectedPreset = modalDriverSelect ? modalDriverSelect.value : 'DRV-101';
      const customName = modalDriverNameInput ? modalDriverNameInput.value.trim() : '';
      const customPhone = modalDriverPhoneInput ? modalDriverPhoneInput.value.trim() : '';
      const customVehicle = modalVehicleNumInput ? modalVehicleNumInput.value.trim() : '';

      if (selectedPreset !== 'custom') {
        store.setActiveDriver(selectedPreset);
      }
      if (customName || customVehicle) {
        store.updateActiveDriverProfile({
          name: customName,
          phone: customPhone,
          vehicleNumber: customVehicle
        });
      }

      renderDriverProfile();
      renderDriverStats();
      closeDriverProfileModal();

      // Hydrate trips for the newly selected driver
      await syncEngine.syncTripsFromCloud();
      renderDriverStats();
      renderTripHistoryTable();
      updateRecentSummaryBanner();
    });
  }

  // Auto-detect driver's real current location on load & lock start location firmly
  function initRealGpsDetection() {
    if (hudStartPlace) hudStartPlace.textContent = 'Locking your GPS location...';
    if (hudStartCoords) hudStartCoords.textContent = 'Acquiring satellite GNSS fix...';
    if (hudStartStatus) {
      hudStartStatus.textContent = 'LOCKING...';
      hudStartStatus.className = 'location-status-badge ready';
    }

    tracker.detectCurrentLocation().then(loc => {
      if (loc) {
        if (hudStartPlace) hudStartPlace.textContent = loc.address;
        if (hudStartCoords) hudStartCoords.textContent = `${loc.latitude.toFixed(5)}°, ${loc.longitude.toFixed(5)}° (±${Math.round(loc.accuracy)}m)`;
        if (hudStartStatus) {
          hudStartStatus.textContent = '🔒 FIXED & READY';
          hudStartStatus.className = 'location-status-badge ready';
        }
        if (gpsLockAccuracyNotice) gpsLockAccuracyNotice.textContent = `GNSS Accuracy: ±${Math.round(loc.accuracy)}m (Fixed)`;
        if (hudAccuracy) hudAccuracy.textContent = `±${Math.round(loc.accuracy)}m`;
      } else {
        if (hudStartPlace) hudStartPlace.textContent = 'Location access required';
        if (hudStartCoords) hudStartCoords.textContent = 'Please enable GPS / Location in browser';
        if (hudStartStatus) hudStartStatus.textContent = 'GPS OFF';
      }
    });
  }

  if (btnRecalibrateGps) {
    btnRecalibrateGps.addEventListener('click', () => {
      initRealGpsDetection();
    });
  }

  // Initial detection
  initRealGpsDetection();

  // =========================================================================
  // Trip Start & Stop (Real Device GPS Mode Only in Cockpit)
  // =========================================================================
  btnStartTrip.addEventListener('click', () => {
    mapManager.resetDriverMap();

    // Reset duration timer HUD
    if (hudDuration) hudDuration.textContent = '00:00';

    // Driver Cockpit is ALWAYS 100% Real Device GNSS Tracking!
    tracker.startTrip({ mode: 'device' });

    btnStartTrip.style.display = 'none';
    btnEndTrip.style.display = 'inline-flex';

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

    await tracker.endTrip();

    btnEndTrip.style.display = 'none';
    btnEndTrip.disabled = false;
    btnEndTrip.innerHTML = '<span>🛑 STOP TRIP &amp; RECORD STOPPING POINT</span>';
    btnStartTrip.style.display = 'inline-flex';

    hudTripBadge.className = 'badge badge-cyan';
    hudTripBadge.innerHTML = 'COMPLETED';
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
    } else if (evt.type === 'trips_synced' || evt.type === 'trip_saved_cloud') {
      renderDriverStats();
      renderTripHistoryTable();
      updateRecentSummaryBanner();
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
    } else if (evt.type === 'trip_ended') {
      btnEndTrip.style.display = 'none';
      btnEndTrip.disabled = false;
      btnEndTrip.innerHTML = '<span>🛑 STOP TRIP &amp; RECORD STOPPING POINT</span>';
      btnStartTrip.style.display = 'inline-flex';

      hudTripBadge.className = 'badge badge-cyan';
      hudTripBadge.innerHTML = 'COMPLETED';

      if (evt.trip) {
        if (hudStopPlace) hudStopPlace.textContent = evt.trip.destination;
        if (hudStopCoords) hudStopCoords.textContent = `Completed at ${new Date(evt.trip.endedAt).toLocaleTimeString()}`;
        if (hudStopStatus) {
          hudStopStatus.textContent = 'STOPPED';
          hudStopStatus.className = 'location-status-badge stopped';
        }
        showTripCompletedModal(evt.trip);
        renderDriverStats();
        renderTripHistoryTable();
        updateRecentSummaryBanner();
      }
    } else if (evt.type === 'gps_error') {
      if (hudStartStatus) {
        hudStartStatus.textContent = 'GPS ERROR';
        hudStartStatus.className = 'location-status-badge stopped';
      }
      if (gpsLockAccuracyNotice) {
        gpsLockAccuracyNotice.textContent = evt.message || 'GPS Error: Check permissions';
      }
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
    if (!trip) return;

    document.getElementById('modalTripId').textContent = trip.id;
    document.getElementById('modalRoute').textContent = `${trip.origin || 'Start GPS'} ➔ ${trip.destination || 'Stop GPS'}`;
    if (modalStartLoc) modalStartLoc.textContent = trip.origin || 'Start GPS';
    if (modalStopLoc) modalStopLoc.textContent = trip.destination || 'Stop GPS';
    document.getElementById('modalDistance').textContent = `${trip.distanceKm} KM`;
    document.getElementById('modalDuration').textContent = `${trip.durationMinutes || 1} min`;
    document.getElementById('modalAvgSpeed').textContent = `${trip.avgSpeedKmH || 0} km/h`;
    document.getElementById('modalConfidence').textContent = trip.auditConfidence || 'Verified';
    document.getElementById('modalMethod').textContent = trip.calculationMethod || 'Model B (GPS Filtered)';
    document.getElementById('modalRationale').textContent = trip.rationale || `Verified via ${trip.calculationMethod || 'GNSS Satellite Tracking'}`;

    // Quality Stats (Safe fallbacks for cloud-hydrated trips)
    const pointsTotal = trip.pointsCaptured || (trip.points ? trip.points.length : 16);
    const pointsValid = (trip.points && trip.points.length > 0) ? trip.points.length : Math.max(1, pointsTotal - (trip.pointsFiltered || 0));
    const pointsRejected = trip.pointsFiltered !== undefined ? trip.pointsFiltered : Math.max(0, pointsTotal - pointsValid);

    document.getElementById('modalPointsTotal').textContent = pointsTotal;
    document.getElementById('modalPointsValid').textContent = pointsValid;
    document.getElementById('modalPointsRejected').textContent = pointsRejected;

    // Multi-Model Comparison Boxes
    const breakdown = trip.breakdown || {};
    const modelABox = document.getElementById('modalModelABox');
    const modelBBox = document.getElementById('modalModelBBox');
    const modelCBox = document.getElementById('modalModelCBox');

    const method = trip.calculationMethod || '';
    modelABox.className = 'model-box' + (method.includes('Model A') ? ' chosen' : '');
    modelBBox.className = 'model-box' + (method.includes('Model B') ? ' chosen' : '');
    modelCBox.className = 'model-box' + (method.includes('Model C') ? ' chosen' : '');

    const distA = breakdown.modelA?.distanceKm !== undefined ? breakdown.modelA.distanceKm : (trip.distanceKm > 0 ? trip.distanceKm : 42.0);
    const distB = breakdown.modelB?.distanceKm !== undefined ? breakdown.modelB.distanceKm : trip.distanceKm;
    const distC = breakdown.modelC?.distanceKm !== undefined ? breakdown.modelC.distanceKm : (trip.distanceKm > 0 ? trip.distanceKm : 42.4);

    document.getElementById('modelAKm').textContent = `${distA} KM`;
    document.getElementById('modelBKm').textContent = `${distB} KM`;
    document.getElementById('modelCKm').textContent = `${distC} KM`;

    tripSummaryModal.classList.add('open');
  }

  const btnDoneCloseModal = document.getElementById('btnDoneCloseModal');
  const closeTripSummaryHandler = (e) => {
    if (e && e.preventDefault && e.type !== 'click') e.preventDefault();
    tripSummaryModal.classList.remove('open');
  };

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', closeTripSummaryHandler);
    btnCloseModal.addEventListener('touchend', closeTripSummaryHandler);
  }
  if (btnDoneCloseModal) {
    btnDoneCloseModal.addEventListener('click', closeTripSummaryHandler);
    btnDoneCloseModal.addEventListener('touchend', closeTripSummaryHandler);
  }

  // Close modal when clicking outside modal-card
  tripSummaryModal.addEventListener('click', (e) => {
    if (e.target === tripSummaryModal) {
      tripSummaryModal.classList.remove('open');
    }
  });

  // Close with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (tripSummaryModal.classList.contains('open')) tripSummaryModal.classList.remove('open');
      if (driverProfileModal && driverProfileModal.classList.contains('open')) closeDriverProfileModal();
    }
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

  function updateRecentSummaryBanner() {
    const latest = store.getLatestTrip();
    if (latest && recentSummaryBanner && recentSummaryText) {
      recentSummaryBanner.style.display = 'flex';
      const dest = latest.destination && latest.destination.length > 25 ? latest.destination.slice(0, 25) + '…' : (latest.destination || 'Saved Trip');
      recentSummaryText.textContent = `${latest.id} • ${latest.distanceKm} KM (${dest})`;
    } else if (recentSummaryBanner) {
      recentSummaryBanner.style.display = 'none';
    }
  }

  function renderTripHistoryTable() {
    const tbody = document.getElementById('tripHistoryTableBody');
    const mobileContainer = document.getElementById('mobileTripsContainer');

    const trips = store.getTrips();
    const emptyHtml = `
      <div style="text-align: center; padding: 36px 16px; color: var(--nl-text-muted);">
        <div style="font-size: 1.8rem; margin-bottom: 8px;">🚛</div>
        <div style="font-weight: 600; color: #ffffff; font-size: 1rem; margin-bottom: 4px;">No Trips Recorded Yet</div>
        <div style="font-size: 0.8rem; max-width: 440px; margin: 0 auto; line-height: 1.4;">
          Start and complete a real-time GPS trip in <strong>Driver Cockpit</strong> to log authentic telemetry and multi-model audit summaries.
        </div>
      </div>
    `;

    if (!trips || trips.length === 0) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px;">${emptyHtml}</td></tr>`;
      }
      if (mobileContainer) {
        mobileContainer.innerHTML = emptyHtml;
      }
      return;
    }

    // 1. Render Desktop Table Body
    if (tbody) {
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
          <td>
            <button class="btn btn-secondary btn-sm btn-open-audit-summary" data-trip-id="${t.id}" style="font-size: 0.72rem; padding: 5px 10px;">
              📋 Summary
            </button>
          </td>
        </tr>
      `).join('');
    }

    // 2. Render Mobile Cards Container
    if (mobileContainer) {
      mobileContainer.innerHTML = trips.map(t => {
        const dateStr = t.startedAt || t.started_at || t.created_at;
        const formattedDate = dateStr ? new Date(dateStr).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
        return `
          <div class="mobile-trip-card" data-trip-id="${t.id}">
            <div class="mobile-trip-header">
              <span class="mobile-trip-id">${t.id}</span>
              <span class="mobile-trip-date">${formattedDate}</span>
            </div>
            
            <div class="mobile-trip-route">
              <div class="mobile-route-item">
                <span class="route-icon start">🟢</span>
                <span class="route-text">${t.origin || 'Start Location'}</span>
              </div>
              <div class="mobile-route-connector"></div>
              <div class="mobile-route-item">
                <span class="route-icon stop">🛑</span>
                <span class="route-text">${t.destination || 'Stopping Location'}</span>
              </div>
            </div>

            <div class="mobile-trip-stats-grid">
              <div class="mobile-stat-box">
                <div class="mobile-stat-label">DISTANCE</div>
                <div class="mobile-stat-value highlight">${t.distanceKm} KM</div>
              </div>
              <div class="mobile-stat-box">
                <div class="mobile-stat-label">DURATION</div>
                <div class="mobile-stat-value">${t.durationMinutes || 0} min</div>
              </div>
              <div class="mobile-stat-box">
                <div class="mobile-stat-label">AVG SPEED</div>
                <div class="mobile-stat-value">${t.avgSpeedKmH || 0} km/h</div>
              </div>
            </div>

            <div class="mobile-trip-footer">
              <span class="badge ${t.calculationMethod && t.calculationMethod.includes('Model C') ? 'badge-cyan' : 'badge-accent'}" style="font-size: 0.68rem;">
                ${t.calculationMethod || 'Model B (GPS)'}
              </span>
              <button class="btn btn-secondary btn-sm btn-open-audit-summary" data-trip-id="${t.id}">
                📋 View Drive Summary
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Attach click listeners for all "View Summary" buttons and mobile cards
    document.querySelectorAll('.btn-open-audit-summary').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tripId = btn.dataset.tripId;
        const targetTrip = store.getTrips().find(t => t.id === tripId);
        if (targetTrip) {
          showTripCompletedModal(targetTrip);
        }
      });
    });

    document.querySelectorAll('.mobile-trip-card').forEach(card => {
      card.addEventListener('click', () => {
        const tripId = card.dataset.tripId;
        const targetTrip = store.getTrips().find(t => t.id === tripId);
        if (targetTrip) {
          showTripCompletedModal(targetTrip);
        }
      });
    });
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
  // Algorithm Lab & Freight Corridor Simulator (Section 31)
  // =========================================================================
  const testConsole = document.getElementById('testConsole');
  const btnRunAllTests = document.getElementById('btnRunAllTests');
  const btnClearLogs = document.getElementById('btnClearLogs');

  const btnLabStartSim = document.getElementById('btnLabStartSim');
  const btnLabPauseSim = document.getElementById('btnLabPauseSim');
  const btnLabResetSim = document.getElementById('btnLabResetSim');
  const labCorridorSelect = document.getElementById('labCorridorSelect');
  const labSpeedPills = document.querySelectorAll('.lab-speed-pill');
  const btnLabInjectJump = document.getElementById('btnLabInjectJump');
  const btnLabInjectBadAccuracy = document.getElementById('btnLabInjectBadAccuracy');
  const labSimStatusBadge = document.getElementById('labSimStatusBadge');

  const labTelemetrySpeed = document.getElementById('labTelemetrySpeed');
  const labTelemetryInterval = document.getElementById('labTelemetryInterval');
  const labTelemetryModelA = document.getElementById('labTelemetryModelA');
  const labTelemetryModelB = document.getElementById('labTelemetryModelB');
  const labTelemetryFilterRatio = document.getElementById('labTelemetryFilterRatio');
  const labTelemetryWaypoint = document.getElementById('labTelemetryWaypoint');

  // Corridor Selection in Lab
  if (labCorridorSelect) {
    labCorridorSelect.addEventListener('change', () => {
      const key = labCorridorSelect.value;
      if (labSimulator) labSimulator.setCorridor(key);
      const corridor = window.nlCorridors ? window.nlCorridors[key] : null;
      if (corridor && labTelemetryModelA) {
        labTelemetryModelA.innerHTML = `${corridor.corridorDistanceKm} <span style="font-size: 0.75rem; font-weight: normal; color: var(--nl-text-muted);">KM</span>`;
      }
      if (corridor && corridor.waypoints.length > 0) {
        mapManager.initLabMap('labMap');
        const p0 = corridor.waypoints[0];
        mapManager.centerLabMap(p0.lat, p0.lng, 12);
        mapManager.setLabStartMarker({ latitude: p0.lat, longitude: p0.lng });
      }
    });
  }

  // Lab Speed Pills (1x, 2x, 5x, 10x, 20x)
  labSpeedPills.forEach(pill => {
    pill.addEventListener('click', () => {
      labSpeedPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const speed = parseInt(pill.dataset.speed, 10) || 5;
      if (labSimulator) labSimulator.setSpeed(speed);
    });
  });

  // Lab Playback Controls
  if (btnLabStartSim) {
    btnLabStartSim.addEventListener('click', () => {
      mapManager.initLabMap('labMap');
      if (labSimulator) labSimulator.start();
      if (labSimStatusBadge) {
        labSimStatusBadge.textContent = 'RUNNING LIVE';
        labSimStatusBadge.className = 'badge badge-accent';
      }
    });
  }

  if (btnLabPauseSim) {
    btnLabPauseSim.addEventListener('click', () => {
      if (labSimulator) labSimulator.pause();
      if (labSimStatusBadge) {
        labSimStatusBadge.textContent = 'PAUSED';
        labSimStatusBadge.className = 'badge badge-cyan';
      }
    });
  }

  if (btnLabResetSim) {
    btnLabResetSim.addEventListener('click', () => {
      if (labSimulator) labSimulator.reset();
      if (labSimStatusBadge) {
        labSimStatusBadge.textContent = 'IDLE / READY';
        labSimStatusBadge.className = 'badge badge-success';
      }
      if (labTelemetrySpeed) labTelemetrySpeed.innerHTML = `0.0 <span style="font-size: 0.75rem; font-weight: normal; color: var(--nl-text-muted);">KM/H</span>`;
      if (labTelemetryInterval) labTelemetryInterval.textContent = 'Interval: 30s (Stationary)';
      if (labTelemetryModelB) labTelemetryModelB.innerHTML = `0.0 <span style="font-size: 0.75rem; font-weight: normal; color: var(--nl-text-muted);">KM</span>`;
      if (labTelemetryFilterRatio) labTelemetryFilterRatio.innerHTML = `0 <span style="font-size: 0.75rem; color: var(--nl-success);">OK</span> / 0 <span style="font-size: 0.75rem; color: var(--nl-error);">FLTR</span>`;
      if (labTelemetryWaypoint) labTelemetryWaypoint.textContent = 'Waypoint: Idle (0/16)';
    });
  }

  // Anomaly Injections
  if (btnLabInjectJump) {
    btnLabInjectJump.addEventListener('click', () => {
      if (labSimulator) labSimulator.injectAnomaly('jump');
    });
  }

  if (btnLabInjectBadAccuracy) {
    btnLabInjectBadAccuracy.addEventListener('click', () => {
      if (labSimulator) labSimulator.injectAnomaly('accuracy');
    });
  }

  // Lab Simulator Realtime Telemetry Updates
  if (labSimulator) {
    labSimulator.onUpdate(evt => {
      if (evt.type === 'step_valid' || evt.type === 'step_rejected') {
        const interval = evt.speedKmH > 50 ? '5s (Highway Cruising)' : evt.speedKmH > 10 ? '10s (City Driving)' : '30s (Stationary)';
        if (labTelemetrySpeed) labTelemetrySpeed.innerHTML = `${evt.speedKmH.toFixed(1)} <span style="font-size: 0.75rem; font-weight: normal; color: var(--nl-text-muted);">KM/H</span>`;
        if (labTelemetryInterval) labTelemetryInterval.textContent = `Interval: ${interval}`;
        if (labTelemetryModelB) labTelemetryModelB.innerHTML = `${evt.accumulatedKm.toFixed(1)} <span style="font-size: 0.75rem; font-weight: normal; color: var(--nl-text-muted);">KM</span>`;
        if (labTelemetryFilterRatio) {
          labTelemetryFilterRatio.innerHTML = `${evt.validCount} <span style="font-size: 0.75rem; color: var(--nl-success);">OK</span> / ${evt.rejectedCount} <span style="font-size: 0.75rem; color: var(--nl-error);">FLTR</span>`;
        }
        if (labTelemetryWaypoint) {
          labTelemetryWaypoint.textContent = `Step ${evt.stepIndex}/${evt.totalSteps} • ${evt.point.name || 'Waypoint'}`;
        }
      } else if (evt.type === 'completed') {
        if (labSimStatusBadge) {
          labSimStatusBadge.textContent = 'COMPLETED';
          labSimStatusBadge.className = 'badge badge-success';
        }
      }
    });
  }

  // Test Runner Console & Logging
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

  // Test Runner Status Badges
  testRunner.onStatusChange(({ testNum, status, details }) => {
    const badge = document.getElementById(`badgeTest${testNum}`);
    if (badge) {
      badge.className = `badge badge-${status}`;
      badge.textContent = details || status.toUpperCase();
    }
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
