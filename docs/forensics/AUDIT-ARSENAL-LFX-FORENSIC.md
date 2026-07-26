# Auditoría Forense del Arsenal LFX — LuxSync

**Fecha:** 2026-07-26  
**Modo:** Read-Only (sin modificaciones)  
**Alcance:** `src/core/arsenal/builtins/` (repo) + `userData/arsenal/`, `userData/effects/`, `userData/builtins/` (producción)

---

## 1. Mapeo de Dualidad y Sobrescritura (Dev vs. Prod)

### 1.1 Inventario Total

| Ubicación | Archivos `.lfx` | Archivos basura | Subdirectorios |
|---|---|---|---|
| **REPO** (`src/core/arsenal/builtins/`) | 42 | 0 | `chill/`, `chill-lounge/`, `latin/`, `rock/`, `techno/` |
| **USERDATA-ARSENAL** (`userData/arsenal/`) | 19 | 1 (`00000000`) | 0 (plano) |
| **USERDATA-EFFECTS** (`userData/effects/`) | 6 | 1 (`00000000`) | 0 (plano) |
| **USERDATA-BUILTINS** (`userData/builtins/`) | 3 | 0 | 0 (plano) |

**Total de archivos `.lfx` escaneados:** 70  
**Archivos no-.lfx detectados:** 2 (`00000000` en arsenal + effects)  
**Archivo `.jlfx` detectado:** 1 (`strobe_ping_pong.jlfx` en repo — extensión no reconocida por el loader)

### 1.2 Lista A — Overrides (UserData sobrescribiendo builtins del repo)

Efectos en `userData/arsenal/` con el **mismo `clip.id`** que un builtin del repo. El loader aplica orden de carga: si userData se carga después, **silenciosamente pisa** al builtin.

| # | Clip ID | Repo Path | UserData Path | Discrepancia |
|---|---|---|---|---|
| 1 | `amazon_mist` | `latin/amazon_mist.lfx` (4260 B) | `amazon_mist.lfx` (4260 B) | **Idéntico** (copia espejo) |
| 2 | `binary_glitch` | `techno/binary_glitch.lfx` (5602 B) | `binary_glitch.lfx` (6879 B) | **CRÍTICA:** durationMs 800→3000, vibeCompat `techno-club`→`techno`, añade safetyDecl(25Hz), añade root `version:"1.0.0"` |
| 3 | `corazon_latino` | `latin/corazon_latino.lfx` (12807 B) | `corazon_latino.lfx` (13977 B) | **Divergencia:** +1170 bytes, misma track count (10). Añade root `version:"1.0.0"`. Keyframes modificados. |
| 4 | `core_meltdown` | `techno/core_meltdown.lfx` (4688 B) | `core_meltdown.lfx` (4660 B) | **Menor:** -28 bytes. Mismo ID, misma track count (3). Ambos tienen `strobeRate` paramId (V2.1). |
| 5 | `cumbia_moon` | `latin/cumbia_moon.lfx` (4558 B) | `cumbia_moon.lfx` (4552 B) | **Trivial:** -6 bytes |
| 6 | `cyber_dualism` | `techno/cyber_dualism.lfx` (4799 B) | `cyber_dualism.lfx` (4926 B) | **Divergencia:** +127 bytes. UserData añade safetyDecl(25Hz). |
| 7 | `ghost_breath` | `latin/ghost_breath.lfx` (4295 B) | `ghost_breath.lfx` (4300 B) | **Trivial:** +5 bytes |
| 8 | `kitt_scanner` | `latin/kitt_scanner.lfx` (6472 B) | `kitt_scanner.lfx` (6485 B) | **CRÍTICA:** vibeCompat `techno-club`→`techno`, spatialBehavior `dynamic`→`static`. Añade root `version:"1.0.0"`. |
| 9 | `lateral_frag` | `techno/lateral_frag.lfx` (7348 B) | `lateral_frag.lfx` (7770 B) | **Divergencia:** +422 bytes. UserData añade safetyDecl(25Hz). Ambos tienen `strobeRate` paramId (V2.1). |
| 10 | `latina_meltdown` | `latin/latina_meltdown.lfx` (3730 B) | `latina_meltdown.lfx` (4059 B) | **Divergencia:** +329 bytes. UserData añade safetyDecl(25Hz). |
| 11 | `machine_gun` | `techno/machine_gun.lfx` (4051 B) | `machine_gun.lfx` (4478 B) | **Divergencia:** +427 bytes. UserData añade safetyDecl(25Hz). Ambos tienen `strobeRate` paramId (V2.1). |
| 12 | `salsa_fire` | `latin/salsa_fire.lfx` (5398 B) | `salsa_fire.lfx` (5423 B) | **Divergencia:** +25 bytes. UserData añade safetyDecl(25Hz). Ambos tienen `strobeRate` paramId (V2.1). |
| 13 | `seismic_snap` | `techno/seismic_snap.lfx` (7614 B) | `seismic_snap.lfx` (6680 B) | **Divergencia:** -934 bytes. Track count 5→4. UserData elimina una track. |
| 14 | `solar_flare` | `latin/solar_flare.lfx` (4002 B) | `solar_flare.lfx` (4033 B) | **CRÍTICA:** durationMs 1500→2500. +31 bytes. |
| 15 | `strobe_burst` | `techno/strobe_burst.lfx` (4003 B) | `strobe_burst.lfx` (3975 B) | **Trivial:** -28 bytes. Ambos tienen safetyDecl(25Hz) y `strobeRate` paramId (V2.1). |

**Total Overrides:** 15

### 1.3 Lista B — Orphans (Local Only, sin contraparte en repo)

Efectos creados en producción que **no existen** en el repo.

| # | Clip ID | Nombre | Ubicación | Tamaño | Notas |
|---|---|---|---|---|---|
| 1 | `heph_1782609140553_bto9fn` | DEFiNITIVETEST | `arsenal/` + `effects/` + `builtins/` | 8442 B | **Triple duplicado** (3 copias idénticas) |
| 2 | `heph_1782937097650_pjisyy` | depo | `arsenal/` (6505 B) + `effects/` (3634 B) + `builtins/` (3634 B) | variable | **Triple duplicado + divergencia:** arsenal tiene durationMs=6000, effects/builtins durationMs=1000 |
| 3 | `heph_1784931422617_tpox7b` | latin_strobe | `arsenal/` | 9599 B | Único |
| 4 | `heph_1784952802805_jigk8a` | latin_bubbles | `arsenal/` | 7835 B | Único |
| 5 | `heph_1782553308617_cgkagj` | testcurvodistribucion | `effects/` | 1657 B | **Sin cognitiveDNA** — no entra al arsenal de Selene |
| 6 | `heph_1782560366284_rfs6bw` | movementtest | `effects/` | 2443 B | **Sin cognitiveDNA** — no entra al arsenal de Selene |
| 7 | `heph_1782928865838_apewm8` | TESTEANDOPHASE | `effects/` | 4129 B | Único en effects |
| 8 | `00000000:8e8ab59a-7d5d-465d-9879-a2e294c3ed9f` | Feral Wave Omega | `arsenal/` + `builtins/` | 4735 B | **Doble duplicado**. Clip ID con prefijo `00000000:` — formato no estándar. **Sin schemaVersion**. |

**Total Orphans:** 8 (con 3 duplicados internos)

### 1.4 Lista C — Puros (Repo Only, sin modificación local)

Efectos del repo que **no han sido copiados ni modificados** en userData.

| # | Clip ID | Repo Path | Categoría |
|---|---|---|---|
| 1 | `efecto_base` | `_EFECTO_BASE.lfx` | Plantilla |
| 2 | `solar_caustics` | `chill/solar_caustics.lfx` | chill |
| 3 | `surface_shimmer` | `chill-lounge/surface_shimmer.lfx` | chill-lounge |
| 4 | `arena_sweep` | `latin/arena_sweep.lfx` | latin |
| 5 | `divine_obliteration` | `latin/divine_obliteration.lfx` | latin |
| 6 | `tidal_wave` | `latin/tidal_wave.lfx` | latin |
| 7 | `amp_heat` | `rock/amp_heat.lfx` | rock |
| 8 | `liquid_solo` | `rock/liquid_solo.lfx` | rock |
| 9 | `power_chord` | `rock/power_chord.lfx` | rock |
| 10 | `spotlight_pulse` | `rock/spotlight_pulse.lfx` | rock |
| 11 | `stage_wash` | `rock/stage_wash.lfx` | rock |
| 12 | `thunder_struck` | `rock/thunder_struck.lfx` | rock |
| 13 | `abyssal_rise` | `techno/abyssal_rise.lfx` | techno |
| 14 | `acid_sweep` | `techno/acid_sweep.lfx` | techno |
| 15 | `ambient_strobe` | `techno/ambient_strobe.lfx` | techno |
| 16 | `cascade_strike` | `techno/cascade_strike.lfx` | techno |
| 17 | `cyber_scanner` | `techno/cyber_scanner.lfx` | techno |
| 18 | `deep_breath` | `techno/deep_breath.lfx` | techno |
| 19 | `gatling_raid` | `techno/gatling_raid.lfx` | techno |
| 20 | `ghost_chase` | `techno/ghost_chase.lfx` | techno |
| 21 | `industrial_strobe` | `techno/industrial_strobe.lfx` | techno |
| 22 | `neon_blinder` | `techno/neon_blinder.lfx` | techno |
| 23 | `red_surge` | `techno/red_surge.lfx` | techno |
| 24 | `static_pulse` | `techno/static_pulse.lfx` | techno |
| 25 | `strobe_storm` | `techno/strobe_storm.lfx` | techno |
| 26 | `void_mist` | `techno/void_mist.lfx` | techno |
| 27 | `wrath_of_titans` | `techno/wraht_of_the_titans.lfx` | techno |

**Total Puros:** 27

> **Nota:** `strobe_ping_pong.jlfx` (extensión `.jlfx`) existe en el repo pero el `LfxFileLoader` solo escanea extensión `.lfx` — **es invisible al sistema**.

---

## 2. Detección de Corrupción y Basura

### 2.1 Archivos Basura (0 bytes, sin extensión .lfx)

| # | Archivo | Ubicación | Tamaño | Diagnóstico |
|---|---|---|---|---|
| 1 | `00000000` | `userData/arsenal/` | 0 bytes | Archivo vacío sin extensión. Probable producto de un crash o write abortado. El loader lo ignora (no es `.lfx`). |
| 2 | `00000000` | `userData/effects/` | 0 bytes | Ídem. Segundo residuo. |

### 2.2 Archivos con Extensiones No Reconocidas

| # | Archivo | Ubicación | Diagnóstico |
|---|---|---|---|
| 1 | `strobe_ping_pong.jlfx` | `repo/builtins/techno/` | Extensión `.jlfx` no reconocida por `LfxFileLoader` (filtro: `.endsWith('.lfx')`). **Efecto muerto** — nunca se carga. Contiene `strobeRate` paramId (V2.1). |

### 2. Archivos con Parse OK pero Estructuralmente Anómalos

| # | Clip ID | Ubicación | Anomalía |
|---|---|---|---|
| 1 | `00000000:8e8ab59a-...` (Feral Wave Omega) | `arsenal/` + `builtins/` | **Clip ID con prefijo `00000000:`** — formato no estándar que viola el patrón de IDs canónicos. **Sin `schemaVersion`** en el clip. |
| 2 | `heph_1782553308617_cgkagj` | `effects/` | **Sin `cognitiveDNA`** — el loader la acepta pero Selene nunca la selecciona. Efecto zombi. |
| 3 | `heph_1782560366284_rfs6bw` | `effects/` | **Sin `cognitiveDNA`** — ídem. |

### 2.4 Duplicados Internos (mismo Clip ID en múltiples carpetas userData)

| # | Clip ID | Copias | Discrepancia |
|---|---|---|---|
| 1 | `heph_1782609140553_bto9fn` | `arsenal/` + `effects/` + `builtins/` (3 copias) | **Idénticas** (8442 B, durationMs=4000) |
| 2 | `heph_1782937097650_pjisyy` | `arsenal/` (6505 B) + `effects/` (3634 B) + `builtins/` (3634 B) | **Divergencia crítica:** arsenal durationMs=6000 vs effects/builtins durationMs=1000. El arsenal tiene 2871 bytes más de contenido de keyframes. |
| 3 | `00000000:8e8ab59a-...` | `arsenal/` + `builtins/` (2 copias) | **Idénticas** (4735 B) |

> **Impacto:** El orden de carga de directorios determina qué versión "gana". Si `arsenal/` se carga después de `effects/`, la versión de 6000ms pisa la de 1000ms — comportamiento no determinístico.

---

## 3. Auditoría de Esquema (Conflicto V2.1 vs V3)

### 3.1 Schema Wrapper

Todos los archivos `.lfx` escaneados declaran `"$schema": "luxsync.lfx/3.0"` en el wrapper externo. **No se encontraron archivos con schema V2.1 explícito.**

Sin embargo, se detectaron **restos V2.1 incrustados** dentro de los clips que causan conflictos funcionales con el motor V3.

### 3.2 Hallazgo CRÍTICO — `strobeRate` paramId (V2.1 Remnant)

**23 archivos** usan `paramId: "strobeRate"` en sus tracks. Este es un paramId V2.1 que **no existe** en el sistema V3 de curvas. En V3, el strobo se controla vía `paramId: "strobe"` o `paramId: "intensity"` con keyframes.

El `HephaestusRuntime` evalúa las curvas pero el `HephaestusAetherAdapter` **no tiene mapeo para `strobeRate`** — el valor se calcula pero se descarta silenciosamente. El strobo del hardware **no responde** a estos keyframes.

**Archivos afectados en REPO (17):**

| Clip ID | Ubicación |
|---|---|
| `salsa_fire` | `latin/salsa_fire.lfx` |
| `power_chord` | `rock/power_chord.lfx` |
| `abyssal_rise` | `techno/abyssal_rise.lfx` |
| `ambient_strobe` | `techno/ambient_strobe.lfx` |
| `cascade_strike` | `techno/cascade_strike.lfx` |
| `core_meltdown` | `techno/core_meltdown.lfx` |
| `gatling_raid` | `techno/gatling_raid.lfx` |
| `industrial_strobe` | `techno/industrial_strobe.lfx` |
| `lateral_frag` | `techno/lateral_frag.lfx` |
| `machine_gun` | `techno/machine_gun.lfx` |
| `neon_blinder` | `techno/neon_blinder.lfx` |
| `red_surge` | `techno/red_surge.lfx` |
| `seismic_snap` | `techno/seismic_snap.lfx` |
| `static_pulse` | `techno/static_pulse.lfx` |
| `strobe_burst` | `techno/strobe_burst.lfx` |
| `strobe_storm` | `techno/strobe_storm.lfx` |
| `wrath_of_titans` | `techno/wraht_of_the_titans.lfx` |

**Archivos afectados en USERDATA (6 overrides):**

| Clip ID | Ubicación |
|---|---|
| `core_meltdown` | `arsenal/core_meltdown.lfx` |
| `lateral_frag` | `arsenal/lateral_frag.lfx` |
| `machine_gun` | `arsenal/machine_gun.lfx` |
| `salsa_fire` | `arsenal/salsa_fire.lfx` |
| `seismic_snap` | `arsenal/seismic_snap.lfx` |
| `strobe_burst` | `arsenal/strobe_burst.lfx` |

**Archivo afectado .jlfx (invisible):** `strobe_ping_pong.jlfx`

**Síntoma en producción:** Efectos de strobo que "no estroban" — el patrón de keyframes se evalúa pero el canal DMX de strobo nunca recibe el intent. El operador ve movimiento de color/dimmer pero el strobo queda en su valor por defecto (0 = abierto/continuo o el defaultValue del fixture).

### 3.3 Hallazgo MODERADO — Campo `version` en raíz (V2.1 Remnant)

**35 archivos** contienen un campo `"version": "1.0.0"` en la raíz del JSON (fuera del bloque `clip`). Este campo **no es parte del schema V3** (`LFXFileV3` solo define `$schema`, `clip`, `checksum`). Es inofensivo para el loader (lo ignora), pero indica que el migrador V2→V3 no limpió completamente los campos heredados.

**Distribución:** 8 en repo, 22 en userData-arsenal, 5 en userData-effects, 2 en userData-builtins.

### 3.4 Hallazgo MODERADO — `schemaVersion` faltante

**2 archivos** no contienen `clip.schemaVersion`:

| Clip ID | Ubicación |
|---|---|
| `00000000:8e8ab59a-...` (Feral Wave Omega) | `arsenal/` + `builtins/` (2 copias) |

El `LfxFileLoader` no valida `schemaVersion` explícitamente (lo ensambla como `'3.0'` por defecto en `_parseAndValidateV3`), pero su ausencia indica que el migrador no completó la transformación.

### 3.5 Hallazgo MENOR — Checksum faltante

**3 archivos** en `userData/effects/` no tienen checksum:

| Clip ID | Ubicación |
|---|---|
| `heph_1782553308617_cgkagj` | `effects/` |
| `heph_1782560366284_rfs6bw` | `effects/` |
| `kitt_scanner` | `effects/` |

El loader permite checksum vacío para archivos `user` (política intencional), pero los archivos `builtin` requieren checksum. `kitt_scanner` en `effects/` es una copia de un builtin sin checksum — si se carga como `user` pasa, pero si se carga como `builtin` sería rechazado.

### 3.6 Hallazgo MENOR — `staticParams.strobeRateHz` (V2.1 Remnant)

Varios efectos contienen `staticParams.strobeRateHz` (ej: `core_meltdown` = 15). Este campo V2.1 es **ignorado** por el HephaestusRuntime V3 — el strobo se controla exclusivamente vía keyframes en tracks. Es metadata muerta que confunde al operador durante debugging.

### 3.7 Discrepancias Críticas de Contenido (UI vs Hardware)

| Clip ID | Discrepancia UI vs Hardware | Impacto |
|---|---|---|
| `binary_glitch` | Repo: durationMs=800, vibe=`techno-club`. UserData: durationMs=3000, vibe=`techno`. | **Selene no lo selecciona para `techno-club`** cuando se carga la versión userData. El operador ve el efecto en la UI con duración 3s pero Selene nunca lo dispara en sesiones techno-club. |
| `kitt_scanner` | Repo: spatialBehavior=`dynamic`, vibe=`techno-club`. UserData: spatialBehavior=`static`, vibe=`techno`. | **El motor IK no recibe pan/tilt** porque `static` desactiva el routing espacial. El efecto se ejecuta como wash estático en vez de scan dinámico. |
| `solar_flare` | Repo: durationMs=1500. UserData: durationMs=2500. | **El efecto dura 1s más de lo esperado.** Si Selene lo dispara esperando 1500ms, el overlap con el siguiente efecto es de 1000ms no planificados. |
| `seismic_snap` | Repo: 5 tracks. UserData: 4 tracks (eliminó una). | **Falta una curva** — posiblemente strobo o color. El efecto se ejecuta incompleto. |

---

## 4. Resumen Ejecutivo

### Estadísticas Globales

| Métrica | Valor |
|---|---|
| Total archivos escaneados | 70 (.lfx) + 1 (.jlfx) + 2 (basura) |
| Overrides (userData pisa repo) | 15 |
| Orphans (solo userData) | 8 |
| Puros (solo repo) | 27 |
| Duplicados internos | 3 IDs en múltiples carpetas userData |
| Archivos basura (0 bytes) | 2 |
| Archivos invisibles (.jlfx) | 1 |
| Efectos con `strobeRate` V2.1 | 23 (17 repo + 6 userData) |
| Efectos con root `version` V2.1 | 35 |
| Efectos sin `schemaVersion` | 2 |
| Efectos sin checksum | 3 |
| Efectos sin `cognitiveDNA` | 2 (zombies de Selene) |

### Prioridad de Riesgo

| Prioridad | Hallazgo | Impacto |
|---|---|---|
| **P0 — CRÍTICO** | `strobeRate` paramId en 23 efectos | Strobo no funciona en 17 efectos del repo. El hardware no recibe el intent de strobo. |
| **P0 — CRÍTICO** | Divergencia `binary_glitch` (800ms→3000ms, vibe cambiado) | Selene no selecciona el efecto correcto para la vibe esperada. |
| **P0 — CRÍTICO** | Divergencia `kitt_scanner` (dynamic→static, vibe cambiado) | Efecto pierde movimiento IK. Selene no lo selecciona para techno-club. |
| **P1 — ALTO** | Triple duplicado `heph_1782609140553_bto9fn` | Comportamiento no determinístico según orden de carga. |
| **P1 — ALTO** | Divergencia `heph_1782937097650_pjisyy` (6000ms vs 1000ms) | Misma ID, duraciones diferentes. Orden de carga decide. |
| **P1 — ALTO** | `seismic_snap` perdió una track en userData | Efecto incompleto en producción. |
| **P2 — MEDIO** | Clip ID `00000000:...` en Feral Wave Omega | Formato no estándar. Puede causar colisiones de hashing. |
| **P2 — MEDIO** | 2 efectos sin `cognitiveDNA` en effects/ | Zombies: se cargan pero Selene nunca los usa. |
| **P2 — MEDIO** | `strobe_ping_pong.jlfx` invisible | Efecto muerto en repo. Nunca se carga. |
| **P3 — BAJO** | 35 archivos con root `version:"1.0.0"` | Inofensivo pero indica migración incompleta. |
| **P3 — BAJO** | 2 archivos `00000000` basura | Inofensivos (ignorados por loader). |
| **P3 — BAJO** | 3 archivos sin checksum | Política permite user sin checksum. |

---

## 5. Mapa de Directorios Auditados

```
REPO (src/core/arsenal/builtins/)
├── _EFECTO_BASE.lfx                    [PURO]
├── chill/
│   └── solar_caustics.lfx              [PURO]
├── chill-lounge/
│   └── surface_shimmer.lfx             [PURO]
├── latin/
│   ├── amazon_mist.lfx                 [OVERRIDE — copia idéntica]
│   ├── arena_sweep.lfx                 [PURO]
│   ├── corazon_latino.lfx              [OVERRIDE — divergente +1170B]
│   ├── cumbia_moon.lfx                 [OVERRIDE — trivial -6B]
│   ├── divine_obliteration.lfx         [PURO]
│   ├── ghost_breath.lfx                [OVERRIDE — trivial +5B]
│   ├── kitt_scanner.lfx                [OVERRIDE — CRÍTICO vibe+spatial]
│   ├── latina_meltdown.lfx             [OVERRIDE — +329B +safetyDecl]
│   ├── salsa_fire.lfx                  [OVERRIDE — +25B +safetyDecl]
│   ├── solar_flare.lfx                 [OVERRIDE — CRÍTICO duration 1500→2500]
│   └── tidal_wave.lfx                  [PURO]
├── rock/
│   ├── amp_heat.lfx                    [PURO]
│   ├── liquid_solo.lfx                 [PURO]
│   ├── power_chord.lfx                 [PURO — tiene strobeRate V2.1]
│   ├── spotlight_pulse.lfx             [PURO]
│   ├── stage_wash.lfx                  [PURO]
│   └── thunder_struck.lfx              [PURO]
└── techno/
    ├── abyssal_rise.lfx                [PURO — tiene strobeRate V2.1]
    ├── acid_sweep.lfx                  [PURO]
    ├── ambient_strobe.lfx              [PURO — tiene strobeRate V2.1]
    ├── binary_glitch.lfx               [OVERRIDE — CRÍTICO 800→3000ms + vibe]
    ├── cascade_strike.lfx              [PURO — tiene strobeRate V2.1]
    ├── core_meltdown.lfx               [OVERRIDE — menor -28B + strobeRate V2.1]
    ├── cyber_dualism.lfx               [OVERRIDE — +127B +safetyDecl]
    ├── cyber_scanner.lfx               [PURO]
    ├── deep_breath.lfx                 [PURO]
    ├── gatling_raid.lfx                [PURO — tiene strobeRate V2.1]
    ├── ghost_chase.lfx                 [PURO]
    ├── industrial_strobe.lfx           [PURO — tiene strobeRate V2.1]
    ├── lateral_frag.lfx                [OVERRIDE — +422B +safetyDecl + strobeRate V2.1]
    ├── machine_gun.lfx                 [OVERRIDE — +427B +safetyDecl + strobeRate V2.1]
    ├── neon_blinder.lfx                [PURO — tiene strobeRate V2.1]
    ├── red_surge.lfx                   [PURO — tiene strobeRate V2.1]
    ├── seismic_snap.lfx                [OVERRIDE — -934B, perdió 1 track]
    ├── static_pulse.lfx                [PURO — tiene strobeRate V2.1]
    ├── strobe_burst.lfx                [OVERRIDE — trivial -28B + strobeRate V2.1]
    ├── strobe_ping_pong.jlfx           [INVISIBLE — extensión .jlfx]
    ├── strobe_storm.lfx                [PURO — tiene strobeRate V2.1]
    ├── void_mist.lfx                   [PURO]
    └── wraht_of_the_titans.lfx         [PURO — tiene strobeRate V2.1]

USERDATA (AppData/Roaming/luxsync-electron/)
├── arsenal/
│   ├── 00000000                        [BASURA — 0 bytes]
│   ├── amazon_mist.lfx                 [OVERRIDE de repo/latin/]
│   ├── binary_glitch.lfx               [OVERRIDE CRÍTICO de repo/techno/]
│   ├── corazon_latino.lfx              [OVERRIDE divergente de repo/latin/]
│   ├── core_meltdown.lfx               [OVERRIDE de repo/techno/]
│   ├── cumbia_moon.lfx                 [OVERRIDE de repo/latin/]
│   ├── cyber_dualism.lfx               [OVERRIDE de repo/techno/]
│   ├── Feral Wave Omega.lfx            [ORPHAN — ID 00000000:... + sin schemaVersion]
│   ├── ghost_breath.lfx                [OVERRIDE de repo/latin/]
│   ├── heph_1782609140553_bto9fn.lfx   [ORPHAN — triple duplicado]
│   ├── heph_1782937097650_pjisyy.lfx   [ORPHAN — triple duplicado + divergente]
│   ├── heph_1784931422617_tpox7b.lfx   [ORPHAN — único]
│   ├── heph_1784952802805_jigk8a.lfx   [ORPHAN — único]
│   ├── kitt_scanner.lfx                [OVERRIDE CRÍTICO de repo/latin/]
│   ├── lateral_frag.lfx                [OVERRIDE de repo/techno/]
│   ├── latina_meltdown.lfx             [OVERRIDE de repo/latin/]
│   ├── machine_gun.lfx                 [OVERRIDE de repo/techno/]
│   ├── salsa_fire.lfx                  [OVERRIDE de repo/latin/]
│   ├── seismic_snap.lfx                [OVERRIDE de repo/techno/ — perdió track]
│   ├── solar_flare.lfx                 [OVERRIDE CRÍTICO de repo/latin/]
│   └── strobe_burst.lfx                [OVERRIDE de repo/techno/]
├── effects/
│   ├── 00000000                        [BASURA — 0 bytes]
│   ├── heph_1782553308617_cgkagj.lfx   [ORPHAN — sin cognitiveDNA]
│   ├── heph_1782560366284_rfs6bw.lfx   [ORPHAN — sin cognitiveDNA]
│   ├── heph_1782609140553_bto9fn.lfx   [DUPLICADO de arsenal/]
│   ├── heph_1782928865838_apewm8.lfx   [ORPHAN — único]
│   ├── heph_1782937097650_pjisyy.lfx   [DUPLICADO de arsenal/ — divergente]
│   └── kitt_scanner.lfx                [DUPLICADO de arsenal/ — sin checksum]
└── builtins/
    ├── Feral Wave Omega.lfx            [DUPLICADO de arsenal/]
    ├── heph_1782609140553_bto9fn.lfx   [DUPLICADO de arsenal/]
    └── heph_1782937097650_pjisyy.lfx   [DUPLICADO de arsenal/ — divergente]
```

---

*Fin del reporte. No se modificaron, borraron ni unificaron archivos.*
