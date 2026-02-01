import { useRef, useEffect } from 'react';
import { GeoPolygon } from '../../../lib/spatial-coverage/domain/valueObjects/GeoPolygon';
import { CoordinateTransform } from '../../../lib/spatial-coverage/domain/services/CoordinateTransform';

interface VoxelData {
    worldX: number;
    worldY: number;
    visitCount?: number;
    elevation?: number;
}

interface WalkingCoverageOverlayProps {
    boundary: GeoPolygon | null;
    currentPosition: { lat: number; lon: number } | null;
    voxels: VoxelData[];
    isInsideBoundary: boolean;
    coveragePercent: number;
    stepCount?: number;
    gpsAccuracy?: number;
    size?: number;
}

/**
 * WalkingCoverageOverlay - Tactical mini-map with heatmap visualization.
 */
export function WalkingCoverageOverlay({
    boundary,
    currentPosition,
    voxels,
    isInsideBoundary,
    coveragePercent,
    stepCount = 0,
    gpsAccuracy = 0,
    size = 200
}: WalkingCoverageOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        const poly = GeoPolygon.ensureInstance(boundary);
        if (!ctx || !poly) return;

        const bounds = poly.getBounds();
        const origin = poly.getCentroid();

        // Calculate viewport
        const rangeX = (bounds.maxLon - bounds.minLon) * 111320 * Math.cos(origin.lat * Math.PI / 180);
        const rangeY = (bounds.maxLat - bounds.minLat) * 111320;
        const padding = 0.25;
        const maxRange = Math.max(rangeX, rangeY);

        // Guard against division by zero for degenerate polygons
        const scale = maxRange > 0.0001
            ? (size / maxRange) * (1 - padding)
            : 1;

        const offsetX = size / 2;
        const offsetY = size / 2;

        const project = (lat: number, lon: number) => {
            const dx = (lon - origin.lon) * 111320 * Math.cos(origin.lat * Math.PI / 180);
            const dy = (lat - origin.lat) * 111320;
            return {
                x: dx * scale + offsetX,
                y: -dy * scale + offsetY
            };
        };

        // Clear with tactical dark background
        ctx.fillStyle = '#0f172a'; // Slate-900
        ctx.fillRect(0, 0, size, size);

        // Draw Grid
        ctx.strokeStyle = '#1e293b'; // Slate-800
        ctx.lineWidth = 1;
        const gridStep = scale * 10; // 10m grid
        for (let x = offsetX % gridStep; x < size; x += gridStep) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
        }
        for (let y = offsetY % gridStep; y < size; y += gridStep) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
        }

        // Draw boundary polygon
        const vertices = poly.vertices;
        if (vertices.length >= 3) {
            ctx.beginPath();
            vertices.forEach((v, i) => {
                const p = project(v.lat, v.lon);
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw heatmap voxels with glow
        voxels.forEach(v => {
            const p = project(
                origin.lat + v.worldY / 111320,
                origin.lon + v.worldX / (111320 * Math.cos(origin.lat * Math.PI / 180))
            );
            const voxelScreenSize = Math.max(4, scale * 0.6);

            const intensity = Math.min((v.visitCount || 1) / 5, 1);
            const color = getHeatmapColor(intensity);

            ctx.shadowBlur = 4;
            ctx.shadowColor = color;
            ctx.fillStyle = color;
            ctx.fillRect(p.x - voxelScreenSize / 2, p.y - voxelScreenSize / 2, voxelScreenSize, voxelScreenSize);
        });
        ctx.shadowBlur = 0;

        // Draw current position (Clamped to Frame)
        if (currentPosition) {
            const rawP = project(currentPosition.lat, currentPosition.lon);

            // CLAMPING: Ensure dot is always visible within the box
            const margin = 12;
            const p = {
                x: Math.max(margin, Math.min(size - margin, rawP.x)),
                y: Math.max(margin, Math.min(size - margin, rawP.y))
            };

            // Pulse effect for accuracy
            const time = Date.now() / 1000;
            const pulse = 1 + Math.sin(time * 4) * 0.2;
            const accuracyRadius = Math.max(6, gpsAccuracy * scale * 0.1) * pulse;

            ctx.beginPath();
            ctx.arc(p.x, p.y, accuracyRadius, 0, Math.PI * 2);
            ctx.fillStyle = isInsideBoundary ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            ctx.fill();

            // Dot
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = isInsideBoundary ? '#10b981' : '#ef4444';
            ctx.fill();

            // White ring for visibility
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // If clamped, draw a small pointer towards the actual off-canvas position
            if (rawP.x < 0 || rawP.x > size || rawP.y < 0 || rawP.y > size) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                const angle = Math.atan2(rawP.y - p.y, rawP.x - p.x);
                ctx.lineTo(p.x + Math.cos(angle) * 8, p.y + Math.sin(angle) * 8);
                ctx.strokeStyle = '#ef4444';
                ctx.stroke();
            }
        }

        // Draw Frame (The "Red Square Box")
        ctx.strokeStyle = isInsideBoundary ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, size - 4, size - 4);

        if (!isInsideBoundary) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
            ctx.fillRect(0, 0, size, size);
        }

        // DRAW PLANNED ANCHORS (Vertices from Screen 1)
        const polyVertices = (boundary as any)._vertices || [];
        polyVertices.forEach((v: any, i: number) => {
            const pv = project(v.lat, v.lon);
            const isNear = currentPosition &&
                CoordinateTransform.haversineDistance(currentPosition, v) < 3;

            // Anchor Spot
            ctx.beginPath();
            ctx.arc(pv.x, pv.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = isNear ? '#34d399' : '#fff';
            ctx.fill();

            // Marker ID
            ctx.fillStyle = isNear ? '#34d399' : 'rgba(255,255,255,0.4)';
            ctx.font = '8px Inter, sans-serif';
            ctx.fillText((i + 1).toString(), pv.x + 6, pv.y + 3);

            if (isNear) {
                ctx.strokeStyle = '#34d399';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(pv.x, pv.y, 8, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

    }, [boundary, currentPosition, voxels, isInsideBoundary, gpsAccuracy, size]);

    if (!boundary) return null;

    return (
        <div className="absolute bottom-28 right-6 z-[100] pointer-events-none" data-testid="walking-coverage-overlay">
            <div className="bg-slate-900/90 backdrop-blur-xl rounded-[2rem] p-4 border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 mb-4">
                    <ProgressCircle percent={coveragePercent} />
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl text-white font-black leading-none">{coveragePercent.toFixed(0)}</span>
                            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">%</span>
                        </div>
                        <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Sensing Complete</span>
                    </div>
                </div>

                {/* Canvas Container with Inner Shadow */}
                <div className="relative rounded-2xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border border-white/5">
                    <canvas
                        ref={canvasRef}
                        width={size}
                        height={size}
                        className="block"
                        data-testid="walking-coverage-canvas"
                    />
                </div>

                {/* Tactical Stats & Legend */}
                <div className="flex flex-col gap-3 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                            <div className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">Precision</div>
                            <div className="text-[11px] text-white font-mono">±{gpsAccuracy.toFixed(1)}m</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                            <div className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">Locomotion</div>
                            <div className="text-[11px] text-white font-mono">{stepCount} <span className="text-[8px] text-slate-500">STS</span></div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#FFE600] ring-4 ring-[#FFE600]/10" />
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">Segment</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-tight">Verified</span>
                        </div>
                    </div>
                </div>

                {/* Warning Overlay */}
                {!isInsideBoundary && currentPosition && (
                    <div className="mt-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-[9px] text-red-400 font-black text-center uppercase animate-pulse">
                            Out of Bounds Exception
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ProgressCircle({ percent }: { percent: number }) {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <div className="relative w-12 h-12 flex items-center justify-center">
            <svg width="48" height="48" className="-rotate-90">
                <circle
                    cx="24" cy="24" r={radius}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="5"
                />
                <circle
                    cx="24" cy="24" r={radius}
                    fill="transparent"
                    stroke="url(#progressGradient)"
                    strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
                <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                </defs>
            </svg>
            <div className={`absolute w-1.5 h-1.5 rounded-full bg-emerald-500 ${percent < 100 ? 'animate-ping' : ''}`} />
        </div>
    );
}

function getHeatmapColor(intensity: number): string {
    // Yellow (255, 230, 0) → Emerald (16, 185, 129)
    const r = Math.round(255 - intensity * (255 - 16));
    const g = Math.round(230 + intensity * (185 - 230));
    const b = Math.round(0 + intensity * 129);
    return `rgb(${r}, ${g}, ${b})`;
}
