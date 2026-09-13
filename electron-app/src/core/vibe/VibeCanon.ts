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
  | 'rave'           // 🎆 FASE 4: EDM / Dubstep / Neurofunk / Hardstyle

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
  'rave',
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
  'rave',
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
// ALIASES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aliases legacy/genre → VibeId canónico. Fuente única.
 *
 * 🎭 VIBE CANON FASE 2 — CONSOLIDACIÓN: antes de esta fase existían CUATRO
 * mapas de alias independientes que había que mantener en sincronía a mano:
 *   · `VIBE_ALIAS_MAP` (engine/vibe/profiles/index.ts) — 26 aliases
 *   · `PROFILE_REGISTRY` aliases (hal/physics/profiles/index.ts) — 14 claves extra
 *   · `VIBE_ID_MAP` (core/aether/adapters/KineticAdapter.ts) — 16 claves
 *   · aliases sueltos en VibeSectionProfiles ('lofi', 'downtempo', ...)
 * Este mapa es la unión de los cuatro. Si un alias existe en algún consumidor,
 * está aquí. FASE 4 añadirá: 'edm', 'hardstyle', 'trance', 'bigroom' → 'rave',
 * y migrará 'dubstep'/'neurofunk' de techno-club a rave.
 *
 * Las entradas identidad ('techno-club' → 'techno-club', etc.) NO existen aquí:
 * `isVibeId()` las captura antes de consultar aliases.
 */
export const VIBE_ALIASES: Readonly<Record<string, VibeId>> = {
  // ── familia techno (techno-club) ──────────────────────────────────────────
  'techno':      'techno-club',
  'electro':     'techno-club',
  'electronic':  'techno-club',
  'acid':        'techno-club',
  'minimal':     'techno-club',
  'industrial':  'techno-club',
  'techno-dark': 'techno-club',
  'dark':        'techno-club',
  'cyberpunk':   'techno-club',
  // ── familia rave (rave) — FASE 4 ─────────────────────────────────────────
  // D4 (blueprint §5.4): migrar 'dubstep'/'neurofunk' de techno-club a rave.
  'edm':         'rave',
  'dubstep':     'rave',
  'neurofunk':   'rave',
  'hardstyle':   'rave',
  'ravex':       'rave',
  'trance':      'rave',
  'bigroom':     'rave',
  // ── familia latina (fiesta-latina) ───────────────────────────────────────
  'latin':         'fiesta-latina',
  'latino':        'fiesta-latina',
  'fiesta':        'fiesta-latina',
  'reggaeton':     'fiesta-latina',
  'salsa':         'fiesta-latina',
  'cumbia':        'fiesta-latina',
  'dembow':        'fiesta-latina',
  'tropical':      'fiesta-latina',
  'bachata':       'fiesta-latina',
  'latino-organic': 'fiesta-latina',
  // ── familia rock (pop-rock) ──────────────────────────────────────────────
  'rock':        'pop-rock',
  'pop':         'pop-rock',
  'metal':       'pop-rock',
  'indie':       'pop-rock',
  'hiphop':      'pop-rock',
  'blues':       'pop-rock',
  'rock-anthem': 'pop-rock',
  // ── familia chill (chill-lounge) ─────────────────────────────────────────
  'chill':      'chill-lounge',
  'chillout':   'chill-lounge',
  'lounge':     'chill-lounge',
  'ambient':    'chill-lounge',
  'jazz':       'chill-lounge',
  'ballad':     'chill-lounge',
  'romantic':   'chill-lounge',
  'lofi':       'chill-lounge',
  'downtempo':  'chill-lounge',
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUCIÓN CANÓNICA
// ═══════════════════════════════════════════════════════════════════════════

/** De dónde salió la resolución de un vibe. */
export type VibeResolutionSource = 'canonical' | 'alias' | 'custom' | 'fallback'

/** Resultado de resolver un identificador arbitrario a un vibe válido. */
export interface VibeResolution {
  /** El vibe resuelto: canónico, clave custom, o VIBE_FALLBACK_ID. */
  readonly id: VibeId | CustomVibeKey
  /** Cómo se resolvió — permite a los callers distinguir rechazo de éxito. */
  readonly source: VibeResolutionSource
  /** El string original pedido (para telemetría/warnings). */
  readonly requested: string
}

/**
 * Warning único por key desconocida — evita saturar los logs a 44Hz.
 * @see resolveVibeId
 */
const _warnedUnknownVibes = new Set<string>()

/**
 * 🎯 Resolución ÚNICA de cualquier string a un vibe válido.
 *
 * Política (blueprint §3.1):
 *   1. Canónico directo (case-sensitive, O(1) sobre array congelado)
 *   2. Clave custom:* (VibeLab / Proteus graft) — se devuelve tal cual; la
 *      validación de que el injerto EXISTE es responsabilidad del caller
 *      (VibeManager → isGrafted), porque el Canon es módulo hoja y no puede
 *      importar el graft registry.
 *   3. Alias (case-insensitive)
 *   4. Fallback a VIBE_FALLBACK_ID con UN warning por key y por sesión.
 *
 * ⚠️ NOTA PARA CALLERS QUE RECHAZAN INPUT DESCONOCIDO (VibeManager):
 * usar `source === 'fallback'` como señal de rechazo — NO usar el id
 * devuelto, que siempre es 'idle'. El fallback aquí es para MAPAS que
 * reciben un vibe ya activo y no pueden fallar; la validación de entrada
 * sigue siendo fail-loud en VibeManager (404).
 */
export function resolveVibeId(raw: string | undefined | null): VibeResolution {
  const requested = raw ?? ''
  if (isVibeId(requested)) {
    return { id: requested, source: 'canonical', requested }
  }
  if (isCustomVibeKey(requested)) {
    return { id: requested, source: 'custom', requested }
  }
  const aliased = VIBE_ALIASES[requested.toLowerCase()]
  if (aliased) {
    return { id: aliased, source: 'alias', requested }
  }
  if (!_warnedUnknownVibes.has(requested)) {
    _warnedUnknownVibes.add(requested)
    console.warn(
      `[VibeCanon] ⚠️ Vibe desconocido '${requested}' → fallback '${VIBE_FALLBACK_ID}'. ` +
      `Válidos: ${VIBE_IDS.join(', ')}. ` +
      `Aliases: ${Object.keys(VIBE_ALIASES).length} en VIBE_ALIASES. ` +
      `(Este warning se emite una sola vez por key y por sesión.)`
    )
  }
  return { id: VIBE_FALLBACK_ID, source: 'fallback', requested }
}

/**
 * Acceso tipado a un mapa `Record<VibeId, T>` desde una clave arbitraria.
 *
 * Los mapas canónicos se declaran `Record<VibeId, T>` para que el compilador
 * exija completitud (Fase 4: añadir un vibe = lista de errores = checklist).
 * Pero `VibeGraftRegistry` injerta claves `custom:*` en runtime, y el VMM
 * acepta strings arbitrarios por contrato (su test suite prueba el fallback
 * con 'nonexistent-vibe-that-doesnt-exist'). Este helper es el ÚNICO punto
 * por el que se hace ese cast — grep `as Record<string,` para auditar.
 *
 * NOTA: el parámetro es `string` (no `AnyVibeKey`) deliberadamente — la
 * seguridad tipa el MAPA (completitud), no la clave. El fallback en la clave
 * es responsabilidad del caller.
 *
 * NO aplica fallback — devuelve undefined si la key no existe.
 */
export function lookupVibeMap<T>(
  map: Record<VibeId, T>,
  key: string,
): T | undefined {
  return (map as Record<string, T>)[key]
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 3a — SISTEMA DE FAMILIAS Y TRAITS
// ═══════════════════════════════════════════════════════════════════════════
//
// Blueprint §4.1. Esta sección define la "genética" de cada vibe: una tabla
// de datos (VIBE_TRAITS) que reemplazará los ~20 condicionales includes()/===
// dispersos por el motor. En la Fase 3a SOLO se definen los contratos y se
// inyectan las dependencias — los condicionales existentes NO se tocan aún.
// La Fase 3b hará el reemplazo condicional por condicional (§4.2).
//
// ⚠️ CERO IMPORTS — este módulo sigue siendo hoja del grafo de dependencias.
// VibeTraits es una interfaz pura (sin herencia, sin imports de tipos
// externos), así que puede vivir aquí sin romper la regla de oro.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Familia musical de un vibe.
 *
 * NO es una etiqueta para reemplazar `includes('techno')` por
 * `family === 'techno'` — eso seguiría siendo un condicional disperso.
 * Su rol es clasificar para telemetría y para futura lógica de familia
 * (p.ej. herencia de traits en VibeLab). Los parámetros reales que
 * reemplazan los condicionales viven en `VibeTraits`.
 *
 * `rave` se incluye ya para que la Fase 4 no tenga que tocar este tipo.
 * `neutral` es la familia de `idle` — no es un género musical.
 */
export type VibeFamily = 'techno' | 'latino' | 'rock' | 'chill' | 'rave' | 'neutral'

/**
 * Rasgos de comportamiento por vibe.
 *
 * Cada campo reemplaza un condicional hardcodeado identificado en la
 * auditoría (`docs/forensics/auditoria_trazabilidad_vibe.md`). La
 * referencia al origen (archivo:línea) es obligatoria en el comentario de
 * cada campo para que la Fase 3b pueda verificar paridad exacta.
 *
 * Todos los campos son `readonly` — la tabla es inmutable post-declaración.
 * Los valores se copian literalmente de los condicionales originales sin
 * redondear ni "limpiar" (blueprint §4.2 paso 2).
 */
export interface VibeTraits {
  readonly family: VibeFamily

  // ── Física líquida ──────────────────────────────────────────
  /** Reemplaza `isTechnoProfile` @ LiquidEngineBase.ts:1958 (vocalPenalty bypass) */
  readonly bypassVocalPenalty: boolean
  /** Reemplaza el ternario dmzFactor @ LiquidEngineBase.ts:1959 */
  readonly dmzFactor: number
  /** Reemplaza el ternario backLeftGain @ LiquidEngineBase.ts:1965 */
  readonly backLeftGain: number
  /** Reemplaza `isLatino` @ LiquidEngine71.ts:107,167-168 (swap de movers) */
  readonly swapMovers: boolean
  /** Reemplaza `isAbsoluteChillProfile()` @ LiquidEngineBase.ts:2257 */
  readonly pureAmbient: boolean
  /** Reemplaza `isChill` @ LiquidEngine71.ts:108,120 (payload neutro) */
  readonly neutralPayload: boolean

  // ── Techo de intensidad legacy ──────────────────────────────
  /** Reemplaza `isTechno ? 0.80 : 0.95` @ SeleneLux.ts:1212 */
  readonly frontCeiling: number
  /** Reemplaza `isTechno ? 0.10 : 0.06` @ SeleneLux.ts:1218 */
  readonly backGateThreshold: number

  // ── Paleta y motores auxiliares ─────────────────────────────
  /** Reemplaza el if/else de paleta @ SeleneLux.ts:610-626 */
  readonly palettePhysics: 'techno' | 'latino' | 'none'
  /** Reemplaza `includes('chill')` @ SeleneLux.ts:677, TitanEngine.ts:811 */
  readonly usesChillAmbientEngine: boolean
  /** Reemplaza `isChillVibeStrobe` @ SeleneLux.ts:1324 */
  readonly strobeAllowed: boolean
  /** Reemplaza `isChillVibeDimmer` @ SeleneLux.ts:1310 */
  readonly photonDimmerOverride: boolean

  // ── Identificador del perfil líquido ────────────────────────
  /** El `ILiquidProfile.id` asociado. Rompe el acoplamiento por string. */
  readonly liquidProfileId: string
}

/**
 * Tabla de traits por vibe canónico.
 *
 * `Record<VibeId, VibeTraits>` exige completitud: si se añade un vibe
 * nuevo (Fase 4: `rave`), el compilador produce un error hasta que la
 * entrada exista — mismo mecanismo de guardia que los otros mapas.
 *
 * Los valores se copiaron literalmente de los condicionales originales
 * (blueprint §4.2 paso 2). NO redondear ni "limpiar" — la Fase 3b
 * verificará paridad exacta contra estos valores.
 */
export const VIBE_TRAITS: Record<VibeId, VibeTraits> = {
  'techno-club': {
    family: 'techno',
    bypassVocalPenalty: true,      // era: id === 'techno-industrial'
    dmzFactor: 0.55,
    backLeftGain: 1.45,
    swapMovers: false,
    pureAmbient: false,
    neutralPayload: false,
    frontCeiling: 0.80,
    backGateThreshold: 0.10,
    palettePhysics: 'techno',
    usesChillAmbientEngine: false,
    strobeAllowed: true,
    photonDimmerOverride: true,
    liquidProfileId: 'techno-industrial',
  },
  'fiesta-latina': {
    family: 'latino',
    bypassVocalPenalty: false,
    dmzFactor: 0.30,
    backLeftGain: 1.75,
    swapMovers: true,              // era: id === 'latino-fiesta'
    pureAmbient: false,
    neutralPayload: false,
    frontCeiling: 0.95,
    backGateThreshold: 0.06,
    palettePhysics: 'latino',
    usesChillAmbientEngine: false,
    strobeAllowed: true,
    photonDimmerOverride: true,
    liquidProfileId: 'latino-fiesta',
  },
  'pop-rock': {
    family: 'rock',
    bypassVocalPenalty: false,
    dmzFactor: 0.30,
    backLeftGain: 1.75,
    swapMovers: false,
    pureAmbient: false,
    neutralPayload: false,
    frontCeiling: 0.95,
    backGateThreshold: 0.06,
    palettePhysics: 'none',
    usesChillAmbientEngine: false,
    strobeAllowed: true,
    photonDimmerOverride: true,
    liquidProfileId: 'poprock-live',
  },
  'chill-lounge': {
    family: 'chill',
    bypassVocalPenalty: false,
    dmzFactor: 0.30,
    backLeftGain: 1.75,
    swapMovers: false,
    pureAmbient: true,             // era: id.includes('chill')||includes('ambient')
    neutralPayload: true,          // era: id === 'chill-oceanic'
    frontCeiling: 0.95,
    backGateThreshold: 0.06,
    palettePhysics: 'none',
    usesChillAmbientEngine: true,  // era: includes('chill')||'lounge'||'ambient'||'jazz'
    strobeAllowed: false,
    photonDimmerOverride: false,
    liquidProfileId: 'chill-oceanic',
  },
  'idle': {
    family: 'neutral',
    bypassVocalPenalty: false,
    dmzFactor: 0.30,
    backLeftGain: 1.75,
    swapMovers: false,
    pureAmbient: false,
    neutralPayload: false,
    frontCeiling: 0.95,
    backGateThreshold: 0.06,
    palettePhysics: 'none',
    usesChillAmbientEngine: false,
    strobeAllowed: true,
    photonDimmerOverride: true,
    liquidProfileId: 'idle',
  },
  'rave': {
    // 🎆 FASE 4: clonado de techno-club (blueprint §5.6 — partir de techno).
    // D2 (§5.4): bypassVocalPenalty=false — EDM tiene vocales prominentes,
    //   respetarlas primero y ajustar en sala si los sintes disparan falsos.
    // D1 (§5.4): family='rave' — identidad propia (familia ya en VibeFamily).
    family: 'rave',
    bypassVocalPenalty: false,    // D2=B: respeta vocales (EDM vocal-heavy)
    dmzFactor: 0.55,              // heredado de techno — mismo bombo seco
    backLeftGain: 1.45,           // heredado de techno
    swapMovers: false,            // heredado de techno — strict-split
    pureAmbient: false,
    neutralPayload: false,
    frontCeiling: 0.80,           // heredado de techno — techo comprimido
    backGateThreshold: 0.10,     // heredado de techno
    palettePhysics: 'techno',    // heredado de techno — usa TechnoStereoPhysics
    usesChillAmbientEngine: false,
    strobeAllowed: true,          // heredado de techno — strobe-ready
    photonDimmerOverride: true,  // heredado de techno
    liquidProfileId: 'rave-highfreq',
  },
}

/**
 * Helper de lookup de traits por clave arbitraria.
 *
 * Acepta `AnyVibeKey` (canónico o `custom:*`) para que los vibes injertados
 * por VibeGraftRegistry no fallen. Los custom vibes aún no tienen traits
 * propios — caen al fallback `idle`. La Fase 4 podría añadir traits
 * sintéticos para custom vibes vía el graft bundle.
 *
 * @param key VibeId canónico o CustomVibeKey injertada
 * @returns Los traits del vibe, o los traits de `idle` si no se encuentra
 */
export function getVibeTraits(key: AnyVibeKey): VibeTraits {
  return (VIBE_TRAITS as Record<string, VibeTraits>)[key] ?? VIBE_TRAITS[VIBE_FALLBACK_ID]
}

// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS MODE — Canal de capacidad entre SeleneLux y TitanEngine (§4.5)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modo de física aplicado por SeleneLux en este frame.
 *
 * Reemplaza al canal por string `physicsApplied: string` que enumeraba
 * géneros ('techno', 'latino', 'rock', 'chill', 'liquid-stereo', 'none').
 * TitanEngine tenía que listar los 5 géneros para saber si había física
 * activa — lo que hacía imposible añadir `rave` sin tocar TitanEngine.
 *
 * Con `PhysicsMode`, TitanEngine pregunta "¿hay física?" (`!== 'none'`),
 * no "¿es de género X?". Un vibe nuevo (rave) funciona sin tocar TitanEngine.
 *
 * Mapeo desde los valores legacy de `physicsApplied`:
 *   · 'liquid-stereo' → 'liquid-stereo' (path principal, useLiquidStereo=true)
 *   · 'techno'/'latino'/'rock' → 'legacy-mono' (paths legacy, useLiquidStereo=false)
 *   · 'chill' → 'chill-glacier' (path legacy chill, raramente activo)
 *   · 'none' → 'none'
 */
export type PhysicsMode = 'liquid-stereo' | 'legacy-mono' | 'chill-glacier' | 'none'
