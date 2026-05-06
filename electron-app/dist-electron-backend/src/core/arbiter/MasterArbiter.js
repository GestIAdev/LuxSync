/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MASTER ARBITER — FACADE (WAVE 3504.3 DEMOLICIÓN CONTROLADA)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este archivo es ahora una FACHADA de retrocompatibilidad.
 * Toda la lógica vive en ArbitrationDirector.ts.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  NO MODIFICAR ESTE ARCHIVO — editar ArbitrationDirector.ts           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Consumidores que importan `MasterArbiter` o `masterArbiter` siguen
 * funcionando sin cambios. El alias de clase y el singleton son idénticos
 * en forma y comportamiento al monolito anterior.
 *
 * @module core/arbiter/MasterArbiter
 * @version WAVE 3504.3 — Facade
 * @see ArbitrationDirector.ts
 */
// Re-export the Director as MasterArbiter (zero-regression alias)
export { ArbitrationDirector as MasterArbiter } from './ArbitrationDirector';
export { ArbitrationDirector } from './ArbitrationDirector';
import { ArbitrationDirector } from './ArbitrationDirector';
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON — backward-compatible drop-in replacement
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Global ArbitrationDirector instance exposed as `masterArbiter`.
 * Use this for production — single source of truth.
 */
export const masterArbiter = new ArbitrationDirector();
