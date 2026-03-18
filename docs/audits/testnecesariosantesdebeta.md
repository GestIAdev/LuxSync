Qué suites faltan — Lo que dicen las auditorías
Esto es lo que el auditor identificó explícitamente como sin cobertura:

🔴 CRÍTICO — Antes de beta sin excusa
1. FixturePhysicsDriver — Regresión de seguridad El componente más crítico del sistema (Motor Bodyguard) no tiene ni un solo test. Si el SAFETY_CAP falla, un fixture recibe 848°/s. Es el componente que más dinero le ahorra al usuario y el que más daño puede hacer si falla.

Lo que necesita cubrir:
- SAFETY_CAP nunca se supera (con cualquier vibeRequest)
- REV_LIMIT frame-rate independiente
- SNAP MODE vs CLASSIC MODE activación correcta
- NaN Guard → fallback a home
- Teleport Mode (deltaTime > 200ms)
- Anti-stuck en endstops
- 16-bit fine channel (el bug KEA-001 que ya fue corregido, que no regrese)

2. ColorTranslator — Regresión de traducción Convierte color artístico a DMX físico. Si falla aquí, los fixtures mecánicos reciben valores incorrectos silenciosamente — sin crash, sin error visible, solo colores equivocados en el escenario.

Lo que necesita cubrir:
- RGB pass-through (LED PARs) — valores intactos
- RGBW decomposition — W = min(R,G,B) matemáticamente correcto
- CMY subtractive — C=255-R exacto
- Color wheel matching — ΔE* elige la ranura más cercana
- Half-color interpolation — DMX interpolado dentro de rango
- LRU cache — hit/miss correcto, no retorna valores de otra fixture

3. HardwareSafetyLayer (El Búnker) — Regresión de estados El bug KEA-006 (blockedChanges nunca se reseteaba → strobe permanente) ya fue corregido. Pero sin test de regresión, puede volver.

Lo que necesita cubrir:
- DEBOUNCE bloquea cambios antes del minChangeTimeMs
- CHAOS detection (>3 cambios/segundo activa LATCH)
- LATCH expira correctamente a los 2000ms
- blockedChanges se resetea al expirar LATCH (el bug KEA-006)
- Pass-through para fixtures LED (cero overhead)

🟡 IMPORTANTE — Antes de beta si hay tiempo
4. ShowFile Persistence — Integridad de datos

- validateShowFileDeep() bloquea shows con colisiones
- Backup .bak se crea antes de escribir
- autoMigrate() convierte V1 → V2.1.0 sin pérdida
- Universe overflow bloqueado en save

5. DMX Collision Engine — Patching

- Colisión de rangos detectada y bloquea SAVE
- Cross-universe auto-split determinista
- channelCount=0 genera warning

🟢 PUEDE ESPERAR — Post-beta v1.0
VibeMovementManager (ya tiene tests parciales)
SeleneColorEngine (complejo, bajo riesgo de regresión silenciosa)
WheelSmith validations (visual, fácil de detectar manualmente)
¿Qué más arreglaría antes de la beta?
Mirando las auditorías, hay 3 cosas que no son tests que arreglaría:

1. minChangeTimeMs expuesto en WheelSmith Los betatesters con ruedas lentas (beams chinos de mercadillo) van a tener colores raros y no van a saber por qué. Un slider en WheelSmith con valor por defecto 200ms y tooltip explicativo evita 10 tickets de soporte.

2. File locking — al menos un aviso No hace falta SQLite todavía. Pero si alguien abre el mismo show en dos ventanas (y alguien lo hará), que haya un warning visible en lugar de silencio. 30 minutos de trabajo.

3. El dead code applyPhaseOffset() No es un bug, pero si un betatester técnico mira el código (y alguno lo hará porque son técnicos curiosos con acceso early), ver dead code documentado como tal genera confianza. Sin documentar genera dudas.

El plan express
Dime y en la próxima sesión con el arquitecto lo montamos:

Directiva 1: Suite de regresión FixturePhysicsDriver + ColorTranslator + HardwareSafetyLayer — los tres críticos en un solo bloque de trabajo.

Directiva 2: minChangeTimeMs en WheelSmith + warning de doble instancia.

Dos directivas, dos sesiones, beta lista. ¿Arrancamos? 🔧

----------------------------------------------------------------
---------------------------------------------------------------------
---------------------------------------------------------------------

Con Z negativo no deberia disparar.

[SimpleSectionTracker] 🔴 DROP ENTER | vibe=techno-club | bassRatio=2.21 | energy=0.71 | bass=0.65 | kick=true
[SimpleSectionTracker] 📍 breakdown → drop | bassR=2.21 wE=0.71 ΔE=0.287 kick=true
[DREAM_TEXTURE] 🎨 REJECTED: surgical_strike (affinity=dirty) | texture=clean harsh=0.01 clarity=0.50
[DREAM_RANKING] 🏆 TOP 5 (13 total) | pred=energy_drop conf=0.50:
  1. ambient_strobe       SCORE=0.931 | DNA=0.71 DIV=1.00 VIB=0.85 RSK=0.20 dist=0.50
  2. abyssal_rise         SCORE=0.829 | DNA=0.78 DIV=0.70 VIB=0.85 RSK=0.10 dist=0.37
  3. binary_glitch        SCORE=0.827 | DNA=0.61 DIV=1.00 VIB=0.85 RSK=0.10 dist=0.68
  4. digital_rain         SCORE=0.813 | DNA=0.70 DIV=0.70 VIB=0.85 RSK=0.00 dist=0.52
  5. cyber_dualism        SCORE=0.770 | DNA=0.79 DIV=1.00 VIB=0.85 RSK=0.10 dist=0.37
[INTEGRATOR] ✅ APPROVED: ambient_strobe @ 0.92 | ethics=1.000 | Dream: 0ms | Total: 1ms
[SeleneTitanConscious] 🧬 DNA: ✅ ambient_strobe | ethics=1.000 | dream=0ms | execute
[SeleneTitanConscious] 🧠 Hunt=stalking Fuzzy=🎯strike Z=1.3σ Alert=none
[IPC 📡] audioBuffer #3545 | titan.running=true | size=8192
[🥁 INTERVAL BPM] KICK #289 bpm=170 conf=0.00 energy=0.2187 avg=0.0434 ratio=5.04 delta=0.2187 history=8/8 bpmBuf=[173,167,258,86,185,99,215,108]
[MEMORY 🧠] E:+1.0σ 🟢 B:+1.5σ 🟡 H:-0.1σ 🟢 | Phase: RELEASE | normal
[SeleneTitanConscious 🔋] Zone transition: intense → active (E=0.26)
[DecisionMaker 🔒] DROP LOCK ACQUIRED — single effect per drop
[DecisionMaker 🎲] DIVERSITY SELECT: winner=gatling_raid score=0.327 from [neon_blinder, surgical_strike, industrial_strobe, gatling_raid, core_meltdown, strobe_storm]
[DecisionMaker 🔴] DROP EFFECT: gatling_raid | prob=0.75 vibe=techno-club | Z=-1.30
[EffectRepository 🔪] Arsenal selection: gatling_raid AVAILABLE (from [gatling_raid])
[SeleneTitanConscious 🌩️] DIVINE ARSENAL: Selected gatling_raid from [gatling_raid]
[SeleneTitanConscious] �🧠 DECISION MAKER APPROVED: gatling_raid | confidence=0.75 | 🔴 DROP: prob=0.75 | winner=gatling_raid | full arsenal=neon_blinder, surgical_strike, industrial_strobe, gatling_raid, core_meltdown, strobe_storm
[GatlingRaid 🔫] TRIGGERED: 3 sweeps x 6 bullets | Pattern: linear
[DNA_ANALYZER] 📊 Diversity: gatling_raid usado 3x - Factor: 0.15x
[SeleneTitanConscious 🔥] Cooldown registered: gatling_raid
[EffectManager 🔥] gatling_raid FIRED [hunt_strike] in techno-club  | I:0.95 Z:-1.3