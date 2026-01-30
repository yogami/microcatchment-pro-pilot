# Microcatchment Pro: Hybrid Tier Strategy

## 1. Core Architecture (The Mechanism)
We build **ONE** application with two modes.

### Mode A: The "Trojan Horse" (Sovereign Tier)
*   **Target:** Civil Engineers, Utility Planners.
*   **Model:** **SaaS / Tooling.** (Not Agency).
*   **Manual Work:** **ZERO.** The User (Engineer) enters the data. You provide the calculator.
*   **Tech:** Desktop App (Tauri + Rust).
*   **Data:** Local SQLite + GeoPackage. **100% Offline.**
*   **Value:** "Calculate Runoff (`Abflussbeiwert`) faster than Excel." rates.
*   **Trust:** No data leaves the laptop. This bypasses the "Cloud Phobia" of German engineers.

### Mode B: The "Upsell" (Cloud Tier)
*   **Target:** The same Engineer (seeking benchmarks) OR The Municipality (seeking integration).
*   **Tech:** Sync to Supabase (PostgreSQL/PostGIS) via secured API.
*   **The Trade:** "Want to compare your site against 500 others? Sync anonymized stats."
*   **Revenue:** We sell the **Aggregated Risk Map** to Insurers (GGD) and Cities.

## 2. Effort Estimate
*   **Frontend (Tauri/React):** ~3 Weeks. (Mapbox/Deck.gl integration).
*   **Backend (Rust/Python Logic):** ~2 Weeks. (Hydrology calc `DIN 1986-100`).
*   **The "Bureaucracy Adapter":** ~4-6 Weeks. (XPlanung export, DXF layers). **Crucial.**

## 3. The Sales Motion (Who to talk to)
*   **Do NOT talk to Homeowners.** (The 1.7/10 Trap).
*   **Talk to Engineers:** "Here is a free tool to automate your bureaucratic calculations."
*   **Talk to Insurers (GDV):** "We have a live map of actual retention capacity in Berlin-Mitte."

## 4. Bureaucracy Hell (The Risk)
*   **XPlanung:** Strict XML schema for German planning data. Must be perfect.
*   **DIN 1986-100:** The drainage standard. Our math must be certified or exact.
*   **GDPR (DSGVO):** Aggregation must be privacy-preserving (K-Anonymity).

## Implementation Sandbox
This directory contains the "Sovereign Tier" implementation (Tauri).
