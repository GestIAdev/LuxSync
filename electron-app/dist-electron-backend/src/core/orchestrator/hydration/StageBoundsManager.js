/**
 * WAVE 4960.1 PHASE 5c — StageBoundsManager
 * Extracted from TitanOrchestrator.ts (~lines 3241-3278).
 *
 * Owns: _updateAetherStageBounds() — spatial calculation that updates
 * the Aether stage bounds and propagates dimensions to PhysicsPostProcessor.
 */
export class StageBoundsManager {
    constructor(bounds, physicsPostProcessor) {
        this.bounds = bounds;
        this.physicsPostProcessor = physicsPostProcessor;
    }
    /**
     * Update stage bounds from input and fixture positions.
     * Also propagates dimensions to PhysicsPostProcessor for spatial inertia scaling.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateStageBounds(stageBounds, fixtures) {
        const bounds = this.bounds;
        console.log(`[STAGE-BOUNDS] input=(${stageBounds?.width?.toFixed(2) ?? 'N/A'},${stageBounds?.height?.toFixed(2) ?? 'N/A'},${stageBounds?.depth?.toFixed(2) ?? 'N/A'}) ` +
            `current=(${bounds.width.toFixed(2)},${bounds.height.toFixed(2)},${bounds.depth.toFixed(2)})`);
        if (stageBounds) {
            if (stageBounds.width !== undefined && Number.isFinite(stageBounds.width) && stageBounds.width > 0) {
                bounds.width = stageBounds.width;
            }
            if (stageBounds.height !== undefined && Number.isFinite(stageBounds.height) && stageBounds.height > 0) {
                bounds.height = stageBounds.height;
            }
            if (stageBounds.depth !== undefined && Number.isFinite(stageBounds.depth) && stageBounds.depth > 0) {
                bounds.depth = stageBounds.depth;
            }
        }
        let sumY = 0;
        let count = 0;
        for (const fixture of fixtures) {
            const y = fixture?.position?.y;
            if (typeof y === 'number' && Number.isFinite(y)) {
                sumY += y;
                count++;
            }
        }
        const avgY = count > 0 ? (sumY / count) : bounds.height * 0.5;
        bounds.centerY = Math.max(0, Math.min(bounds.height, avgY));
        this.physicsPostProcessor.setStageBounds(bounds.width, bounds.height, bounds.depth);
    }
}
