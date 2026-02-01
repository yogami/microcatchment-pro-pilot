
import { describe, it, expect } from '@jest/globals';
import { VIAPEngine } from '../../src/lib/spatial-coverage/domain/services/VIAPEngine';

describe('VIAPEngine (Visual-Inertial Anchor Protocol)', () => {
    it('should correctly solve for scale and rotation using the Umeyama/Sim3 algorithm', () => {
        // 1. Ground Truth points (The "Ideal" Bedroom corners)
        const groundTruth = [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
            { x: 0, y: 2 }
        ];

        // 2. Drifting Inertial points (Simulated 10% scale error and 5 deg rotation)
        const s_ideal = 1.1;
        const theta_ideal = 0.087; // ~5 degrees
        const t_ideal = { x: 0.5, y: -0.3 };

        const cos = Math.cos(theta_ideal);
        const sin = Math.sin(theta_ideal);

        const inertial = groundTruth.map(p => ({
            x: (p.x * cos - p.y * sin) * s_ideal + t_ideal.x,
            y: (p.x * sin + p.y * cos) * s_ideal + t_ideal.y
        }));

        // 3. RUN THE ENGINE
        // Alignment from Inertial (Source) to GroundTruth (Target)
        const result = VIAPEngine.solveAlignment(inertial, groundTruth);

        // Note: The solveAlignment finds the transform to go FROM source TO target.
        // Our 'simulated' transform was FROM target TO source.
        // So the detected scale should be 1/1.1 and rotation should be -0.087.
        expect(result.scale).toBeCloseTo(1 / s_ideal, 5);
        expect(result.rotation).toBeCloseTo(-theta_ideal, 5);
    });

    it('should detect "Visual Stasis" (ZUPT 2.0) based on optical flow and gyro variance', () => {
        // Scenario 1: Still (Both agree)
        expect(VIAPEngine.detectStasis([{ dx: 0.1, dy: 0.1 }], 0.01, 0.01)).toBe(true);

        // Scenario 2: Camera says still, but IMU says moving (e.g. featureless floor drift)
        expect(VIAPEngine.detectStasis([{ dx: 0.1, dy: 0.1 }], 0.5, 0.5)).toBe(false);

        // Scenario 3: IMU says still, but Camera says moving (e.g. handheld rotation but still translation)
        expect(VIAPEngine.detectStasis([{ dx: 5.0, dy: 2.0 }], 0.01, 0.01)).toBe(false);
    });
});
