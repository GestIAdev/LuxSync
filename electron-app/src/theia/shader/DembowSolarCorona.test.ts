/**
 * 🔥 WAVE 8402 — Pack Latino · átomo "Dembow Solar Corona".
 *
 * Certifica:
 *  - Cabecera: ADN (0.8/0.5/1.0), vibes con comas para Selene V3.
 *  - Contrato de autor: sin u_impact/u_approach (prohibidos desde 8287),
 *    sin intents de Selene en geometría, mainImage canónico, salida lineal.
 *  - Matemática pedida: SDF de esfera desplazada por FBM (≥4 octavas,
 *    dominio circular sin costura), grave→llamaradas, medios→ebullición.
 *  - Destello compliant: downbeat por u_barPhase × u_speed, cegado por
 *    u_blend durante el X-FADE (paridad con el ducking del HOTFIX 8312).
 */

import { describe, expect, it } from 'vitest'
import DEMBOW_SRC from '../../../assets/shaders/dembow_solar_corona.glsl?raw'
import {
  assembleFragmentShader,
  hasMainImage,
  parseEuclidMeta,
} from './ShaderAssembler'

describe('WAVE 8402 — cabecera del átomo', () => {
  const meta = parseEuclidMeta(DEMBOW_SRC)

  it('ADN inicial: agresión alta, caos medio, organicidad máxima', () => {
    expect(meta.genome).toEqual({ aggression: 0.8, chaos: 0.5, organicity: 1.0 })
  })

  it('vibes de Selene V3 (separadas por comas)', () => {
    expect(meta.vibes).toEqual(['fiesta-latina', 'reggaeton', 'fuego', 'sun', 'dembow'])
  })

  it('genes con guardia #ifndef y params neutros (Cero Neutro)', () => {
    expect(meta.genes.map((g) => g.name)).toEqual(['G_BOIL', 'G_FLAME', 'G_SEED', 'G_OCT'])
    expect(meta.params.map((p) => [p.name, p.defaultValue])).toEqual([
      ['u_flare', 0],
      ['u_heat', 0],
    ])
    for (const g of ['G_BOIL', 'G_FLAME', 'G_SEED', 'G_OCT']) {
      expect(DEMBOW_SRC).toContain(`#ifndef ${g}`)
    }
  })
})

describe('WAVE 8402 — contrato de autor', () => {
  const code = DEMBOW_SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')

  it('firma mainImage canónica', () => {
    expect(hasMainImage(DEMBOW_SRC)).toBe(true)
  })

  it('Clean Shot: sin u_impact / u_approach / intents de Selene', () => {
    expect(code).not.toMatch(/u_impact|u_approach|u_predictiveETA|u_strobeGate/)
    expect(code).not.toMatch(/u_seleneConfidence|u_tension|u_epicness|u_selEta/)
  })

  it('salida lineal: sin auto-tonemap ni gamma propia', () => {
    expect(code).not.toMatch(/1\.0\s*-\s*exp\(\s*-\s*col/)
    expect(code).not.toMatch(/pow\s*\(\s*col/)
  })

  it('turbulencia ridged (|noise|) multifractal, no FBM suave', () => {
    expect(code).toMatch(/1\.0 - abs\(2\.0 \* n - 1\.0\)/)
    expect(code).toMatch(/float ridgeFbm\(vec3 q\)/)
    expect(code).toMatch(/s\s+\+= a \* r \* w/)             // ponderado por la cresta previa
    expect(code).not.toMatch(/softFbm/)
  })

  it('polares sin costura: dirección + altura, sin atan()', () => {
    expect(code).not.toMatch(/atan\s*\(/)
    expect(code).toMatch(/h \* 6\.0 - tc/)                // eyección radial hacia fuera
    expect(code).toMatch(/exp\(-h \/ max\(reach/)         // alpha radial
  })

  it('fotosfera volumétrica: normal de esfera + granulación + limbo + manchas', () => {
    expect(code).toMatch(/sqrt\(max\(1\.0 - rr \* rr/)
    expect(code).toMatch(/gran/)
    expect(code).toMatch(/limb/)
    expect(code).toMatch(/spot/)
  })

  it('paleta de alto contraste: rampa de cuerpo negro x²/x³/x⁵', () => {
    expect(code).toMatch(/vec3 fireRamp\(float x\)/)
  })

  it('ebullición pesada: multiplicador del reloj ≤ 0.05 (lava/miel)', () => {
    const m = code.match(/float t\s*=\s*([0-9.]+) \* G_BOIL/)
    expect(m).not.toBeNull()
    expect(parseFloat(m![1])).toBeLessThanOrEqual(0.05)
  })

  it('relojes Ley-1: t es combinación de integrales host — nunca tiempo×señal (8418-C)', () => {
    // t = ∫rate·dt construido como Σwᵢ·xᵢTime — las bandas modulan la
    // VELOCIDAD del reloj sin tocar su fase (adiós al snap ∝ acumulado).
    expect(code).toMatch(/u_midTime/)
    expect(code).toMatch(/u_energyTime/)
    const t = code.match(/float t\s*=[^;]*;/)![0]
    expect(t).not.toMatch(/gBeats|u_speed|u_mid\b|u_energy\b/)
    expect(code).toMatch(/float tc\s*= gBeats \* 0\.070 \* G_FLAME/) // tc: reloj puro
  })

  it('contraste dinámico: lava idle con pow(gran,1.5) + emisión × percusión (8402-F)', () => {
    expect(code).toMatch(/pow\(gran, 1\.5\)/)
    expect(code).toMatch(/max\(kick, 0\.65 \* bass\)/)
    expect(code).toMatch(/\(0\.6 \+ 1\.8 \* pulse\)/)
  })

  it('cataclismo cálido: sin cian, horizonte difuso, z-index suave, estela (8402-F)', () => {
    expect(code).not.toMatch(/vec3\(0\.05, 0\.55, 1\.00\)/)         // adiós cian
    expect(code).not.toMatch(/vec3\(0\.55, 0\.95, 1\.20\)/)
    expect(code).toMatch(/smoothstep\(Rh \* 1\.12, Rh \* 0\.55, r\)/) // horizonte ancho
    expect(code).toMatch(/bleed/)                                     // magenta que sangra
    expect(code).toMatch(/smoothstep\(0\.14, -0\.14, dq\.y\)/)        // fusión Y inclinada
    expect(code).toMatch(/rot2\(-0\.22\) \* rq/)                      // tap de motion blur
  })

  it('early cull: fuera del alcance no se calcula FBM (8402-E)', () => {
    expect(code).toMatch(/float cutR\s*=/)
    expect(code).toMatch(/if \(r < cutR\)/)
    // El agujero negro queda FUERA del cull: su disco llega a los bordes.
    const iCull = code.indexOf('if (r < cutR)')
    const iBH   = code.indexOf('if (k > 0.01)')
    expect(iBH).toBeGreaterThan(iCull)
    expect(code.slice(iCull, iBH)).toContain('} // ── early cull')
    // G_OCT: default barato (3 octavas bastan en HQ).
    expect(DEMBOW_SRC).toMatch(/G_OCT\s+struct int\s+\d+\s+\d+\s+3/)
  })

  it('dinámica: u_bass hincha (squash & stretch) sin acelerar el reloj', () => {
    expect(code).toMatch(/u_bass/)
    expect(code).toMatch(/u_mid/)
    expect(code).toMatch(/p\.x \/ \(1\.0 \+ sq\)/)
    expect(code).toMatch(/p\.y \/ \(1\.0 - 0\.7 \* sq\)/)
    const t = code.match(/float t\s*=[^;]*;/)![0]
    expect(t).not.toMatch(/u_bass|u_kickPulse/)
  })

  it('colapso DMX: agujero negro de acreción anclado a u_activeEffectEnergy', () => {
    expect(code).toMatch(/u_activeEffectEnergy/)
    expect(code).not.toMatch(/u_flashState/)              // es el limitador, no un trigger
    expect(code).toMatch(/k \* 7\.0/)                      // colapso: offset acotado (8418-C)
    expect(code).toMatch(/float hole/)                    // núcleo a negro absoluto
    expect(code).toMatch(/\/ \(dr \+ 0\.06\)/)            // rotación diferencial kepleriana
    expect(code).toMatch(/photon/)
    expect(code).not.toMatch(/tear|neutron/)              // adiós al desgarro UV
  })

  it('destello de frase compliant: u_barPhase × u_speed, cegado por u_blend', () => {
    expect(code).toMatch(/exp\(-7\.0 \* u_barPhase\) \* u_speed/)
    expect(code).toMatch(/u_blend/)
    expect(code).toMatch(/u_crestPulse/)
  })
})

describe('WAVE 8402 — ensamblado', () => {
  it('el átomo ensambla con mainImage y sin colisión de símbolos', () => {
    const asm = assembleFragmentShader(DEMBOW_SRC, 64)
    expect(asm.fragSource).toContain('void mainImage')
    expect(asm.fragSource.indexOf('ridgeFbm')).toBeGreaterThan(0)
  })
})
