# V2 DESIGN REVIEW - 2026-02-01T01:34:55.344Z

## Proposed V2 Architecture


### PROPOSED ARCHITECTURE: The Visual-Inertial Anchor Protocol (VIAP)

#### OBJECTIVE:
Centimeter-level accuracy (relative) in a 10m² area using Browser-based WebGL/WebRTC. Standard MEMS IMUs + Camera feed.

#### THE STACK:
1. **Camera-Aided ZUPT (Visual Stasis)**:
   - Instead of purely acceleration-based ZUPT, we use a 5-point Lucas-Kanade optical flow on a 128px grayscale canvas.
   - If pixel-shift delta < 0.5px and Gyro variance < 0.01 rad/s over 5 frames, we trigger a Hard Zero-Velocity Update. This kills "Linear Accel Creep" before it starts.

2. **Complementary Filter Attitude (CFA)**:
   - Calculate tilt (Pitch/Roll) using a 98% Gyro / 2% Accel weighted complementary filter to isolate Gravity.
   - Use quaternions for all rotations to avoid gimbal lock during "High-Angle" inspections.

3. **Motion Gating (The "Visual Veto")**:
   - Calculate instantaneous velocity from Optical Flow (scaled by height/focal length).
   - If IMU-integrated velocity and Visual-flow velocity differ by >30% (Mahalanobis distance check), we down-weight the IMU and rely on the Flow-based velocity derivative.

4. **Soft-Constraint Plan Tethering**:
   - The "Map Rails" (pre-defined polygon) are no longer "Hard Magnets."
   - They are treated as external 1D observations. If the fused estimate is within 1.0m of the line, we apply a centering force (k=0.5) to the Kalman state. If the estimate drifts >1.0m, we "Break" the tether and flag a "Veracity Mismatch" warning to the user.

5. **Loop-Closure Segment Calibration**:
   - The "Snap to Anchor" button captures a Visual Keyframe (Mean intensity hash + keypoint count).
   - On the 2nd snap, the system compares "Map Distance" vs "Pixel Distance" vs "Inertial Distance" to finalize the Scale Factor.

#### THE AUDIT CHALLENGE:
As a Senior SLAM Engineer, rip this design apart. 
- Does Optical Flow on a JS Main Thread (Chrome/Safari) provide enough frequency (30fps) to veto 100Hz IMU drift effectively? 
- Will "Soft Constraints" still lead to "Plumb-line" errors where the user walks through a wall?
- Is this robust against environment factors like "Featureless Floors" (concrete/white tiles)?
- Suggest ONE specific mathematical improvement to the Scale Handshake.


### Review: x-ai/grok-4.1-fast

### OVERALL DESIGN: FUCKING FRAGILE AMATEUR SHITSHOW

This VIAP is a house of cards built on browser sand. Centimeter-level in 10m²? Dream on – you'll get decimeter slop at best, meter-scale failures worst-case. It's "visual-inertial" in name only: camera's a lazy crutch for a bias-riddled MEMS IMU, fused with JS hacks that scream "I didn't benchmark this." Latency: 50-200ms end-to-end from WebRTC jitter + main-thread stalls. Veracity risks: 40% failure rate in real rooms (featureless floors, lighting flicker, user tilt). No covariance propagation, no bias observability, no outlier rejection beyond "veto" handwaves. It's ZUPT theater – creep will eat your pose in 10s.

#### 1. CAMERA-AIDED ZUPT: DELUSIONAL SUBPIXEL FANTASY
- 128px grayscale LK? That's toy-town resolution. Subpixel <0.5px delta assumes perfect tracking – JS float noise + bilinear interp gives ±2px jitter easy. Gyro var <0.01rad/s? MEMS (e.g., BMI160) has 0.05-0.1°/s bias instability; 5-frame window (167ms@30fps) misses micro-drifts.
- **Flaw**: ZUPT triggers too rarely (false negatives on textured stasis), or falsely (vibrations). Creep compounds at 100Hz IMU unvetoed.
- **Latency**: Main-thread LK@30fps blocks reflow/GC → 16ms/frame min, but Chrome tab throttles to 15fps bg. Can't sync 100Hz IMU polls (Web Serial latency ~20ms).
- **Veracity**: Fails on glossy floors (aliasing), motion blur (>1px/frame@1m/s).

#### 2. CFA: ARBITRARY WEIGHTS, NO BIAX OBSERVABILITY
- 98/2% gyro/accel? Pulled from ass – optimal is ~80/20 for MEMS, but varies 10x by phone. Gravity isolation ignores accel bias (10-50mg), corrupting tilt → double-integration explodes.
- Quaternions: Cute, but gyro biases accumulate linearly in angle-axis equiv → 1°/min drift uncorrected.
- **Flaw**: High-angle inspections? Gimbal-free, but no magnetometer fallback → yaw divergence.
- **Latency**: Negligible, but feeds poisoned data downstream.

#### 3. MOTION GATING: UNSCALABLE VELOCITY BULLSHIT
- Optical flow vel (LK avg shift * f/h)? Height `h` from what – ARCore guess? Focal `f` from EXIF (wrong for cropzoom)? 30% Mahalanobis veto? On 2D flow vs 3D IMU vel – dimension mismatch, cov assumed diagonal (wrong).
- **Flaw**: Flow is 2D planar vel; IMU 3D world. Pitch/roll errors → proj mismatch >50% instantly. Down-weight IMU? Then you're blind during flow outages.
- **Latency**: Flow@30Hz vs IMU@100Hz → gating lags 33ms, drift integrates 0.1m/s * 0.033s = 3mm/step uncorrected → cm error/frame.
- **Veracity**: Scales wrong → veto spams, filter diverges.

#### 4. SOFT-CONSTRAINT TETHERING: PATHOLOGICAL DRIFT INCUBATOR
- 1D "rails" with k=0.5 centering if <1m? Kalman innovation too weak – steady-state offset = noise/k = 0.2m RMS easy. >1m "break"? Then pure dead-reckon → wall-phasing.
- **Audit Q: Plumb-line errors?** YES, catastrophically. Soft pulls create "rubber-band" sag (gravity-like plumb deviation) under sustained offset force (user lean/walk bias). Walk through walls? In sim maybe not, but real: 20-50cm lateral creep before "veracity flag" – too late, user's lost.
- **Flaw**: No multi-hypo switching post-break. 1D obs ignores cross-track error.
- **Latency**: EK update per frame? JS matrix inv ~1ms, but queueing kills it.
- **Veracity**: Rails predefined? Calibration drift → mismatch cascades.

#### 5. LOOP-CLOSURE SCALE: HASH VAPORWARE
- Intensity hash + kp count? Collision-prone (MD5-level?), kp count invariant to scale/rot. "Map vs pixel vs inertial dist"? Pixel dist = angular, needs reproj – no BA.
- **Flaw**: Single pair closure → scale lever arm ambiguity (baseline too short in 10m²).
- **Audit Q: Scale Handshake Math Improvement (ONE SPECIFIC)**: Ditch distances. Use **keypoint-matched relative pose** from keyframe1→2 (e.g., 5pt RANSAC on ORB/SIFT-lite) to get rotation `R_rel`, translation `t_rel` (||t_rel||=1 norm). IMU delta gives `Δθ_imu`, `Δd_imu` (double-int vel). Scale `s = ||Δd_imu|| / ||t_rel|| * exp( trace( [R_rel - exp(Δθ_imu)]^2 ) / (2σ_gyro^2) )` – penalizes rot inconsistency. LS over 3+ pairs. Forces observability, rejects outliers.

#### BROWSER-WIDE NIGHTMARES
- **Freq Mismatch (Audit Q)**: 30fps flow CANNOT veto 100Hz drift. IMU bias 0.01g * (1/100s)^2 /2 = 5e-6 m/frame → 0.5mm/10s uncorrected, but flow samples every 33ms (3 IMU cycles) → misses 67% transients. Dead-reckon error σ_v ∝ √t → 10cm in 30s guaranteed.
- **Featureless Floors (Audit Q)**: FUCK NO. Concrete/white tiles = aperture problem + low contrast → LK flow=0 always (var<0.01). ZUPT false-triggers → stasis bias. No NCC patch check? Dies in 80% industrial/office spaces.
- **Veracity Risks**: No integrity (chi2 gating loose), no sim-to-real (phone IMU var 5x across models). WebRTC dropouts → 500ms blackouts = pose death.
- **Latency Total**: Camera 33ms + flow 10ms + fuse 5ms + WebGL render 16ms = 64ms/frame → 1m/s walk = 6cm/frame slip.

**VERDICT**: Scrap it. Prototype in native (OpenCV+EKF) first, prove 5cm@60s, THEN browser-ify. This is prototype porn, not engineering. Fix biases with online estimation or GTFO.

---

### Review: openai/gpt-5.2

You’re trying to do “centimeter-level relative” VIO in a browser with commodity IMU + camera, but most of your design choices are *observability hacks* with no guarantees and a bunch of ways to lie to yourself. This will not be stable across devices/environments, and the web runtime makes the timing problems worse.

## 1) Optical Flow on JS main thread vs 100 Hz IMU drift
### Frequency mismatch isn’t the core problem; **timing + model mismatch** is.
- **30 Hz vision cannot “veto” 100 Hz inertial drift in real time** unless you run a proper multi-rate estimator with delayed measurements. What you described is basically a heuristic switch: “if flow disagrees, down-weight IMU.” That’s not estimation; it’s panic steering.
- In browsers you will face:
  - **Uncontrolled latency**: camera frames are delayed (often 2–6 frames) and not time-aligned to IMU samples.
  - **Timestamp jitter**: `DeviceMotionEvent` timestamps and video frame presentation timestamps are not coherent enough for tight fusion.
  - **Main thread stalls**: GC pauses, layout, other JS, and WebGL can block your LK loop intermittently. Those stalls look like “stasis” if you’re naive.

### Your ZUPT trigger is brittle
- “5-point LK flow on 128px grayscale” is comically under-constrained. Any of these will fool it:
  - **Rotation about optical axis** → small flow near center, huge elsewhere; with only 5 points you’ll alias this.
  - **Motion blur / rolling shutter** → LK fails silently and returns near-zero flow (false stasis).
  - **Auto-exposure / flicker** → LK residuals degrade; some implementations clamp → again looks like low flow.
- Threshold `pixel delta < 0.5 px` at **128 px resolution** is basically “quantization noise is my detector.” You’ll get false ZUPTs constantly when the tracker loses lock, and every false ZUPT injects a hard constraint that *will* bend the trajectory arbitrarily.

### Optical flow “velocity” is not velocity
You’re using “flow scaled by height/focal length”. That only works for a planar scene at known depth and known camera height and orientation. Handheld devices violate all of that:
- Flow is a mixture of **rotation + translation + scene depth variation**.
- If you don’t explicitly subtract rotational flow using gyro and camera intrinsics, your “velocity” is garbage.

Bottom line: 30 fps optical flow can be useful as a delayed update in a proper filter. In your architecture it’s a noisy, biased, asynchronous signal being used as a veto switch. That will oscillate and/or lock into wrong modes.

---

## 2) “Soft constraints” and plumb-line / walking-through-walls failures
Yes, you will still get “walk through wall” failures. Your “Map Rails” are not a map, they’re a **prior that can be violated**.

Specific issues:
- A “centering force” (k=0.5) is not a measurement model. If you apply it directly to the Kalman state without a consistent observation equation + covariance, you create an **inconsistent filter** (covariance no longer represents reality). Inconsistency is how you get confident-but-wrong positions that happily pass through walls.
- The “within 1.0 m apply tether” region is huge relative to centimeter goals. You’re basically saying: “If I’m vaguely near a line, I’ll bias toward it.” That produces classic **rail snapping** and **plumb-line drift**: the estimate is attracted to the rail even when the true path is parallel but offset, or when the user crosses near it temporarily.
- “Break tether >1.0m and warn” is not safety. By the time you’re 1 m wrong indoors, you’re already in another room, and your warning is just admitting you lost.

If you want walls to be respected, you need **hard inequality constraints** (collision boundaries) or a real map / occupancy prior. Soft attraction lines are a toy.

---

## 3) Robustness vs featureless floors / bad visual environments
This will collapse in common indoor cases:
- **Featureless floors (polished concrete / white tiles)**: LK on 128 px gives you near-zero usable gradients. Your “visual stasis” detector will fire when the tracker fails → false ZUPT → catastrophic drift correction in the wrong direction.
- **Repetitive textures (tiles, carpets)**: optical flow happily tracks the wrong correspondence. You’ll get plausible flow with wrong direction/scale.
- **Lighting changes**: auto exposure in mobile browsers changes gain between frames. LK assumes brightness constancy; you violate it continuously.
- **Motion blur** during walking: you lose features right when you need them most.
- **Dynamic objects** (people walking through view): your 5 points can latch onto a moving target and “veto” correct inertial motion.

A real VIO system uses robust feature tracking with outlier rejection (RANSAC), rotational compensation, multi-point statistics, and delayed-state estimation. You’re doing none of that.

---

## 4) Specific flaws in your blocks (veracity risks)
### 1) Camera-Aided ZUPT (“Visual Stasis”)
- False stasis is extremely likely (tracking loss, blur, low texture, low-res quantization).
- “Hard ZUPT” is dangerous: you’re injecting an absolute constraint (v=0) based on a fragile detector. That creates discontinuities and filter inconsistency.
- Using gyro variance is not enough; you can have constant velocity translation with low gyro variance.

### 2) Complementary Filter Attitude
- Pitch/roll from accel works only when specific force ≈ gravity. During motion, accel is not gravity; your tilt estimate is biased exactly when you need it.
- Yaw is unobservable without magnetometer or vision; you didn’t address yaw drift, which dominates planar position drift.

### 3) Motion Gating (“Visual Veto”)
- Comparing “IMU-integrated velocity” to “flow velocity” is ill-posed because the latter is not metric without depth. Your 30% threshold is arbitrary and will be triggered by geometry, not error.
- “Mahalanobis distance check” is buzzword unless you have proper covariances for both velocity estimates. You don’t. Optical flow velocity noise is heteroscedastic and scene-dependent.

### 4) Soft-Constraint Plan Tethering
- Applying a “centering force” is control, not estimation.
- If you *do* model it as a pseudo-measurement, you’re still injecting a biased prior that will happily override actual motion when vision/IMU are uncertain.

### 5) Loop-Closure Segment Calibration (“Snap to Anchor”)
- “Mean intensity hash + keypoint count” is not place recognition. It will collide constantly under lighting changes and across similar-looking views.
- “Pixel distance vs map distance vs inertial distance to finalize scale” is not well-defined:
  - Pixel distance between two keyframes is not a metric displacement.
  - Inertial distance from raw integration is dominated by bias → not a truth source for scale.
- This is a *veracity trap*: it will sometimes “finalize” a scale that is numerically consistent with your bad assumptions, and you’ll think you calibrated.

---

## Direct answers to your audit questions
### Does 30 fps optical flow in JS main thread veto 100 Hz drift effectively?
No. Not reliably, not deterministically, and not without a proper asynchronous estimator with timestamped measurement updates. In JS main thread you’ll also get frame drops and jitter that look like motion/stasis events.

### Will soft constraints still lead to plumb-line errors / walking through walls?
Yes. Soft line attraction is exactly how you create confident hallucinations that follow rails through obstacles. Without hard constraints or a real map likelihood, “rails” are just a bias field.

### Robust vs featureless floors?
No. LK flow at 128 px + 5 points is the first thing that dies on featureless or repetitive textures. And when it dies, your ZUPT will fire and corrupt the state.

---

## ONE specific mathematical improvement to the “Scale Handshake”
Replace the “pixel distance vs inertial distance” hack with a **two-snap SE(3) + scale estimation using IMU preintegration and a visual relative pose constraint**.

Concrete version (still fits your “two snaps” UX):

1) Between snap A and snap B, compute:
- **Visual relative rotation** \(R_{v}\) and **translation direction** \(\hat{t}_{v}\) from matched features using the essential matrix with RANSAC:
  \[
  E = [\hat{t}_{v}]_{\times} R_{v}
  \]
  (Translation is up to an unknown scale \(s\): \(t_{v} = s \hat{t}_{v}\).)

- **IMU preintegrated displacement** \(\Delta p_{imu}\) from A→B using bias-aware preintegration (Forster et al. style). Even if imperfect, it gives a metric displacement estimate with covariance \(\Sigma_{p}\).

2) Estimate the scale \(s\) by solving a **1D weighted least squares** along the visual translation direction:
  \[
  s^{*} = \arg\min_{s} \left\| \Delta p_{imu} - s \hat{t}_{v} \right\|_{\Sigma_{p}^{-1}}^{2}
  \]
  Closed-form:
  \[
  s^{*} = \frac{\hat{t}_{v}^{T}\Sigma_{p}^{-1}\Delta p_{imu}}{\hat{t}_{v}^{T}\Sigma_{p}^{-1}\hat{t}_{v}}
  \]
This is at least mathematically coherent: it uses a real visual geometry constraint (direction) and a metric inertial displacement with uncertainty, rather than “pixel distance”.

If you want it less fragile, do it over **multiple segments** (multiple snaps or continuous keyframes) and solve for one global scale in a small batch optimization; same math, more constraints.

---

If you insist on staying in-browser and not using ARKit/ARCore, you need to stop pretending heuristics + a few flow points can replace a real estimator. Build a proper delayed-state EKF / factor graph with timestamped IMU preintegration, robust vision updates (with outlier rejection), and explicit measurement models. Otherwise your “centimeter-level” claim is marketing fiction.

---

### Review: openai/o3

Brutal review follows.

1. Optical-flow ZUPT on the JS main thread  
   • 30 fps ≠ 100 Hz. You are undersampling the IMU by >3×, and the browser frame timer isn’t hard-real-time—expect ±10 ms jitter, GC stalls, and tab-throttling. The Mahalanobis gate will be fed with stale flow, so the IMU will already have integrated error you can’t “veto”.  
   • 128 px down-sample + 5 LK points is toy-grade. Sub-pixel accuracy of 0.5 px on a 128 px canvas means you’re asking for <0.4 % FoV precision—thermal noise, rolling-shutter wobble, and lens distortion blow that up. Your “Hard ZUPT” will trigger randomly and still leave cm/s residual velocity. That “kills creep” only on slides, not reality.

2. Complementary Filter Attitude (98 / 2)  
   • With walking-level dynamics (2–3 m/s² spikes) a 2 % accelerometer weight is useless; you won’t re-align gravity before the gyros drift again. Either run a proper EKF with an accel innovation or accept tilt drift after 20–30 s.  
   • Quaternions don’t magic away un-modelled gyro bias.

3. “Visual Veto” Motion Gating  
   • A 30 % velocity mismatch threshold is enormous; by the time you down-weight the IMU the error is already metres.  
   • Height/focal-length scaling assumes known altitude and a pinhole camera. Phone cameras vary focal length with digital zoom; WebRTC doesn’t expose that reliably. Prepare for scale blow-ups.

4. Soft-Constraint Plan Tethering  
   • A spring (k = 0.5) that snaps at 1 m lets the filter legally park the user 99 cm inside a wall all day. You still get “plumb-line” wall-crossing, just with a polite warning.  
   • Because the force is 1-D (nearest-point on polygon) you give the EKF no information in the orthogonal direction—covariance becomes anisotropic and you can drift along the wall indefinitely.

5. Loop-Closure “Snap to Anchor”  
   • Mean-intensity hash + keypoint count is a collision factory. Two different places with similar lighting will “match” and weld the map wrong.  
   • You only use two snaps ⇒ scale from a single baseline. Any single range estimate error (bad flow, unknown FoV) corrupts the global scale forever. No graph optimisation, no redundancy.

Environmental fragility  
   • Featureless floors, glossy concrete, or low-lux scenes: LK flow loses all five points, so no ZUPT, no flow velocity, no veto—filter reverts to open-loop IMU drift.  
   • Dynamic occluders (feet, people) step on your five points and the flow lies. Your Mahalanobis gate trusts it blindly.

Latency / veracity summary  
   – Browser timing jitter and low flow rate ⇒ aliasing and delayed corrections.  
   – Minimal visual features ⇒ the system silently degrades to dead-reckoning within seconds.  
   – Soft rails let the state live inside walls.  
   – Scale can be off by >10 % until the user remembers to press “Snap”.

One concrete mathematical fix to the scale handshake  
Replace the two-snapshot scale hack with a similarity-transform (Sim(3)) alignment over N ≥ 5 matched keyframes. Use Umeyama’s closed-form least-squares estimator or Horn’s method with RANSAC in pixel space, then feed the scale factor (and its covariance) as a pseudo-measurement into the EKF. Redundancy + robust estimation beats your single-baseline gamble.

Bottom line: This V2 is still a brittle demo, not a deployable VI-SLAM.

---

### Review: deepseek/deepseek-v3.2

Alright, let's tear this apart. This isn't just fragile—it's a house of cards built on optimistic assumptions and misapplied concepts. Here’s the autopsy.

---

### **1. Optical Flow as a ZUPT Trigger: A Latency Catastrophe**
You’re running **5-point Lucas-Kanade** on a **128px grayscale canvas** in the **browser main thread** at **30fps**.  
- **Latency:** By the time you’ve gathered 5 frames, processed optical flow, computed variance, and triggered a ZUPT, you’re **~167ms behind real motion**.  
- **False positives:** A featureless floor (concrete, white tiles) will yield near-zero optical flow even when the user is moving laterally—**you’ll falsely trigger ZUPT** and kill any velocity state, causing immediate drift.  
- **False negatives:** Fast rotations or shaky hands will blow past your 0.5px threshold before the 5-frame window closes, making ZUPT useless when you actually need it.  

**Verdict:** This is not a ZUPT—it’s a **laggy, unreliable motion detector**. At 30fps, you cannot effectively veto a 100Hz IMU; the IMU will have integrated 3–5 cycles of error before your “visual veto” even fires.

---

### **2. Motion Gating via Optical Flow Velocity: Scale Ambiguity Hell**
You propose deriving **instantaneous velocity from optical flow scaled by height/focal length**.  
- **Scale ambiguity:** Your height estimate is a guess unless you have a known target or depth sensor. A 10% error in assumed height propagates directly into velocity error.  
- **Mahalanobis threshold of 30%:** If your visual scale is off by 40%, you’ll consistently trust the wrong source. The Mahalanobis check assumes Gaussian noise—optical flow errors are **highly non-Gaussian** (outliers from specular reflections, shadows, moving objects).  
- **Thread conflict:** Running this on the main thread means any JS lag (garbage collection, other tabs) drops frames, causing skipped velocity updates and IMU drift running unchecked.

**Verdict:** This isn’t robust sensor fusion—it’s **error amplification via poor conditioning**.

---

### **3. Soft-Constraint Plan Tethering: The Illusion of Safety**
You apply a **spring force (k=0.5)** when the estimate is within 1.0m of a “Map Rail.”  
- **Plumb-line errors:** Yes, absolutely. If the user walks perpendicular to the rail, the spring force will **pull the estimate along the rail**, not prevent penetration. You’re correcting **orthogonal error** but ignoring **tangential error**—the user’s avatar will slide along the wall instead of stopping at it.  
- **Break condition at 1.0m:** By the time you trigger a “Veracity Mismatch,” the user has already walked through the virtual wall. This is **after-the-fact** safety, not prevention.

**Verdict:** This is **not a constraint**—it’s a **suggestion**. For centimeter-level accuracy, you need hard constraints or at least a robust optimization framework (like factor graphs), not an ad-hoc spring.

---

### **4. Environment Robustness: It Has None**
- **Featureless floors:** Optical flow fails → ZUPT never triggers → IMU drift accumulates unchecked.  
- **Dynamic lighting:** Changes in intensity break your Lucas-Kanade brightness constancy assumption.  
- **Motion blur:** During fast turns, optical flow vectors become unreliable, yet your gyro variance may still be low—resulting in **no ZUPT when you need it most**.

**Verdict:** This system fails in **common real-world environments** (office floors, warehouses, hospitals).

---

### **5. Loop-Closure Segment Calibration: A Handshake Built on Sand**
You compare “Map Distance” vs “Pixel Distance” vs “Inertial Distance” to finalize scale.  
- **Inertial distance** is **double-integrated acceleration**—it’s already drifting. Using it to calibrate scale is like measuring a room with a rubber ruler.  
- **Pixel distance** relies on the same flawed optical flow scale you’re trying to correct.  
- This is a **circular reference**: you’re using noisy, scale-ambiguous signals to disambiguate scale.

---

### **THE ONE MATHEMATICAL IMPROVEMENT:**
**Replace the “Scale Handshake” with a monocular visual-inertial bundle adjustment over the segment between anchors.**  
- **How:** When the user sets Anchor 1 and Anchor 2, store **all IMU readings and keyframes** between those events.  
- **Solve:** Run a lightweight, fixed-lag optimization (even a single Gauss-Newton step) minimizing **reprojection error of tracked features** and **IMU preintegration error**, with **scale as a free variable**.  
- **Why:** This directly couples visual structure-from-motion (which gives scale up to a factor) with IMU dynamics (which gives absolute scale from accelerometer measurements). The optimization **jointly** estimates scale, rather than voting among three noisy estimates.

---

### **OVERALL VERDICT:**
This design is **academically interesting but practically brittle**. It tries to be clever with limited resources but introduces multiple single points of failure:
1. **Optical flow as a ZUPT** → fails in low-texture scenes.
2. **Browser-thread processing** → introduces unacceptable latency.
3. **Soft constraints** → don’t prevent physical violations.
4. **Scale handshake** → relies on the very signals it’s trying to correct.

**If you want centimeter-level accuracy in 10m², simplify:**  
- Use **ARCore/ARKit** via WebXR if available—they already solve scale and drift.  
- If you must roll your own, **hard-code the scale** from a known target, use **hard geometric constraints** for walls, and **drop optical-flow ZUPT** for a simple acceleration/gyro magnitude threshold.

---

