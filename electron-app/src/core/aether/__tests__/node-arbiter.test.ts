import { describe, expect, test } from 'vitest'

import { NodeArbiter } from '../NodeArbiter'

describe('NodeArbiter mover shield diplomatic passport', () => {
  test('bloquea color Selene en nodos protegidos cuando no hay override', () => {
    const arbiter = new NodeArbiter()

    arbiter.setMoverShieldNodeIds(['mover-1:color'])
    arbiter.setSeleneOverrideMoverShield(false)
    arbiter.setSeleneOverrides([
      {
        nodeId: 'mover-1:color',
        values: { r: 1, g: 0.5, b: 0.25, red: 1, green: 0.5, blue: 0.25 },
        priority: 300,
        confidence: 1,
        source: 'effect',
      },
    ])

    const result = arbiter.arbitrate()
    const channels = result.get('mover-1:color')

    expect(channels).toBeDefined()
    expect(channels?.['r']).toBeUndefined()
    expect(channels?.['g']).toBeUndefined()
    expect(channels?.['b']).toBeUndefined()
    expect(channels?.['red']).toBeUndefined()
    expect(channels?.['green']).toBeUndefined()
    expect(channels?.['blue']).toBeUndefined()
  })

  test('permite color Selene en nodos protegidos cuando override esta activo', () => {
    const arbiter = new NodeArbiter()

    arbiter.setMoverShieldNodeIds(['mover-1:color'])
    arbiter.setSeleneOverrideMoverShield(true)
    arbiter.setSeleneOverrides([
      {
        nodeId: 'mover-1:color',
        values: { r: 1, g: 0.5, b: 0.25, red: 1, green: 0.5, blue: 0.25 },
        priority: 300,
        confidence: 1,
        source: 'effect',
      },
    ])

    const result = arbiter.arbitrate()
    const channels = result.get('mover-1:color')

    expect(channels).toBeDefined()
    expect(channels?.['r']).toBeCloseTo(1, 6)
    expect(channels?.['g']).toBeCloseTo(0.5, 6)
    expect(channels?.['b']).toBeCloseTo(0.25, 6)
    expect(channels?.['red']).toBeCloseTo(1, 6)
    expect(channels?.['green']).toBeCloseTo(0.5, 6)
    expect(channels?.['blue']).toBeCloseTo(0.25, 6)
  })
})

describe('NodeArbiter — Inhibit Limits sobre Virtual Dimmer (WAVE 8269)', () => {
  const busOf = (intents: any[]) => ({ getAll: () => intents }) as any
  const l0 = (nodeId: string, values: Record<string, number>) => ({
    nodeId, values, priority: 0, confidence: 1, source: 'liquid-aether-l0',
  })

  test('capa brightness del nodo cuando no hay dimmer en el record', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('beam-1:beam-color', { brightness: 0.8 })]))
    arbiter.setInhibitLimit('beam-1:beam-color', 0.5)

    const result = arbiter.arbitrate()
    expect(result.get('beam-1:beam-color')?.['brightness']).toBeCloseTo(0.4, 6)
  })

  test('capa dimmer y brightness simultáneamente cuando ambos existen', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('mix-1:cell', { dimmer: 1.0, brightness: 1.0 })]))
    arbiter.setInhibitLimit('mix-1:cell', 0.25)

    const record = arbiter.arbitrate().get('mix-1:cell')
    expect(record?.['dimmer']).toBeCloseTo(0.25, 6)
    expect(record?.['brightness']).toBeCloseTo(0.25, 6)
  })

  test('limit=0 apaga el dimmer virtual por completo', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('beam-1:beam-color', { brightness: 1.0 })]))
    arbiter.setInhibitLimit('beam-1:beam-color', 0)

    expect(arbiter.arbitrate().get('beam-1:beam-color')?.['brightness']).toBe(0)
  })
})

describe('NodeArbiter — WAVE 8409 Fase 1: L2 Virtual Dimmer Override', () => {
  const busOf = (intents: any[]) => ({ getAll: () => intents }) as any
  const l0 = (nodeId: string, values: Record<string, number>) => ({
    nodeId, values, priority: 0, confidence: 1, source: 'liquid-aether-l0',
  })

  test('E1 — color L2 sin intensidad inyecta brightness=1.0 y ahoga el virtualDim de L0', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('dev-01:beam-color', { r: 0, g: 0, b: 1, brightness: 0 })]))
    arbiter.setManualOverride('dev-01:beam-color', { r: 1, g: 0, b: 0 })

    const rec = arbiter.arbitrate().get('dev-01:beam-color')!
    expect(rec['r']).toBe(1)
    expect(rec['b']).toBe(0)           // L2 reclamó 'b' → L0 silenciado en ese canal
    expect(rec['brightness']).toBe(1)  // ← la corriente pasa a propiedad L2
  })

  test('E2 — color L2 con dimmer explícito NO inyecta: la intensidad del operador manda', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('dev-01:beam-color', { brightness: 0 })]))
    arbiter.setManualOverride('dev-01:beam-color', { r: 1, dimmer: 0.5 })

    const rec = arbiter.arbitrate().get('dev-01:beam-color')!
    expect(rec['dimmer']).toBeCloseTo(0.5, 6)
    expect(rec['brightness']).toBeCloseTo(0.5, 6)  // manual intensity lock, no 1.0
  })

  test('E3 — dimmer previo + color posterior no machaca la intensidad del operador', () => {
    const arbiter = new NodeArbiter()
    arbiter.setManualOverride('dev-01:wash-color', { dimmer: 0.4 })
    arbiter.setManualOverride('dev-01:wash-color', { r: 1, g: 0, b: 0 })

    const rec = arbiter.arbitrate().get('dev-01:wash-color')!
    expect(rec['dimmer']).toBeCloseTo(0.4, 6)
    expect(rec['brightness']).toBeCloseTo(0.4, 6)  // sin inyección — el 0.4 persiste
    expect(rec['r']).toBe(1)
  })

  test('E4 — fail-closed preservado: sin L2, L0 sigue gobernando brightness', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('dev-01:beam-color', { brightness: 0.3 })]))

    const rec = arbiter.arbitrate().get('dev-01:beam-color')!
    expect(rec['brightness']).toBeCloseTo(0.3, 6)
  })

  test('E5 — liberar el override devuelve el virtualDim a L0 (releaseMs=0)', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('dev-01:beam-color', { brightness: 0.2 })]))
    arbiter.setManualOverride('dev-01:beam-color', { r: 1, g: 0, b: 0 })
    expect(arbiter.arbitrate().get('dev-01:beam-color')!['brightness']).toBe(1)

    arbiter.clearManualOverride('dev-01:beam-color', 0)  // release inmediato, sin fade
    const rec = arbiter.arbitrate().get('dev-01:beam-color')!
    expect(rec['brightness']).toBeCloseTo(0.2, 6)  // L0 recupera la corriente
  })

  test('E6 — canal no-cromático (strobe) no inyecta brightness', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('dev-01:impact-20', { brightness: 0.2 })]))
    arbiter.setManualOverride('dev-01:impact-20', { strobe: 0.5 })

    const rec = arbiter.arbitrate().get('dev-01:impact-20')!
    expect(rec['strobe']).toBe(0.5)
    expect(rec['brightness']).toBeCloseTo(0.2, 6)  // L0 sigue dueño del canal no reclamado
  })

  test('E7 — supremacía L2 post-L3: el Hard Lock reasegura brightness=1.0', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('dev-01:beam-color', { brightness: 0 })]))
    arbiter.setManualOverride('dev-01:beam-color', { r: 1, g: 0, b: 0 })
    arbiter.setEffectIntents([{
      nodeId: 'dev-01:beam-color',
      values: { brightness: 0, r: 0.5 },
      priority: 300, confidence: 1, source: 'effect',
    }])

    const rec = arbiter.arbitrate().get('dev-01:beam-color')!
    expect(rec['brightness']).toBe(1)  // Hard Lock L2 > L3
    expect(rec['r']).toBe(1)
  })

  test('E8 — nombre físico (red) también dispara la inyección', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('dev-01:beam-color', { brightness: 0 })]))
    arbiter.setManualOverride('dev-01:beam-color', { red: 1 })

    const rec = arbiter.arbitrate().get('dev-01:beam-color')!
    expect(rec['red']).toBe(1)
    expect(rec['brightness']).toBe(1)
  })

  test('E9 — brightness explícito del operador no es sobrescrito por la inyección', () => {
    const arbiter = new NodeArbiter()
    arbiter.setManualOverride('dev-01:beam-color', { r: 1, brightness: 0.4 })

    const rec = arbiter.arbitrate().get('dev-01:beam-color')!
    expect(rec['brightness']).toBeCloseTo(0.4, 6)
  })
})

describe('NodeArbiter — WAVE 8413: Atmospheric Safety Firewall (Strict L2+ Isolation)', () => {
  const busOf = (intents: any[]) => ({ getAll: () => intents }) as any
  const chronosBusOf = (intents: any[]) => ({
    count: intents.length,
    getAt: (i: number) => intents[i],
  }) as any
  const l0 = (nodeId: string, values: Record<string, number>) => ({
    nodeId, values, priority: 0, confidence: 1, source: 'atmos_system',
  })
  const NODE = 'fog-01:atmosphere'

  test('F1 — contrato del brief: L0 {smoke:255, red:255} → solo {red:255}', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0(NODE, { smoke: 255, red: 255 })]))

    const rec = arbiter.arbitrate().get(NODE)!
    expect(rec['smoke']).toBeUndefined()  // el gatillo muere en el firewall
    expect(rec['red']).toBe(255)          // la luz sigue fluyendo
  })

  test('F2 — el veto cubre TODAS las claves peligrosas en L0, exacto por clave', () => {
    const keys = [
      'smoke', 'smoke_pump', 'smoke_density',
      'fire', 'fire_valve', 'fire_ignite',
      'emission', 'emission_gate',
    ]
    const payload: Record<string, number> = { red: 1 }
    for (const k of keys) payload[k] = 1

    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0(NODE, payload)]))

    const rec = arbiter.arbitrate().get(NODE)!
    for (const k of keys) {
      expect(rec[k], `L0 no debe escribir '${k}'`).toBeUndefined()
    }
    expect(rec['red']).toBe(1)
  })

  test('F3 — Selene (L1) vetada: la IA no abre la válvula', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSeleneOverrides([{
      nodeId: NODE,
      values: { smoke: 1, fire_valve: 1, red: 1 },
      priority: 100, confidence: 1, source: 'selene_ai',
    }])

    const rec = arbiter.arbitrate().get(NODE)!
    expect(rec['smoke']).toBeUndefined()
    expect(rec['fire_valve']).toBeUndefined()
    expect(rec['red']).toBe(1)
  })

  test('F4 — Chronos (L1) vetado: playback automático no dispara pirotecnia', () => {
    const arbiter = new NodeArbiter()
    arbiter.setChronosBus(chronosBusOf([{
      nodeId: NODE,
      values: { fire_ignite: 1, emission_gate: 1 },
      priority: 100, confidence: 1, source: 'chronos',
    }]))

    const rec = arbiter.arbitrate().get(NODE)
    if (rec) {
      expect(rec['fire_ignite']).toBeUndefined()
      expect(rec['emission_gate']).toBeUndefined()
    }
  })

  test('F5 — L2 (Programmer/MIDI) conserva permiso total sobre canales peligrosos', () => {
    const arbiter = new NodeArbiter()
    arbiter.setManualOverride(NODE, { smoke: 1, fire_valve: 0.5, emission: 1 })

    const rec = arbiter.arbitrate().get(NODE)!
    expect(rec['smoke']).toBe(1)
    expect(rec['fire_valve']).toBe(0.5)
    expect(rec['emission']).toBe(1)
  })

  test('F6 — L3 (cue explícito vía AtmosphereCueDriver) conserva permiso', () => {
    const arbiter = new NodeArbiter()
    arbiter.setEffectIntents([{
      nodeId: NODE,
      values: { smoke_pump: 0.8, fire_ignite: 1 },
      priority: 300, confidence: 1, source: 'effect',
    }])

    const rec = arbiter.arbitrate().get(NODE)!
    expect(rec['smoke_pump']).toBeCloseTo(0.8, 6)
    expect(rec['fire_ignite']).toBe(1)
  })

  test('F7 — payload mixto: solo caen las claves peligrosas, fan_speed fluye', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0(NODE, {
      smoke_pump: 1, emission: 1,
      fan_speed: 0.6, dimmer: 0.4,
    })]))

    const rec = arbiter.arbitrate().get(NODE)!
    expect(rec['smoke_pump']).toBeUndefined()
    expect(rec['emission']).toBeUndefined()
    expect(rec['fan_speed']).toBeCloseTo(0.6, 6)  // ventilación ≠ consumible
    expect(rec['dimmer']).toBeCloseTo(0.4, 6)
  })

  test('F8 — L0 vetado no resucita cuando L2 toca el mismo canal', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0(NODE, { smoke: 1 })]))
    arbiter.setManualOverride(NODE, { smoke: 0.3 })

    const rec = arbiter.arbitrate().get(NODE)!
    expect(rec['smoke']).toBeCloseTo(0.3, 6)  // solo el valor del operador
  })
})
