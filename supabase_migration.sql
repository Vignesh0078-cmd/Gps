-- ============================================================
-- Namma Lorry GPS Tracking — Supabase Database Migration
-- Run this once in:
--   Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- Enable PostGIS for geospatial support (Section 2 of gps.docx)
create extension if not exists postgis;

-- ============================================================
-- 1. DRIVERS TABLE (Section 4.1)
-- ============================================================
create table if not exists public.drivers (
  id          text primary key,
  name        text not null,
  phone       text,
  email       text,
  status      text default 'active',   -- 'active' | 'idle' | 'inactive'
  created_at  timestamptz default now()
);

-- ============================================================
-- 2. VEHICLES TABLE (Section 5)
-- ============================================================
create table if not exists public.vehicles (
  id             text primary key,
  driver_id      text references public.drivers(id) on delete cascade,
  vehicle_number text not null,
  vehicle_type   text,
  capacity       text,
  status         text default 'available', -- 'available' | 'on_road' | 'maintenance'
  created_at     timestamptz default now()
);

-- ============================================================
-- 3. TRIPS TABLE (Section 6)
-- ============================================================
create table if not exists public.trips (
  id                   text primary key,
  driver_id            text references public.drivers(id) on delete cascade,
  vehicle_id           text references public.vehicles(id) on delete set null,
  start_location       text,
  end_location         text,
  started_at           timestamptz,
  ended_at             timestamptz,
  status               text default 'active', -- 'active' | 'completed' | 'cancelled'
  distance_km          numeric(10, 2),
  calculation_method   text,   -- 'Model A' | 'Model B (GPS)' | 'Model C (GPS + OSRM)'
  audit_confidence     text,
  created_at           timestamptz default now()
);

-- ============================================================
-- 4. DRIVER LOCATIONS TABLE (Section 7)
-- Stores every GPS point captured during a trip
-- ============================================================
create table if not exists public.driver_locations (
  id           text primary key,
  trip_id      text references public.trips(id) on delete cascade,
  driver_id    text references public.drivers(id) on delete cascade,
  latitude     double precision not null,
  longitude    double precision not null,
  accuracy     double precision,   -- metres — used by GPS quality filter (Section 14)
  speed        double precision,   -- km/h
  heading      double precision,   -- degrees 0–360
  recorded_at  timestamptz not null,
  synced_at    timestamptz default now()
);

-- Partial index for fast "pending sync" queries
create index if not exists idx_locations_trip
  on public.driver_locations(trip_id, recorded_at desc);

-- ============================================================
-- 5. ROW LEVEL SECURITY (Section 28 of gps.docx)
-- Driver A cannot read Driver B's trips or locations
-- ============================================================
alter table public.drivers          enable row level security;
alter table public.vehicles         enable row level security;
alter table public.trips            enable row level security;
alter table public.driver_locations enable row level security;

-- Public SELECT on drivers (fleet management view)
create policy "Allow anon read drivers"
  on public.drivers for select using (true);

create policy "Allow anon insert drivers"
  on public.drivers for insert with check (true);

-- Open policies for MVP (tighten with Supabase Auth user_id later)
create policy "Allow anon read vehicles"
  on public.vehicles for select using (true);

create policy "Allow anon insert vehicles"
  on public.vehicles for insert with check (true);

create policy "Allow anon read trips"
  on public.trips for select using (true);

create policy "Allow anon insert/update trips"
  on public.trips for insert with check (true);

create policy "Allow anon update trips"
  on public.trips for update using (true);

create policy "Allow anon read locations"
  on public.driver_locations for select using (true);

create policy "Allow anon insert locations"
  on public.driver_locations for insert with check (true);

create policy "Allow anon update locations"
  on public.driver_locations for update using (true);

create policy "Allow anon update drivers"
  on public.drivers for update using (true);

create policy "Allow anon update vehicles"
  on public.vehicles for update using (true);

-- ============================================================
-- 6. SEED SAMPLE DRIVERS & VEHICLES (from store.js)
-- ============================================================
insert into public.drivers (id, name, phone, email, status) values
  ('DRV-101', 'Kumar K.',  '+91 98401 23456', 'kumar.driver@nammalorry.in',  'active'),
  ('DRV-102', 'Selvam M.', '+91 98402 78910', 'selvam.driver@nammalorry.in', 'active'),
  ('DRV-103', 'Raja V.',   '+91 98403 45678', 'raja.driver@nammalorry.in',   'idle')
on conflict (id) do nothing;

insert into public.vehicles (id, driver_id, vehicle_number, vehicle_type, capacity, status) values
  ('VEH-201', 'DRV-101', 'TN 01 AB 1234', 'Heavy Truck (25 Ton)',          '25 Ton', 'on_road'),
  ('VEH-202', 'DRV-102', 'TN 09 BC 5678', 'Multi-Axle Trailer (32 Ton)',   '32 Ton', 'on_road'),
  ('VEH-203', 'DRV-103', 'KA 04 CD 9012', 'Container Lorry (16 Ton)',      '16 Ton', 'available')
on conflict (id) do nothing;
