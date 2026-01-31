import { useState, useEffect } from 'react';

export interface NadirAlignment {
    pitch: number;    // Beta: -180 to 180
    roll: number;     // Gamma: -90 to 90
    isAligned: boolean;
    deviationX: number; // For Spirit Level UI (Normalized -1 to 1)
    deviationY: number; // For Spirit Level UI (Normalized -1 to 1)
}

/**
 * useNadirAlignment - Tracks if the phone is parallel to the ground (pointing down).
 * 
 * Perfect Nadir is:
 * - Beta (Pitch): 180 or -180
 * - Gamma (Roll): 0
 */
export function useNadirAlignment(tolerance = 5) {
    const [alignment, setAlignment] = useState<NadirAlignment>({
        pitch: 0,
        roll: 0,
        isAligned: false,
        deviationX: 0,
        deviationY: 0
    });

    useEffect(() => {
        const handleOrientation = (event: DeviceOrientationEvent) => {
            const { beta, gamma } = event;
            if (beta === null || gamma === null) return;

            // Normalize Beta to 180 center (it can jump between 180 and -180)
            const normalizedBeta = Math.abs(beta);
            const pitchDiff = Math.abs(180 - normalizedBeta);
            const rollDiff = Math.abs(gamma);

            const isAligned = pitchDiff <= tolerance && rollDiff <= tolerance;

            // Calculate deviation for UI (-1 to 1 scale)
            // Clamp to a sensible range (e.g. 15 degrees)
            const uiRange = 15;
            const devY = (180 - normalizedBeta) / uiRange;
            const devX = gamma / uiRange;

            setAlignment({
                pitch: beta,
                roll: gamma,
                isAligned,
                deviationX: Math.max(-1, Math.min(1, devX)),
                deviationY: Math.max(-1, Math.min(1, devY))
            });
        };

        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
    }, [tolerance]);

    return alignment;
}
