/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.4 — Liquid Telemetry Bridge & Black Box
 *
 * Caja Negra — Ring buffer pre-asignado de 2700 frames (~60s @ 44Hz).
 * Zero-allocation en hot path. Dump a JSONL para análisis offline (Monte Carlo).
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §12
 */
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
// ═══════════════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════════════
/** Tamaño del ring buffer — 2700 frames ≈ 60s @ 44Hz */
const BUFFER_SIZE = 2700;
// ═══════════════════════════════════════════════════════════════════════════
// Recorder — ring buffer zero-alloc
// ═══════════════════════════════════════════════════════════════════════════
export class LiquidTelemetryRecorder {
    constructor() {
        // Ring buffer pre-asignado — Float64Array para máxima eficiencia de cache
        this._timestamps = new Float64Array(BUFFER_SIZE);
        this._ignite = new Uint8Array(BUFFER_SIZE);
        this._confidence = new Float64Array(BUFFER_SIZE);
        this._squelch = new Float64Array(BUFFER_SIZE);
        this._intensity = new Float64Array(BUFFER_SIZE);
        this._epicness = new Float64Array(BUFFER_SIZE);
        this._tension = new Float64Array(BUFFER_SIZE);
        this._viscosity = new Float64Array(BUFFER_SIZE);
        this._vaporPressure = new Float64Array(BUFFER_SIZE);
        this._excitability = new Float64Array(BUFFER_SIZE);
        this._temperature = new Float64Array(BUFFER_SIZE);
        this._impact = new Float64Array(BUFFER_SIZE);
        this._crestFactor = new Float64Array(BUFFER_SIZE);
        this._s_DNA = new Float64Array(BUFFER_SIZE);
        this._s_Z = new Float64Array(BUFFER_SIZE);
        this._s_E = new Float64Array(BUFFER_SIZE);
        this._s_V = new Float64Array(BUFFER_SIZE);
        this._s_X = new Float64Array(BUFFER_SIZE);
        this._s_P = new Float64Array(BUFFER_SIZE);
        this._s_B = new Float64Array(BUFFER_SIZE);
        // WAVE 8008: Rhythmic percussion energies
        this._snare_energy = new Float64Array(BUFFER_SIZE);
        this._hh_energy = new Float64Array(BUFFER_SIZE);
        this._head = 0;
        this._count = 0;
        this._totalRecorded = 0;
        /**
         * Snapshot del último frame grabado (para telemetría en tiempo real).
         * Zero-alloc — devuelve primitivos empaquetados en un objeto pre-asignado.
         */
        this._lastFrameSnapshot = {
            timestamp: 0, ignite: false, confidence: 0, squelch: 0, intensity: 0,
            epicness: 0, tension: 0, viscosity: 0, vaporPressure: 0, excitability: 0,
            temperature: 0, impact: 0, crestFactor: 0,
            s_DNA: 0, s_Z: 0, s_E: 0, s_V: 0, s_X: 0, s_P: 0, s_B: 0,
            snare_energy: 0, hh_energy: 0,
        };
    }
    /**
     * Graba un frame del LiquidVerdict en el ring buffer.
     * Hot path 44Hz — zero-alloc, solo escritura de primitivos en arrays tipados.
     */
    recordFrame(verdict, now, snareEnergy, hhEnergy) {
        const idx = this._head;
        this._timestamps[idx] = now;
        this._ignite[idx] = verdict.ignite ? 1 : 0;
        this._confidence[idx] = verdict.confidence;
        this._squelch[idx] = verdict.squelch;
        this._intensity[idx] = verdict.intensity;
        this._epicness[idx] = verdict.epicness;
        this._tension[idx] = verdict.fluid.tension;
        this._viscosity[idx] = verdict.fluid.viscosity;
        this._vaporPressure[idx] = verdict.fluid.vaporPressure;
        this._excitability[idx] = verdict.fluid.excitability;
        this._temperature[idx] = verdict.fluid.temperature;
        this._impact[idx] = verdict.fluid.impact;
        this._crestFactor[idx] = verdict.fluid.crestFactor;
        this._s_DNA[idx] = verdict.sensors.s_DNA;
        this._s_Z[idx] = verdict.sensors.s_Z;
        this._s_E[idx] = verdict.sensors.s_E;
        this._s_V[idx] = verdict.sensors.s_V;
        this._s_X[idx] = verdict.sensors.s_X;
        this._s_P[idx] = verdict.sensors.s_P;
        this._s_B[idx] = verdict.sensors.s_B;
        this._snare_energy[idx] = snareEnergy ?? 0;
        this._hh_energy[idx] = hhEnergy ?? 0;
        // Avanzar cabeza del ring buffer
        this._head = (this._head + 1) % BUFFER_SIZE;
        if (this._count < BUFFER_SIZE)
            this._count++;
        this._totalRecorded++;
    }
    /**
     * Número de frames válidos en el buffer.
     */
    get frameCount() {
        return this._count;
    }
    /**
     * Total de frames grabados desde el inicio (incluye los sobrescritos).
     */
    get totalRecorded() {
        return this._totalRecorded;
    }
    /**
     * Extrae el historial ordenado cronológicamente del ring buffer.
     * Construye un array de TelemetryFrame — solo llamar desde dumpToFile (no hot path).
     */
    _extractFrames() {
        const frames = new Array(this._count);
        // El índice de inicio depende de si el buffer ya dio la vuelta
        const startIdx = this._count < BUFFER_SIZE
            ? 0
            : this._head; // _head apunta al slot más antiguo cuando está lleno
        for (let i = 0; i < this._count; i++) {
            const idx = (startIdx + i) % BUFFER_SIZE;
            frames[i] = {
                timestamp: this._timestamps[idx],
                ignite: this._ignite[idx] === 1,
                confidence: this._confidence[idx],
                squelch: this._squelch[idx],
                intensity: this._intensity[idx],
                epicness: this._epicness[idx],
                tension: this._tension[idx],
                viscosity: this._viscosity[idx],
                vaporPressure: this._vaporPressure[idx],
                excitability: this._excitability[idx],
                temperature: this._temperature[idx],
                impact: this._impact[idx],
                crestFactor: this._crestFactor[idx],
                s_DNA: this._s_DNA[idx],
                s_Z: this._s_Z[idx],
                s_E: this._s_E[idx],
                s_V: this._s_V[idx],
                s_X: this._s_X[idx],
                s_P: this._s_P[idx],
                s_B: this._s_B[idx],
                snare_energy: this._snare_energy[idx],
                hh_energy: this._hh_energy[idx],
            };
        }
        return frames;
    }
    /**
     * Dump del buffer a archivo JSONL en disco.
     * Limpia el buffer después del dump exitoso.
     *
     * @returns Ruta del archivo escrito, o null si no hay datos
     */
    async dumpToFile() {
        if (this._count === 0)
            return null;
        const frames = this._extractFrames();
        // Construir ruta: <userData>/LuxSync_Telemetry/liquid_<timestamp>.jsonl
        const userDataPath = app.getPath('userData');
        const outDir = path.join(userDataPath, 'LuxSync_Telemetry');
        const fileName = `liquid_${Date.now()}.jsonl`;
        const filePath = path.join(outDir, fileName);
        // Asegurar que el directorio existe
        fs.mkdirSync(outDir, { recursive: true });
        // Escribir como JSONL (un objeto JSON por línea)
        const lines = frames.map(f => JSON.stringify(f));
        const content = lines.join('\n') + '\n';
        fs.writeFileSync(filePath, content, 'utf-8');
        // Log prominente con la ruta absoluta exacta
        console.log(`\n╔══════════════════════════════════════════════════════════╗
║  🌊 LIQUID TELEMETRY DUMP — ${frames.length} frames written
║  📂 ${filePath}
╚══════════════════════════════════════════════════════════╝\n`);
        // Limpiar buffer después del dump
        this._head = 0;
        this._count = 0;
        return filePath;
    }
    getLastFrame() {
        if (this._count === 0)
            return null;
        const idx = (this._head - 1 + BUFFER_SIZE) % BUFFER_SIZE;
        const s = this._lastFrameSnapshot;
        s.timestamp = this._timestamps[idx];
        s.ignite = this._ignite[idx] === 1;
        s.confidence = this._confidence[idx];
        s.squelch = this._squelch[idx];
        s.intensity = this._intensity[idx];
        s.epicness = this._epicness[idx];
        s.tension = this._tension[idx];
        s.viscosity = this._viscosity[idx];
        s.vaporPressure = this._vaporPressure[idx];
        s.excitability = this._excitability[idx];
        s.temperature = this._temperature[idx];
        s.impact = this._impact[idx];
        s.crestFactor = this._crestFactor[idx];
        s.s_DNA = this._s_DNA[idx];
        s.s_Z = this._s_Z[idx];
        s.s_E = this._s_E[idx];
        s.s_V = this._s_V[idx];
        s.s_X = this._s_X[idx];
        s.s_P = this._s_P[idx];
        s.s_B = this._s_B[idx];
        s.snare_energy = this._snare_energy[idx];
        s.hh_energy = this._hh_energy[idx];
        return s;
    }
    reset() {
        this._head = 0;
        this._count = 0;
        this._totalRecorded = 0;
        // No need to zero-fill typed arrays — count tracking handles validity
    }
}
