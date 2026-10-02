/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🩸 WAVE 8425 — ZOMBIE DIAG GATE (Oilpan Rescue & Console Silence)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sondeo diagnóstico bajo demanda para los hot paths de 44Hz (bridges L2,
 * NodeArbiter, IPC handlers, programmerStore). Apagado por defecto:
 * `if (zDiagOn())` evalúa una lectura de propiedad y cortocircuita ANTES de
 * construir template-strings o serializar payloads — cero alloc, cero spam.
 *
 * Re-armado en runtime, sin rebuild (mismo patrón que __EUCLID_TEL_DIAG__):
 *   renderer (devtools):  __ZOMBIE_DIAG__ = true
 *   worker / main proc:   globalThis.__ZOMBIE_DIAG__ = true
 *   apagar:               __ZOMBIE_DIAG__ = false
 *
 * En dev con DevTools abierto cada console.log retenido es memoria Oilpan —
 * los probes [ZOMBIE-DIAG]/[BridgeDiag] inundaban ~100-200 líneas/s.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function zDiagOn() {
    return globalThis.__ZOMBIE_DIAG__ === true;
}
