## 🛑 ARCHITECTURAL ANCHOR
This project is part of the **Berlin AI Automation Studio**. 
It is governed by the global rules in **[berlin-ai-infra](https://github.com/yogami/berlin-ai-infra)**.

**Setup for new laptops:**
1. Clone this repo.
2. Run `./bootstrap-infra.sh` to link to the global Master Brain.

---

# 🌧️ Microcatchment Pro

**The "TurboTax" for Civil Engineering Stormwater Assessments.** 
Transform raw field data into grant-ready hydrology reports in minutes, not weeks.

---

## 🎯 The Problem & Our Moat

Traditional stormwater engineering is trapped between **manual surveying** (slow/inaccurate) and **enterprise CAD software** (expensive/complex). 

**Microcatchment Pro** provides the "Blue Ocean" alternative:
*   **The Problem:** Civil engineers waste ~10 hours per project on manual site visits, "spreadsheet hydrology," and drafting grant-alignment reports.
*   **The Solution:** A rapid field-triage tool that fuses **Drone LiDAR/Photogrammetry** with a **Physics-Informed Neural Network (PINN)** for instant, professional-grade site assessment.
*   **The Competitor Gap:** Unlike *CivilGEO* or *Bentley*, we focus on the **Proposal Phase**. We are the tool that wins the contract before the expensive CAD work even begins.

---

## ✨ Features

| Feature | Description | Moat |
|---------|-------------|------|
| 🚁 **Drone Data Fusion** | Upload drone photos/video for high-res terrain modeling | Replaces wobbly hand-held AR measurements |
| 🧠 **PINN Hydrology Engine** | Physics-Informed Neural Network for instant runoff inference | Faster than HEC-RAS for "Rapid Scoping" |
| 📊 **Professional Hydrology** | Rational Method & SCS Soil Group calculations | Engineering-ready technical annexes |
| 📄 **One-Click Reports** | Automated "Stamp-Ready" PDFs with grant alignment | Saves 4-8 hours of technical writing |
| 🏛️ **Grant Alignment** | Automatic matching with VADEQ-SLAF and FEMA-BRIC programs | First-to-market grant automation |

---

## 📐 Technical Architecture

### 1. The Hydrology Engine (`src/services/HydrologyEngine.ts`)
Implements the **Rational Method** for peak discharge (Q = CiA):
*   **C:** Weighted runoff coefficient based on surface classification.
*   **i:** Real-time rainfall intensity from **Open-Meteo**.
*   **A:** Precision area measurement from Drone/LiDAR data.

### 2. High-Fidelity Data Pipeline
*   **Field Capture:** Smartphone AR for ground-level "contextual" markers.
*   **Aerial Fusion:** Drone media upload for precision topographic meshing.
*   **Inference:** Client-side TensorFlow.js model (PINN) for runoff prediction.

---

## 🏃 Performance Metrics
*   **Site Survey Time:** Reduced from 2 hours to 15 minutes.
*   **Report Generation:** Reduced from 6 hours to 60 seconds.
*   **Accuracy:** Drone LiDAR support provides +/- 2cm vertical precision.

---

## 👨‍👩‍G‍👦 Team & Domain
Built for stormwater engineers and municipal resilient departments.
- **Domain Expert:** Licensed Civil Engineer specialization in Water Resources.
- **Engine:** Neural-Physics Hybrid (PINN).

---

## 📄 License
MIT

---

*"We do the boring math so you can do the engineering."* - Product Vision 2026

