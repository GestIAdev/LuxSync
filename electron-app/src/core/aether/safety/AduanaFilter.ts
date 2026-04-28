/**
 * WAVE 3511: ADUANA FILTER — El Gate de Seguridad HAL para la Aether Matrix
 *
 * Interceptor centralizado que protege el hardware DMX de escrituras
 * inseguras procedentes del NodeResolver de la Aether Matrix.
 *
 * PIPELINE QUE IMPLEMENTA (por nodo, por frame):
 *
 *   ArbitratedNodeMap
 *     |
 *     +-- 1. DARKSPIN + QUANTIZER (solo nodos COLOR con color_wheel)
 *     |       Si detecta cambio de rueda mecanica:
 *     |         - HarmonicQuantizer gatea el cambio al BPM
 *     |         - DarkSpinFilter fuerza dimmer=0 durante el transito
 *     |
 *     +-- 2. PHYSICS (nodos KINETIC — gestionado por PhysicsPostProcessor)
 *     |       La inercia pan/tilt ya fue aplicada antes de llegar aqui.
 *     |       AduanaFilter aplica solo el Output Gate sobre esos canales.
 *     |
 *     +-- 3. OUTPUT GATE (Aduana Inmutable — WAVE 3160)
 *             Si !outputEnabled:
 *               - canales MANUAL (_overrides) -> preservar valor
 *               - canales AUTO  -> safe value  (dimmer=0, pan/tilt=0.5)
 *
 * ZERO-ALLOC CONTRACT:
 * - _resultMap: Map<NodeId, Record<string,number>> pre-allocado, mutado in-place.
 * - _channelsBuf: Record<string,number> scratch mutado por nodo.
 * - No new Map / new Array / new Object en el hot path recurrente.
 * - Primera vez que se ve un nodeId: se alloca su Record una sola vez.
 *   Frame siguiente: el Record ya existe, se muta in-place. Amortizado O(1).
 *
 * ARTICULATION: Singleton por instancia de TitanOrchestrator.
 *
 * @module core/aether/safety/AduanaFilter
 * @version WAVE 3511
 */

import type { ArbitratedNodeMap } from '../intent-bus'
import type { INodeGraph }        from '../node-graph'
import type { NodeId }            from '../types'
import type { IDeviceDefinition } from '../device'
import { NodeFamily }             from '../types'

import { getDarkSpinFilter }     from '../../../hal/translation/DarkSpinFilter'
import { getHarmonicQuantizer }  from '../../../hal/translation/HarmonicQuantizer'
import type { FixtureProfile }   from '../../../hal/translation/FixtureProfiles'

// ---------------------------------------------------------------------------
// COLORES DE SEGURIDAD — Valores por defecto cuando la Aduana cierra el gate
// ---------------------------------------------------------------------------

/** Valor de pan/tilt cuando la Aduana cierra: centro del rango (0.5 = 127/255) */
const SAFE_PAN_TILT      = 0.5
/** Valor de dimmer cuando la Aduana cierra: apagado total */
const SAFE_DIMMER        = 0.0
/** Velocidad de rueda de color por defecto para el DarkSpinFilter */
const DEFAULT_WHEEL_SPEED_MS = 500

// ---------------------------------------------------------------------------
// CANALES POR CATEGORIA — arrays estaticos, sin alloc
// ---------------------------------------------------------------------------

/** Canales de intensidad: siempre se zerean si la Aduana cierra */
const INTENSITY_CHANNELS = ['dimmer', 'strobe', 'shutter', 'white', 'amber', 'uv'] as const

/** Canales de movimiento: se centran (0.5) si la Aduana cierra */
const MOTION_CHANNELS = ['pan', 'tilt', 'pan_fine', 'tilt_fine'] as const

/** Canales de color RGB cuyo comportamiento en gate depende del nodo */
const COLOR_CHANNELS = ['red', 'green', 'blue', 'color_wheel', 'cyan', 'magenta', 'yellow'] as const

// ---------------------------------------------------------------------------
// PERFIL ADAPTADOR — Convierte IDeviceDefinition a FixtureProfile minimal
// para los modulos legacy (DarkSpinFilter, HarmonicQuantizer)
// ---------------------------------------------------------------------------

/**
 * Construye un FixtureProfile suficiente para DarkSpinFilter y HarmonicQuantizer
 * a partir de la IDeviceDefinition Aether. Sin allocar si se muta el mismo objeto.
 *
 * NOTE: Se alloca una vez por device en patch time. En hot path se usa el cache.
 */
function _buildMinimalProfile(definition: IDeviceDefinition, minChangeTimeMs: number): FixtureProfile {
  return {
    id: definition.deviceId,
    name: definition.deviceId,
    type: 'beam',
    colorEngine: {
      mixing: 'wheel',
      colorWheel: {
        colors:             [],
        allowsContinuousSpin: false,
        minChangeTimeMs,
      },
    },
    shutter: { type: 'mechanical' },
    safety: { blackoutOnColorChange: true, maxStrobeHz: 10 },
  } as unknown as FixtureProfile
}

// ---------------------------------------------------------------------------
// ESTADO POR NODO — cache de valores permitidos para el Quantizer/DarkSpin
// ---------------------------------------------------------------------------

interface NodeColorState {
  lastAllowedWheelNorm: number  // 0-1 — ultimo valor de color_wheel aprobado
}

// ---------------------------------------------------------------------------
// ADUANA FILTER
// ---------------------------------------------------------------------------

export class AduanaFilter {

  // Singletons legacy — se resuelven una vez en construccion
  private readonly _darkSpin   = getDarkSpinFilter()
  private readonly _quantizer  = getHarmonicQuantizer()

  // Map de resultado — pre-allocado en construccion, mutado in-place cada frame
  private readonly _resultMap: Map<NodeId, Record<string, number>> = new Map()

  // Cache de FixtureProfile por deviceId — allocado en patch time
  private readonly _profileCache = new Map<string, FixtureProfile>()

  // Cache de estado de color por nodeId — para delta de cambio de color
  private readonly _colorState = new Map<NodeId, NodeColorState>()

  // Overrides manuales activos — set por setManualOverride() desde el orquestador
  private readonly _manualOverrides = new Map<NodeId, Record<string, number>>()

  // ---------------------------------------------------------------------------
  // PATCH TIME: registrar device y su perfil
  // ---------------------------------------------------------------------------

  /**
   * Registra un Device en el AduanaFilter.
   * Llama en patch time — NO en hot path.
   *
   * Extrae el minChangeTimeMs del nodo COLOR (si existe) para configurar
   * el HarmonicQuantizer y el DarkSpinFilter correctamente.
   */
  public registerDevice(definition: IDeviceDefinition): void {
    if (this._profileCache.has(definition.deviceId)) return

    // Buscar el nodo COLOR con responseType=mechanical para extraer minChangeTimeMs
    let minChangeTimeMs = DEFAULT_WHEEL_SPEED_MS
    for (const node of definition.nodes) {
      if (node.family === NodeFamily.COLOR && node.constraints.responseType === 'mechanical') {
        minChangeTimeMs = node.constraints.minChangeTimeMs
        break
      }
    }

    const profile = _buildMinimalProfile(definition, minChangeTimeMs)
    this._profileCache.set(definition.deviceId, profile)
  }

  /**
   * Elimina el cache de un Device al desregistrarlo.
   */
  public unregisterDevice(deviceId: string): void {
    this._profileCache.delete(deviceId)
  }

  // ---------------------------------------------------------------------------
  // RUNTIME: Bridge de Override Manual desde el MasterArbiter legacy
  // ---------------------------------------------------------------------------

  /**
   * Registra un override manual para un nodo Aether.
   *
   * Llamado desde el bridge TitanOrchestrator cuando el MasterArbiter
   * detecta un override manual en Layer 2 (MANUAL) para un fixture
   * que ya esta mapeado como nodo Aether.
   *
   * Los valores de override se preservan incluso cuando outputEnabled=false
   * (la Aduana Inmutable respeta los canales manuales).
   *
   * @param nodeId   - NodeId del nodo Aether correspondiente
   * @param channels - Record<channelName, normalizedValue 0-1>
   */
  public setManualOverride(nodeId: NodeId, channels: Readonly<Record<string, number>>): void {
    let existing = this._manualOverrides.get(nodeId)
    if (!existing) {
      existing = {}
      this._manualOverrides.set(nodeId, existing)
    }
    for (const key in channels) {
      existing[key] = (channels as Record<string, number>)[key]!
    }
  }

  /**
   * Elimina todos los overrides manuales de un nodo.
   */
  public clearManualOverride(nodeId: NodeId): void {
    this._manualOverrides.delete(nodeId)
  }

  // ---------------------------------------------------------------------------
  // HOT PATH: filtrar el ArbitratedNodeMap
  // ---------------------------------------------------------------------------

  /**
   * Aplica la cadena de seguridad completa sobre el ArbitratedNodeMap.
   *
   * EJEMPLO — Cambio de color en fixture mecanico:
   *
   *   1. ColorSystem emite channels = { color_wheel: 0.45, dimmer: 1.0 }
   *   2. AduanaFilter detecta que el nodo es COLOR + responseType='mechanical'
   *   3. Llama HarmonicQuantizer.quantize() con el BPM actual
   *      -> Si colorAllowed=false: preserva _colorState.lastAllowedWheelNorm
   *      -> El camvio queda en cola hasta el proximo beat armonico
   *   4. Llama DarkSpinFilter.filter() con el color_wheel DMX objetivo
   *      -> Si hay cambio real: inTransit=true -> dimmer se fuerza a 0
   *      -> Durante el transito (~500ms para Beam 2R): blackout total
   *      -> Cuando transitRemainingMs=0: dimmer se libera
   *   5. El Record resultante reemplaza al original en _resultMap
   *
   * @param arbitrated    - Salida del NodeArbiter (o del PhysicsPostProcessor)
   * @param graph         - NodeGraph para lookups de familia y deviceId
   * @param bpm           - BPM actual del IntervalBPMTracker (para Quantizer)
   * @param bpmConfidence - Confianza del BPM (0-1)
   * @param outputEnabled - Estado del gate fisico de la Aduana Inmutable
   * @returns ArbitratedNodeMap filtrado — listo para el NodeResolver
   */
  public filter(
    arbitrated: ArbitratedNodeMap,
    graph: INodeGraph,
    bpm: number,
    bpmConfidence: number,
    outputEnabled: boolean,
  ): ArbitratedNodeMap {
    this._resultMap.clear()

    for (const [nodeId, channels] of arbitrated) {
      const nodeData = graph.getNodeData(nodeId)

      // Nodo desconocido — pasa sin tocar
      if (!nodeData) {
        this._resultMap.set(nodeId, _readonlyToMutable(channels))
        continue
      }

      // Obtener o crear el Record de salida para este nodo
      let out = this._resultMap.get(nodeId)
      if (!out) {
        out = {}
        this._resultMap.set(nodeId, out)
      }

      // Copiar todos los channels al Record de salida
      _copyChannels(channels, out)

      // ── MANUAL OVERRIDE ────────────────────────────────────────────────
      // Los overrides manuales se aplican ANTES del Output Gate para que
      // el operador conserve control incluso con la Aduana abierta.
      const manuals = this._manualOverrides.get(nodeId)
      if (manuals) {
        for (const ch in manuals) {
          out[ch] = manuals[ch]!
        }
      }

      // ── DARKSPIN + QUANTIZER (solo COLOR mecanico) ────────────────────
      if (nodeData.family === NodeFamily.COLOR) {
        const hasColorWheel = 'color_wheel' in out

        if (hasColorWheel && nodeData.constraints.responseType === 'mechanical') {
          const profile = this._profileCache.get(nodeData.deviceId)

          if (profile) {
            // --- Quantizer ---
            const targetWheelNorm = out['color_wheel'] ?? 0
            const quantizerRGB = {
              r: Math.round(targetWheelNorm * 255),
              g: 0,
              b: 0,
            }
            const minChangeTimeMs = profile.colorEngine?.colorWheel?.minChangeTimeMs ?? DEFAULT_WHEEL_SPEED_MS
            const qResult = this._quantizer.quantize(
              nodeData.deviceId,
              quantizerRGB,
              bpm,
              bpmConfidence,
              minChangeTimeMs,
            )

            // Si el Quantizer bloquea el cambio: preservar ultimo valor aprobado
            let effectiveWheelNorm = targetWheelNorm
            if (!qResult.colorAllowed) {
              let state = this._colorState.get(nodeId)
              if (!state) {
                state = { lastAllowedWheelNorm: targetWheelNorm }
                this._colorState.set(nodeId, state)
              }
              effectiveWheelNorm = state.lastAllowedWheelNorm
              out['color_wheel'] = effectiveWheelNorm
            } else {
              // Aprobado — actualizar estado
              let state = this._colorState.get(nodeId)
              if (!state) {
                state = { lastAllowedWheelNorm: targetWheelNorm }
                this._colorState.set(nodeId, state)
              } else {
                state.lastAllowedWheelNorm = targetWheelNorm
              }
            }

            // --- DarkSpinFilter ---
            // Convierte 0-1 -> DMX para el DarkSpinFilter (legacy trabaja en 0-255)
            const wheelDmx      = Math.round(effectiveWheelNorm * 255)
            const requestDimmer = out['dimmer'] ?? 1.0
            const dsResult      = this._darkSpin.filter(
              nodeData.deviceId,
              wheelDmx,
              profile,
              requestDimmer,
            )

            // Si DarkSpin dice que estamos en transito: apagar el dimmer
            if (dsResult.inTransit) {
              out['dimmer'] = SAFE_DIMMER
            }
          }
        }
      }

      // ── OUTPUT GATE — Aduana Inmutable ─────────────────────────────────
      // Opera sobre valores normalizados antes de llegar al NodeResolver.
      // Respeta los overrides manuales: los canales con override conservan
      // su valor incluso con outputEnabled=false.
      if (!outputEnabled) {
        _applyOutputGate(out, manuals)
      }
    }

    return this._resultMap as unknown as ArbitratedNodeMap
  }

  // ---------------------------------------------------------------------------
  // DIAGNOSTICO
  // ---------------------------------------------------------------------------

  public getRegisteredDeviceCount(): number {
    return this._profileCache.size
  }

  public getActiveManualOverrideCount(): number {
    return this._manualOverrides.size
  }

  public getDarkSpinMetrics(): { activeFixtures: number; fixturesInTransit: number } {
    return this._darkSpin.getMetrics()
  }
}

// ---------------------------------------------------------------------------
// HELPERS INLINE — Sin closures, sin allocacion en hot path
// ---------------------------------------------------------------------------

/** Copia channels de un Readonly<Record> a un Record mutable existente */
function _copyChannels(
  src: Readonly<Record<string, number>>,
  dst: Record<string, number>,
): void {
  for (const key in src) {
    dst[key] = (src as Record<string, number>)[key]!
  }
}

/** Convierte Readonly<Record> a Record mutable sin alloc (cast directo) */
function _readonlyToMutable(src: Readonly<Record<string, number>>): Record<string, number> {
  return src as Record<string, number>
}

/**
 * Aplica el Output Gate sobre un Record de channels.
 *
 * Regla WAVE 3160:
 *   - Canales con override manual -> preservar (el operador manda)
 *   - dimmer/strobe/shutter/color  -> 0 (apagado)
 *   - pan/tilt   -> 0.5 (centro, para no golpear topes mecanicos)
 *   - resto      -> 0
 */
function _applyOutputGate(
  out: Record<string, number>,
  manuals: Record<string, number> | undefined,
): void {
  for (const ch of INTENSITY_CHANNELS) {
    if (manuals && ch in manuals) continue  // manual: preservar
    if (ch in out) out[ch] = SAFE_DIMMER
  }
  for (const ch of MOTION_CHANNELS) {
    if (manuals && ch in manuals) continue  // manual: preservar
    if (ch in out) out[ch] = SAFE_PAN_TILT
  }
  for (const ch of COLOR_CHANNELS) {
    if (manuals && ch in manuals) continue  // manual: preservar
    if (ch in out) out[ch] = SAFE_DIMMER
  }
  // Canales BEAM (gobo, prism, zoom, focus, frost) y ATMOSPHERE (output, fan_speed):
  // se zerean tambien si no tienen override manual
  for (const ch in out) {
    if (manuals && ch in manuals) continue
    if (
      !INTENSITY_CHANNELS.includes(ch as typeof INTENSITY_CHANNELS[number]) &&
      !MOTION_CHANNELS.includes(ch as typeof MOTION_CHANNELS[number]) &&
      !COLOR_CHANNELS.includes(ch as typeof COLOR_CHANNELS[number])
    ) {
      out[ch] = SAFE_DIMMER
    }
  }
}


// ---------------------------------------------------------------------------
// SINGLETON EXPORT
// ---------------------------------------------------------------------------

let _instance: AduanaFilter | null = null

export function getAduanaFilter(): AduanaFilter {
  if (!_instance) _instance = new AduanaFilter()
  return _instance
}
