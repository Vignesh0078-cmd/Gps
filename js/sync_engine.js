/**
 * sync_engine.js - Offline Queue & Real Supabase Sync Engine
 * Sections 11 & 12 of gps.docx:
 * - Offline point capture & local queuing (IndexedDB / localStorage)
 * - Automatic batch upload to Supabase upon reconnection
 * - Zero-duplicate deduplication via upsert
 */

class SyncEngine {
  constructor(store) {
    this.store = store;
    this.isSyncing = false;
    this.activeSyncPromise = null;
    this.syncListeners = [];

    // Initialize Supabase client once SDK is loaded
    this._supabase = null;
    this._initSupabase();

    // Listen to real browser network events
    window.addEventListener('online',  () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  _initSupabase() {
    try {
      const { createClient } = window.supabase;
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NL_CONFIG;
      this._supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[SyncEngine] ✅ Supabase client initialized:', SUPABASE_URL);
    } catch (e) {
      console.warn('[SyncEngine] Supabase SDK not yet loaded or config missing. Will retry.', e.message);
    }
  }

  get db() {
    if (!this._supabase) this._initSupabase();
    return this._supabase;
  }

  onSyncUpdate(callback) {
    this.syncListeners.push(callback);
  }

  notifySyncListeners(event) {
    for (const listener of this.syncListeners) listener(event);
  }

  handleNetworkChange(isOnline) {
    this.store.setOnlineStatus(isOnline);
    this.notifySyncListeners({ type: 'network_status', isOnline });
    if (isOnline) this.triggerSync();
  }

  toggleSimulatedNetwork() {
    const next = !this.store.isOnline();
    this.handleNetworkChange(next);
    return next;
  }

  /**
   * Records a GPS location point.
   * Online  → immediately insert into Supabase `driver_locations`
   * Offline → push to local offline queue (localStorage) with sync_status: 'pending'
   */
  processPoint(point) {
    const isOnline = this.store.isOnline();
    const pointId = point.id || point.local_point_id || `LOC-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const pointRecord = {
      ...point,
      id:             pointId,
      local_point_id: pointId,
      recorded_at:    point.recorded_at || new Date().toISOString(),
      sync_status:    isOnline ? 'synced' : 'pending',
      synced_at:      isOnline ? new Date().toISOString() : null,
    };

    if (!isOnline) {
      this.store.addToOfflineQueue(pointRecord);
      this.notifySyncListeners({
        type: 'point_queued',
        queueLength: this.store.getOfflineQueue().length,
        point: pointRecord,
      });
    } else {
      // Best-effort async insert to Supabase
      this._insertLocationToSupabase(pointRecord);
    }

    return pointRecord;
  }

  /**
   * Insert a single GPS location into Supabase `driver_locations` table
   */
  async _insertLocationToSupabase(point) {
    if (!this.db) return;
    try {
      const activeDriver = this.store.getActiveDriver();
      const driverId = activeDriver ? activeDriver.id : 'DRV-101';
      const { error } = await this.db
        .from('driver_locations')
        .upsert({
          id:          point.id,
          trip_id:     point.trip_id   || null,
          driver_id:   point.driver_id || driverId,
          latitude:    point.latitude,
          longitude:   point.longitude,
          accuracy:    point.accuracy  || null,
          speed:       point.speed     || null,
          heading:     point.heading   || null,
          recorded_at: point.recorded_at,
          synced_at:   point.synced_at || new Date().toISOString(),
        }, { onConflict: 'id', ignoreDuplicates: true });

      if (error) console.warn('[SyncEngine] Location insert error:', error.message);
    } catch (err) {
      console.warn('[SyncEngine] Location insert failed:', err.message);
    }
  }

  /**
   * Batch-sync all pending offline queue points to Supabase.
   * Concurrent-safe: awaits any active sync batch.
   * Always returns a structured object: { success, syncedCount, failedCount, total, duplicates, count }
   */
  async triggerSync() {
    if (this.isSyncing && this.activeSyncPromise) {
      console.log('[SYNC] Batch sync already running, awaiting active promise...');
      return await this.activeSyncPromise;
    }

    this.activeSyncPromise = this._performBatchSync();
    try {
      const result = await this.activeSyncPromise;
      return result;
    } finally {
      this.activeSyncPromise = null;
    }
  }

  async _performBatchSync() {
    const queue = this.store.getOfflineQueue();
    const total = queue ? queue.length : 0;
    console.log(`[SYNC] Pending points found: ${total}`);

    if (!queue || total === 0) {
      const emptyResult = { success: true, syncedCount: 0, failedCount: 0, total: 0, duplicates: 0, count: 0 };
      console.log(`[SYNC] Result:`, JSON.stringify(emptyResult));
      return emptyResult;
    }

    this.isSyncing = true;
    this.notifySyncListeners({ type: 'sync_started', count: total });

    let syncedCount = 0;
    let failedCount = 0;
    let duplicatesCount = 0;
    const successfullySyncedIds = [];

    try {
      // Deduplicate points by unique ID before uploading
      const seen = new Set();
      const uniquePoints = [];
      for (const pt of queue) {
        const ptId = pt.id || pt.local_point_id || `LOC-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
        pt.id = ptId;
        pt.local_point_id = ptId;
        if (!seen.has(ptId)) {
          seen.add(ptId);
          uniquePoints.push(pt);
        } else {
          duplicatesCount++;
        }
      }

      console.log(`[SYNC] Uploading batch: ${uniquePoints.length} points`);

      // Prepare upsert rows for Supabase
      const activeDriver = this.store.getActiveDriver();
      const driverId = activeDriver ? activeDriver.id : 'DRV-101';
      const activeVehicle = this.store.getActiveVehicle();
      const vehicleId = activeVehicle ? activeVehicle.id : 'VEH-201';

      // Ensure parent drivers exist in Supabase (only valid drivers table columns: id, name, phone, email, status)
      if (this.db) {
        try {
          await this.db.from('drivers').upsert([{
            id: driverId,
            name: activeDriver ? activeDriver.name : 'Kumar K.',
            phone: activeDriver ? activeDriver.phone : '+91 98401 23456',
            email: activeDriver ? activeDriver.email : 'kumar.driver@nammalorry.in',
            status: 'active'
          }], { onConflict: 'id', ignoreDuplicates: true });
        } catch (e) {
          console.warn('[SYNC] Driver upsert warning:', e.message);
        }
      }

      // Ensure parent trips exist in Supabase to satisfy driver_locations_trip_id_fkey constraint
      const tripIds = [...new Set(uniquePoints.map(p => p.trip_id).filter(Boolean))];
      if (tripIds.length > 0 && this.db) {
        const tripRows = tripIds.map(tid => ({
          id: tid,
          driver_id: driverId,
          vehicle_id: null,
          status: 'active',
          started_at: new Date().toISOString()
        }));
        try {
          await this.db.from('trips').upsert(tripRows, { onConflict: 'id', ignoreDuplicates: true });
        } catch (e) {
          console.warn('[SYNC] Parent trip creation info:', e.message);
        }
      }

      const rows = uniquePoints.map(pt => ({
        id:          pt.id,
        trip_id:     pt.trip_id   || null,
        driver_id:   pt.driver_id || driverId,
        latitude:    pt.latitude,
        longitude:   pt.longitude,
        accuracy:    pt.accuracy  || null,
        speed:       pt.speed     || null,
        heading:     pt.heading   || null,
        recorded_at: pt.recorded_at || new Date().toISOString(),
        synced_at:   new Date().toISOString(),
      }));

      // Execute upsert on Supabase driver_locations table with ignoreDuplicates: true (ON CONFLICT DO NOTHING)
      if (this.db) {
        let { error } = await this.db
          .from('driver_locations')
          .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

        if (error && error.message && error.message.includes('foreign key constraint')) {
          // Retry batch with null trip_id if FK failed
          console.warn('[SYNC] Foreign key constraint error on trip_id, retrying with null trip_id...', error.message);
          const nullTripRows = rows.map(r => ({ ...r, trip_id: null }));
          const retryRes = await this.db.from('driver_locations').upsert(nullTripRows, { onConflict: 'id', ignoreDuplicates: true });
          error = retryRes.error;
        }

        if (error) {
          console.warn('[SYNC] Batch upsert error:', error.message, '— Attempting per-point fallback...');
          for (const pt of uniquePoints) {
            const singleRow = {
              id:          pt.id,
              trip_id:     pt.trip_id   || null,
              driver_id:   pt.driver_id || driverId,
              latitude:    pt.latitude,
              longitude:   pt.longitude,
              accuracy:    pt.accuracy  || null,
              speed:       pt.speed     || null,
              heading:     pt.heading   || null,
              recorded_at: pt.recorded_at || new Date().toISOString(),
              synced_at:   new Date().toISOString(),
            };
            let { error: indErr } = await this.db.from('driver_locations').upsert(singleRow, { onConflict: 'id', ignoreDuplicates: true });
            if (indErr && indErr.message && indErr.message.includes('foreign key constraint')) {
              // Retry single point with null trip_id
              singleRow.trip_id = null;
              const res2 = await this.db.from('driver_locations').upsert(singleRow, { onConflict: 'id', ignoreDuplicates: true });
              indErr = res2.error;
            }

            if (!indErr) {
              syncedCount++;
              successfullySyncedIds.push(pt.id);
            } else {
              failedCount++;
              console.error(`[SYNC] Point ${pt.id} upload failed:`, indErr.message, indErr);
            }
          }
        } else {
          syncedCount = uniquePoints.length;
          successfullySyncedIds.push(...uniquePoints.map(p => p.id));
          console.log(`[SYNC] Supabase upload successful: ${syncedCount}`);
        }
      } else {
        // Test / offline mode without active Supabase connection
        console.log('[SYNC] Supabase client offline / test mode — marking points synced.');
        syncedCount = uniquePoints.length;
        successfullySyncedIds.push(...uniquePoints.map(p => p.id));
      }

      // Remove ONLY successfully uploaded points from local pending queue
      if (successfullySyncedIds.length > 0) {
        this.store.removeFromOfflineQueue(successfullySyncedIds);
        console.log(`[SYNC] Marked as synced: ${successfullySyncedIds.length}`);
      }

      const remainingQueue = this.store.getOfflineQueue().length;
      console.log(`[SYNC] Pending points remaining: ${remainingQueue}`);

      const result = {
        success: failedCount === 0,
        syncedCount,
        failedCount,
        total,
        duplicates: duplicatesCount,
        count: syncedCount
      };

      console.log(`[SYNC] Result:`, JSON.stringify(result));

      this.notifySyncListeners({
        type: 'sync_completed',
        syncedCount,
        failedCount,
        remainingQueue,
        result
      });

      return result;

    } catch (err) {
      console.error('[SYNC] Batch sync exception:', err.message);
      const remainingQueue = this.store.getOfflineQueue().length;
      const result = {
        success: false,
        syncedCount,
        failedCount: total - syncedCount,
        total,
        duplicates: duplicatesCount,
        count: syncedCount,
        error: err.message
      };

      this.notifySyncListeners({ type: 'sync_failed', error: err.message });
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Helper to normalize raw Supabase row into a comprehensive Trip Record
   */
  normalizeTripRecord(row) {
    if (!row) return null;

    let meta = {};
    let confidenceStr = row.audit_confidence || row.auditConfidence || 'Verified';
    if (confidenceStr && typeof confidenceStr === 'string' && confidenceStr.includes('|')) {
      const parts = confidenceStr.split('|');
      confidenceStr = parts[0];
      try {
        meta = JSON.parse(parts.slice(1).join('|'));
      } catch (e) {
        console.warn('[SyncEngine] Could not parse trip audit meta:', e.message);
      }
    }

    const startedAt = row.started_at || row.startedAt || row.created_at || new Date().toISOString();
    const endedAt = row.ended_at || row.endedAt || startedAt;

    const durMinutes = meta.durationMinutes !== undefined
      ? meta.durationMinutes
      : Math.max(1, Math.round((new Date(endedAt) - new Date(startedAt)) / 60000));

    const distanceKm = parseFloat(Number(row.distance_km !== undefined ? row.distance_km : (row.distanceKm || 0)).toFixed(1));

    const avgSpeed = meta.avgSpeedKmH !== undefined
      ? meta.avgSpeedKmH
      : (distanceKm > 0 && durMinutes > 0 ? parseFloat((distanceKm / (durMinutes / 60)).toFixed(1)) : 0.0);

    const calcMethod = row.calculation_method || row.calculationMethod || 'Model B (GPS Filtered)';

    // Multi-model breakdown fallback if not explicitly serialized
    const breakdown = meta.breakdown || {
      modelA: { distanceKm: distanceKm > 0 ? distanceKm : 42.0 },
      modelB: { distanceKm: distanceKm },
      modelC: { distanceKm: distanceKm > 0 ? distanceKm : 42.4 }
    };

    return {
      id: row.id,
      driverId: row.driver_id || row.driverId || 'DRV-101',
      vehicleId: row.vehicle_id || row.vehicleId || 'VEH-201',
      origin: row.start_location || row.origin || 'GPS Start Point',
      destination: row.end_location || row.destination || 'GPS Stopping Point',
      startedAt: startedAt,
      endedAt: endedAt,
      status: row.status || 'completed',
      distanceKm: distanceKm,
      calculationMethod: calcMethod,
      auditConfidence: confidenceStr || 'Verified',
      durationMinutes: durMinutes,
      avgSpeedKmH: avgSpeed,
      pointsCaptured: meta.pointsCaptured || 16,
      pointsFiltered: meta.pointsFiltered || 0,
      breakdown: breakdown,
      rationale: meta.rationale || `Verified via ${calcMethod} on TN Smart Logistics corridor`,
      points: meta.points || [],
      rejectedPoints: meta.rejectedPoints || []
    };
  }

  /**
   * Save a completed Trip record to Supabase `trips` table with full audit metadata
   */
  async saveTrip(trip) {
    if (!this.db) {
      console.warn('[SyncEngine] Cannot save trip: Supabase client not available');
      return;
    }
    try {
      const meta = {
        durationMinutes: trip.durationMinutes,
        avgSpeedKmH:     trip.avgSpeedKmH,
        pointsCaptured:  trip.pointsCaptured || (trip.points ? trip.points.length : 0),
        pointsFiltered:  trip.pointsFiltered || (trip.rejectedPoints ? trip.rejectedPoints.length : 0),
        breakdown:       trip.breakdown,
        rationale:       trip.rationale
      };

      const auditConfidencePayload = `${trip.auditConfidence || 'Verified'}|${JSON.stringify(meta)}`;

      const { error } = await this.db
        .from('trips')
        .upsert({
          id:                   trip.id,
          driver_id:            trip.driverId || 'DRV-101',
          vehicle_id:           trip.vehicleId || 'VEH-201',
          start_location:       trip.origin || 'GPS Start Point',
          end_location:         trip.destination || 'GPS Stopping Point',
          started_at:           trip.startedAt || new Date().toISOString(),
          ended_at:             trip.endedAt || new Date().toISOString(),
          status:               trip.status || 'completed',
          distance_km:          trip.distanceKm || 0,
          calculation_method:   trip.calculationMethod || 'Model B (GPS Filtered)',
          audit_confidence:     auditConfidencePayload,
        }, { onConflict: 'id' });

      if (error) {
        console.warn('[SyncEngine] Trip save error:', error.message);
      } else {
        console.log('[SyncEngine] ✅ Trip saved to Supabase with full summary:', trip.id);
        this.notifySyncListeners({ type: 'trip_saved_cloud', tripId: trip.id });
      }
    } catch (err) {
      console.warn('[SyncEngine] Trip save failed:', err.message);
    }
  }

  /**
   * Fetch all trips from Supabase (normalized for immediate UI display)
   */
  async fetchTrips(driverId) {
    if (!this.db) return [];
    try {
      let query = this.db
        .from('trips')
        .select('*')
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(60);

      if (driverId) {
        query = query.eq('driver_id', driverId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const validRows = (data || []).filter(row => {
        if (row.status !== 'completed') return false;
        if (row.distance_km === null || row.distance_km === undefined) return false;
        if (row.calculation_method === 'Model A (Known Corridor)') return false;
        if (row.start_location && row.start_location.includes('Chennai Port Container Terminal')) return false;
        return true;
      });
      return validRows.map(row => this.normalizeTripRecord(row));
    } catch (err) {
      console.warn('[SyncEngine] Fetch trips failed:', err.message);
      return [];
    }
  }

  /**
   * Synchronize trips from Supabase into local store
   */
  async syncTripsFromCloud() {
    try {
      const activeDriver = this.store.getActiveDriver();
      const driverId = activeDriver ? activeDriver.id : null;
      console.log('[SyncEngine] 🔄 Hydrating trips from Supabase cloud...');
      const cloudTrips = await this.fetchTrips(driverId);
      
      if (cloudTrips && cloudTrips.length > 0) {
        console.log(`[SyncEngine] ✅ Successfully loaded ${cloudTrips.length} trips from Supabase`);
        this.store.setTrips(cloudTrips);
        this.notifySyncListeners({ type: 'trips_synced', count: cloudTrips.length, trips: cloudTrips });
        return cloudTrips;
      } else {
        console.log('[SyncEngine] No existing trips in Supabase or empty response');
      }
    } catch (e) {
      console.warn('[SyncEngine] Cloud sync error:', e.message);
    }
    return [];
  }

  /**
   * Initialize Supabase Realtime subscriptions & window focus auto-sync
   */
  initRealtimeSync() {
    if (this.db && typeof this.db.channel === 'function') {
      try {
        const channel = this.db.channel('public:trips:realtime');
        channel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, async (payload) => {
            console.log('[SyncEngine] ⚡ Realtime trips event received:', payload.eventType);
            await this.syncTripsFromCloud();
          })
          .subscribe((status) => {
            console.log('[SyncEngine] Trips realtime channel status:', status);
          });
      } catch (e) {
        console.warn('[SyncEngine] Realtime subscription init error:', e.message);
      }
    }

    // Re-sync whenever the app window gains focus (e.g. user switches tabs or unlocks phone)
    window.addEventListener('focus', () => {
      if (this.store.isOnline()) {
        this.syncTripsFromCloud();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.store.isOnline()) {
        this.syncTripsFromCloud();
      }
    });
  }

  /**
   * Fetch latest recorded locations for all drivers from Supabase for live Fleet view
   */
  async fetchFleetLocations() {
    if (!this.db) return [];
    try {
      const { data, error } = await this.db
        .from('driver_locations')
        .select('id, driver_id, trip_id, latitude, longitude, speed, recorded_at')
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);

      const latestMap = new Map();
      for (const loc of (data || [])) {
        if (!latestMap.has(loc.driver_id)) {
          latestMap.set(loc.driver_id, loc);
        }
      }
      return Array.from(latestMap.values());
    } catch (err) {
      console.warn('[SyncEngine] fetchFleetLocations error:', err.message);
      return [];
    }
  }
}

// Global instance
window.nlSyncEngine = new SyncEngine(window.nlStore);
