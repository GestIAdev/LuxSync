/**
 * WAVE 3512: AETHER CONFIG — Master Switch Global
 *
 * Fuente de verdad unica para la decision de routing DMX:
 * "Este universo pertenece al pipeline Aether o al pipeline legacy?"
 *
 * SEMANTICA:
 * - Un universo en `_aetherUniverses` es EXCLUSIVAMENTE propiedad del NodeResolver.
 *   El pipeline legacy (masterArbiter → HAL.flushToDriver) NO escribe en el.
 * - Un universo FUERA del set es exclusivamente del pipeline legacy.
 * - No hay mezcla: la frontera es atomica por numero de universo.
 *
 * ZERO-ALLOC:
 * - Set<number> pre-allocado en modulo load time.
 * - `has()` es O(1), sin new/spread/array.
 * - `add()` / `delete()` solo se llaman en patch time (no en hot path).
 *
 * USO:
 *   import { aetherConfig } from './AetherConfig'
 *   aetherConfig.claimUniverse(1)           // Aether toma el universo 1
 *   aetherConfig.ownsUniverse(1)            // true
 *   aetherConfig.releaseUniverse(1)         // vuelve al legacy
 *
 * @module core/aether/AetherConfig
 * @version WAVE 3512
 */

// ---------------------------------------------------------------------------
// MASTER SWITCH
// ---------------------------------------------------------------------------

export class AetherConfig {

  // Set pre-allocado en construccion. Crece solo en patch time.
  private readonly _aetherUniverses = new Set<number>()

  // ---------------------------------------------------------------------------
  // PATCH TIME — Reclamacion y liberacion de universos
  // ---------------------------------------------------------------------------

  /**
   * Marca un universo DMX como controlado EXCLUSIVAMENTE por el pipeline Aether.
   *
   * Llamar en patch time cuando se registra un IDeviceDefinition en el NodeGraph.
   * A partir de este momento, HardwareAbstraction.flushToDriver() omitira
   * cualquier FixtureState cuyo `.universe` coincida con este numero.
   *
   * @param universe — Numero de universo DMX (1-based, Art-Net convention)
   */
  public claimUniverse(universe: number): void {
    this._aetherUniverses.add(universe)
    console.info('[AETHER] ⚡ UNIVERSE CLAIMED: ' + universe)
  }

  /**
   * Devuelve un universo al control del pipeline legacy.
   *
   * Llamar cuando todos los IDeviceDefinition de un universo se desregistran.
   * A partir de este momento, flushToDriver() volvera a procesar ese universo.
   *
   * @param universe — Numero de universo a liberar
   */
  public releaseUniverse(universe: number): void {
    this._aetherUniverses.delete(universe)
  }

  // ---------------------------------------------------------------------------
  // HOT PATH — Verificacion O(1) sin alloc
  // ---------------------------------------------------------------------------

  /**
   * Retorna true si el universo esta bajo control Aether.
   *
   * Llamar en el hot path de flushToDriver() para decidir si un
   * FixtureState debe ser suprimido del output legacy.
   *
   * @param universe — Numero de universo a verificar
   */
  public ownsUniverse(universe: number): boolean {
    return this._aetherUniverses.has(universe)
  }

  /**
   * Retorna true si el universo NO esta en el set Aether
   * (conveniente para el filtro inline de flushToDriver).
   */
  public isLegacyUniverse(universe: number): boolean {
    return !this._aetherUniverses.has(universe)
  }

  // ---------------------------------------------------------------------------
  // DIAGNOSTICO / UI
  // ---------------------------------------------------------------------------

  /**
   * Para telemetria y el hook de UI toggle.
   * No alloca: snapshot del Set como array solo se llama on-demand.
   */
  public getAetherUniverses(): readonly number[] {
    return Array.from(this._aetherUniverses)
  }

  public getAetherUniverseCount(): number {
    return this._aetherUniverses.size
  }
}

// ---------------------------------------------------------------------------
// SINGLETON — una instancia por proceso, mismo que usa el TitanOrchestrator
// ---------------------------------------------------------------------------

export const aetherConfig = new AetherConfig()
