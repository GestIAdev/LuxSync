/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 VIBE CANON — SINGLE SOURCE OF TRUTH
 *
 * FASE 1 del blueprint `docs/blueprints/Vibe_Canon_blueprint.md`.
 *
 * Este archivo es la ÚNICA declaración de `VibeId` en todo el codebase.
 * Antes de la Fase 1 existían 5 uniones duplicadas e independientes:
 *   · types/VibeProfile.ts:18
 *   · core/protocol/SeleneProtocol.ts:50
 *   · chronos/core/TimelineClip.ts:28
 *   · core/orchestrator/TitanOrchestrator.ts:34
 *   · core/orchestrator/lifecycle/VibeLifecycleManager.ts:17
 * Todas ellas importan ahora de aquí.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠️  REGLA DE ORO: CERO IMPORTS
 *
 * Este módulo es una HOJA del grafo de dependencias. No debe importar nada,
 * nunca. La razón es estructural: tanto `types/VibeProfile.ts` como
 * `core/protocol/SeleneProtocol.ts` y `chronos/core/TimelineClip.ts` viven en
 * árboles distintos y los tres deben poder importarlo. Cualquier import aquí
 * abre la puerta a un ciclo de dependencias.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * @layer CORE/VIBE
 * @module core/vibe/VibeCanon
 */

// ═══════════════════════════════════════════════════════════════════════════
// IDENTIDAD CANÓNICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vibes canónicas del sistema. **Única declaración del codebase.**
 *
 * Para añadir una vibra nueva (p.ej. `rave`) hay que tocar DOS sitios en este
 * archivo: esta unión y el array `VIBE_IDS`. La guardia de exhaustividad de
 * más abajo falla en compilación si sólo se toca uno de los dos.
 */
export type VibeId =
  | 'idle'           // 💤 Estado neutro de espera — no es un género
  | 'techno-club'    // ⚡ Techno / Electronic / Build-ups
  | 'fiesta-latina'  // 🎉 Reggaetón / Salsa / Cumbia / Dembow
  | 'pop-rock'       // 🎸 Rock / Pop / Hip-hop / Metal
  | 'chill-lounge'   // 🌊 Chillout / Ambient / Jazz / Lo-fi
  // FASE 4 añadirá: | 'rave'  (EDM / Dubstep / Neurofunk)

/**
 * Lista runtime de las vibes canónicas.
 *
 * `satisfies readonly VibeId[]` garantiza que todo miembro del array es un
 * `VibeId` válido (dirección array → unión). La guardia
 * `_VIBE_IDS_ARE_EXHAUSTIVE` garantiza la dirección contraria (unión → array).
 * Juntas hacen imposible el drift que motivó esta refactorización.
 */
export const VIBE_IDS = [
  'idle',
  'techno-club',
  'fiesta-latina',
  'pop-rock',
  'chill-lounge',
] as const satisfies readonly VibeId[]

/**
 * 🛡️ GUARDIA DE EXHAUSTIVIDAD — no borrar.
 *
 * Si se añade un miembro a la unión `VibeId` sin añadirlo a `VIBE_IDS`, el
 * `Exclude` deja de resolverse a `never`, el tipo condicional colapsa a
 * `never`, y esta asignación falla la compilación con un error explícito.
 *
 * Error típico si falta un id: `Type 'boolean' is not assignable to type 'never'`.
 * Solución: añadir el id faltante al array `VIBE_IDS`.
 */
const _VIBE_IDS_ARE_EXHAUSTIVE: Exclude<VibeId, typeof VIBE_IDS[number]> extends never
  ? true
  : never = true
void _VIBE_IDS_ARE_EXHAUSTIVE

// ═══════════════════════════════════════════════════════════════════════════
// VIBES CUSTOM (VibeLab / Proteus Graft)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clave sintética de un vibe custom generado por VibeLab.
 *
 * Formato: `custom:<slug>-<hash6>` — p.ej. `custom:dubstep-cathedral-a1b2c3`.
 *
 * El prefijo `custom:` es el discriminante que permite injertar la clave en
 * los registries del motor sin colisionar nunca con un `VibeId` canónico.
 */
export type CustomVibeKey = `custom:${string}`

/**
 * Cualquier identificador de vibe aceptable en runtime: canónico o custom.
 *
 * Úsalo en las firmas de los helpers de lookup que deben tolerar claves
 * injertadas por `VibeGraftRegistry`, mientras los mapas siguen declarados
 * como `Record<VibeId, T>` para forzar completitud canónica.
 */
export type AnyVibeKey = VibeId | CustomVibeKey

// ═══════════════════════════════════════════════════════════════════════════
// DONANTES DE ADN (VibeLab)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lista runtime de los ADN válidos (para validación y UI).
 *
 * `idle` queda excluido deliberadamente: no es un género musical, es el estado
 * neutro de espera (panScale 0.15, un solo patrón `breath`, sin constitución
 * cromática real). Heredar de `idle` produciría vibes inertes.
 *
 * `satisfies readonly VibeId[]` garantiza por construcción que todo donante es
 * un `VibeId` canónico.
 */
export const BASE_DNA_IDS = [
  'techno-club',
  'fiesta-latina',
  'pop-rock',
  'chill-lounge',
] as const satisfies readonly VibeId[]

/**
 * Los donantes de ADN válidos.
 *
 * Derivado de `BASE_DNA_IDS` en lugar de declarado a mano: así es imposible
 * que la lista runtime y el tipo se desincronicen.
 */
export type BaseDNA = typeof BASE_DNA_IDS[number]

// ═══════════════════════════════════════════════════════════════════════════
// POLÍTICA DE FALLBACK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fallback ÚNICO del sistema para vibes no reconocidas.
 *
 * La auditoría (`docs/forensics/auditoria_trazabilidad_vibe.md` §2.7) detectó
 * fallbacks divergentes: `KineticAdapter` caía a `techno-club` mientras el VMM
 * caía a `idle`. Resultado: una vibra desconocida se renderizaba como un
 * frankenstein (movimiento idle + kinetics techno) imposible de diagnosticar
 * en escenario.
 *
 * `idle` es el fallback correcto porque es visiblemente neutro: el operador ve
 * inmediatamente que algo va mal, en lugar de ver algo que parece techno real.
 *
 * ⚠️ FASE 2 unificará los 7 mapas contra esta constante. En la Fase 1 sólo se
 * declara; los consumidores todavía tienen sus fallbacks locales.
 */
export const VIBE_FALLBACK_ID: VibeId = 'idle'

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Type guard canónico de `VibeId`.
 *
 * Es la única forma correcta de validar un string suelto (procedente de IPC,
 * de un `.lux` persistido, del Recorder o de la UI) antes de tratarlo como
 * una vibra canónica.
 */
export function isVibeId(value: string): value is VibeId {
  return (VIBE_IDS as readonly string[]).includes(value)
}

/**
 * Type guard de `CustomVibeKey`.
 *
 * Exige que exista algo después del prefijo: `'custom:'` a secas NO es una
 * clave válida. Esta validación estricta viene de la implementación original
 * en `types/CustomVibe.ts` y se preserva aquí como canónica.
 */
export function isCustomVibeKey(value: string): value is CustomVibeKey {
  return value.startsWith('custom:') && value.length > 'custom:'.length
}

/**
 * Type guard de `BaseDNA` — donantes de ADN válidos para VibeLab.
 */
export function isBaseDNA(value: string): value is BaseDNA {
  return (BASE_DNA_IDS as readonly string[]).includes(value)
}

/**
 * Type guard de `AnyVibeKey`: acepta canónicas y custom injertadas.
 */
export function isAnyVibeKey(value: string): value is AnyVibeKey {
  return isVibeId(value) || isCustomVibeKey(value)
}

// ═══════════════════════════════════════════════════════════════════════════
// ROADMAP — NO IMPLEMENTAR EN FASE 1
// ═══════════════════════════════════════════════════════════════════════════
//
// FASE 2 (registros y fallbacks) añadirá aquí:
//   · VIBE_ALIASES: Readonly<Record<string, VibeId>>
//   · VibeResolution + resolveVibeId()
//
// FASE 3 (familias y lógica física) añadirá aquí:
//   · VibeFamily
//   · VibeTraits + VIBE_TRAITS + getVibeTraits()
//
// Ver `docs/blueprints/Vibe_Canon_blueprint.md` §3 y §4.
