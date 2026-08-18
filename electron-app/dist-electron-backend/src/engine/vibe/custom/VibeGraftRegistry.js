/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌿 VibeGraftRegistry.ts — THE GRAFTING LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Injerta un `FusedVibeBundle` en los 7 registries canónicos de motor para
 * que el pipeline entero (Liquid + Color + Movement) acepte la clave
 * sintética `custom:...` sin una sola línea modificada en la lógica de motor.
 *
 * ── EL PROBLEMA DE PATTERN_CONFIG ──────────────────────────────────────────
 * A diferencia de los otros 6 registries (que son keyed por vibe y por tanto
 * el injerto es aditivo y no destructivo), `PATTERN_CONFIG` es GLOBAL: un
 * único `Record<GoldenPattern, PatternConfig>` compartido por TODOS los vibes.
 *
 * Si un custom vibe muta `scan_x.cycleBeats`, ese cambio afecta a TODOS los
 * vibes que usan `scan_x`. Por eso el graft registry:
 *   1. Antes de injertar, hace BACKUP de los PatternConfigs que se van a
 *      sobrescribir (sólo esos, no los 22).
 *   2. Al hacer `ungraft`, RESTAURA esos backups exactos.
 *
 * Esto garantiza que desactivar un custom vibe devuelve el motor a su estado
 * canónico, sin contaminación.
 *
 * ── REGISTRO DE INJERTOS ───────────────────────────────────────────────────
 * Se mantiene un `Map<CustomVibeKey, GraftRecord>` para saber qué claves
 * están injertadas y poder revertirlas. Cada registro guarda:
 *   - La key injertada.
 *   - El backup de los PatternConfigs sobrescritos (para restore).
 *
 * @module engine/vibe/custom/VibeGraftRegistry
 * @version FASE 1B — The Fusion Core
 */
import { isCustomVibeKey } from '../../../types/CustomVibe';
import { VIBE_REGISTRY } from '../../vibe/profiles/index';
import { normalizeVibeId } from '../../vibe/profiles/index';
import { PROFILE_REGISTRY } from '../../../hal/physics/profiles/index';
import { COLOR_CONSTITUTIONS } from '../../color/colorConstitutions';
import { VIBE_CONFIG, STEREO_CONFIG, TILT_OFFSET_BY_VIBE, PATTERN_CONFIG, } from '../../movement/VibeMovementManager';
import { MOVEMENT_PRESETS } from '../../movement/VibeMovementPresets';
// ═══════════════════════════════════════════════════════════════════════════
// ESTADO DEL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Mapa de injertos activos: `custom:...` → GraftRecord.
 * Múltiples custom vibes pueden estar injertados simultáneamente.
 *
 * PROTEUS §6.10: To prevent unbounded growth in the 7 backend registries,
 * we enforce a MAX_ACTIVE_GRAFTS limit. When a new graft would exceed the
 * limit, the oldest previously-grafted custom vibe is evicted via ungraft().
 * Since only one custom vibe is active at a time (VibeManager is singleton),
 * a limit of 2 is sufficient: the currently-active vibe + one "standby"
 * for rapid A/B switching without re-graft overhead.
 */
const MAX_ACTIVE_GRAFTS = 2;
/**
 * Mapa de injertos activos: `custom:...` → GraftRecord.
 * Insertion order is preserved (Map iterates in insertion order), so the
 * first entry is the oldest and the one evicted when the limit is exceeded.
 */
const graftedKeys = new Map();
// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Injerta un `FusedVibeBundle` en los 7 registries canónicos.
 *
 * Después de llamar a esta función, `normalizeVibeId(bundle.key)` devuelve
 * la key, `getColorConstitution(bundle.key)` devuelve la constitución
 * fusionada, y `getMovementPreset(bundle.key)` no emite el warn de fallback.
 *
 * Si la key ya estaba injertada, se re-injerta (actualiza los valores).
 *
 * @param bundle El bundle fusionado por `VibeFusionResolver`.
 * @returns `true` si el injerto fue exitoso.
 */
export function graft(bundle) {
    if (!isCustomVibeKey(bundle.key)) {
        console.error(`[VibeGraftRegistry] Key inválida: "${bundle.key}". Debe empezar con "custom:".`);
        return false;
    }
    // Si ya estaba injertada, primero la desaplicamos (restore de PATTERN_CONFIG).
    if (graftedKeys.has(bundle.key)) {
        ungraft(bundle.key);
    }
    // ── PROTEUS §6.10: Eviction policy ──────────────────────────────────
    // If we're at the graft limit, evict the oldest custom vibe (FIFO).
    // Map preserves insertion order, so the first key is the oldest.
    // We evict BEFORE grafting the new one to keep registry size bounded.
    while (graftedKeys.size >= MAX_ACTIVE_GRAFTS) {
        const oldestKey = graftedKeys.keys().next().value;
        if (oldestKey === undefined)
            break;
        console.log(`[VibeGraftRegistry] Evicting graft "${oldestKey}" (limit ${MAX_ACTIVE_GRAFTS} reached)`);
        ungraft(oldestKey);
    }
    // ── 1. BACKUP de PatternConfigs que se van a sobrescribir ────────────
    const patternConfigBackup = new Map();
    if (bundle.patternConfigs) {
        for (const [patternId, newConfig] of Object.entries(bundle.patternConfigs)) {
            if (!newConfig)
                continue;
            const pid = patternId;
            // Backup del estado CANÓNICO actual (que puede ser de un injerto previo
            // de OTRO custom vibe — pero ese es el estado que debemos restaurar
            // cuando ESTE vibe se desaplique).
            const current = PATTERN_CONFIG[pid];
            if (current) {
                patternConfigBackup.set(pid, { ...current });
            }
            // Aplicar el nuevo config
            ;
            PATTERN_CONFIG[pid] = { ...newConfig };
        }
    }
    // ── 2. Injertar en los 6 registries keyed por vibe ───────────────────
    // Estos son aditivos: añadir la key no destruye nada.
    ;
    VIBE_REGISTRY[bundle.key] = bundle.vibeProfile;
    PROFILE_REGISTRY[bundle.key] = bundle.liquidProfile;
    COLOR_CONSTITUTIONS[bundle.key] = bundle.colorConstitution;
    VIBE_CONFIG[bundle.key] = bundle.vibeConfig;
    STEREO_CONFIG[bundle.key] = bundle.stereoConfig;
    MOVEMENT_PRESETS[bundle.key] = bundle.movementPreset;
    TILT_OFFSET_BY_VIBE[bundle.key] = bundle.tiltOffset;
    // ── 3. Registrar el injerto ──────────────────────────────────────────
    graftedKeys.set(bundle.key, {
        key: bundle.key,
        patternConfigBackup,
    });
    return true;
}
/**
 * Desaplica un injerto: elimina la key de los 7 registries y restaura
 * los PatternConfigs desde el backup.
 *
 * @param key La clave sintética a desaplicar.
 * @returns `true` si la key estaba injertada y se desaplicó.
 */
export function ungraft(key) {
    const record = graftedKeys.get(key);
    if (!record)
        return false;
    // ── 1. Restaurar PatternConfigs desde el backup ──────────────────────
    for (const [patternId, backupConfig] of record.patternConfigBackup) {
        ;
        PATTERN_CONFIG[patternId] = { ...backupConfig };
    }
    // ── 2. Eliminar la key de los 6 registries keyed por vibe ────────────
    delete VIBE_REGISTRY[key];
    delete PROFILE_REGISTRY[key];
    delete COLOR_CONSTITUTIONS[key];
    delete VIBE_CONFIG[key];
    delete STEREO_CONFIG[key];
    delete MOVEMENT_PRESETS[key];
    delete TILT_OFFSET_BY_VIBE[key];
    // ── 3. Eliminar del registro ─────────────────────────────────────────
    graftedKeys.delete(key);
    return true;
}
/**
 * Desaplica TODOS los injertos activos. Usado al cerrar el Vibe Lab.
 */
export function ungraftAll() {
    for (const key of Array.from(graftedKeys.keys())) {
        ungraft(key);
    }
}
/**
 * Lista las claves custom injertadas actualmente.
 */
export function listGrafted() {
    return Array.from(graftedKeys.keys());
}
/**
 * Verifica si una clave está injertada.
 */
export function isGrafted(key) {
    return graftedKeys.has(key);
}
/**
 * Verifica que una clave injertada es reconocida por `normalizeVibeId`.
 * Usado por los tests para confirmar que el pipeline acepta la key.
 */
export function isKeyNormalized(key) {
    return normalizeVibeId(key) !== null;
}
/**
 * Recupera el registro de injerto de una clave, si existe.
 * Para debugging e inspección.
 */
export function getGraftRecord(key) {
    return graftedKeys.get(key);
}
/**
 * PROTEUS §6.10: Returns the maximum number of concurrent custom vibe grafts
 * allowed before eviction kicks in.
 */
export function getMaxActiveGrafts() {
    return MAX_ACTIVE_GRAFTS;
}
