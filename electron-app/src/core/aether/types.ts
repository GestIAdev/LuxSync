/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — PRIMITIVE TYPES & ENUMS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: Los átomos del nuevo universo.
 *
 * Este archivo define las unidades indivisibles del sistema de tipos Aether.
 * Ningún tipo aquí importa de ningún otro módulo — ni legacy, ni externo.
 * Cada símbolo exportado es un contrato inmutable que los sistemas superiores
 * (NodeGraph, IntentBus, Systems) consumen sin poder alterar.
 *
 * PRINCIPIO: "Si no puedes expresarlo como un tipo primitivo, un enum
 * o un type alias, no pertenece aquí."
 *
 * @module core/aether/types
 * @version WAVE 3509.1 — GOD EAR SYNC (7-Band Alignment)
 */

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY — Identificadores estables del Éter
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identificador único e inmutable de un Nodo de Capacidad.
 *
 * Formato canónico: `"<deviceId>:<nodeLabel>"`.
 * Ejemplo: `"fan-01:petal-3"`, `"beam-2r-01:color"`, `"led-bar:px-07"`.
 *
 * Generado en patch time por la Forja / NodeFactory.
 * Permanece estable durante toda la vida del nodo — nunca se reasigna.
 */
export type NodeId = string

/**
 * Identificador único de un dispositivo físico (la carcasa).
 *
 * Un Device agrupa N CapabilityNodes que comparten dirección DMX base
 * y universo. El Device solo existe en dos momentos: patch time y
 * DMX flush time. Entre ambos, el motor solo ve NodeIds.
 *
 * Ejemplo: `"fan-tungsten-01"`, `"beam-2r-stage-left"`.
 */
export type DeviceId = string

/**
 * Identificador de zona espacial.
 *
 * Define la región lógica del escenario a la que pertenece un nodo.
 * Usado por los Systems para asignar paletas, intensidades y
 * estrategias de movimiento según ubicación.
 *
 * Ejemplo: `"FRONT_WASH"`, `"FLOOR_CENTER"`, `"TRUSS_LEFT"`.
 */
export type ZoneId = string

// ═══════════════════════════════════════════════════════════════════════════
// NODE FAMILY — Las cinco familias de capacidad
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Las cinco familias fundamentales de nodos de capacidad.
 *
 * Cada familia define un dominio físico de control que un System
 * del motor entiende nativamente. Un canal DMX pertenece a
 * **exactamente una familia** — no hay canales compartidos.
 *
 * - `COLOR`      → Dominio cromático (RGB, RGBW, CMY, rueda de colores)
 * - `IMPACT`     → Dominio de intensidad y ruptura de luz (dimmer, shutter, strobe)
 * - `KINETIC`    → Dominio de movimiento mecánico (pan, tilt, rotation)
 * - `BEAM`       → Dominio de conformación de haz (zoom, focus, gobo, prism, frost)
 * - `ATMOSPHERE` → Dominio de efectos ambientales no lumínicos (humo, chispas, ventiladores)
 */
export enum NodeFamily {
  /** Dominio cromático: R, G, B, W, Amber, UV, CTO, CTB, CMY, color_wheel */
  COLOR = 'COLOR',
  /** Dominio de intensidad: dimmer, shutter, strobe — física reactiva al audio */
  IMPACT = 'IMPACT',
  /** Dominio cinético: pan, tilt, pan_fine, tilt_fine, speed, rotation */
  KINETIC = 'KINETIC',
  /** Dominio de conformación de haz: zoom, focus, iris, frost, gobo, prism */
  BEAM = 'BEAM',
  /** Dominio atmosférico: pump, fan, spark — controlado por cues, no por frame */
  ATMOSPHERE = 'ATMOSPHERE',
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE ROLE — Semántica reactiva
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rol semántico de un nodo dentro de su dispositivo y del show.
 *
 * Los Systems usan el rol como hint para decidir **cómo** reacciona
 * un nodo al contexto musical. No es un tipo; es una intención creativa.
 *
 * - `primary`    → Nodo principal del device (el dimmer master, el color principal)
 * - `percussion` → Reacciona a golpes rítmicos: bass, kick, sub-bass
 * - `breath`     → Respiración orgánica: responde a mid con decay suave
 * - `accent`     → Acentos agudos: snare, hi-hat, con ataques afilados
 * - `ambient`    → Relleno ambiental: responde a energía global con floor mínimo
 * - `decoration` → Efecto visual estático o lento (gobos, prismas)
 * - `atmosphere` → Control atmosférico (humo, chispas)
 * - `pixel`      → Pixel individual dentro de un array LED
 *
 * Extensible: cualquier string es válido para roles custom.
 */
export type NodeRole =
  | 'primary'
  | 'percussion'
  | 'breath'
  | 'accent'
  | 'ambient'
  | 'decoration'
  | 'atmosphere'
  | 'pixel'
  | (string & {})  // Extensible sin romper discriminated unions

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL TYPE — Tipos de canal DMX atómicos
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de canal DMX reconocido por el Aether.
 *
 * Cada canal en un nodo tiene exactamente uno de estos tipos.
 * El tipo determina la estrategia de merge en el Arbiter,
 * la curva de transferencia por defecto, y el rango válido.
 *
 * Alineado con el ChannelType del ArbitrationDirector legacy
 * para garantizar compatibilidad en el BridgeAdapter.
 */
export type AetherChannelType =
  // ── INTENSITY ────────────────────────────────────────────────────────
  | 'dimmer'
  | 'strobe'
  | 'shutter'
  // ── COLOR ────────────────────────────────────────────────────────────
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'amber'
  | 'uv'
  | 'cyan'
  | 'magenta'
  | 'yellow'
  | 'color_wheel'
  // ── POSITION ─────────────────────────────────────────────────────────
  | 'pan'
  | 'pan_fine'
  | 'tilt'
  | 'tilt_fine'
  // ── BEAM ─────────────────────────────────────────────────────────────
  | 'gobo'
  | 'gobo_rotation'
  | 'prism'
  | 'prism_rotation'
  | 'focus'
  | 'zoom'
  | 'iris'
  | 'frost'
  // ── CONTROL ──────────────────────────────────────────────────────────
  | 'speed'
  | 'rotation'
  | 'macro'
  | 'control'
  | 'custom'

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE TYPE — Modelo de comportamiento físico del hardware
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de respuesta física del hardware detrás de un nodo.
 *
 * Determina cómo el NodeResolver y el physics layer tratan las
 * transiciones de valor:
 *
 * - `digital`    → LED/semiconductor. Respuesta instantánea, sin inercia.
 *                  El valor target se aplica directamente.
 * - `mechanical` → Motor stepper/servo, rueda de colores, rueda de gobos.
 *                  Tiene inercia, velocidad máxima, y necesita protección
 *                  anti-rebote (DarkSpin). El physics layer interpola.
 * - `discharge`  → Lámpara de descarga (HMI, MSR, HTI).
 *                  No puede apagarse/encenderse rápido. Requiere shutter
 *                  para blackout. El dimmer actúa sobre el shutter, no
 *                  sobre la lámpara directamente.
 */
export type ResponseType = 'digital' | 'mechanical' | 'discharge'

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFER CURVE — Morfología de la señal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de curva de transferencia para la conversión 0-1 → DMX.
 *
 * Cada curva modela una percepción distinta de la intensidad:
 *
 * - `linear`      → Proporcional directo. Útil para posición.
 * - `exponential`  → Respuesta `input^exponent`. Ataque explosivo
 *                    ("Snappy Attack"): casi nada hasta 0.7, luego latigazo.
 *                    Ideal para dimmers de impacto (kicks, strobes).
 *                    Exponente default: 2.5.
 * - `logarithmic` → Respuesta `log(1 + input*9) / log(10)`.
 *                    Percepción suave, gentil. Ideal para ambient/breath.
 * - `scurve`      → Hermite `3t² - 2t³`. Arranque suave + final suave.
 *                    Ideal para fades cinematográficos.
 * - `gamma`       → Corrección perceptual `input^(1/gamma)`.
 *                    Compensa la no-linealidad del ojo humano.
 *                    Gamma default: 2.2.
 */
export type TransferCurveType = 'linear' | 'exponential' | 'logarithmic' | 'scurve' | 'gamma'

/**
 * Definición completa de una curva de transferencia.
 *
 * Combina el tipo de curva con sus parámetros específicos.
 * El NodeResolver aplica esta curva al valor normalizado (0-1)
 * antes de escalar a rango DMX (0-255).
 */
export interface TransferCurve {
  /** Tipo de curva a aplicar */
  readonly type: TransferCurveType
  /**
   * Exponente para curva `exponential`.
   * Default: 2.5 (Snappy Attack para IMPACT_NODEs de percusión).
   * Valores más altos = ataque más abrupto.
   */
  readonly exponent?: number
  /**
   * Gamma para curva `gamma`.
   * Default: 2.2 (estándar sRGB).
   */
  readonly gamma?: number
  /**
   * Umbral de noise gate (0-1).
   * Todo input por debajo de este valor produce output = 0.
   * Elimina ruido residual de audio en silencio absoluto.
   * Default: 0 (sin gate).
   */
  readonly noiseGate?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR MIXING TYPE — Modelo cromático del hardware
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de mezcla de color que soporta un COLOR_NODE.
 *
 * Determina cómo el ColorSystem traduce un color target a
 * valores de canal DMX:
 *
 * - `rgb`    → Mezcla aditiva LED: 3 canales (R, G, B)
 * - `rgbw`   → Mezcla aditiva LED con blanco dedicado: 4 canales
 * - `cmy`    → Mezcla sustractiva (flags mecánicos): 3 canales
 * - `wheel`  → Rueda de colores mecánica: 1 canal con posiciones discretas
 * - `hybrid` → Combinación rueda + LEDs (fixtures avanzados)
 */
export type ColorMixingType = 'rgb' | 'rgbw' | 'cmy' | 'wheel' | 'hybrid'

// ═══════════════════════════════════════════════════════════════════════════
// MOTOR TYPE — Tipo de motor para nodos cinéticos
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de motor físico detrás de un KINETIC_NODE.
 *
 * Determina el modelo de physics para interpolación de movimiento:
 *
 * - `stepper` → Motor paso a paso. Preciso pero con aceleración limitada.
 *               Típico en moving heads económicos.
 * - `servo`   → Servomotor. Rápido, con buena respuesta dinámica.
 *               Típico en moving heads profesionales.
 * - `galvo`   → Galvanómetro (espejo oscilante). Ultrarrápido, rango limitado.
 *               Usado en scanners láser y espejos rápidos.
 */
export type MotorType = 'stepper' | 'servo' | 'galvo'

// ═══════════════════════════════════════════════════════════════════════════
// ATMOSPHERE TYPE — Tipo de dispositivo atmosférico
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de dispositivo físico detrás de un ATMOSPHERE_NODE.
 *
 * Cada tipo tiene restricciones de seguridad distintas
 * (cooldown, interlock, tiempo máximo de activación):
 *
 * - `fog`    → Máquina de humo (heat-based). Cooldown obligatorio.
 * - `haze`   → Máquina de haze (oil/water-based). Funcionamiento continuo.
 * - `spark`  → Generador de chispas (Sparkular, etc.). Interlock de seguridad.
 * - `fan`    → Ventilador direccional. Sin restricciones especiales.
 * - `pyro`   → Pirotecnia fría. Single-shot, interlock máximo.
 * - `custom` → Dispositivo no clasificado. Sin safety assumptions.
 */
export type AtmosphereType = 'fog' | 'haze' | 'spark' | 'fan' | 'pyro' | 'custom'

// ═══════════════════════════════════════════════════════════════════════════
// INTENT SOURCE — Origen de un NodeIntent
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identifica qué System o hook produjo un NodeIntent.
 *
 * Usado por el NodeArbiter para logging, telemetría, y para
 * determinar la capa de prioridad del intent durante el merge.
 */
export type IntentSource =
  | 'color_system'
  | 'impact_system'
  | 'kinetic_system'
  | 'beam_system'
  | 'atmos_system'
  | 'selene_ai'
  | 'chronos'
  | 'manual'
  | 'effect'

// ═══════════════════════════════════════════════════════════════════════════
// MERGE STRATEGY — Estrategia de resolución de conflictos
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estrategia de merge por canal en el NodeArbiter.
 *
 * Cuando múltiples capas quieren controlar el mismo canal
 * de un nodo, el arbiter usa una de estas estrategias:
 *
 * - `HTP` → Highest Takes Precedence. El valor más alto gana.
 *           Estándar de la industria para canales de intensidad (dimmer).
 * - `LTP` → Latest Takes Precedence. El último en escribir gana.
 *           Estándar para posición, color, y beam.
 * - `ADD` → Aditivo. Los valores se suman (clamped a max).
 *           Útil para efectos que se apilan sobre la base.
 */
export type MergeStrategy = 'HTP' | 'LTP' | 'ADD'

// ═══════════════════════════════════════════════════════════════════════════
// POSITION 3D — Coordenada espacial
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Posición física 3D de un nodo en el escenario.
 *
 * Usada por el KineticSystem para stereo routing (mirror/snake),
 * por el PixelMapper para efectos espaciales, y por el ImpactSystem
 * para delay-based phase offsets.
 *
 * Coordenadas normalizadas al espacio del venue:
 * - `x` → Negativo = izquierda, Positivo = derecha (vista desde público)
 * - `y` → 0 = suelo, Positivo = arriba (altura)
 * - `z` → 0 = proscenio, Positivo = fondo del escenario (profundidad)
 */
export interface Position3D {
  readonly x: number
  readonly y: number
  readonly z: number
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR WHEEL DEFINITION — Mapa de una rueda de colores física
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Definición de una posición discreta en una rueda de colores mecánica.
 */
export interface ColorWheelSlot {
  /** Nombre legible del color (e.g. "Deep Red", "Congo Blue") */
  readonly name: string
  /** Valor DMX que selecciona esta posición */
  readonly dmxValue: number
  /** Color RGB aproximado para preview en UI */
  readonly previewRgb: { readonly r: number; readonly g: number; readonly b: number }
}

/**
 * Definición completa de una rueda de colores mecánica.
 *
 * Usada por el ColorSystem para traducir un color target RGB
 * al slot de rueda más cercano (nearest-neighbor en espacio
 * perceptual CIE Lab).
 */
export interface ColorWheelDefinition {
  /** Nombre del perfil de rueda (e.g. "Beam 2R Wheel 1") */
  readonly name: string
  /** Posiciones disponibles en la rueda */
  readonly slots: readonly ColorWheelSlot[]
  /**
   * Tiempo mínimo entre cambios de posición (ms).
   * Protección mecánica contra cambios demasiado rápidos
   * que podrían dañar el motor de la rueda.
   */
  readonly minTransitionMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// BAND MIX WEIGHTS — Pesos de mezcla de bandas de frecuencia
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pesos de mezcla entre bandas de frecuencia de audio y la
 * respuesta de un IMPACT_NODE.
 *
 * Cada peso (0-1) determina cuánto influye esa banda en la
 * intensidad final del nodo. La suma no necesita ser 1.0 —
 * el ImpactSystem normaliza internamente.
 *
 * Configurable por Vibe:
 * - Techno: `percussion` tiene 0.90 en `subBass`
 * - Chill:  `breath` tiene 0.80 en `mid`
 *
 * @see WAVE-3505-BLUEPRINT.md §2.3.2 "La Matriz de Bandas × Roles"
 */
export interface BandMixWeights {
  /** Sub-bass (20-60 Hz) — Peso de la banda más grave */
  readonly subBass: number
  /** Bass (60-250 Hz) — Peso del bajo fundamental */
  readonly bass: number
  /** Low-mid (250-500 Hz) — Peso del calor rítmico */
  readonly lowMid: number
  /** Mid (500-2000 Hz) — Peso del corazón musical (voces, snare) */
  readonly mid: number
  /** High-mid (2000-6000 Hz) — Peso de presencia y ataque */
  readonly highMid: number
  /** Treble (6000-16000 Hz) — Peso del brillo percusivo */
  readonly treble: number
  /** Ultra-Air (16000-22000 Hz) — Peso del éter digital */
  readonly ultraAir: number
  /** Energía global — Peso de la energía RMS total */
  readonly energy: number
}

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY STATE — Estado de seguridad para nodos atmosféricos
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado de seguridad runtime de un ATMOSPHERE_NODE.
 *
 * Trackeado por el AtmosphereSystem para enforcar cooldowns,
 * interlocks, y tiempos máximos de activación continua.
 */
export interface AtmosphereSafetyState {
  /** Timestamp de la última activación (ms) */
  readonly lastActivationMs: number
  /** Tiempo total de activación acumulado en la sesión (ms) */
  readonly totalActiveMs: number
  /** Tiempo restante de cooldown obligatorio (ms). 0 = disponible. */
  readonly cooldownRemaining: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DARKSPIN STATE — Estado de debounce mecánico
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado del filtro DarkSpin para ruedas mecánicas (gobo, color wheel).
 *
 * Previene cambios demasiado rápidos que produzcan parpadeo visible
 * o daño mecánico. El sistema bloquea cambios de posición durante
 * `minTransitionMs` tras cada cambio.
 */
export interface DarkSpinState {
  /** Timestamp del último cambio de posición (ms) */
  readonly lastChangeMs: number
  /** Está actualmente bloqueado (dentro del periodo de debounce)? */
  readonly isLocked: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVELOPE STATE — Estado del envolvente de intensidad
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado runtime del envolvente de intensidad de un IMPACT_NODE.
 *
 * Permite al ImpactSystem aplicar decay suave entre frames
 * en lugar de cortar abruptamente cuando el audio baja.
 * La `velocity` permite modelos de inercia/spring.
 */
export interface EnvelopeState {
  /** Valor actual del envolvente (0-1) */
  readonly current: number
  /** Velocidad de cambio (para modelos de inercia/spring) */
  readonly velocity: number
}
