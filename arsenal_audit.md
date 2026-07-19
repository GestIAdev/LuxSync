# WAVE 7177 — Auditoría del Arsenal de Efectos .lfx

**Fecha:** 2026-07-18  
**Total de archivos:** 42 (34 Repo + 10 Local)  
**Fuente Repo:** `electron-app/src/core/arsenal/builtins/`  
**Fuente Local:** `%APPDATA%/luxsync-electron/arsenal/`

---

## Tabla 1 — Efectos Divine (Máxima Prioridad)

| ID / Nombre | Origen | Arquetipo | Zonas de Energía | Presión Acústica | Textura | Agresividad | validSections | compatibleVibes |
|---|---|---|---|---|---|---|---|---|
| divine_obliteration | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | clean | 0.8 – 1.0 (agg=1.0) | drop | techno-club, fiesta-latina |
| wrath_of_titans | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.8 – 1.0 (agg=1.0) | buildup, drop | techno-club |
| core_meltdown | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.0 – 1.0 (agg=1.0) | drop, peak | techno-club, pop-rock |
| industrial_strobe | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.0 – 1.0 (agg=1.0) | drop, peak | techno-club, pop-rock |
| neon_blinder | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.0 – 1.0 (agg=0.98) | drop, peak | techno-club |
| strobe_storm | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.0 – 1.0 (agg=0.95) | drop, peak | fiesta-latina, techno-club |
| latina_meltdown (Repo) | Repo | Divine+Strobe | intense → peak | 0.5 – 1.0 | universal | 0.0 – 1.0 (agg=0.95) | drop, peak | fiesta-latina |
| latina_meltdown (Local) | Local | Divine+Strobe | intense → peak | 0.5 – 1.0 | universal | 0.0 – 1.0 (agg=0.95) | drop, peak | fiesta-latina |
| gatling_raid | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.8 – 1.0 (agg=0.93) | drop, peak | techno-club |
| power_chord | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.0 – 1.0 (agg=0.97) | drop, peak | pop-rock |
| ambient_strobe | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.75 – 1.0 (agg=0.95) | drop, peak | techno-club, fiesta-latina |
| solar_flare (Repo) | Repo | Divine+Heavy | intense → peak | 0.5 – 1.0 | universal | 0.0 – 1.0 (agg=0.9) | drop, peak | fiesta-latina, techno-club |
| solar_flare (Local) | Local | Divine+Heavy | ambient → gentle | 0.5 – 1.0 | clean | 0.3 – 0.3 (agg=0.3) | drop, peak | fiesta-latina |
| red_surge | Repo | Divine+Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.5 – 1.0 (agg=0.88) | drop, peak | techno-club |
| binary_glitch (Repo) | Repo | Divine+Strobe | intense → peak | 0.5 – 1.0 | universal | 0.7 – 1.0 (agg=0.88) | drop, impact | techno-club |
| binary_glitch (Local) | Local | Divine+Strobe | intense → peak | 0.61 – 1.0 | dirty | 0.88 – 0.88 (agg=0.88) | drop, impact | techno-club |

---

## Tabla 2 — Efectos Heavy

| ID / Nombre | Origen | Arquetipo | Zonas de Energía | Presión Acústica | Textura | Agresividad | validSections | compatibleVibes |
|---|---|---|---|---|---|---|---|---|
| machine_gun (Repo) | Repo | Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.85 – 1.0 (agg=1.0) | drop, peak | techno-club |
| machine_gun (Local) | Local | Heavy+Strobe | intense → peak | **0.65 – 1.0** | dirty | 1.0 – 1.0 (agg=1.0) | drop, peak | techno-club |
| lateral_frag | Repo | Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.7 – 1.0 (agg=0.92) | drop, peak | techno-club |
| strobe_burst | Repo | Heavy+Strobe | active → intense | 0.5 – 1.0 | dirty | 0.0 – 1.0 (agg=0.9) | build, drop, breakdown | fiesta-latina, techno-club |
| cyber_scanner | Repo | Heavy | intense → peak | 0.5 – 1.0 | clean | 0.7 – 1.0 (agg=0.9) | drop, active | techno-club |
| salsa_fire | Repo | Heavy+Strobe | active → intense | 0.5 – 1.0 | dirty | 0.0 – 1.0 (agg=0.85) | build, drop, breakdown | fiesta-latina |
| cascade_strike | Repo | Heavy+Strobe | intense → peak | 0.5 – 1.0 | dirty | 0.6 – 1.0 (agg=0.85) | drop, peak | techno-club |
| seismic_snap | Repo | Heavy+Strobe | active → intense | 0.5 – 1.0 | dirty | 0.0 – 1.0 (agg=0.87) | build, drop, breakdown | techno-club |
| abyssal_rise | Repo | Heavy+Strobe | active → intense | 0.5 – 1.0 | clean | 0.4 – 0.9 (agg=0.7) | build, buildup | techno-club |
| thunder_struck | Repo | Heavy | intense → peak | 0.5 – 1.0 | universal | 0.0 – 1.0 (agg=0.95) | drop, peak | pop-rock |
| Feral Wave Omega (Local) | Local | Heavy | intense → peak | **MISSING** | universal | 0.0 – 1.0 (agg=0.98) | drop, peak | latin |

---

## Tabla 3 — Efectos Strobe (no Divine, no Heavy)

| ID / Nombre | Origen | Arquetipo | Zonas de Energía | Presión Acústica | Textura | Agresividad | validSections | compatibleVibes |
|---|---|---|---|---|---|---|---|---|
| cyber_dualism (Local) | Local | Strobe | intense → peak | 0.75 – 1.0 | dirty | 0.9 – 0.9 (agg=0.9) | build, drop, breakdown | techno-club |
| cyber_dualism (Repo) | Repo | Strobe | active → intense | 0.5 – 1.0 | dirty | 0.0 – 0.98 (agg=0.83) | build, drop, breakdown | techno-club |
| static_pulse | Repo | Strobe | active → intense | 0.5 – 1.0 | dirty | 0.0 – 0.9 (agg=0.75) | build, drop, breakdown | techno-club |

---

## Tabla 4 — Efectos Utility / Resto

| ID / Nombre | Origen | Arquetipo | Zonas de Energía | Presión Acústica | Textura | Agresividad | validSections | compatibleVibes |
|---|---|---|---|---|---|---|---|---|
| arena_sweep | Repo | Utility | active → intense | 0.5 – 1.0 | universal | 0.0 – 0.9 (agg=0.75) | build, drop, breakdown | pop-rock |
| cumbia_moon | Repo | Utility | gentle → active | 0.0 – 1.0 | universal | 0.0 – 0.8 (agg=0.65) | intro, breakdown, valley, outro | fiesta-latina, chill-lounge |
| void_mist | Repo | Utility | gentle → active | 0.0 – 1.0 | universal | 0.0 – 0.75 (agg=0.6) | build, active, breakdown | techno-club |
| liquid_solo | Repo | Utility | gentle → active | 0.0 – 1.0 | universal | 0.0 – 0.75 (agg=0.6) | build, active, breakdown | pop-rock |
| tidal_wave | Repo | Utility | gentle → active | 0.0 – 1.0 | clean | 0.3 – 0.7 (agg=0.55) | intro, breakdown, active, outro | fiesta-latina |
| spotlight_pulse | Repo | Utility | gentle → active | 0.0 – 1.0 | universal | 0.0 – 0.7 (agg=0.55) | build, active, breakdown | pop-rock |
| ghost_chase | Repo | Utility | gentle → active | 0.0 – 1.0 | universal | 0.0 – 0.65 (agg=0.5) | intro, breakdown, valley, outro | techno-club |
| heph_1782937097650_pjisyy | Local | Utility | gentle → active | **0.0 – 0.0** | universal | 0.5 – 0.5 (agg=0.5) | (vacío) | techno-club |
| acid_sweep | Repo | Utility | active → intense | 0.0 – 1.0 | clean | 0.3 – 0.7 (agg=0.45) | build, drop | techno-club |
| deep_breath | Repo | Utility | ambient → gentle | 0.0 – 0.5 | universal | 0.0 – 0.55 (agg=0.4) | intro, breakdown, valley, outro | techno-club |
| corazon_latino (Local) | Local | Utility | gentle → active | 0.0 – 1.0 | universal | 0.38 – 0.38 (agg=0.38) | ambient, gentle, valley, breakdown | fiesta-latina |
| corazon_latino (Repo) | Repo | Utility | ambient → active | 0.0 – 1.0 | clean | 0.25 – 0.6 (agg=0.38) | ambient, gentle, valley, breakdown | fiesta-latina |
| amp_heat | Repo | Utility | ambient → gentle | 0.0 – 0.5 | clean | 0.0 – 0.45 (agg=0.3) | intro, breakdown, valley, outro | pop-rock |
| heph_1782609140553_bto9fn | Local | Utility | valley → ambient | **MISSING** | universal | 0.21 – 0.21 (agg=0.21) | (vacío) | fiesta-latina |
| stage_wash | Repo | Utility | ambient → gentle | 0.0 – 0.5 | clean | 0.0 – 0.4 (agg=0.25) | intro, breakdown, valley, outro | pop-rock |
| kitt_scanner (Local) | Local | Utility | active → intense | 0.5 – 1.0 | universal | 0.7 – 0.7 (agg=0.7) | active, intense | techno-club |
| kitt_scanner (Repo) | Repo | Utility | active → intense | 0.0 – 1.0 | clean | 0.5 – 0.9 (agg=0.7) | active, intense | techno-club |
| efecto_base | Repo | Utility | intense → peak | 0.0 – 1.0 | clean | 0.4 – 0.8 (agg=0.6) | drop | techno-club |
| amazon_mist | Repo | Utility | silence → valley | 0.0 – 1.0 | clean | 0.0 – 0.27 (agg=0.12) | intro, outro, silence | fiesta-latina, chill-lounge |
| ghost_breath | Repo | Utility | silence → valley | 0.0 – 1.0 | clean | 0.0 – 0.25 (agg=0.1) | intro, outro, silence | chill-lounge, fiesta-latina |
| surface_shimmer | Repo | Utility | silence → silence | 0.0 – 1.0 | clean | 0.03 – 0.33 (agg=0.18) | intro, breakdown, valley, outro | chill-lounge |
| solar_caustics | Repo | Utility | silence → silence | 0.0 – 1.0 | clean | 0.0 – 0.3 (agg=0.15) | intro, breakdown, valley, outro | chill-lounge |

---

## Hallazgos Críticos

### Overrides Local → Repo (IDs duplicados)

Los siguientes efectos existen en **ambas** carpetas (Repo y Local). El loader carga Repo primero, Local después (last-write-wins), por lo que la versión Local **debería** ganar en runtime:

| ID | Campo | Repo | Local | ¿Desincronización? |
|---|---|---|---|---|
| machine_gun | pressureRange | 0.5 – 1.0 | **0.65 – 1.0** | Sí — Local tiene presión modificada por usuario |
| machine_gun | aggressionRange | 0.85 – 1.0 | **1.0 – 1.0** | Sí — Local tiene aggression fijada en 1.0 |
| binary_glitch | pressureRange | 0.5 – 1.0 | **0.61 – 1.0** | Sí — Local tiene presión modificada |
| binary_glitch | textureAffinity | universal | **dirty** | Sí — Local cambió textura |
| binary_glitch | aggressionRange | 0.7 – 1.0 | **0.88 – 0.88** | Sí — Local fijó aggression en 0.88 |
| cyber_dualism | energyZone | active → intense | **intense → peak** | Sí — Local subió de zona |
| cyber_dualism | pressureRange | 0.5 – 1.0 | **0.75 – 1.0** | Sí — Local subió presión mínima |
| cyber_dualism | aggressionRange | 0.0 – 0.98 | **0.9 – 0.9** | Sí — Local fijó aggression |
| cyber_dualism | textureAffinity | dirty | dirty | No — igual |
| corazon_latino | energyZone | ambient → active | **gentle → active** | Sí — Local cambió zona mínima |
| corazon_latino | textureAffinity | clean | **universal** | Sí — Local cambió textura |
| corazon_latino | aggressionRange | 0.25 – 0.6 | **0.38 – 0.38** | Sí — Local fijó aggression |
| kitt_scanner | pressureRange | 0.0 – 1.0 | **0.5 – 1.0** | Sí — Local subió presión mínima |
| kitt_scanner | textureAffinity | clean | **universal** | Sí — Local cambió textura |
| kitt_scanner | aggressionRange | 0.5 – 0.9 | **0.7 – 0.7** | Sí — Local fijó aggression |
| solar_flare | energyZone | intense → peak | **ambient → gentle** | Sí — Local drásticamente diferente |
| solar_flare | textureAffinity | universal | **clean** | Sí — Local cambió textura |
| solar_flare | aggressionRange | 0.0 – 1.0 | **0.3 – 0.3** | Sí — Local fijó aggression |
| latina_meltdown | (todos) | idéntico | idéntico | No — sin cambios |

### pressureRange MISSING (polyfill la sobrescribirá con {0.5, 1.0})

| ID | Origen | pressureRange en disco | Valor tras polyfill (pre-WAVE 7176) | Valor tras polyfill (post-WAVE 7176) |
|---|---|---|---|---|
| Feral Wave Omega | Local | **MISSING** | {0.5, 1.0} inyectado | {0.5, 1.0} inyectado (null check) |
| heph_1782609140553_bto9fn | Local | **MISSING** | {0.5, 1.0} inyectado | {0.5, 1.0} inyectado (null check) |

### pressureRange {0, 0} (permissive — respetado post-WAVE 7176)

| ID | Origen | pressureRange en disco | Valor tras polyfill (pre-WAVE 7176) | Valor tras polyfill (post-WAVE 7176) |
|---|---|---|---|---|
| heph_1782937097650_pjisyy | Local | **{0, 0}** | {0.5, 1.0} sobrescrito | **{0, 0}** respetado |

### Anomalías de Clasificación

- **solar_flare (Local)**: Marcado como `isDivineCandidate: true` + `isHeavyCandidate: true`, pero tiene `aggression=0.3` y `energyZone: ambient → gentle`. Esto es contradictorio — un efecto ambient/gentle no debería ser Divine/Heavy. Probablemente el usuario modificó el ADN sin actualizar los flags de `simulationMeta`.
- **efecto_base**: Tiene `energyZone: intense → peak` pero `aggression=0.6` y `textureAffinity: clean`. Clasificación incongruente para un efecto de pico.
- **Feral Wave Omega**: `compatibleVibes: "latin"` — vibe no canónico (debería ser `fiesta-latina`). Podría ser rechazado por el `DynamicEffectRegistry` si el gate G4 valida contra vibes canónicas.
