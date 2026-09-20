# Namma Lorry — Driver GPS & Distance Tracking System

A production-grade, highly resilient **Driver GPS & Mileage Verification System** designed specifically for freight and logistics operations across India, built to the exact specifications in `gps.docx`.

---

## 🌟 Key Highlights & Engineering Features

### 1. Offline-First Architecture & Resilient Queue (Sections 11 & 12)
* **Zero Lost Mileage**: Operates seamlessly when cellular reception drops across rural corridors or tunnels.
* **Local Offline Queue**: When offline (`isOnline === false`), GPS points are stamped with `sync_status: pending` and stored securely.
* **Auto-Sync & Deduplication**: When connectivity is restored, the sync engine batches queued points to Supabase and marks them `synced` with zero duplicate records.

### 2. Multi-Stage GPS Quality Guard (Sections 13, 14, 15 & 16)
* **Check 1 — Accuracy Filter**: Drops or flags any point with GPS accuracy error $> 50\text{ meters}$.
* **Check 2 — Impossible Jump Filter**: Computes $v = \Delta d / \Delta t$. Rejects any speed exceeding realistic heavy vehicle limits ($> 120\text{ km/h}$).
* **Check 3 — Transient Spike Detection**: Evaluates 3-point windows ($P_{i-1} \to P_i \to P_{i+1}$) to eliminate satellite multi-path reflections.

### 3. Multi-Model Distance Engine (Sections 17, 18, 19, 20 & 21)
* **Model A (Known Corridor Baseline / Fallback)**: Reference baseline for major freight routes (e.g., Chennai $\leftrightarrow$ Bengaluru = 348.5 km, Chennai $\leftrightarrow$ Sriperumbudur = 42.0 km) with a $1.25\times$ winding factor fallback.
* **Model B (GPS Filtered Geodesic)**: Haversine distance accumulated across all cleaned GPS points. Fully operational 100% offline.
* **Model C (OpenStreetMap + OSRM Road Matching)**: Snaps GPS coordinates to the actual road network geometry using OpenStreetMap routing for high accuracy.
* **Decision Arbiter**: Evaluates point quality and model divergence. Chooses Model C when road alignment is within 15%, cleanly defaults to Model B when offline, and safely falls back to Model A only if GPS signal was completely lost.

### 4. Driver & Fleet Interfaces
* **Driver Mobile Cockpit**: Real-time HUD displaying current speed, trip distance, duration, GNSS accuracy, and live moving vehicle pin on Leaflet map.
* **Trip Audit Summary**: Deep audit modal showing final distance, calculation method, multi-model comparison, and filtered noise points.
* **Driver Analytics**: Daily KM, Trips count, Duty driving hours, weekly interactive breakdown chart (Mon–Sun), and monthly totals.
* **Admin Fleet Command**: Live fleet tracking map across Tamil Nadu & Karnataka corridors.
* **Built-in Algorithm Lab**: Interactive test runner directly executing all 5 tests defined in Section 31 of the specification document.

---

## 🚀 How to Run

1. Open `index.html` directly in any modern web browser, or serve with a local static web server:
   ```bash
   python -m http.server 8080
   ```
2. Open `http://localhost:8080` in your browser.
3. Click **START TRIP** to experience live corridor tracking and noise filtering in real-time.
4. Toggle the **ONLINE / SIMULATED OFFLINE** button in the top header to test offline queuing and auto-sync!
