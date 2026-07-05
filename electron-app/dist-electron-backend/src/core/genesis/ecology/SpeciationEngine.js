// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA IV: Speciation Engine
// ═══════════════════════════════════════════════════════════════════════════
//  Lightweight clustering on bezier_signature (Float32Array) to group
//  structurally similar organisms under a shared species_id.
//
//  Algorithm: Simplified K-means with K ∈ [3, 12], auto-tuned by population.
//  Distance: Euclidean on the 128-float bezier signature.
//
//  Anti-mode-collapse: species diversity is the first line of defense
//  against the entire ecosystem converging to one effect.
//
//  Runs in background (geological time). Never in the 44Hz hot path.
// ═══════════════════════════════════════════════════════════════════════════
import { getGenesisVault } from '../GenesisVaultService';
// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const SIGNATURE_LENGTH = 128;
const MIN_K = 3;
const MAX_K = 12;
const MAX_ITERATIONS = 20;
const CONVERGENCE_THRESHOLD = 0.001;
// ─── DISTANCE ───────────────────────────────────────────────────────────────
function euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < SIGNATURE_LENGTH; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
/**
 * Runs K-means clustering on the given signatures.
 * K is auto-tuned: sqrt(N/2) clamped to [3, 12].
 */
function kMeans(signatures, k) {
    const n = signatures.length;
    if (n === 0)
        return { centroids: [], assignments: [] };
    if (n <= k) {
        // Each organism is its own cluster
        return {
            centroids: signatures.map((s) => new Float32Array(s)),
            assignments: signatures.map((_, i) => i),
        };
    }
    // Initialize centroids: pick k evenly spaced organisms (k-means++ lite)
    const centroids = [];
    const step = Math.floor(n / k);
    for (let i = 0; i < k; i++) {
        centroids.push(new Float32Array(signatures[i * step]));
    }
    let assignments = new Array(n).fill(0);
    let converged = false;
    for (let iter = 0; iter < MAX_ITERATIONS && !converged; iter++) {
        // Assignment step
        const newAssignments = new Array(n);
        for (let i = 0; i < n; i++) {
            let bestCluster = 0;
            let bestDist = Infinity;
            for (let c = 0; c < k; c++) {
                const d = euclideanDistance(signatures[i], centroids[c]);
                if (d < bestDist) {
                    bestDist = d;
                    bestCluster = c;
                }
            }
            newAssignments[i] = bestCluster;
        }
        // Check convergence
        let changes = 0;
        for (let i = 0; i < n; i++) {
            if (newAssignments[i] !== assignments[i])
                changes++;
        }
        assignments = newAssignments;
        if (changes / n < CONVERGENCE_THRESHOLD) {
            converged = true;
        }
        // Update step — recompute centroids
        for (let c = 0; c < k; c++) {
            const acc = new Float32Array(SIGNATURE_LENGTH);
            let count = 0;
            for (let i = 0; i < n; i++) {
                if (assignments[i] === c) {
                    for (let j = 0; j < SIGNATURE_LENGTH; j++) {
                        acc[j] += signatures[i][j];
                    }
                    count++;
                }
            }
            if (count > 0) {
                for (let j = 0; j < SIGNATURE_LENGTH; j++) {
                    centroids[c][j] = acc[j] / count;
                }
            }
            // If count === 0, keep the old centroid (empty cluster)
        }
    }
    return { centroids, assignments };
}
/**
 * Auto-tunes K based on population size.
 * K = clamp(round(sqrt(N / 2)), 3, 12)
 */
function autoK(n) {
    if (n === 0)
        return MIN_K;
    return Math.max(MIN_K, Math.min(MAX_K, Math.round(Math.sqrt(n / 2))));
}
// ─── SPECIATION ENGINE ──────────────────────────────────────────────────────
export class SpeciationEngine {
    constructor(vault) {
        this._vault = vault ?? getGenesisVault();
    }
    /**
     * Runs speciation on all alive + champion organisms.
     * Reads bezier_signature BLOBs, clusters them, and writes species_id back to DB.
     *
     * Species IDs are deterministic: `species_<cluster_idx>` (e.g. "species_0", "species_1").
     * Organisms that are alone in their cluster get a singleton species.
     */
    runSpeciation() {
        const db = this._vault._db;
        if (!db) {
            throw new Error('[Speciation] GenesisVault not initialized');
        }
        // 1. Fetch all alive + champion organisms with their signatures
        const rows = db.prepare(`SELECT organism_id, bezier_signature, species_id
       FROM lfx_organisms
       WHERE status IN ('alive', 'champion')
       ORDER BY organism_id`).all();
        if (rows.length === 0) {
            return {
                totalOrganisms: 0,
                speciesCount: 0,
                assignments: [],
                speciesSizes: new Map(),
            };
        }
        // 2. Decode BLOBs to Float32Array
        const organisms = rows.map((row) => ({
            organismId: row.organism_id,
            signature: new Float32Array(row.bezier_signature.buffer, row.bezier_signature.byteOffset, Math.min(row.bezier_signature.byteLength / 4, SIGNATURE_LENGTH)),
            speciesId: row.species_id,
        }));
        // 3. Run K-means
        const k = autoK(organisms.length);
        const signatures = organisms.map((o) => o.signature);
        const { assignments } = kMeans(signatures, k);
        // 4. Generate species IDs and batch update
        const updateStmt = db.prepare('UPDATE lfx_organisms SET species_id = @species WHERE organism_id = @id');
        const speciesSizes = new Map();
        const assignmentRecords = [];
        const tx = db.transaction(() => {
            for (let i = 0; i < organisms.length; i++) {
                const speciesId = `species_${assignments[i]}`;
                updateStmt.run({ species: speciesId, id: organisms[i].organismId });
                assignmentRecords.push({ organismId: organisms[i].organismId, speciesId });
                speciesSizes.set(speciesId, (speciesSizes.get(speciesId) ?? 0) + 1);
            }
        });
        tx();
        const speciesCount = speciesSizes.size;
        console.log(`[Speciation 🧬] Clustered ${organisms.length} organisms into ${speciesCount} species ` +
            `(K=${k}, iterations≤${MAX_ITERATIONS})`);
        return {
            totalOrganisms: organisms.length,
            speciesCount,
            assignments: assignmentRecords,
            speciesSizes,
        };
    }
}
// ─── SINGLETON ──────────────────────────────────────────────────────────────
let _instance = null;
export function getSpeciationEngine() {
    if (_instance == null)
        _instance = new SpeciationEngine();
    return _instance;
}
export function __resetSpeciationEngineForTests() {
    _instance = null;
}
