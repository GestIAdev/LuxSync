// 🆕 WAVE 1010.5: THE LOST FOUR
this.effectFactories.set('amazon_mist', () => new AmazonMist())
this.effectFactories.set('machete_spark', () => new MacheteSpark())
this.effectFactories.set('glitch_guaguanco', () => new GlitchGuaguanco())
this.effectFactories.set('latina_meltdown', () => new LatinaMeltdown())

EL TROMPETAZO LATINO

NUEVO EFECTO: OroSolido (oro_solido)
- Sustituye el hueco de strobe_storm en fiesta-latina con peso y brillo
- mixBus=global (Dictador absoluto — silencia todo)
- duration=1200ms SHORT — puede usar color en movers
- priority=98 (entre latina_meltdown 95 y solar_flare 100)

MECÁNICA VISUAL (2 fases):
  FASE 1 LATCH (0→250ms): Todos los Pars + Movers al 100% instantáneo
    Movers apuntan al público (Tilt 45°, Pan centrado) — muro de oro que ciega
  FASE 2 BARRIDO (250→1200ms): Decay exponencial en Pars (resonancia bombo)
    Movers izquierda barren izquierda, derecha barren derecha (apertura/cadera)

PALETA: Oro Puro / Ámbar Saturado
  Peak:  R:255 G:200 B:40  W:255 A:255
  Decay: R:255 G:120 B:0   W:80  A:200

DNA:
  aggression: 0.90 — Golpe brutal de sección de vientos
  chaos:      0.15 — Coreografiado y simétrico, cero caos
  organicity: 0.40 — Cuerpo físico (vientos + bombo), no máquina pura
  textureAffinity: universal

CABLEADO (16 puntos):
  ✅ OroSolido.ts — clase completa con BaseEffect
  ✅ EffectManager.ts — import + factory register
  ✅ EffectManager.ts — EFFECT_VIBE_RULES (isDynamic)
  ✅ EffectManager.ts — isEmergency list
  ✅ EffectManager.ts — dictatorIsPeak list
  ✅ ContextualEffectSelector.ts — DICTATOR_HARD_MINIMUM_COOLDOWNS (22s)
  ✅ ContextualEffectSelector.ts — EFFECT_COOLDOWNS (28s base)
  ✅ ContextualEffectSelector.ts — EFFECT_TEXTURE_COMPATIBILITY (universal)
  ✅ ContextualEffectSelector.ts — SECTION_EFFECT_PALETTE drop.latinaOverride
  ✅ ContextualEffectSelector.ts — EFFECTS_BY_VIBE fiesta-latina
  ✅ ContextualEffectSelector.ts — getEffectsAllowedForZone peak
  ✅ EffectDNA.ts — EFFECT_DNA_REGISTRY zona PEAK
  ✅ DecisionMaker.ts — DIVINE_ARSENAL fiesta-latina (#2 slot)
  ✅ MonteCarloLab-Latino.ts — EFFECT_DNA_REGISTRY local + PEAK expected
  ✅ wave902-vocabulary-test.ts — latino-organic roster
