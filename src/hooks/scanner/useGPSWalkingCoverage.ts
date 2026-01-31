import { useState, useEffect, useCallback, useRef } from 'react';
import { GeoPolygon } from '../../lib/spatial-coverage/domain/valueObjects/GeoPolygon';
import { CoordinateTransform } from '../../lib/spatial-coverage/domain/services/CoordinateTransform';

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
}

const GPS_WEIGHT = 0.7;
const IMU_WEIGHT = 0.3;

export function useGPSWalkingCoverage(
    boundary: GeoPolygon | null,
    isScanning: boolean,
    isAligned: boolean = true
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
        stepCount: 0
    });

    const watchIdRef = useRef<number | null>(null);
    const lastIMURef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
    const stepDetectorRef = useRef<{ lastAccel: number; stepThreshold: number }>({ lastAccel: 0, stepThreshold: 1.2 });

    // Use a ref for alignment to avoid restarting the watch effect constantly
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
            const accel = event.accelerationIncludingGravity;
            if (!accel?.x || !accel?.y || !accel?.z) return;

            const totalAccel = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
            const detector = stepDetectorRef.current;

            if (totalAccel > detector.stepThreshold * 9.8 && detector.lastAccel < detector.stepThreshold * 9.8) {
                setState(s => ({ ...s, stepCount: s.stepCount + 1 }));
                if (navigator.vibrate) navigator.vibrate(10);
            }
            detector.lastAccel = totalAccel / 9.8;

            const now = Date.now();
            if (lastIMURef.current) {
                const dt = (now - lastIMURef.current.timestamp) / 1000;
                lastIMURef.current = {
                    x: lastIMURef.current.x + accel.x * dt * 0.1,
                    y: lastIMURef.current.y + accel.y * dt * 0.1,
                    timestamp: now
                };
            } else {
                lastIMURef.current = { x: 0, y: 0, timestamp: now };
            }
        };

        window.addEventListener('devicemotion', handleMotion);
        return () => window.removeEventListener('devicemotion', handleMotion);
    }, [isScanning]);

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
                    let fusedX = gpsLocal.x;
                    let fusedY = gpsLocal.y;

                    if (lastIMURef.current && s.fusedPosition) {
                        fusedX = GPS_WEIGHT * gpsLocal.x + IMU_WEIGHT * (s.fusedPosition.x + lastIMURef.current.x);
                        fusedY = GPS_WEIGHT * gpsLocal.y + IMU_WEIGHT * (s.fusedPosition.y + lastIMURef.current.y);
                        lastIMURef.current = { x: 0, y: 0, timestamp: Date.now() };
                    }

                    const fusedPosition: FusedPosition = {
                        x: fusedX,
                        y: fusedY,
                        elevation: pos.coords.altitude || 0,
                        confidence: Math.max(0, 1 - gpsPos.accuracy / 20)
                    };

                    const isInside = poly.containsPoint(gpsPos.lat, gpsPos.lon);
                    const newPainted = new Map(s.voxelGrid.painted);

                    // RECORD ONLY IF INSIDE AND ALIGNED
                    if (isInside && isAlignedRef.current) {
                        const vx = Math.floor(fusedX / s.voxelGrid.voxelSize);
                        const vy = Math.floor(fusedY / s.voxelGrid.voxelSize);
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

    const reset = useCallback(() => {
        setState(s => ({
            ...s,
            voxelGrid: { ...s.voxelGrid, painted: new Map() },
            paintedVoxels: 0,
            coveragePercent: 0,
            stepCount: 0
        }));
    }, []);

    return {
        ...state,
        reset,
        getVoxelArray: (): VoxelData[] => Array.from(state.voxelGrid.painted?.values() || [])
    };
}
