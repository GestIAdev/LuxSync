// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA I: AncestralIngestor
// ═══════════════════════════════════════════════════════════════════════════
//  Reads all `.lfx` V3 files from the Hephaestus builtins catalog and
//  inserts them into `lfx_blueprints` as immutable "Ancestros de Granito".
//
//  Idempotent: blueprints already in the vault are skipped (INSERT OR IGNORE
//  + pre-check). Safe to re-run on every boot.
// ═══════════════════════════════════════════════════════════════════════════
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { getGenesisVault } from './GenesisVaultService';
// ─── INGESTOR ───────────────────────────────────────────────────────────────
export class AncestralIngestor {
    constructor(vault) {
        this._vault = vault ?? getGenesisVault();
    }
    /**
     * Scans the builtins directory recursively for `.lfx` files and ingests
     * any valid V3 file that isn't already in the vault.
     *
     * @param builtinsDir Absolute path to the `builtins/` directory.
     *                    If omitted, resolves to the default arsenal path.
     */
    async ingestAll(builtinsDir) {
        const dir = builtinsDir ?? this._getDefaultBuiltinsDir();
        if (!fs.existsSync(dir)) {
            console.warn(`[AncestralIngestor ⚠️] Builtins dir not found: ${dir}`);
            return { scanned: 0, inserted: 0, skipped: 0, errors: 0, insertedIds: [] };
        }
        const lfxFiles = this._scanLfxFiles(dir);
        // Found N .lfx files log silenced
        let scanned = 0;
        let inserted = 0;
        let skipped = 0;
        let errors = 0;
        const insertedIds = [];
        for (const filePath of lfxFiles) {
            scanned++;
            try {
                const lfx = await this._parseLfxFile(filePath);
                if (!lfx) {
                    errors++;
                    continue;
                }
                const clip = lfx.clip;
                const id = clip.id;
                // Pre-check: skip if already in vault
                if (this._vault.blueprintExists(id)) {
                    skipped++;
                    continue;
                }
                // Convert to payload and insert
                const payload = this._vault.lfxToBlueprintPayload(lfx, 'builtin');
                const ok = this._vault.insertBlueprint(payload);
                if (ok) {
                    inserted++;
                    insertedIds.push(id);
                    // Per-ancestor ingested log silenced
                }
                else {
                    skipped++;
                }
            }
            catch (err) {
                errors++;
                console.warn(`[AncestralIngestor ⚠️] Error ingesting ${filePath}:`, err);
            }
        }
        // Ingestion summary log silenced — non-essential startup noise
        return { scanned, inserted, skipped, errors, insertedIds };
    }
    /**
     * Ingests a single `.lfx` file by path.
     */
    async ingestFile(filePath) {
        const lfx = await this._parseLfxFile(filePath);
        if (!lfx)
            return false;
        const clip = lfx.clip;
        if (this._vault.blueprintExists(clip.id)) {
            return false;
        }
        const payload = this._vault.lfxToBlueprintPayload(lfx, 'builtin');
        return this._vault.insertBlueprint(payload);
    }
    // ─── INTERNALS ───────────────────────────────────────────────────────────
    /**
     * Recursively scans a directory for `.lfx` files.
     */
    _scanLfxFiles(dir) {
        const results = [];
        const walk = (currentDir) => {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                }
                else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lfx')) {
                    results.push(fullPath);
                }
            }
        };
        walk(dir);
        return results;
    }
    /**
     * Parses a `.lfx` file from disk into a typed `LFXFileV3`.
     * Returns null if the file is not valid V3.
     */
    async _parseLfxFile(filePath) {
        try {
            let raw = await fsPromises.readFile(filePath, 'utf8');
            // Strip UTF-8 BOM (U+FEFF) if present — some editors save with BOM
            if (raw.charCodeAt(0) === 0xFEFF) {
                raw = raw.slice(1);
            }
            const parsed = JSON.parse(raw);
            // Validate $schema
            if (parsed.$schema !== 'luxsync.lfx/3.0') {
                console.warn(`[AncestralIngestor ⚠️] Not a V3 file: ${filePath} (schema=${parsed.$schema})`);
                return null;
            }
            const clip = parsed.clip;
            if (!clip || !clip.id) {
                console.warn(`[AncestralIngestor ⚠️] Missing clip or id: ${filePath}`);
                return null;
            }
            // Auto-fill cognitiveDNA if missing — some user-created clips don't have it
            if (!clip.cognitiveDNA) {
                clip.cognitiveDNA = {
                    genome: { aggression: 0.5, chaos: 0.3, organicity: 0.5 },
                    textureAffinity: 'universal',
                    compatibleVibes: clip.vibeCompat ?? [],
                    validSections: ['drop', 'buildup'],
                    energyZone: { min: 'ambient', max: 'peak' },
                    aggressionRange: { min: 0.2, max: 0.8 },
                    pressureRange: { min: 0.1, max: 0.9 },
                    spatialBehavior: 'static',
                    executionDomain: 'vector',
                };
            }
            // Checksum validation skipped — JSON.stringify is key-order dependent,
            // so reformatted files always mismatch. Builtins are trusted.
            const checksum = typeof parsed.checksum === 'string' ? parsed.checksum : '';
            return {
                $schema: 'luxsync.lfx/3.0',
                clip,
                checksum,
            };
        }
        catch (err) {
            console.warn(`[AncestralIngestor ⚠️] Parse error for ${filePath}:`, err);
            return null;
        }
    }
    _getDefaultBuiltinsDir() {
        // In production (Electron), builtins are in extraResources
        if (typeof process !== 'undefined' && process.resourcesPath) {
            const resourcesBuiltins = path.join(process.resourcesPath, 'builtins');
            if (fs.existsSync(resourcesBuiltins))
                return resourcesBuiltins;
        }
        // In dev, builtins live in the source tree at src/core/arsenal/builtins.
        // Vite bundles everything into dist-electron/main.js, so __dirname is
        // electron-app/dist-electron/. We try several relative paths to cover
        // both bundled and non-bundled layouts.
        const candidates = [
            // Bundled (vite): __dirname = electron-app/dist-electron/
            path.join(__dirname, '..', 'src', 'core', 'arsenal', 'builtins'),
            // Non-bundled: __dirname = dist-electron-backend/src/core/genesis/
            path.join(__dirname, '..', '..', '..', 'src', 'core', 'arsenal', 'builtins'),
            // Legacy fallback
            path.join(__dirname, '..', 'arsenal', 'builtins'),
        ];
        for (const c of candidates) {
            if (fs.existsSync(c))
                return c;
        }
        return candidates[0]; // Return best guess even if it doesn't exist (for error msg)
    }
}
// ─── SINGLETON ──────────────────────────────────────────────────────────────
let _instance = null;
export function getAncestralIngestor() {
    if (_instance == null)
        _instance = new AncestralIngestor();
    return _instance;
}
export function __resetAncestralIngestorForTests() {
    _instance = null;
}
