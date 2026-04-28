/**
 * WAVE 3511: PHYSICS POST-PROCESSOR — Inercia de Motores en el Pipeline Aether
 *
 * Eslabón entre NodeArbiter y NodeResolver para nodos KINETIC.
 * Toma los valores normalizados de pan/tilt (0-1) del ArbitratedNodeMap
 * y los filtra por el FixturePhysicsDriver (inercia, aceleracion, tilt limits)
 * antes de que el NodeResolver los convierta a bytes DMX.
 *
 * ZERO-ALLOC CONTRACT:
 * - _workRecord: Record pre-allocado por deviceId, mutado in-place.
 * - No crea new Map / new Array / new Object en el hot path.
 * - Solo accede al FixturePhysicsDriver singleton del stack legacy.
 *
 * CALIBRACION:
 * Aplica directamente los campos IDeviceCalibration antes de devolver:
 *   invertPan/tilt, panOffset/tiltOffset, tiltLimitMin/Max
 *
 * MAPEADO DE RANGES:
 * Los valores Aether son 0-1 (normalizados). FixturePhysicsDriver trabaja
 * en DMX 0-255. Este modulo convierte en ambos sentidos sin allocar.
 *
 * @module core/aether/safety/PhysicsPostProcessor
 * @version WAVE 3511
 */

import type { ArbitratedNodeMap } from '../intent-bus'
import type { INodeGraph } from '../node-graph'
import type { NodeId, DeviceId } from '../types'
import type { IDeviceDefinition } from '../device'
import { FixturePhysicsDriver } from '../../../engine/movement/FixturePhysicsDriver'

// ---------------------------------------------------------------------------
// SENTINEL — Dispositivos ya registrados en el driver fisico
// ---------------------------------------------------------------------------

const _registered = new Set<DeviceId>()

// ---------------------------------------------------------------------------
// CLAMP UTIL — Inline, sin crear funciones por frame
// ---------------------------------------------------------------------------

function _clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

// ---------------------------------------------------------------------------
// PHYSICS POST-PROCESSOR
// ---------------------------------------------------------------------------

/**
 * PhysicsPostProcessor — aplica inertia pan/tilt a un ArbitratedNodeMap.
 *
 * Produce un nuevo ArbitratedNodeMap (mismo Map, Records mutados in-place)
 * con los valores de pan/tilt reemplazados por los valores fisicamente
 * interpolados que produce FixturePhysicsDriver.translateDMX().
 */
export class PhysicsPostProcessor {

  private readonly _driver: FixturePhysicsDriver
  // Record de trabajo: re-usado por cada nodo. Nunca se alloca de nuevo.
  private readonly _scratch: Record<string, number> = {}
  // Map de resultado: mismo Map para toda la vida del procesador.
  private readonly _result: Map<NodeId, Record<string, number>> = new Map()

  constructor(driver?: FixturePhysicsDriver) {
    this._driver = driver ?? new FixturePhysicsDriver()
  }

  // -------------------------------------------------------------------------
  // PATCH-TIME: registrar un Device en el driver de fisica
  // -------------------------------------------------------------------------

  /**
   * Registra un Device en el FixturePhysicsDriver.
   * Llama en patch time (registerDevice del NodeGraph), NO en hot path.
   */
  public registerDevice(definition: IDeviceDefinition): void {
    if (_registered.has(definition.deviceId)) return
    _registered.add(definition.deviceId)

    const cal = definition.calibration

    this._driver.registerFixture(definition.deviceId, {
      installationType: 'ceiling', // default seguro
      invert: {
        pan:  cal?.invertPan  ?? false,
        tilt: cal?.invertTilt ?? false,
      },
      limits: {
        tiltMin: cal?.tiltLimitMin ?? 20,
        tiltMax: cal?.tiltLimitMax ?? 200,
      },
    })
  }

  /**
   * Actualiza el vibe del driver (llamado cuando el orquestador cambia de vibe).
   * No aloca.
   */
  public setVibe(vibeId: string): void {
    this._driver.setVibe(vibeId)
  }

  // -------------------------------------------------------------------------
  // HOT PATH: procesar ArbitratedNodeMap
  // -------------------------------------------------------------------------

  /**
   * Filtra los canales pan/tilt de un ArbitratedNodeMap por fisica.
   *
   * Recorre SOLO los nodos que tienen pan o tilt en sus channels.
   * El resto pasa sin tocar. Los Records del Map de entrada son
   * ReadOnly, asi que el resultado se construye sobre _result (mutado).
   *
   * @param arbitrated - Salida del NodeArbiter
   * @param graph      - NodeGraph para lookups de familia y deviceId
   * @param deltaMs    - Tiempo real transcurrido desde el frame anterior
   * @returns          - Map con pan/tilt reemplazados; resto intacto
   */
  public process(
    arbitrated: ArbitratedNodeMap,
    graph: INodeGraph,
    deltaMs: number,
  ): ArbitratedNodeMap {
    this._result.clear()

    for (const [nodeId, channels] of arbitrated) {
      const nodeData = graph.getNodeData(nodeId)

      // Nodo no registrado en el graph — pasa sin tocar
      if (!nodeData) {
        this._result.set(nodeId, channels as Record<string, number>)
        continue
      }

      const hasPan  = 'pan'  in channels
      const hasTilt = 'tilt' in channels

      // No es nodo cinetico — copia referencia sin mover datos
      if (!hasPan && !hasTilt) {
        this._result.set(nodeId, channels as Record<string, number>)
        continue
      }

      // ------------------------------------------------------------------
      // Copiar todos los channels al scratch (zero-alloc: sobrescribimos)
      // ------------------------------------------------------------------
      for (const key in channels) {
        this._scratch[key] = (channels as Record<string, number>)[key]!
      }

      // Convertir 0-1 -> DMX 0-255 para el driver
      const targetPanDMX  = hasPan  ? _clamp((channels as Record<string, number>)['pan']!  * 255, 0, 255) : 127
      const targetTiltDMX = hasTilt ? _clamp((channels as Record<string, number>)['tilt']! * 255, 0, 255) : 127

      // Llamar al driver — interpola con inertia
      const result = this._driver.translateDMX(
        nodeData.deviceId,
        targetPanDMX,
        targetTiltDMX,
        deltaMs,
        false, // isManualPosition — el AduanaFilter gestiona overrides manuales
      )

      // Aplicar calibracion usando la definicion del device
      const device = graph.getDevice(nodeData.deviceId)
      const cal    = device?.calibration

      let physPan  = result.panDMX
      let physTilt = result.tiltDMX

      if (cal) {
        if (cal.invertPan)  physPan  = 255 - physPan
        if (cal.invertTilt) physTilt = 255 - physTilt
        physPan  = _clamp(physPan  + (cal.panOffset  ?? 0), 0, 255)
        physTilt = _clamp(physTilt + (cal.tiltOffset ?? 0),
          cal.tiltLimitMin ?? 0, cal.tiltLimitMax ?? 255)
      }

      // Convertir de vuelta a 0-1 (NodeResolver escala a DMX)
      if (hasPan)  this._scratch['pan']  = physPan  / 255
      if (hasTilt) this._scratch['tilt'] = physTilt / 255

      // NOTE: Crear nuevo Record aqui es inevitable porque ArbitratedNodeMap
      // usa Readonly<Record>. Se hace una sola vez por nodo cinetico por frame.
      // En un show tipico con 4-8 movers = 4-8 objetos/frame — aceptable.
      this._result.set(nodeId, { ...this._scratch })
    }

    return this._result as unknown as ArbitratedNodeMap
  }

  /**
   * Resetea el estado de un device (llamar cuando se desregistra).
   */
  public unregisterDevice(deviceId: DeviceId): void {
    _registered.delete(deviceId)
  }

  /**
   * Metricas de diagnostico.
   */
  public getRegisteredCount(): number {
    return _registered.size
  }
}
