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
        if (parsed.trips) {
          parsed.trips = parsed.trips.filter(t => 
            t.calculationMethod !== 'Model A (Known Corridor)' &&
            !(t.origin && t.origin.includes('Chennai Port Container Terminal'))
          );
        }
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
    return this.data.trips;
  }

  addTrip(trip) {
    this.data.trips.unshift(trip);
    // Update weekly & monthly stats
    const todayDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
    if (this.data.weeklyHistoryKm[todayDay] !== undefined) {
      this.data.weeklyHistoryKm[todayDay] = parseFloat((this.data.weeklyHistoryKm[todayDay] + trip.distanceKm).toFixed(1));
    }
    const driver = this.getActiveDriver();
    if (driver) {
      driver.totalKm = parseFloat((driver.totalKm + trip.distanceKm).toFixed(1));
      driver.tripsCompleted += 1;
    }
    this.save();
  }

  // Summary Metrics — 100% Real Data
  getDriverStats(driverId) {
    const targetId = driverId || this.data.activeDriverId;
    const trips = (this.data.trips || []).filter(t => {
      if (t.driverId !== targetId || t.status !== 'completed') return false;
      // Filter out legacy simulation corridor runs
      if (t.calculationMethod === 'Model A (Known Corridor)') return false;
      if (t.origin && t.origin.includes('Chennai Port Container Terminal')) return false;
      return true;
    });
    
    // Today calculation
    const today = new Date().toISOString().slice(0, 10);
    const todayTrips = trips.filter(t => (t.endedAt || t.startedAt || '').slice(0, 10) === today);
    const todayKm = todayTrips.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
    const todayDurationMins = todayTrips.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);

    const weeklyTotalKm = trips.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
    const driver = this.data.drivers.find(d => d.id === targetId);

    return {
      todayKm: parseFloat(todayKm.toFixed(1)),
      todayTripsCount: todayTrips.length,
      todayDrivingHours: (todayDurationMins / 60).toFixed(1) + 'h',
      weeklyTotalKm: parseFloat(weeklyTotalKm.toFixed(1)),
      monthlyTotalKm: parseFloat(weeklyTotalKm.toFixed(1)),
      weeklyBreakdown: this.data.weeklyHistoryKm,
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
