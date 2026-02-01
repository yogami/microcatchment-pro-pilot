import { useState, useEffect, useCallback, useRef } from 'react';
import { GeoPolygon } from '../../lib/spatial-coverage/domain/valueObjects/GeoPolygon';
import { CoordinateTransform } from '../../lib/spatial-coverage/domain/services/CoordinateTransform';
import { AudioFeedbackService } from '../../services/AudioFeedbackService';
import { VIAPEngine } from '../../lib/spatial-coverage/domain/services/VIAPEngine';
import type { Point2D } from '../../lib/spatial-coverage/domain/services/VIAPEngine';

interface GPSPosition {
    lat: number;
    lon: number;
    accuracy: number;
}

interface FusedPosition {
    x: number; // Local meters from origin
    y: number;
    elevation: number;
    confidence: number;
}

interface VoxelData {
    key: string;
    gx: number;
    gy: number;
    worldX: number;
    worldY: number;
    elevation: number;
    visitCount: number;
}

interface VoxelGrid {
    painted: Map<string, VoxelData>;
    voxelSize: number;
    origin: { lat: number; lon: number };
}

interface WalkingCoverageState {
    isActive: boolean;
    currentPosition: GPSPosition | null;
    fusedPosition: FusedPosition | null;
    isInsideBoundary: boolean;
    voxelGrid: VoxelGrid;
    coveragePercent: number;
    totalVoxels: number;
    paintedVoxels: number;
    gpsAccuracy: number;
    stepCount: number;
    veracityWarning: boolean;
}

export function useGPSWalkingCoverage(
    boundary: GeoPolygon | null,
    isScanning: boolean,
    isAligned: boolean = true,
    cameraRef?: React.RefObject<HTMLVideoElement | null>
) {
    const [state, setState] = useState<WalkingCoverageState>({
        isActive: false,
        currentPosition: null,
        fusedPosition: null,
        isInsideBoundary: false,
        voxelGrid: { painted: new Map(), voxelSize: 0.5, origin: { lat: 0, lon: 0 } },
        coveragePercent: 0,
        totalVoxels: 0,
        paintedVoxels: 0,
        gpsAccuracy: 0,
        stepCount: 0,
        veracityWarning: false
    });

    const watchIdRef = useRef<number | null>(null);
    const lastIMURef = useRef<{ vx: number; vy: number; dx: number; dy: number; timestamp: number }>({
        vx: 0, vy: 0, dx: 0, dy: 0, timestamp: 0
    });
    const imuScaleRef = useRef<number>(1.0);
    const stepDetectorRef = useRef<{ lastAccel: number; stepThreshold: number; lastMotionTime: number }>({
        lastAccel: 0,
        stepThreshold: 1.02, // Lowered for gentle hand sweeps
        lastMotionTime: 0
    });

    const lastStepCountRef = useRef<number>(0);
    const lastAnchorRef = useRef<{ mapPoint: Point2D; sensorPoint: Point2D } | null>(null);
    const sensorPathRef = useRef<Point2D[]>([]);
    const opticalFlowRef = useRef<{ dx: number; dy: number; stasis: boolean }>({ dx: 0, dy: 0, stasis: true });
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const flowTracerRef = useRef<any>(null); // OpticalFlowTracer

    const isAlignedRef = useRef(isAligned);
    useEffect(() => {
        isAlignedRef.current = isAligned;
    }, [isAligned]);

    const calculateTotalVoxels = useCallback((poly: GeoPolygon, voxelSize: number): number => {
        const bounds = poly.getBounds();
        const origin = { lat: bounds.minLat, lon: bounds.minLon };
        const pMax = CoordinateTransform.latLonToLocalMeters(origin, { lat: bounds.maxLat, lon: bounds.maxLon });
        return Math.ceil(Math.abs(pMax.x) / voxelSize) * Math.ceil(Math.abs(pMax.y) / voxelSize);
    }, []);

    useEffect(() => {
        if (!isScanning) return;

        const handleMotion = (event: DeviceMotionEvent) => {
            const accel = event.acceleration; // Use pure linear acceleration
            if (!accel?.x || !accel?.y) return;

            const now = Date.now();
            if (lastIMURef.current.timestamp === 0) {
                lastIMURef.current.timestamp = now;
                return;
            }

            const dt = (now - lastIMURef.current.timestamp) / 1000;
            const imu = lastIMURef.current;

            // V3 DUAL-GATE STASIS: Confirm still across Vision and Inertial
            const flow = opticalFlowRef.current;
            const isStill = VIAPEngine.detectStasis(
                flow.stasis ? [] : [{ dx: flow.dx, dy: flow.dy }],
                Math.sqrt(accel.x ** 2 + accel.y ** 2),
                0.01 // Fixed accel variance for now
            );

            if (isStill) {
                // ZUPT 2.0: High-Veracity Brake
                imu.vx = 0;
                imu.vy = 0;
            } else {
                // 1. Integrate Acceleration -> Velocity
                imu.vx += accel.x * dt;
                imu.vy += accel.y * dt;

                // 2. Friction / Damping (Tightened for Hand-Sweeps)
                imu.vx *= 0.90;
                imu.vy *= 0.90;

                stepDetectorRef.current.lastMotionTime = now;
            }

            // 3. Integrate Velocity -> Displacement
            imu.dx += imu.vx * dt;
            imu.dy += imu.vy * dt;
            imu.timestamp = now;

            // TRACK SENSOR PATH for Sim3 alignment
            sensorPathRef.current.push({ x: imu.dx, y: imu.dy });
            if (sensorPathRef.current.length > 500) sensorPathRef.current.shift(); // Keep recent 5s
        };

        window.addEventListener('devicemotion', handleMotion);
        return () => window.removeEventListener('devicemotion', handleMotion);
    }, [isScanning]);

    useEffect(() => {
        if (cameraRef?.current) {
            videoRef.current = cameraRef.current;
        }
    }, [cameraRef]);

    useEffect(() => {
        const poly = GeoPolygon.ensureInstance(boundary);
        if (!isScanning || !poly) {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            return;
        }

        const origin = poly.getCentroid();
        const voxelSize = 0.5;
        const totalVoxels = calculateTotalVoxels(poly, voxelSize);

        setState(s => ({
            ...s,
            isActive: true,
            voxelGrid: { ...s.voxelGrid, painted: s.voxelGrid.painted || new Map(), voxelSize, origin },
            totalVoxels,
        }));

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const gpsPos: GPSPosition = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                };

                setState(s => {
                    const gpsLocal = CoordinateTransform.latLonToLocalMeters(s.voxelGrid.origin, gpsPos);

                    // FUSION: Start with GPS, then apply IMU 'High-Fidelity' displacement
                    let targetX = gpsLocal.x;
                    let targetY = gpsLocal.y;

                    const imu = lastIMURef.current;
                    const imuX = imu.dx * imuScaleRef.current;
                    const imuY = imu.dy * imuScaleRef.current;

                    // THE RAIL LOGIC: If near a boundary edge, snap the movement to it
                    if (s.fusedPosition && (Math.abs(imu.dx) > 0.0005 || Math.abs(imu.dy) > 0.0005)) {
                        let nextX = s.fusedPosition.x + imuX;
                        let nextY = s.fusedPosition.y + imuY;

                        // Get nearest point on the boundary path
                        const nearestOnEdge = (poly as any).getNearestPointOnEdge({ x: nextX, y: nextY }, s.voxelGrid.origin);
                        const distToEdge = Math.sqrt(
                            Math.pow(nextX - nearestOnEdge.x, 2) +
                            Math.pow(nextY - nearestOnEdge.y, 2)
                        );

                        // STICKINESS (Magnetic Rails): If within 1.0 meter of the bed edge, stick to it.
                        // This 'Slot-Car' logic handles shaky-hand or random wiggles.
                        if (distToEdge < 1.0) {
                            targetX = nearestOnEdge.x;
                            targetY = nearestOnEdge.y;
                        } else {
                            targetX = nextX;
                            targetY = nextY;
                        }

                        // Reset IMU accumulators
                        imu.dx = 0; imu.dy = 0;
                    }

                    // ODOMETRY VALIDATION: Compare GPS delta to actual physical movement
                    if (s.fusedPosition) {
                        const dx = targetX - s.fusedPosition.x;
                        const dy = targetY - s.fusedPosition.y;
                        const actualDist = Math.sqrt(dx * dx + dy * dy);

                        // How many steps did we take since the last GPS update?
                        const stepsSinceLast = s.stepCount - lastStepCountRef.current;
                        lastStepCountRef.current = s.stepCount;

                        // Physical Max: Allow 1.8m movement even without steps (for hand sweeps)
                        const maxPhysicalDist = Math.max(1.8, stepsSinceLast * 0.9 + 0.8);

                        if (actualDist > maxPhysicalDist && s.stepCount > 0) {
                            const scale = maxPhysicalDist / actualDist;
                            targetX = s.fusedPosition.x + dx * scale;
                            targetY = s.fusedPosition.y + dy * scale;
                        }
                    }

                    const fusedPosition: FusedPosition = {
                        x: targetX,
                        y: targetY,
                        elevation: pos.coords.altitude || 0,
                        confidence: Math.max(0, 1 - gpsPos.accuracy / 20)
                    };

                    const isInside = poly.containsPoint(gpsPos.lat, gpsPos.lon);
                    const newPainted = new Map(s.voxelGrid.painted);

                    // MOTION GUARD + ACCURACY GATE + ODOMETRY
                    const isMoving = (Date.now() - stepDetectorRef.current.lastMotionTime) < 2500;
                    const isAccurate = gpsPos.accuracy < 12;

                    // RECORD ONLY IF PHYSICALLY VALID (Clamped targetX/targetY)
                    if (isInside && isAlignedRef.current && isAccurate && isMoving) {
                        const vx = Math.floor(targetX / s.voxelGrid.voxelSize);
                        const vy = Math.floor(targetY / s.voxelGrid.voxelSize);
                        const voxelKey = `${vx},${vy}`;

                        if (!newPainted.has(voxelKey)) {
                            newPainted.set(voxelKey, {
                                key: voxelKey, gx: vx, gy: vy,
                                worldX: vx * s.voxelGrid.voxelSize,
                                worldY: vy * s.voxelGrid.voxelSize,
                                elevation: fusedPosition.elevation,
                                visitCount: 1
                            });
                        } else {
                            const v = newPainted.get(voxelKey)!;
                            newPainted.set(voxelKey, { ...v, visitCount: v.visitCount + 1 });
                        }
                    }

                    const paintedCount = newPainted.size;
                    const coverage = s.totalVoxels > 0 ? (paintedCount / s.totalVoxels) * 100 : 0;

                    return {
                        ...s,
                        currentPosition: gpsPos,
                        fusedPosition,
                        isInsideBoundary: isInside,
                        voxelGrid: { ...s.voxelGrid, painted: newPainted },
                        paintedVoxels: paintedCount,
                        coveragePercent: Math.min(coverage, 100),
                        gpsAccuracy: gpsPos.accuracy
                    };
                });
            },
            (error) => console.error('[useGPSWalkingCoverage] GPS error:', error),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [isScanning, boundary, calculateTotalVoxels]);

    // V3: VERACITY LOOP (Optical Flow)
    useEffect(() => {
        if (!isScanning) return;

        // Lazy load the tracer to avoid SSR issues
        import('../../lib/spatial-coverage/infrastructure/sensors/OpticalFlowTracer').then(m => {
            flowTracerRef.current = new m.OpticalFlowTracer();
        });

        let frameId: number;
        const process = () => {
            if (videoRef.current && flowTracerRef.current) {
                const res = flowTracerRef.current.processFrame(videoRef.current);
                opticalFlowRef.current = res;

                // VERACITY CHECK: If IMU says we are moving fast but camera says 100% still
                // this is a "Magnetic/Inertial Hallucination" warning.
                const imu = lastIMURef.current;
                const imuSpeed = Math.sqrt(imu.vx ** 2 + imu.vy ** 2);
                if (imuSpeed > 0.3 && res.stasis) {
                    setState(s => ({ ...s, veracityWarning: true }));
                    AudioFeedbackService.beep(150, 0.05, 'sawtooth'); // Subtle low buzz
                } else if (state.veracityWarning) {
                    setState(s => ({ ...s, veracityWarning: false }));
                }
            }
            frameId = requestAnimationFrame(process);
        };
        process();
        return () => cancelAnimationFrame(frameId);
    }, [isScanning]);

    const reset = useCallback(() => {
        setState(s => ({
            ...s,
            voxelGrid: { ...s.voxelGrid, painted: new Map() },
            coveragePercent: 0,
            paintedVoxels: 0,
            stepCount: 0
        }));
    }, []);

    const snapToAnchor = useCallback((lat: number, lon: number) => {
        const local = CoordinateTransform.latLonToLocalMeters(state.voxelGrid.origin, { lat, lon });

        // CALIBRATION: The 'Handshake' Alignment (Sim3)
        // We compare the last 2 Anchor Points vs the sensor-tracked distance.
        if (state.fusedPosition) {
            const distOnMap = local.x; // Simplified for MVP
            const distOnSensors = state.fusedPosition.x;

            if (distOnSensors > 0.5) {
                const ratio = distOnMap / distOnSensors;
                // STRENGTH: V3 uses the VIAP Result to update the Global Scale
                imuScaleRef.current = Math.min(1.5, Math.max(0.6, ratio));
                console.log(`[VIAP] Scale Adjusted: ${imuScaleRef.current.toFixed(3)}x`);
            }
        }

        // Use VIAPEngine.solveAlignment for more robust calibration
        const sensorPath = sensorPathRef.current;
        const lastAnchor = lastAnchorRef.current;
        const imu = lastIMURef.current; // This declaration is needed here

        if (lastAnchor && sensorPath.length > 2) {
            try {
                // We align the sensor path segment to the two map anchors
                // Target: [PreviousAnchor, CurrentAnchor]
                // Source: [SensorStartAtPrevAnchor, SensorEndAtCurrAnchor]
                const sourcePoints = [sensorPath[0], sensorPath[sensorPath.length - 1]];
                const targetPoints = [lastAnchor.mapPoint, { x: local.x, y: local.y }];

                const { scale, rotation } = VIAPEngine.solveAlignment(sourcePoints, targetPoints);

                imuScaleRef.current = Math.min(2.0, Math.max(0.5, scale));
                console.log(`[VIAP] Alignment Solved: Scale=${scale.toFixed(3)}, Rotation=${rotation.toFixed(2)}`);
            } catch (err) {
                console.warn('[VIAP] Alignment failed - insufficient baseline', err);
            }
        }

        // Store current anchor point and sensor state for next alignment
        lastAnchorRef.current = {
            mapPoint: { x: local.x, y: local.y },
            sensorPoint: { x: imu.dx, y: imu.dy }
        };
        sensorPathRef.current = []; // Clear sensor path after alignment

        setState(s => ({
            ...s,
            fusedPosition: {
                x: local.x,
                y: local.y,
                elevation: s.fusedPosition?.elevation || 0,
                confidence: 1.0
            }
        }));

        // Reset odometry baseline for the next segment
        imu.dx = 0; imu.dy = 0;
        lastStepCountRef.current = state.stepCount;

        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        AudioFeedbackService.beep(1200, 0.1, 'sine');
    }, [state.voxelGrid.origin, state.stepCount, state.paintedVoxels, state.currentPosition, state.fusedPosition]);

    return {
        ...state,
        reset,
        snapToAnchor,
        getVoxelArray: (): VoxelData[] => Array.from(state.voxelGrid.painted?.values() || [])
    };
}
