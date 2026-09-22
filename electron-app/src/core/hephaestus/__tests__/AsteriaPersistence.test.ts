/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA PERSISTENCE TEST — WAVE 8000
 * Verifica que clip.asteria sobrevive al ciclo de serialización.
 *
 * El serializador (`serializeHephClip`) es un WHITELIST estricto: cualquier
 * campo no listado se descarta EN SILENCIO al guardar. Este test es el canario
 * de la Decisión D-4 del Cónclave (persistencia EMBEBIDA) — si alguien toca
 * el return del serializador y pierde `asteria`, esto explota.
 *
 * @module tests/hephaestus/AsteriaPersistence
 * @version WAVE 8000
 */

import { describe, test, expect } from 'vitest'
import type {
  HephAutomationClipV3,
  HephCurve,
  HephTrack,
  ZoneTarget,
} from '../types'
import { serializeHephClip } from '../types'

describe('🜨 WAVE 8000: Asteria Project Persistence', () => {
  /** Clip V3 mínimo válido (pasa gates G5 del loader). */
  function createMinimalClip(): HephAutomationClipV3 {
    const curve: HephCurve = {
      paramId: 'intensity',
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      keyframes: [{ timeMs: 0, value: 1, interpolation: 'hold' }],
      mode: 'absolute',
    }

    const track: HephTrack = {
      id: 'trk-intensity-01',
      paramId: 'intensity',
      zones: ['all'] as readonly ZoneTarget[],
      curve,
    }

    return {
      id: 'test-clip-asteria',
      name: 'Test Asteria Clip',
      author: 'Asteria',
      category: 'composite' as import('../../effects/types').EffectCategory,
      tags: ['test', 'asteria'],
      vibeCompat: ['universal'],
      spatialZones: ['all'] as readonly ZoneTarget[],
      mixBus: 'global',
      priority: 70,
      durationMs: 4000,
      effectType: 'heph_custom',
      tracks: [track],
      staticParams: {},
      schemaVersion: '3.0',
    }
  }

  test('debe preservar asteria a través del ciclo de serialización', () => {
    // ═══ ARRANGE ═══
    const clip = createMinimalClip()
    clip.asteria = { version: 1, rigFingerprint: 'sha1:abc123' }

    // ═══ ACT ═══
    const restored = serializeHephClip(clip)

    // ═══ ASSERT ═══
    expect(restored.asteria).toBeDefined()
    expect(restored.asteria!.version).toBe(1)
    expect(restored.asteria!.rigFingerprint).toBe('sha1:abc123')
  })

  test('debe deep-clonar asteria — sin referencia compartida al draft de Immer', () => {
    // ═══ ARRANGE ═══
    const clip = createMinimalClip()
    clip.asteria = { version: 1, rigFingerprint: 'sha1:abc123' }

    // ═══ ACT ═══
    const restored = serializeHephClip(clip)

    // ═══ ASSERT ═══
    // El clon JSON rompe la referencia al objeto del draft (Immer) —
    // reasignar el original tras serializar NO debe afectar al serializado.
    // (rigFingerprint es readonly: se reasigna `clip.asteria` completo.)
    expect(restored.asteria).not.toBe(clip.asteria)
    clip.asteria = { version: 1, rigFingerprint: 'sha1:reasignado-despues' }
    expect(restored.asteria!.rigFingerprint).toBe('sha1:abc123')
  })

  test('clip sin asteria debe seguir serializando sin el campo', () => {
    // ═══ ARRANGE ═══
    const clip = createMinimalClip()
    expect(clip.asteria).toBeUndefined()

    // ═══ ACT ═══
    const restored = serializeHephClip(clip)

    // ═══ ASSERT ═══
    // El campo es opcional — los clips existentes (todo el arsenal .lfx)
    // no deben ganar un asteria espurio ni romper su checksum.
    expect(restored.asteria).toBeUndefined()
    expect(restored.schemaVersion).toBe('3.0')
    expect(restored.tracks).toHaveLength(1)
  })

  test('asteria no debe colarse en el JSON serializado cuando es undefined', () => {
    // ═══ ARRANGE ═══
    const clip = createMinimalClip()
    const restored = serializeHephClip(clip)

    // ═══ ACT ═══
    const json = JSON.stringify(restored)

    // ═══ ASSERT ═══
    // JSON.stringify dropea undefined — el archivo .lfx de un clip sin
    // Asteria no debe contener la CLAVE (checksum byte-idéntico al pre-8000).
    // Nota: se busca con ':' para no colisionar con el tag "asteria" del
    // clip de prueba (valor de tags[], no clave).
    expect(json).not.toContain('"asteria":')
  })
})
