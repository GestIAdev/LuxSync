/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔒 SEALED_PARAMS.ts — LOS PARÁMETROS INTOCABLES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registro de las constantes que NUNCA pueden ser mutadas por un `.luxvibe`.
 *
 * ── DOBLE BARRERA ──────────────────────────────────────────────────────────
 * Estos parámetros están protegidos en DOS niveles:
 *
 *   1. NIVEL DE TIPOS (barrera primaria): no existen en `PhysicsOverride`,
 *      `ColorOverride` ni `MovementOverride`. Es imposible escribirlos desde
 *      TypeScript. Ver `types/CustomVibe.ts`.
 *
 *   2. NIVEL DE RUNTIME (esta lista, barrera secundaria): un `.luxvibe`
 *      importado de disco o de otra máquina es JSON arbitrario y NO pasa por
 *      el compilador. El `VibeFusionResolver` valida cada ruta del documento
 *      contra este Set y emite un diagnostic `'error'` si detecta un intento.
 *
 * Sin la barrera 2, un archivo `.luxvibe` malicioso o corrupto podría inyectar
 * `movement.physics.SAFETY_CAP.maxVelocity = 5000` y destruir los motores de
 * un mover real. La barrera 2 es la que protege el hardware.
 *
 * ── POR QUÉ ESTÁN SELLADOS ─────────────────────────────────────────────────
 * Tres categorías:
 *   • SEGURIDAD DE HARDWARE — exceder estos límites rompe correas, motores y
 *     rodamientos de fixtures físicos reales. Daño material irreversible.
 *   • SEGURIDAD HUMANA — anti-epilepsia y anti-deslumbramiento.
 *   • INTEGRIDAD MATEMÁTICA — constantes internas de las que dependen los
 *     invariantes de los solvers (singularidades, tracking de EMAs, identidad
 *     geométrica de los patrones). Mutarlas produce NaN o comportamiento caótico.
 *
 * @module engine/vibe/custom/SEALED_PARAMS
 * @version FASE 1A — The Genome Typings
 */

/** Categoría de un parámetro sellado (para mensajes de UI y auditoría). */
export type SealCategory = 'hardware-safety' | 'human-safety' | 'math-integrity'

/** Descriptor completo de un parámetro sellado. */
export interface SealedParamInfo {
  /** Ruta dot-notation tal como aparecería en un `.luxvibe` malicioso. */
  readonly path: string
  /** Valor inmutable de la constante en el motor. */
  readonly value: number | string
  /** Módulo del motor donde vive la constante. */
  readonly owner: string
  readonly category: SealCategory
  /** Razón legible, mostrada en el tooltip del candado en la UI. */
  readonly reason: string
}

/**
 * Los 19 parámetros sellados, con su procedencia exacta en el motor.
 *
 * Fuente: §0.4 del blueprint `custom_vibe_creator_blueprint.md`, verificado
 * contra el código de los motores.
 */
export const SEALED_PARAMS_INFO: readonly SealedParamInfo[] = [
  // ── SEGURIDAD DE HARDWARE (8) ──────────────────────────────────────────
  {
    path: 'movement.physics.SAFETY_CAP.maxAcceleration',
    value: 900,
    owner: 'engine/movement/FixturePhysicsDriver.ts',
    category: 'hardware-safety',
    reason:
      'Límite absoluto de aceleración (DMX/s²). Superarlo desgarra las correas ' +
      'de cualquier mover. Es el techo del sistema, por encima del vibe y del hardware.',
  },
  {
    path: 'movement.physics.SAFETY_CAP.maxVelocity',
    value: 400,
    owner: 'engine/movement/FixturePhysicsDriver.ts',
    category: 'hardware-safety',
    reason:
      'Límite absoluto de velocidad (DMX/s ≈ 850°/s). Superarlo hace que los ' +
      'motores pierdan pasos y descalibren la posición real del haz.',
  },
  {
    path: 'movement.TILT_CEILING',
    value: 0.15,
    owner: 'engine/movement/VibeMovementManager.ts',
    category: 'hardware-safety',
    reason:
      'Techo del tilt. Impide que el haz apunte al techo (luz perdida) y que ' +
      'la cabeza golpee su tope mecánico superior.',
  },
  {
    path: 'movement.TILT_FLOOR_LIMIT',
    value: 0.5,
    owner: 'engine/movement/VibeMovementManager.ts',
    category: 'hardware-safety',
    reason:
      'Suelo del tilt (máx 67° desde la vertical). Impide que el haz cruce al ' +
      'horizonte trasero atravesando el tope mecánico inferior.',
  },
  {
    path: 'movement.TILT_OFFSET_CEILING',
    value: -0.325,
    owner: 'engine/movement/VibeMovementManager.ts',
    category: 'hardware-safety',
    reason:
      'Offset de tilt para montaje ceiling/truss. Centra la onda en la ' +
      'semiesfera inferior segura [-0.50, -0.15]. Mutarlo enviaría el haz al techo.',
  },
  {
    path: 'movement.ik.PAN_SAFETY_MARGIN',
    value: 5,
    owner: 'engine/movement/InverseKinematicsEngine.ts',
    category: 'hardware-safety',
    reason:
      'Margen en unidades DMX que garantiza que el fixture nunca golpee sus ' +
      'topes mecánicos de pan al resolver un target 3D.',
  },
  {
    path: 'movement.GEARBOX_MIN_AMPLITUDE',
    value: 0.1,
    owner: 'engine/movement/VibeMovementManager.ts',
    category: 'hardware-safety',
    reason:
      'Suelo del Gearbox. Evita la división degenerada que produciría amplitud ' +
      'cero y congelaría los movers de forma indistinguible de un fallo de DMX.',
  },
  {
    path: 'physics.RECOVERY_DURATION',
    value: 250,
    owner: 'hal/physics/LiquidEngineBase.ts',
    category: 'hardware-safety',
    reason:
      'Duración de la rampa de recuperación post-AGC. Es una constante de ' +
      'hardware invariante del pipeline de audio.',
  },

  // ── SEGURIDAD HUMANA (2) ───────────────────────────────────────────────
  {
    path: 'physics.STROBE_MAX_HZ',
    value: 12,
    owner: 'hal/physics/LiquidEngineBase.ts (guardarraíl del resolver)',
    category: 'human-safety',
    reason:
      'Techo anti-epilepsia. El rango 15-25 Hz es el de mayor riesgo ' +
      'fotoconvulsivo. Ninguna combinación de strobeThreshold/Duration puede ' +
      'superar 12 Hz efectivos.',
  },
  {
    path: 'movement.PHRASE_ENVELOPE_RANGE',
    value: '[0.85, 1.00]',
    owner: 'engine/movement/VibeMovementManager.ts',
    category: 'human-safety',
    reason:
      'Rango del breathing amplifier. Por debajo de 0.85 los patrones pierden ' +
      'su identidad geométrica y degeneran en un blob centrado ilegible.',
  },

  // ── INTEGRIDAD MATEMÁTICA (9) ──────────────────────────────────────────
  {
    path: 'movement.ik.GIMBAL_LOCK_EPSILON',
    value: 0.05,
    owner: 'engine/movement/InverseKinematicsEngine.ts',
    category: 'math-integrity',
    reason:
      'Zona de singularidad blindada (50 mm). Por debajo, atan2 es ' +
      'indeterminado y el pan da un latigazo de 180°.',
  },
  {
    // 🛡️ CLEAN THE CHASSIS: BPM_SMOOTH_FACTOR was REMOVED from VMM.
    // The TickEngine already smooths BPM via EMA (α=0.15). The VMM's second
    // EMA (α=0.05) caused ~2s lag. VMM now uses the clamped incoming BPM
    // directly (activeBpm = getSafeBPM(audio.bpm)). Entry kept for audit
    // trail — do not re-add smoothing here.
    path: 'movement.BPM_SMOOTH_FACTOR',
    value: 0.05,
    owner: 'engine/movement/VibeMovementManager.ts [REMOVED]',
    category: 'math-integrity',
    reason:
      'Alpha del filtro paso-bajo del BPM. REMOVIDO en CLEAN THE CHASSIS: ' +
      'TickEngine ya suaviza con EMA α=0.15. Doble EMA causaba ~2s de lag. ' +
      'No re-añadir suavizado en el VMM.',
  },
  {
    path: 'physics.envelope.EMA_ALPHA_SLOW',
    value: 0.02,
    owner: 'hal/physics/LiquidEnvelope.ts',
    category: 'math-integrity',
    reason:
      'Alpha del EMA lento (0.98/0.02) del gate adaptativo. Hardcodeado: el ' +
      'tracking de la señal media depende de esta constante exacta.',
  },
  {
    path: 'physics.envelope.EMA_ALPHA_FAST',
    value: 0.12,
    owner: 'hal/physics/LiquidEnvelope.ts',
    category: 'math-integrity',
    reason:
      'Alpha del EMA rápido (0.88/0.12). Idem: afecta el tracking del gate ' +
      'adaptativo de forma no lineal.',
  },
  {
    path: 'physics.envelope.PEAK_DECAY',
    value: '[0.993, 0.985, 0.95]',
    owner: 'hal/physics/LiquidEnvelope.ts',
    category: 'math-integrity',
    reason:
      'Los 3 factores de decay del peak tracker. Definen el gate adaptativo; ' +
      'mutarlos rompe la normalización dinámica del envelope.',
  },
  {
    path: 'physics.STALE_PEAK_THRESHOLD',
    value: 15,
    owner: 'hal/physics/LiquidEnvelope.ts',
    category: 'math-integrity',
    reason: 'Umbral de detección de peak obsoleto. Constante interna del tracker.',
  },
  {
    path: 'physics.KICK_COOLDOWN_MS',
    value: 150,
    owner: 'hal/physics/LiquidEngineBase.ts',
    category: 'math-integrity',
    reason:
      'Cooldown de la detección de kick. Constante de hardware: por debajo se ' +
      'producen dobles disparos con un solo golpe de bombo.',
  },
  {
    path: 'physics.fadeZone',
    value: 0.08,
    owner: 'hal/physics/LiquidEngineBase.ts',
    category: 'math-integrity',
    reason:
      'Zona de fade cuadrático anti-guillotine. Evita el corte abrupto ' +
      'perceptible al final del decay del envelope.',
  },
  {
    path: 'color.KEY_TO_HUE',
    value: '12 entradas fijas',
    owner: 'engine/color/SeleneColorEngine.ts',
    category: 'math-integrity',
    reason:
      'Mapeo sinestésico canónico nota → hue. Es la identidad cromática de ' +
      'LuxSync; mutarlo desacoplaría el color de la tonalidad musical. Para ' +
      'reorientar la paleta usa hueRemapping o thermalGravity.',
  },
] as const

/**
 * Set de rutas selladas, para lookup O(1) desde el resolver.
 *
 * Se deriva de `SEALED_PARAMS_INFO` para mantener una única fuente de verdad:
 * añadir un sello sólo requiere añadir su descriptor arriba.
 */
export const SEALED_PARAMS: ReadonlySet<string> = new Set(
  SEALED_PARAMS_INFO.map((p) => p.path),
)

/**
 * Prefijos sellados. Cualquier ruta que EMPIECE por uno de estos queda
 * bloqueada, aunque no coincida exactamente con una entrada de la lista.
 *
 * Necesario porque un `.luxvibe` hostil podría intentar
 * `physics.envelope.EMA_ALPHA_SLOW.foo` o `color.MODE_MODIFIERS.major.hue`,
 * rutas que no están en el Set pero que apuntan a territorio sellado.
 */
export const SEALED_PREFIXES: readonly string[] = [
  'movement.physics.SAFETY_CAP',
  'movement.ik.',
  'physics.envelope.EMA_',
  'physics.envelope.PEAK_',
  'color.KEY_TO_HUE',
  'color.MODE_MODIFIERS',
  'color.MOOD_HUES',
  'color.PHI_ROTATION',
] as const

/**
 * Comprueba si una ruta está sellada (coincidencia exacta o por prefijo).
 *
 * @param path Ruta dot-notation a validar.
 * @returns `true` si la ruta es intocable.
 */
export function isSealed(path: string): boolean {
  if (SEALED_PARAMS.has(path)) return true
  return SEALED_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/**
 * Recupera el descriptor de un parámetro sellado, si existe.
 * Usado por la UI para renderizar el tooltip del candado.
 */
export function getSealInfo(path: string): SealedParamInfo | undefined {
  return SEALED_PARAMS_INFO.find((p) => p.path === path)
}

/** Número de parámetros sellados. Verificado por test: debe ser 19. */
export const SEALED_PARAMS_COUNT = SEALED_PARAMS_INFO.length
