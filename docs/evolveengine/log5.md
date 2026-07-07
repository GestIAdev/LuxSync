ELENE SPECTRAL AUDIT & LFX ENERGY MAP
Operación: SELENE SPECTRAL AUDIT & LFX ENERGY MAP
Fecha: 2026-07-07
1. AUDITORÍA DE ALGORITMOS ESPECTRALES
1.1 Filtro Anti-Voz (Spectral Gate) — "Anti-Bad-Bunny" (WAVE 4864)
Ubicación: @/electron-app/src/core/intelligence/think/DecisionMaker.ts:384-413 (path DIVINE) y @/electron-app/src/core/intelligence/think/DecisionMaker.ts:1040-1051 (path DROP).

Problemática resuelta: En reggaetón/latino, la compresión de voces autotuneadas infla la banda MID, elevando rawEnergy (TOTAL) por encima del umbral del Absolute Energy Gate durante valles rítmicos donde el bombo/bajo ha desaparecido. Resultado: disparos HEAVY/DROP en silencios vocales.

Variable clave: bassPresenceSustained
Computación: @/electron-app/src/core/intelligence/SeleneTitanConscious.ts:851



typescript
bassPresenceSustained: this._fftXRayAvgLowLastN(30)
Implementación (@/SeleneTitanConscious.ts:868-878):

Buffer rodante _fftXRayLow[] de 180 frames (~3s @ 60fps), alimentado por _fftXRayUpdate() en cada tick.
_fftXRayAvgLowLastN(30) calcula el promedio aritmético de los últimos 30 frames (~0.5s) de la banda LOW del FFT X-Ray.
Esto proporciona inercia contra plosivas instantáneas y 808 cortos: un kick aislado no infla el promedio de 0.5s, pero un bombo sostenido sí.
Si bassPresenceSustained no está disponible, se hace fallback a pattern.bassPresence (valor instantáneo del frame).
Condiciones del Spectral Gate
El gate solo activa para vibes latino/dembow, y solo cuando el Absolute Energy Gate ya pasó:



typescript
const isLatinoVibeForSpectral = _vId.includes('latino') || _vId.includes('latina') || _vId.includes('dembow')
Dos condiciones deben cumplirse simultáneamente:

Condición	Fórmula	Significado
hasHeavyKick	lowBand >= maxHistoric * 0.75	El bombo está empujando fuerte (al 75% del pico histórico de 30s)
isNotJustVocals	lowBand >= midBand * 0.95	La banda baja no es eclipsada por los medios (voces autotuneadas)
Ambas deben ser true → spectralGateOpen = hasHeavyKick && isNotJustVocals

Si cualquiera falla, el disparo DIVINE/DROP se bloquea con log:

'Low-Band Insufficient' — el bombo no llega al 75% del pico histórico
'Vocals Eclipse Beat' — los medios (voces) superan a los graves
Absolute Energy Gate (complementario)
Path DIVINE (@/DecisionMaker.ts:375-381):

ABSOLUTE_ENERGY_GATE_RATIO = 0.60 — rawEnergy debe ser ≥ 60% del maxHistoric (pico del buffer 30s)
ABSOLUTE_ENERGY_GATE_FALLBACK = 0.50 — si no hay historial (primeros 30s), usar 0.50 fijo
Path DROP (@/DecisionMaker.ts:1035-1037):

Ratio reducido a 0.48 (WAVE 5001 — calibración Montecarlo para redobles latinos)
Fallback de 0.40
Resumen del flujo anti-voz


Cantante agudo de reggaetón → MID band alta → rawEnergy supera AbsGate
  → Pero bassPresenceSustained (promedio 30 frames LOW) es bajo
  → hasHeavyKick = FALSE (lowBand < 75% maxHistoric)
  → spectralGateOpen = FALSE
  → DIVINE/DROP BLOCKED → "Vocals Eclipse Beat" o "Low-Band Insufficient"
1.2 Umbrales Z-Score por Vibe
Z-Score Base — ContextualMemory
Ubicación: @/electron-app/src/core/intelligence/memory/ContextualMemory.ts:172-179

Threshold	Valor	Significado
zScoreNotable	1.5σ	Algo interesante
zScoreSignificant	2.0σ	Raro (~5%)
zScoreEpic	2.5σ	Anomalía (~1%) → trigger threshold
RollingStats (@/electron-app/src/core/intelligence/memory/RollingStats.ts:44-65):

bufferSize: 1800 frames (~30s @ 60fps) — WAVE 1181
minStdDev: 0.10 — WAVE 5003 (suelo de varianza anti-falsos-positivos)
maxZScoreCap: 10.0 — clamp anti-outliers absurdos
isWarmedUp: buffer ≥ 50% lleno (900 frames ~ 15s)
DropBridge — Thresholds por Vibe
Ubicación: @/electron-app/src/core/intelligence/think/DropBridge.ts:123-171

Vibe	Z-Score Threshold	Min Energy	Watching	Imminent
Estándar	3.0σ	0.60	2.0σ	2.5σ
Latino	3.5σ	0.70	2.5σ	3.0σ
Techno	2.2σ	0.55	1.5σ	2.0σ
Cooldown: 2000ms entre activaciones. HIGH_Z_PERSISTENCE = 3 frames consecutivos sobre imminentThreshold para alerta alta.

DecisionMaker — DIVINE Threshold
Ubicación: @/electron-app/src/core/intelligence/think/DecisionMaker.ts:69,452,458

Vibe	effectiveDivineThreshold	Notas
Estándar	4.0σ	DIVINE_THRESHOLD = 4.0 (WAVE 2185 — dual validation)
Techno	2.5σ	Techno maxes at ~2.6σ, umbral bajado
Latino	2.2σ	Dembow infla Z-scores artificialmente
DIVINE_ENERGY_GATE = 0.80 (@/DecisionMaker.ts:452) — rawEnergy debe ser ≥ 0.80 para autorizar DIVINE (WAVE 2494).

Anti-Fake-Drop — Z-Score Sanity Check
Ubicación: @/electron-app/src/core/intelligence/think/DecisionMaker.ts:1104-1128

Vibe	antiFakeThreshold	Excepciones
Latino	1.1σ	WAVE 5018-B: subir de 0.85 a 1.1 para ignorar repuntes de percusión latina
Estándar	0.5σ	—
Techno	0.2σ	Si lowBand > 0.65: -1.0σ (bombo revienta subgraves). Si DNA aprobó en PUNK/BALANCED: -0.2σ
Lógica: Si isHeavyEffect(suggestedEffect) && currentZ < antiFakeThreshold → disparo ABORTED.

2. MAPEO DE ZONAS ENERGÉTICAS — Inventario LFX
Orden de zonas energéticas


silence(0) → valley(1) → ambient(2) → gentle(3) → active(4) → intense(5) → peak(6)
Inventario ordenado por rango energético (de suave a agresivo)
#	Effect ID	Name	Zone Min	Zone Max	Span (zonas)	Alerta
1	solar_caustics	Solar Caustics	silence	silence	1	✅
2	surface_shimmer	Surface Shimmer	silence	silence	1	✅
3	amazon_mist	Amazon Mist	silence	valley	2	✅
4	ghost_breath	Ghost Breath	silence	valley	2	✅
5	amp_heat	Amp Heat	ambient	gentle	2	✅
6	deep_breath	Deep Breath	ambient	gentle	2	✅
7	stage_wash	Stage Wash	ambient	gentle	2	✅
8	corazon_latino	Corazón Latino	ambient	active	3	⚠️
9	cumbia_moon	Cumbia Moon	gentle	active	2	✅
10	ghost_chase	Ghost Chase	gentle	active	2	✅
11	liquid_solo	Liquid Solo	gentle	active	2	✅
12	spotlight_pulse	Spotlight Pulse	gentle	active	2	✅
13	tidal_wave	Tidal Wave	gentle	active	2	✅
14	void_mist	Void Mist	gentle	active	2	✅
15	abyssal_rise	Abyssal Rise	active	intense	2	✅
16	acid_sweep	Acid Sweep	active	intense	2	✅
17	arena_sweep	Arena Sweep	active	intense	2	✅
18	cyber_dualism	Cyber Dualism	active	intense	2	✅
19	kitt_scanner	K.I.T.T. Scanner	active	intense	2	✅
20	salsa_fire	Salsa Fire	active	intense	2	✅
21	seismic_snap	Seismic Snap	active	intense	2	✅
22	static_pulse	Static Pulse	active	intense	2	✅
23	strobe_burst	Strobe Burst	active	intense	2	✅
24	ambient_strobe	Ambient Strobe	intense	peak	2	✅
25	binary_glitch	Binary Glitch	intense	peak	2	✅
26	cascade_strike	Cascade Strike	intense	peak	2	✅
27	core_meltdown	Core Meltdown	intense	peak	2	✅
28	cyber_scanner	Cyber Scanner	intense	peak	2	✅
29	divine_obliteration	Divine Obliteration	intense	peak	2	✅
30	efecto_base	Efecto Base	intense	peak	2	✅
31	gatling_raid	Gatling Raid	intense	peak	2	✅
32	industrial_strobe	Industrial Strobe	intense	peak	2	✅
33	latina_meltdown	Latina Meltdown	intense	peak	2	✅
34	lateral_frag	Lateral Frag	intense	peak	2	✅
35	machine_gun	Machine Gun	intense	peak	2	✅
36	neon_blinder	Neon Blinder	intense	peak	2	✅
37	oro_solido	Oro Sólido	intense	peak	2	✅
38	power_chord	Power Chord	intense	peak	2	✅
39	red_surge	Red Surge	intense	peak	2	✅
40	solar_flare	Solar Flare	intense	peak	2	✅
41	strobe_storm	Strobe Storm	intense	peak	2	✅
42	thunder_struck	Thunder Struck	intense	peak	2	✅
43	void_collapse	Void Collapse	intense	peak	2	✅
44	wrath_of_titans	Wrath of the Titans	intense	peak	2	✅
Distribución por rango energético
Rango	Cantidad	Efectos
silence (solo)	2	solar_caustics, surface_shimmer
silence → valley	2	amazon_mist, ghost_breath
ambient → gentle	3	amp_heat, deep_breath, stage_wash
ambient → active ⚠️	1	corazon_latino
gentle → active	6	cumbia_moon, ghost_chase, liquid_solo, spotlight_pulse, tidal_wave, void_mist
active → intense	9	abyssal_rise, acid_sweep, arena_sweep, cyber_dualism, kitt_scanner, salsa_fire, seismic_snap, static_pulse, strobe_burst
intense → peak	21	ambient_strobe, binary_glitch, cascade_strike, core_meltdown, cyber_scanner, divine_obliteration, efecto_base, gatling_raid, industrial_strobe, latina_meltdown, lateral_frag, machine_gun, neon_blinder, oro_solido, power_chord, red_surge, solar_flare, strobe_storm, thunder_struck, void_collapse, wrath_of_titans
⚠️ Alertas de Inconsistencia
1 efecto con span > 2 zonas:

Effect	Zone Min	Zone Max	Span	Zonas cubiertas
⚠️ corazon_latino	ambient	active	3	ambient, gentle, active
corazon_latino viola la regla arquitectónica de máximo 2 zonas adyacentes. Su rango ambient → active cubre 3 zonas (ambient + gentle + active), excediendo el límite de transición térmica rápida del live show.

Recomendación: Reducir a ambient → gentle o gentle → active según la intención musical del efecto.

Observaciones adicionales
42 de 44 efectos cumplen la regla de ≤2 zonas adyacentes ✅
21 de 44 efectos (48%) están concentrados en intense → peak — sesgo hacia arsenal de clímax
Solo 4 efectos cubren zonas de silencio/valle — posible gap en arsenal ambiental
efecto_base (plantilla V3) tiene intense → peak — verificar si es intencional o herencia de template
ambient_strobe tiene nombre "Ambient" pero zona intense → peak — inconsistencia semántica (es un strobe de 15Hz, no ambiental)
Fin del reporte — Solo lectura, ningún archivo modificado.