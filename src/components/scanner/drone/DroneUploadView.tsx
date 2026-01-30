/**
 * DroneUploadView - Parallel track for processing drone media.
 * 
 * Allows users to upload drone photos/video for server-side reconstruction.
 * Simulates SfM (Structure from Motion) processing in this prototype.
 * 
 * CC ≤ 3, Method length ≤ 30 lines.
 */

import { useState, useCallback } from 'react';
import { useARScanner } from '../../../hooks/useARScanner';
import { ElevationGrid } from '../../../lib/spatial-coverage';

export function DroneUploadView({ scanner }: { scanner: ReturnType<typeof useARScanner> }) {
    const [files, setFiles] = useState<File[]>([]);
    const [isReconstructing, setIsReconstructing] = useState(false);
    const [progress, setProgress] = useState(0);

    const onFinish = useCallback(() => {
        // Create a mock grid to enable export features during drone prototype testing
        const grid = new ElevationGrid(1.0); // 1m resolution for macro drone results
        grid.addSample({ x: 0, y: 0, elevation: 0.1, accuracy: 0.5, source: 'lidar', timestamp: Date.now() });
        grid.addSample({ x: 5, y: 5, elevation: 0.5, accuracy: 0.5, source: 'lidar', timestamp: Date.now() });
        grid.addSample({ x: -5, y: -5, elevation: -0.2, accuracy: 0.5, source: 'lidar', timestamp: Date.now() });

        // Simulate a completed reconstruction result
        scanner.update({
            detectedArea: 250.5,
            elevationGrid: grid,
            scanPhase: 'scanning',
            isLocked: true,
            scanProgress: 0
        });
    }, [scanner]);

    const handleReconstruct = () => {
        setIsReconstructing(true);
        let p = 0;
        const iv = setInterval(() => {
            p += 5;
            setProgress(p);
            if (p >= 100) {
                clearInterval(iv);
                onFinish();
            }
        }, 150);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
            <h2 className="text-2xl font-bold mb-2 text-white">🚁 Drone Media Upload</h2>
            <p className="text-gray-400 mb-8 max-w-xs text-sm">
                Upload drone photos or video to generate a high-resolution 3D terrain model.
            </p>

            {!isReconstructing && progress !== 100 && (
                <UploadArea files={files} setFiles={setFiles} onProcess={handleReconstruct} />
            )}

            {isReconstructing && (
                <ReconstructionProgress progress={progress} />
            )}

            {!isReconstructing && progress === 100 && (
                <div className="mt-8 animate-in fade-in zoom-in duration-500">
                    <ROIDashboard />
                </div>
            )}

            <button
                onClick={() => scanner.update({ scanPhase: 'onboarding' })}
                className="mt-8 text-gray-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
            >
                ← Back to AR Scanner
            </button>
        </div>
    );
}

function ROIDashboard() {
    return (
        <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-2xl p-6 backdrop-blur-md max-w-sm w-full mx-auto shadow-2xl shadow-emerald-900/50">
            <div className="flex items-center justify-between mb-4 border-b border-emerald-500/20 pb-4">
                <div className="text-left">
                    <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Efficiency Gain</p>
                    <p className="text-3xl font-black text-white">4.5 Hrs</p>
                </div>
                <div className="text-right">
                    <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Billable Value</p>
                    <p className="text-3xl font-black text-emerald-400">$675</p>
                </div>
            </div>

            <div className="flex gap-2 items-center justify-center bg-black/40 rounded-lg p-2 mb-2">
                <span className="text-xl">🏛️</span>
                <span className="text-xs font-medium text-gray-300">Grant Eligibility: <span className="text-white font-bold">VADEQ-SLAF</span></span>
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded ml-1">MATCH 98%</span>
            </div>

            <p className="text-[10px] text-gray-500 italic mt-2">
                *Based on standard civil engineering scoping rates ($150/hr).
            </p>
            <div className="mt-4 border-t border-emerald-500/20 pt-2">
                <p className="text-[8px] text-red-400 uppercase font-bold tracking-widest text-center">
                    ⚠️ Preliminary Scoping Only. Not for Final Design or Stamping.
                </p>
            </div>
        </div>
    );
}

function ReconstructionProgress({ progress }: { progress: number }) {
    return (
        <div className="w-full max-w-sm">
            <div className="bg-gray-800 h-2 w-full rounded-full overflow-hidden mb-4 border border-white/5">
                <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest animate-pulse">
                {progress < 40 ? 'Connecting to Python PDAL Worker...' : progress < 80 ? 'Classifying Ground Points (SMRF)...' : 'Generating Grant Report...'}
            </p>
        </div>
    );
}
