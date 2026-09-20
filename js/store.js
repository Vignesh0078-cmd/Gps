/**
 * store.js - Central Data Store with LocalStorage Persistence
 * Implements data structures specified in Section 4-7 of gps.docx:
 * - Drivers
 * - Vehicles
 * - Trips
 * - Driver Locations & Offline Queue
 */

const STORAGE_KEY = 'NAMMA_LORRY_GPS_STORE_V5';

// Pure real data initial template (Zero fake trips, zero fake km)
const SEED_DATA = {
  activeDriverId: 'DRV-101',
  isOnline: true,
  offlineQueue: [],
  drivers: [
    {
      id: 'DRV-101',
      name: 'Kumar K.',
      phone: '+91 98401 23456',
      email: 'kumar.driver@nammalorry.in',
      vehicleId: 'VEH-201',
      status: 'active',
      avatar: 'K',
      totalKm: 0.0,
      tripsCompleted: 0,
      rating: 5.0
    },
    {
      id: 'DRV-102',
      name: 'Selvam M.',
      phone: '+91 98402 78910',
      email: 'selvam.driver@nammalorry.in',
      vehicleId: 'VEH-202',
      status: 'idle',
      avatar: 'S',
      totalKm: 0.0,
      tripsCompleted: 0,
      rating: 5.0
    },
    {
      id: 'DRV-103',
      name: 'Raja V.',
      phone: '+91 98403 45678',
      email: 'raja.driver@nammalorry.in',
      vehicleId: 'VEH-203',
      status: 'idle',
      avatar: 'R',
      totalKm: 0.0,
      tripsCompleted: 0,
      rating: 5.0
    }
  ],
  vehicles: [
    {
      id: 'VEH-201',
      driverId: 'DRV-101',
      vehicleNumber: 'TN 01 AB 1234',
      vehicleType: 'Heavy Truck (25 Ton)',
      capacity: '25 Ton',
      status: 'available'
    },
    {
      id: 'VEH-202',
      driverId: 'DRV-102',
      vehicleNumber: 'TN 09 BC 5678',
      vehicleType: 'Multi-Axle Trailer (32 Ton)',
      capacity: '32 Ton',
      status: 'available'
    },
    {
      id: 'VEH-203',
      driverId: 'DRV-103',
      vehicleNumber: 'KA 04 CD 9012',
      vehicleType: 'Container Lorry (16 Ton)',
      capacity: '16 Ton',
      status: 'available'
    }
  ],
  // Pure real trips only — populated when user conducts actual trips
  trips: [],
  weeklyHistoryKm: {
    Mon: 0.0,
    Tue: 0.0,
    Wed: 0.0,
    Thu: 0.0,
    Fri: 0.0,
    Sat: 0.0,
    Sun: 0.0
  }
};

class Store {
  constructor() {
    this.data = this.load();
    this.listeners = [];
  }

  load() {
    try {
      localStorage.removeItem('NAMMA_LORRY_GPS_STORE_V1');
      localStorage.removeItem('NAMMA_LORRY_GPS_STORE_V2');
      localStorage.removeItem('NAMMA_LORRY_GPS_STORE_V3');
      localStorage.removeItem('NAMMA_LORRY_GPS_STORE_V4');
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...SEED_DATA, ...parsed };
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using seed data.', e);
    }
    return JSON.parse(JSON.stringify(SEED_DATA));
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notify();
    } catch (e) {
      console.error('Failed to save store to localStorage:', e);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.data);
    }
  }

  // Driver methods
  getActiveDriver() {
    return this.data.drivers.find(d => d.id === this.data.activeDriverId) || this.data.drivers[0];
  }

  setActiveDriver(driverId) {
    this.data.activeDriverId = driverId;
    this.save();
  }

  getActiveVehicle() {
    const driver = this.getActiveDriver();
    return this.data.vehicles.find(v => v.id === driver.vehicleId) || this.data.vehicles[0];
  }

  // Network Online / Offline toggle
  isOnline() {
    return this.data.isOnline;
  }

  setOnlineStatus(online) {
    this.data.isOnline = online;
    this.save();
  }

  // Offline Queue
  getOfflineQueue() {
    return this.data.offlineQueue || [];
  }

  addToOfflineQueue(locationPoint) {
    locationPoint.sync_status = 'pending';
    locationPoint.queued_at = new Date().toISOString();
    this.data.offlineQueue.push(locationPoint);
    this.save();
    return this.data.offlineQueue.length;
  }

  clearOfflineQueue() {
    const count = this.data.offlineQueue.length;
    this.data.offlineQueue = [];
    this.save();
    return count;
  }

  removeFromOfflineQueue(pointIds) {
    if (!Array.isArray(pointIds)) pointIds = [pointIds];
    const set = new Set(pointIds);
    const initialCount = this.data.offlineQueue.length;
    this.data.offlineQueue = this.data.offlineQueue.filter(p => !set.has(p.id) && !set.has(p.local_point_id));
    this.save();
    return initialCount - this.data.offlineQueue.length;
  }

  // Trips
  getTrips() {
    return this.data.trips || [];
  }

  getLatestTrip() {
    return (this.data.trips && this.data.trips.length > 0) ? this.data.trips[0] : null;
  }

  addTrip(trip) {
    if (!this.data.trips) this.data.trips = [];
    // Ensure no duplicate by id
    this.data.trips = this.data.trips.filter(t => t.id !== trip.id);
    this.data.trips.unshift(trip);
    this.recalculateDriverStats();
    this.save();
  }

  setTrips(trips) {
    if (!Array.isArray(trips)) return;
    // Sort descending by startedAt
    const sorted = [...trips].sort((a, b) => {
      const ta = new Date(a.startedAt || a.started_at || a.created_at || 0).getTime();
      const tb = new Date(b.startedAt || b.started_at || b.created_at || 0).getTime();
      return tb - ta;
    });
    this.data.trips = sorted;
    this.recalculateDriverStats();
    this.save();
  }

  recalculateDriverStats() {
    const activeDriver = this.getActiveDriver();
    if (!activeDriver) return;

    const trips = this.data.trips || [];
    const driverTrips = trips.filter(t => (t.driverId === activeDriver.id || t.driver_id === activeDriver.id));

    // Reset weekly breakdown
    const weekly = { Mon: 0.0, Tue: 0.0, Wed: 0.0, Thu: 0.0, Fri: 0.0, Sat: 0.0, Sun: 0.0 };
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let totalKm = 0;
    driverTrips.forEach(t => {
      const dist = parseFloat(t.distanceKm !== undefined ? t.distanceKm : (t.distance_km || 0));
      totalKm += dist;

      const dateStr = t.endedAt || t.startedAt || t.ended_at || t.started_at || t.created_at;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const dayName = daysMap[d.getDay()];
          if (weekly[dayName] !== undefined) {
            weekly[dayName] = parseFloat((weekly[dayName] + dist).toFixed(1));
          }
        }
      }
    });

    this.data.weeklyHistoryKm = weekly;
    activeDriver.totalKm = parseFloat(totalKm.toFixed(1));
    activeDriver.tripsCompleted = driverTrips.length;
  }

  // Summary Metrics — 100% Real Data
  getDriverStats(driverId) {
    const targetId = driverId || this.data.activeDriverId;
    const trips = (this.data.trips || []).filter(t => {
      const dId = t.driverId || t.driver_id;
      return dId === targetId && (t.status === 'completed' || !t.status);
    });
    
    // Today calculation
    const today = new Date().toISOString().slice(0, 10);
    const todayTrips = trips.filter(t => {
      const dt = (t.endedAt || t.startedAt || t.ended_at || t.started_at || t.created_at || '').slice(0, 10);
      return dt === today;
    });

    const todayKm = todayTrips.reduce((sum, t) => sum + parseFloat(t.distanceKm !== undefined ? t.distanceKm : (t.distance_km || 0)), 0);
    const todayDurationMins = todayTrips.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);

    const weeklyTotalKm = trips.reduce((sum, t) => sum + parseFloat(t.distanceKm !== undefined ? t.distanceKm : (t.distance_km || 0)), 0);

    return {
      todayKm: parseFloat(todayKm.toFixed(1)),
      todayTripsCount: todayTrips.length,
      todayDrivingHours: (todayDurationMins / 60).toFixed(1) + 'h',
      weeklyTotalKm: parseFloat(weeklyTotalKm.toFixed(1)),
      monthlyTotalKm: parseFloat(weeklyTotalKm.toFixed(1)),
      weeklyBreakdown: this.data.weeklyHistoryKm || {},
      allTrips: trips
    };
  }

  resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = JSON.parse(JSON.stringify(SEED_DATA));
    this.notify();
  }
}

// Global Store Instance
window.nlStore = new Store();
