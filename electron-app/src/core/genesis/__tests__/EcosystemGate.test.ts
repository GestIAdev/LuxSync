// ═══════════════════════════════════════════════════════════════════════════
// 🧪 UX HOTFIX — CRASH TEST: EcosystemGate master switch
// ═══════════════════════════════════════════════════════════════════════════
//  Verifies the "laboratory closed" guarantee:
//  1. isGenesisPaused defaults to TRUE (opt-in ecosystem, WAVE 7527)
//  2. setGenesisPaused flips the flag (only GenesisIgnition writes it)
//  3. While paused, EVERY spawn entry point aborts BEFORE touching the
//     vault — zero DNA generation, zero DB writes:
//       • spawnInitialCohort → []            (EMERGENCY SPARK path)
//       • spawnOrganism      → ECOSYSTEM_PAUSED abort  (cohort + mitosis)
//       • spawnHybrid        → ECOSYSTEM_PAUSED abort  (sexual reproduction)
//  4. When resumed, the gate opens — spawnOrganism reaches the blueprint
//     fetch and fails with 'Blueprint not found' instead of the pause abort.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock electron before importing modules that depend on it
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}))

import { isGenesisPaused, setGenesisPaused } from '../EcosystemGate'
import { ColiseumService } from '../ColiseumService'
import type { GenesisVaultService } from '../GenesisVaultService'

/**
 * Tripwire vault — the paused path must NEVER touch it. Any method that IS
 * reached while paused throws, failing the test loudly.
 */
const makeTripwireVault = (): GenesisVaultService =>
  ({
    getBlueprint: () => { throw new Error('vault touched while PAUSED') },
    getDb: () => { throw new Error('vault touched while PAUSED') },
    executeTransaction: (fn: () => unknown) => fn(),
  }) as unknown as GenesisVaultService

describe('EcosystemGate', () => {
  beforeEach(() => setGenesisPaused(true))

  it('boots paused and flips via setGenesisPaused', () => {
    expect(isGenesisPaused()).toBe(true)
    setGenesisPaused(false)
    expect(isGenesisPaused()).toBe(false)
    setGenesisPaused(true)
    expect(isGenesisPaused()).toBe(true)
  })
})

describe('ColiseumService — laboratory closed', () => {
  beforeEach(() => setGenesisPaused(true))

  it('spawnInitialCohort returns [] without touching the vault', () => {
    const svc = new ColiseumService(makeTripwireVault())
    expect(svc.spawnInitialCohort('solar_flare')).toEqual([])
  })

  it('spawnOrganism aborts with ECOSYSTEM_PAUSED and writes nothing', () => {
    const svc = new ColiseumService(makeTripwireVault())
    const r = svc.spawnOrganism('solar_flare', 'gene_augmentation')
    expect(r.success).toBe(false)
    expect(r.organismId).toBeNull()
    expect(r.screening.viable).toBe(false)
    expect(r.screening.abortReason).toBe('ECOSYSTEM_PAUSED')
  })

  it('spawnHybrid aborts with ECOSYSTEM_PAUSED', () => {
    const svc = new ColiseumService(makeTripwireVault())
    const r = svc.spawnHybrid('org_a', 'org_b')
    expect(r.success).toBe(false)
    expect(r.organismId).toBeNull()
    expect(r.screening.abortReason).toBe('ECOSYSTEM_PAUSED')
  })

  it('resumed gate lets the call reach the vault (blueprint lookup)', () => {
    setGenesisPaused(false)
    const svc = new ColiseumService({
      getBlueprint: () => undefined, // unknown blueprint
      getDb: () => { throw new Error('should not reach getDb') },
    } as unknown as GenesisVaultService)
    expect(() => svc.spawnOrganism('ghost', 'focal_mutation')).toThrow(/Blueprint not found/)
  })
})
