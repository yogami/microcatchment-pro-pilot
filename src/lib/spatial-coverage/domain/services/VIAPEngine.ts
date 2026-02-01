
export interface Point2D {
    x: number;
    y: number;
}

export interface AlignmentResult {
    scale: number;
    rotation: number;
    translation: Point2D;
}

/**
 * VIAPEngine (Visual-Inertial Anchor Protocol)
 * The "Brain" of the V3 High-Veracity spatial auditor.
 */
export class VIAPEngine {
    /**
     * ZUPT 2.0 (Dual-Gate Stasis Detection)
     * Prevents drift by confirming stillness across Vision and Inertial channels.
     */
    static detectStasis(
        flowDisplacement: { dx: number; dy: number }[],
        gyroMagnitude: number,
        accelVariance: number,
        thresholds = { flow: 0.5, gyro: 0.08, accel: 0.02 }
    ): boolean {
        const avgFlow = flowDisplacement.length > 0
            ? flowDisplacement.reduce((acc, f) => acc + Math.sqrt(f.dx ** 2 + f.dy ** 2), 0) / flowDisplacement.length
            : 0;

        // Both vision and inertial must agree for a "Hard Reset"
        const visionStill = avgFlow < thresholds.flow;
        const inertialStill = gyroMagnitude < thresholds.gyro && accelVariance < thresholds.accel;

        return visionStill && inertialStill;
    }

    /**
     * solveAlignment (Umeyama/Sim3 Lite)
     * Finds the best Scale (s), Rotation (r), and Translation (t) to align
     * an IMU-tracked path (source) to Snap-Point anchors (target).
     */
    static solveAlignment(source: Point2D[], target: Point2D[]): AlignmentResult {
        if (source.length !== target.length || source.length < 2) {
            throw new Error("Alignment requires at least 2 points.");
        }

        // 1. Centering
        const centerSource = this.getCentroid(source);
        const centerTarget = this.getCentroid(target);

        const sNorm = source.map(p => ({ x: p.x - centerSource.x, y: p.y - centerSource.y }));
        const tNorm = target.map(p => ({ x: p.x - centerTarget.x, y: p.y - centerTarget.y }));

        // 2. Compute Covariance / Correlation
        let s_xx = 0, s_xy = 0, s_yx = 0, s_yy = 0;
        for (let i = 0; i < sNorm.length; i++) {
            s_xx += sNorm[i].x * tNorm[i].x;
            s_xy += sNorm[i].x * tNorm[i].y;
            s_yx += sNorm[i].y * tNorm[i].x;
            s_yy += sNorm[i].y * tNorm[i].y;
        }

        // 3. Solve for Rotation (SVD equivalent for 2D)
        const rotation = Math.atan2(s_xy - s_yx, s_xx + s_yy);

        // 4. Solve for Scale
        let varSource = sNorm.reduce((acc, p) => acc + (p.x ** 2 + p.y ** 2), 0);
        let cov = (s_xx + s_yy) * Math.cos(rotation) + (s_xy - s_yx) * Math.sin(rotation);
        const scale = cov / varSource;

        // 5. Solve for Translation
        // target = scale * R * source + translation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        // Rotate and scale the centered source
        const rotatedTranslatedSource = {
            x: (centerSource.x * cos - centerSource.y * sin) * scale,
            y: (centerSource.x * sin + centerSource.y * cos) * scale
        };

        const translation = {
            x: centerTarget.x - rotatedTranslatedSource.x,
            y: centerTarget.y - rotatedTranslatedSource.y
        };

        return { scale, rotation, translation };
    }

    private static getCentroid(points: Point2D[]): Point2D {
        const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }
}
