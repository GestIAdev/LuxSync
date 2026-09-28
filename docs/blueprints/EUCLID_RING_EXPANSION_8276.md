# 🔮 WAVE 8276-OPUS — Euclid Ring Expansion & Liquid Physics Alchemy

**Tipo:** Blueprint de diseño (hoja de ruta + manifiesto creativo) — sin implementación.
**Fuente de verdad previa:** `EUCLID_ORACLE_BLUEPRINT.md` §2.3/§3.3/§3.5 · `SHADER_ATOM_BASE.md`
**Contexto orientativo (no vinculante):** `technical_audits/LIQUID_ACOUSTIC_PHYSICS_AUDIT.md`

> **Restricción dura:** el motor de estrobo queda fuera de esta wave. No se
> habilita el StrobeEngine de GodEar ni se reconecta `STROBE_ACTIVE` a
> `lf.strobeActive`. El estrobo lo gestionan las matemáticas de dimmer. Ver §1.8.

---

## 0. Qué dice el código hoy (verificado, no heredado de la auditoría)

| Hecho | Evidencia | Consecuencia para el diseño |
|---|---|---|
| 0/11 átomos usan `u_tel[` directamente | grep `assets/shaders` | Las **macros por nombre** son el contrato real; la indexación interna es libre de cambiar |
| El camino generativo exige WebGL2 | `theta.worker.ts:1146-1156` | Se pueden usar **UBOs** (`layout(std140) uniform`) sin fallback en gen/sim |
| El plasma builtin puede correr en WebGL1 | mismo bloque (fallback `webgl`) | El builtin conserva un `uniform float u_tel[60]` propio |
| El tamaño 256 está duplicado en **3 constantes** | `telemetry/TheiaTelemetryRing.ts:23`, `theia/TheiaTelemetryRing.ts:33`, `TheiaTelemetryPump.ts:55` | Riesgo de desincronía: hay que unificarlas en una sola fuente |
| `TelemetryWireReader` **lanza excepción** si `byteLength !== 256` | `telemetry/TheiaTelemetryRing.ts` ctor | Si el mirror `dist-electron-backend` (main) va desfasado respecto a `src` (renderer), Theia se cae al arrancar |
| `ProcessedFrame` se **congela en silencio** | `LiquidEngineBase.ts:771-774` retorna `buildSilenceResult` sin asignar `lastFrame` | Leer las envolventes desde `lf` en silencio da el **último valor no nulo**: justo lo contrario del vacío |
| Señales clave son **locales** del `process()` | `tonalSquelch`/`percussiveRatio` :650-665, `cleanMid` :2050, `midDelta`, `snareDrive`/`momentum` :1373-1381 | Necesitan un scratch de salida en la clase, no el literal de `ProcessedFrame` |
| Detector MACD 4D solo en perfiles techno | `LiquidEngineBase.ts:1057` (`snareMomentumThreshold !== undefined`) | Sus señales deben tener fallback universal |

### 0.1 Deuda de asignaciones YA existente en la cadena (a saldar en la Fase 0)

La cadena de telemetría no es zero-alloc hoy, aunque lo documente:

| Sitio | Asignación por tick | Frecuencia |
|---|---|---|
| `snapshotTelemetryPayload` | 4 × `new Int32Array/Float32Array` (vistas src/dst) | 44 Hz × links |
| `TheiaTelemetryPump.tick` | `new Int32Array(sources.fc…)` + objeto `{type,seq,buffer}` | 44 Hz × links |
| `mirrorTelemetryIntoRing` | 2 vistas + 4 `subarray` | 44 Hz × consumidores (renderer) |
| `LiquidEngineBase.process` | literal `ProcessedFrame` (~30 campos) | 44 Hz (main) |

Doblar el payload no cambia su coste por sí mismo, pero **sí es el momento**
de eliminar estas asignaciones: la wave toca exactamente esas funciones.

---

## MISIÓN 1 — Expansión del anillo a 512 B / 128 slots

### 1.1 Layout v2

```
Slot     Tipo    Contenido
0..3     Int32   Header Euclid (main): SEQ, TICK_ID, FLAGS, ENUMS
                 Wire: FrameContext (tickId, tsLo, tsHi, generation)   ← SIN CAMBIOS
4..63    Float32 PÁGINA A — schema v1 byte-idéntico                     ← SIN CAMBIOS
                 (56/57 siguen transportando FLAGS/ENUMS en el wire)
64..127  Float32 PÁGINA B — física Liquid/GodEar (§2.1), 16 grupos vec4
```

- **`SCHEMA_VERSION` 1 → 2** (byte 0 de ENUMS, ya transportado).
- **La página A no se mueve.** Todos los índices actuales, tests y macros siguen
  siendo válidos; la v2 es un superconjunto estricto.
- **Payload = 124 floats = 31 vec4 exactos** (496 B, múltiplo de 16). Esto no
  es casualidad: es el requisito std140 del UBO (§1.5).
- Cada grupo semántico de la página B empieza en frontera vec4
  (`(slot−4) % 4 == 0`) → el shader puede leer un grupo entero con un solo
  `vec4` (macros de grupo, §1.6).

### 1.2 Unificación de constantes (antes de tocar ningún tamaño)

Una sola fuente en `src/theia/telemetry/TheiaTelemetryRing.ts`:

```ts
export const TELEMETRY_RING_SLOTS = 128
export const TELEMETRY_RING_BYTES = TELEMETRY_RING_SLOTS * 4          // 512
export const TELEMETRY_PAYLOAD_SLOTS = TELEMETRY_RING_SLOTS - SLOT_PAYLOAD_BASE // 124
export const TELEMETRY_PAGE_B_BASE = 64
export const SCHEMA_VERSION = 2
```

`src/theia/TheiaTelemetryRing.ts` (mirror del wire) y `TheiaTelemetryPump.ts`
**re-exportan/importan** estas constantes en lugar de declarar las suyas. Así
desaparece la posibilidad de que el pump envíe 512 B y el mirror copie 256.

### 1.3 Tolerancia de versión (antidesincronía main ↔ renderer)

El main se ejecuta desde `dist-electron-backend` (espejo JS manual) y el
renderer/worker desde `src` (Vite). Si el espejo queda atrasado, hoy la
excepción del constructor mata Theia. Contrato v2:

- `TelemetryWireReader`, `mirrorTelemetryIntoRing` e `isTelemetryMessage`
  aceptan `byteLength ∈ {256, 512}`.
- Se copia `min(src, dst)`. Si llega un frame de 256 B (productor v1), la
  página B se **pone a 0 una sola vez** (flag `pageBZeroed`) y el reader
  expone `schemaVersion = 1`.
- Los átomos no se rompen: la página B a 0 equivale a "sin física avanzada".
  `euTimbre()` (§2.3) tiene un fallback definido para suma 0.
- El pump y el ring de main se crean siempre en v2. La tolerancia es solo para
  consumidores.

### 1.4 Cambios por módulo

| Módulo | Cambio | Zero-alloc |
|---|---|---|
| **`TelemetryWriter.publish`** | Sin cambios: `fill(this.f32)` ya recibe la vista completa | ✅ ya lo es |
| **`snapshotTelemetryPayload`** | Pasa a ser una clase `TelemetrySnapshotter` que crea las 4 vistas **una vez** (en el constructor, ligadas a src/dst). El bucle usa `TELEMETRY_RING_SLOTS`; 56/57 siguen igual | ✅ elimina 4 allocs/tick |
| **`TheiaTelemetryPump`** | `scratch = new ArrayBuffer(512)`; la vista FC se cachea al registrar las fuentes; el objeto de mensaje `{type, seq, buffer}` se **reutiliza** mutando `seq` (`postMessage` clona de forma síncrona, así que es legal) | ✅ elimina 2 allocs/tick/link |
| **`mirrorTelemetryIntoRing`** | Versión con vistas cacheadas (`TelemetryMirror` con `dstI32` fijo). La vista src por mensaje es inevitable (cada mensaje trae un `ArrayBuffer` nuevo por el clone), pero **una** vista en lugar de seis | 🟡 6 → 1 alloc/msg |
| **`TelemetryWireReader`** | `scratch = Float32Array(128)`; bucle hasta `TELEMETRY_RING_SLOTS`; tolerancia §1.3 | ✅ |
| **`TELEMETRY_SCHEMA`** | +64 entradas (página B, §2.1). Las reservadas son `kind:'none'` y `uniform:''` | — |
| **`TickEngine._euclidFill`** | Escribe la página B desde **un único scratch** de Liquid (§1.7) + `ad.rhythmic`/`ad.photon` + relojes integrales nuevos | ✅ solo escalares |
| **`TelemetrySmoother`** | Tablas a 124. **Tabla de índices activos** (`Uint8Array` precomputada sin los `kind:'none'`), que evita iterar el schema y el `switch` en ~40 slots reservados/crudos. `Math.pow(1−k, dtF)` → `Math.exp(dtF · ln1k[idx])` con `ln1k` precalculado (una transcendente por slot en lugar de pow) | ✅ |
| **`ShaderAssembler`** | `u_tel[60]` float array → **UBO** `EuclidTel { vec4 u_tel4[31]; }` + generador de macros vec4 (§1.5/1.6) | — |
| **`theta.worker` / `GenRuntime`** | Un UBO por contexto GL, **un `bufferSubData` por frame**, `uniformBlockBinding` una vez por programa tras el link (main + sim) | ✅ |
| **Plasma builtin** | Conserva `uniform float u_tel[60]` (compatible con WebGL1) alimentado con una **vista subarray precreada** de `sm.out` (0..59), nunca `subarray()` por frame | ✅ |

### 1.5 Por qué UBO y no `uniform float u_tel[124]`

Es la decisión de rendimiento central de la wave.

**Presupuesto de registros.** En ANGLE/D3D11 (el backend de Chromium en
Windows, la plataforma objetivo), cada elemento de un array `float` del
bloque de uniforms por defecto ocupa un registro vec4 completo. El mínimo
garantizado por WebGL2 es `MAX_FRAGMENT_UNIFORM_VECTORS = 224`.

| Configuración | Registros aprox. (default block) |
|---|---|
| Hoy: `u_tel[60]` + `u_gene[8]` + ~38 escalares | ~106 |
| `u_tel[124]` ingenuo | **~170** + params de artista → **riesgo de fallo de link** en iGPUs que exponen justo el mínimo |
| **UBO** `vec4 u_tel4[31]` fuera del default block | **~46** (el UBO usa `MAX_UNIFORM_BLOCK_SIZE`, mínimo 16 KB: 496 B es un 3 %) |

**Coste de subida.** Hoy se hacen 3 `uniform1fv(60)` por frame (sim + main +
builtin) y se validan por programa. Con UBO: **un `bufferSubData(496 B)` por
contexto y frame**, y todos los programas (main, sim y los hasta 8 del caché
LRU) ven los datos sin volver a subirlos. La expansión es **más barata** que
el esquema actual.

```glsl
layout(std140) uniform EuclidTel {
  vec4 u_tel4[31];          // payload slots 4..127 empaquetado vec4 (std140: stride 16)
};
```

`GEN_STD_UNIFORMS` añade `'EuclidTel'` / `'u_tel4'` (los params de artista
jamás deben resolverse contra ellos).

### 1.6 Generación de macros

Mismo principio que hoy (fuente única = `TELEMETRY_SCHEMA`), cambiando el
destino:

```ts
const idx = d.slot - SLOT_PAYLOAD_BASE
lines.push(`#define ${d.uniform.padEnd(20)} u_tel4[${idx >> 2}].${'xyzw'[idx & 3]}`)
```

- Ejemplos: `u_bass` (slot 11, idx 7) → `u_tel4[1].w` · `u_vocalIsolation`
  (slot 65, idx 61) → `u_tel4[15].y`.
- **`u_chroma(i)`** usa indexación dinámica de componente, legal en GLSL ES
  3.00:
  `#define u_chroma(i) u_tel4[(40 + int(i)) >> 2][(40 + int(i)) & 3]`
- **Macros de grupo** (nuevas, solo página B): `u_vocalVec`, `u_voidVec`,
  `u_snareVec`, `u_zoneA`, `u_zoneB`, `u_textureVec`, `u_deltaVec`, cada una
  `u_tel4[k]` completo. Un grupo cuesta una sola lectura de registro.
- Cambio de comportamiento para artistas: **ninguno**. Siguen escribiendo
  `u_bass`, `u_chroma(3)`, etc.

### 1.7 Productor: `LiquidPhysicsTelemetry` (el scratch que resuelve el silencio)

No se amplía `ProcessedFrame` (es un literal por frame y se congela en
silencio). En su lugar, cada `LiquidEngineBase` recibe **un objeto
preasignado**, mutado in-place y leído por referencia:

```ts
/** WAVE 8276 — escalares físicos para Theia. Instancia única por engine, nunca se reemplaza. */
export interface LiquidPhysicsTelemetry {
  vocalSustain: number; vocalIsolation: number; cleanMid: number; synthSustain: number
  snareDrive: number; snareMomentum: number; gateHealth: number; snareMacdOnset: boolean
  zFrontL: number; zFrontR: number; zBackL: number; zBackR: number
  zMoverL: number; zMoverR: number; zSnareAttack: number
  spectralDensity: number; fluxBaseline: number
  rawMidDelta: number; rawHighMidDelta: number; rawTrebleDelta: number
  realSilence: boolean; noiseMode: boolean
}
readonly physicsTel: LiquidPhysicsTelemetry  // campo readonly en LiquidEngineBase
```

Puntos de escritura:

| Punto de `process()` | Qué escribe |
|---|---|
| Tras la EMA vocal (`:760`, **antes** del check de silencio) | `vocalSustain` (la EMA sigue decayendo en silencio: correcto) |
| Tras el bloque armónico (`:665`) | `synthSustain` continuo (ver §2.1, **no** el `tonalSquelch` escalonado) |
| Bloque MACD (`:1381`) | `snareDrive`, `snareMomentum`, `gateHealth`, `snareMacdOnset` |
| Final del frame (`:2228`) | zonas, `cleanMid`, `vocalIsolation`, deltas, densidad, `realSilence=false` |
| **Rama de silencio (`:771`)** | zonas y deltas a 0, `realSilence=true`: el vacío se lee como vacío |
| Rama `pureAmbient`/glacier (`:719`) | zonas = osciladores glacier, deltas a 0 |

`TitanEngine.getLiquidPhysicsTelemetry()` devuelve
`getActiveLiquidEngine().physicsTel` por referencia (un cambio de vibe cambia
de engine: se resuelve en cada tick, sin coste).

### 1.8 Estrobo (restricción dura)

- `TEL_FLAG.STROBE_ACTIVE` (bit 14) y `u_strobeGate` pasan a **DEPRECATED**:
  el bit se deja siempre a 0 (se elimina el empaquetado actual de
  `photon.strobe.active`, que además lee una fuente muerta,
  `GodEarFFT.ts:2657`).
- **No** se reconecta a `lf.strobeActive`.
- El uniform `u_strobeGate` se mantiene **declarado y fijo a 0.0** durante una
  release para no romper la compilación de átomos de usuario (hoy ningún átomo
  del repo lo usa). `SHADER_ATOM_BASE.md` lo marca como deprecated.
- Ninguna dinámica de §3 depende de gates de estrobo. Los destellos pasan por
  pulsos exponenciales, que el limitador fotosensible del epílogo ya gobierna.

### 1.9 Presupuesto de rendimiento (estimación por tick/frame)

| Etapa | Hoy | v2 | Nota |
|---|---|---|---|
| Fill main (44 Hz) | ~60 escrituras | ~90 escrituras | < 0,5 µs; solo escalares |
| Snapshot + pump | 4-6 allocs + clone 256 B | **0 allocs** + clone 512 B | 22 KB/s por link: irrelevante |
| Mirror renderer | 6 allocs/msg | 1 alloc/msg | — |
| Smoother (60-144 Hz × 2 contextos) | 60 slots, 60 `pow` | ~84 activos, 84 `exp` | Iteración por tabla, sin `switch` en reservados |
| Subida GPU | 3 × `uniform1fv(60)` | **1 × `bufferSubData(496 B)`**/contexto | Todos los programas comparten |
| Registros default block | ~106 | **~46** | Libera margen para params de artista |

---

## MISIÓN 2 — Selección de señales (página B) y alquimia GLSL

### 2.1 Criterio de selección

1. **Continua > escalonada.** `tonalSquelch` vale {0, 0,3, 0,5, 1}: en un
   shader produce saltos visibles. Se exporta la **fuente continua**
   (`percussiveRatio`) transformada. El escalón sigue viviendo solo en DMX.
2. **Universal > dependiente del perfil.** Las señales MACD tienen fallback
   para perfiles no techno.
3. **No re-suavizar lo ya envolvente.** Las zonas ya pasaron por
   `LiquidEnvelope`: el smoother solo interpola 44 → 144 Hz (k alto), no
   añade lag.
4. **Los deltas con signo viajan crudos** (`kind:'none'`): interpolar un
   transitorio lo destruye.
5. **Ley 1 (Infinite Genome):** las señales que un átomo usaría como *velocidad*
   se entregan también como **reloj integral** calculado en el host.

### 2.2 Página B — mapa de slots

| Slot | Grupo (vec4) | Nombre | Uniform | Fuente / fórmula | Kind |
|---|---|---|---|---|---|
| 64 | **VOCAL** `u_vocalVec` = `u_tel4[15]` | VOCAL_SUSTAIN | `u_vocalSustain` | `_vocalSustainEMA` | linear 0.7/0.3 |
| 65 | | VOCAL_ISOLATION | `u_vocalIsolation` | ver abajo ① | linear 0.5/0.15 |
| 66 | | CLEAN_MID | `u_cleanMid` | `max(0, mid − bass·subtractFactor)` (`:2050`) | linear 0.8/0.4 |
| 67 | | SYNTH_SUSTAIN | `u_synthSustain` | ver abajo ② | linear 0.4/0.1 |
| 68 | **VOID** `u_voidVec` = `u_tel4[16]` | RHYTHMIC_VOID | `u_rhythmicVoid` | `rhythmic.rhythmic_void` continuo | linear 0.3/0.3 |
| 69 | | PERC_ABSENCE | `u_percAbsence` | `min(snare_absence_ms, hh_absence_ms) / msPerBar`, clamp [0,16] (en compases) | linear 1/1 |
| 70 | | VOID_HOLD | `u_voidHold` | segundos continuos con `rhythmic_void ≥ 0.75` (host, se pone a 0 al salir) | none |
| 71 | | VOCAL_TIME | `u_vocalTime` | **∫ vocalIsolation·dt** (host, monótono; reloj Ley 1) | none |
| 72 | **SNARE-C** `u_snareVec` = `u_tel4[17]` | SNARE_DRIVE | `u_snareDrive` | MACD `snareDrive`; fallback `snare_energy_ungated × snare_crack_flux` | none |
| 73 | | SNARE_MOMENTUM | `u_snareMomentum` | `emaFast − emaSlow` (con signo); fallback 0 | none |
| 74 | | GATE_HEALTH | `u_gateHealth` | `_snareEnergyEma / GATE_HEALTH_THRESHOLD`; fallback 1 | linear 0.3/0.3 |
| 75 | | SNARE_CRACK | `u_snareCrack` | `rhythmic.snare_energy_ungated` (universal) | linear 0.9/0.35 |
| 76 | **ZONES-A** `u_zoneA` = `u_tel4[18]` | Z_FRONT_L | `u_zFrontL` | `frontLeft` (SubBass) | linear 0.9/0.6 |
| 77 | | Z_FRONT_R | `u_zFrontR` | `frontRight` (kick) | linear 0.9/0.6 |
| 78 | | Z_BACK_L | `u_zBackL` | `backLeft` (coro/pad + hh) | linear 0.9/0.6 |
| 79 | | Z_BACK_R | `u_zBackR` | `backRight` (látigo de caja) | linear 0.9/0.6 |
| 80 | **ZONES-B** `u_zoneB` = `u_tel4[19]` | Z_MOVER_L | `u_zMoverL` | `moverLeft` (melodía tonal) | linear 0.9/0.6 |
| 81 | | Z_MOVER_R | `u_zMoverR` | `moverRight` (dama vocal) | linear 0.9/0.6 |
| 82 | | Z_SNARE_ATTACK | `u_zSnareAttack` | `snareAttack` | linear 1/0.6 |
| 83 | | RESERVED_83 | — | alineación vec4 | none |
| 84 | **TEXTURE** `u_textureVec` = `u_tel4[20]` | WHITE_NOISE | `u_whiteNoise` | `photon.whiteNoiseScore` | linear 0.6/0.2 |
| 85 | | WALL_INTENSITY | `u_wallIntensity` | `photon.wallIntensity` | linear 0.3/0.1 |
| 86 | | SPECTRAL_DENSITY | `u_spectralDensity` | `0.25·harsh + 0.15·flat + 0.60·hh_energy`, **calculado en TickEngine** (universal) | linear 0.4/0.15 |
| 87 | | FLUX_BASELINE_N | `u_fluxBaseline` | `clamp((_fluxBaseline − 0.03)/0.10, 0, 1)` (0 = silencio, 1 = clímax de buildup denso) | linear 0.3/0.1 |
| 88 | **DELTAS** `u_deltaVec` = `u_tel4[21]` | RAW_MID_DELTA | `u_midDelta` | `rawMidDelta` (±) | none |
| 89 | | RAW_HIGHMID_DELTA | `u_highMidDelta` | `rawHighMidDelta` (±) | none |
| 90 | | RAW_TREBLE_DELTA | `u_trebleDelta` | `rawTrebleDelta` (±) | none |
| 91 | | RAW_HH_DELTA | `u_hhDelta` | `rhythmic.raw_hh_delta` (≥0) | none |
| 92 | **MASTER** `u_tel4[22]` | AGC_STRESS | `u_agcStress` | `clamp(log2(agcGainFactor)/3, 0, 1)` (cuánto está inflando el AGC) | linear 0.2/0.05 |
| 93-95 | | RESERVED (stereo width/corr/balance) | — | requiere que el pipeline retransmita `GodEarSpectrum.stereo` (hoy es `null` en mono) → wave futura | none |
| 96-127 | 8 vec4 | RESERVED | — | margen para futuras waves (32 slots) | none |

**① `vocalIsolation`: heurística honesta, no separación de fuentes.**

```
sustainTerm = vocalSustain · clamp01(1 − max(0, midDelta) / max(vocalSustain, 1e-3))
tonalTerm   = clamp01(1 − flatness / moverLTonalThreshold)
vocalIsolation = clamp01(sustainTerm · tonalTerm · (1 − synthPercussive) · 1.6)
```

Sube con **energía media sostenida, tonal y sin transitorios**. Un pad de
sintetizador en 500 Hz-2 kHz también la activa. Por eso el manifiesto la
combina siempre con `u_melodicity` y `u_cleanMid`, y la documentación del
átomo debe llamarla *"presencia vocal/lead sostenido"*.

**② `synthSustain`: la versión continua de `tonalSquelch`.**

```
synthSustain = harmonicBase > 0.05
             ? clamp01(1 − percussiveRatio / 1.12)   // 1.12 = frontera "realmente percusivo" del propio squelch
             : 0
```

En los umbrales coincide con la escalera actual (ratio < 0,88 → ≥ 0,21,
etc.), pero sin saltos.

### 2.3 Flags nuevos (bits 17-22) y derivados del worker

| Bit | Flag | Semántica | Tipo |
|---|---|---|---|
| 14 | ~~STROBE_ACTIVE~~ | **DEPRECATED**, siempre 0 (§1.8) | — |
| 17 | REAL_SILENCE | `physicsTel.realSilence` | nivel |
| 18 | VOCAL_ONSET | `vocalIsolation` cruza 0,35 al alza (histéresis: rearme por debajo de 0,2) | flanco |
| 19 | NOISE_MODE | `lf.noiseMode` (flatness > umbral del perfil) | nivel |
| 20 | GATE_DEAD | `gateHealth < 0.1` (caja sintética / AND-gate muerta) | nivel |
| 21 | SNARE_TRUE | onset del detector MACD; fallback: flanco de `snare_crack_flux` > 0,25 | flanco |
| 22 | VOID_RELEASE | el vacío termina tras `VOID_HOLD ≥ 2 s` (vuelve la percusión) | flanco |
| 23-31 | — | reservados | — |

Derivados que calcula `TelemetrySmoother`, siguiendo el mismo patrón que
`u_kickPulse`:

| Uniform | Fórmula |
|---|---|
| `u_vocalOnset` | `exp(−t/600ms)` desde VOCAL_ONSET: aparición lenta, respiración |
| `u_snareTruePulse` | `exp(−t/(¼ beat))` desde SNARE_TRUE: el snare pulse **que no confunde voces con cajas** |
| `u_voidRelease` | `A · exp(−t/450ms)` desde VOID_RELEASE, con `A = clamp(voidHold_previo / 8 s, 0.25, 1)`. **La fuerza del rebote es proporcional a lo que duró el vacío** |

Nueva función de biblioteca en el preámbulo, paralela a `euChannels`:

```glsl
// Pesos convexos (Σ=1) de las 4 "texturas" de la música: voz · synth · percusión · grano.
vec4 euTimbre() {
  vec4 w = vec4(u_vocalIsolation, u_synthSustain, u_percussiveness,
                max(u_whiteNoise, u_spectralDensity));
  w *= w;                                   // contraste: realza la textura dominante
  float s = w.x + w.y + w.z + w.w;
  return s > 1e-4 ? w / s : vec4(0.0, 1.0, 0.0, 0.0);  // silencio → calma viscosa
}
```

---

## MISIÓN 3 — Manifiesto creativo: 7 dinámicas generativas

> Principio rector: **un mismo átomo, muchos fenotipos.** La música decide el
> *material* del shader, no solo su brillo. Todo el código es GLSL ES 3.00,
> salida lineal (el epílogo aplica ACES y sRGB) y `uv` centrado con aspecto
> corregido (`(fragCoord − 0.5·res) / res.y`).

### D1 · La Voz Interior (`u_vocalIsolation`, `u_vocalTime`, `u_melodicity`)

**Idea:** cuando entra una voz pura, el caos se ordena. El ruido de dominio se
relaja, la simetría se multiplica y aparece una "garganta": ondas
estacionarias concéntricas que respiran con la **fase propia de la voz**
(`u_vocalTime`, que avanza solo mientras hay voz: si la voz se calla, la
geometría se detiene en lugar de saltar).

```glsl
vec4  T     = euTimbre();
float voice = T.x;                                            // peso vocal convexo
float vt    = u_vocalTime;                                    // ∫voz·dt — Ley 1
// 1. La voz ORDENA: menos warp, más simetría
vec2 warp = (1.0 - voice) * 0.25 * vec2(noise3(vec3(uv * 3.0, beats * 0.2)),
                                        noise3(vec3(uv * 3.0 + 7.1, beats * 0.2)));
vec2 q    = uv + warp;
float fold = mix(G_FOLD, G_FOLD * 2.0, voice);
float a    = atan(q.y, q.x);
float r    = length(q);
// 2. Garganta: anillo principal que respira con la frase
float throat = exp(-9.0 * abs(r - 0.28 - 0.04 * sin(vt * 1.7)));
// 3. Armónicos: más anillos cuanto más melódica es la línea
float rings = 0.5 + 0.5 * cos(r * mix(14.0, 42.0, u_melodicity) - vt * 3.0 + a * fold);
vec3 vox = palette(u_chromaHue + 0.08 * sin(vt), vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.15, 0.3));
col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), 0.5 * voice); // el fondo cede el color
col += voice * throat * rings * vox * 1.4;
col += u_vocalOnset * 0.5 * throat * vox;                   // entrada de frase: bloom lento
```

**Fenotipo:** en un drop instrumental el átomo es un fractal caótico; en una
estrofa cantada, el mismo átomo es un mandala ordenado alrededor de un anillo
que respira.

### D2 · Horizonte de Sucesos (`u_voidHold`, `u_vaporPressure`, `u_voidRelease`)

**Idea:** un vacío rítmico sostenido crea masa. La escena se curva alrededor de
un agujero cuyo radio crece con el tiempo sin percusión (y con la sed
acumulada de Selene, `u_vaporPressure`). El tiempo se retrasa cerca del
horizonte. Al volver la percusión, la masa **se libera en una onda de choque**
proporcional a la espera.

```glsl
float hold = smoothstep(0.0, 8.0, u_voidHold);                // 0→1 en 8 s de vacío
float M    = 0.06 * hold * (0.6 + 0.8 * u_vaporPressure);     // "masa"
float r2   = dot(uv, uv) + 1e-4;
vec2  lens = uv * (1.0 - M / r2);                             // lente: r_h = √M
// Dilatación ADITIVA (desfase, no multiplicar el reloj: cumple la Ley 1)
float lag  = 4.0 * M / r2;
vec3  sc   = scene(lens, beats - lag);                        // la función de escena del átomo
float rh   = sqrt(M);
float hor  = 1.0 - smoothstep(rh * 0.95, rh * 1.25, sqrt(r2));
col  = sc * (1.0 - hor);
col += hor * (1.0 - hor) * 4.0 * palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0)) * hold; // anillo de fotones
// Rebote: onda de choque desde el horizonte, amplitud = lo que duró el vacío
float shock = u_voidRelease * exp(-12.0 * abs(sqrt(r2) - (1.0 - u_voidRelease) * 1.2));
col += shock * 1.6 * vec3(1.0, 0.9, 0.8);
```

**Fenotipo:** sin cambiar de átomo, un breakdown de 16 compases convierte
cualquier escena en un agujero negro, y el drop la hace estallar.

### D3 · Espejo del Rig (`u_zoneA`, `u_zoneB`)

**Idea:** la pantalla se convierte en un **gemelo de las luces físicas**. Cada
envolvente zonal es una fuente de campo situada donde vive en el escenario
(front abajo, back arriba, movers a los lados). El campo resultante modula
la densidad o la altura de la escena, de modo que el LED wall y el rig
respiran como un solo organismo. Como las zonas vienen moldeadas por el
**perfil del vibe**, el mismo átomo produce un patrón de campo distinto en
techno, latino o chill.

```glsl
const vec2 ANCH[6] = vec2[6](vec2(-0.55, -0.42), vec2(0.55, -0.42),   // front L/R (suelo)
                             vec2(-0.70,  0.38), vec2(0.70,  0.38),   // back L/R (fondo)
                             vec2(-0.25,  0.10), vec2(0.25,  0.10));  // movers
vec4  zA = u_zoneA;  vec4 zB = u_zoneB;
float z[6] = float[6](zA.x, zA.y, zA.z, zA.w, zB.x, zB.y);
float field = 0.0;  vec2 grad = vec2(0.0);
for (int i = 0; i < 6; i++) {
  vec2  d = uv - ANCH[i];
  float g = z[i] * exp(-9.0 * dot(d, d));
  field += g;  grad += -18.0 * d * g;                        // gradiente analítico gratis
}
vec2 flowUV = uv + 0.04 * grad;                               // la escena "fluye" desde las zonas activas
col  = scene(flowUV, beats);
col *= 0.35 + 0.9 * field;                                    // metaballs de escenario
col += zB.z * 0.6 * exp(-30.0 * abs(uv.y + 0.42)) * vec3(1.0);// ataque de caja: línea de suelo
```

**Fenotipo:** un kick enciende el suelo de la pantalla al mismo tiempo que los
PARs frontales, y una voz ilumina el mover derecho y el cuadrante
correspondiente de la imagen.

### D4 · Transición de Fase: Mercurio ↔ Cristal (`u_synthSustain`, `u_percussiveness`)

**Idea:** el material de la geometría cambia de estado. Los pads sostenidos
funden la escena en metal líquido (`smin` suave, warp lento, estelas largas).
La percusión seca la cristaliza (uniones afiladas, facetas cuantizadas,
estelas cortas). Es un solo parámetro continuo, `visc`.

```glsl
float visc = smoothstep(0.15, 0.75, u_synthSustain) * (1.0 - 0.8 * u_percussiveness);
// Dominio: el mercurio ondula con el reloj de energía (Ley 1), el cristal está quieto
p.xy += visc * 0.25 * vec2(noise3(p * 0.8 + u_energyTime * 0.3),
                           noise3(p * 0.8 - u_energyTime * 0.3));
float k = mix(0.008, 0.40, visc);                             // cristal → mercurio
float d = smin(sdSphere(p - vec3(0.0, 0.0, 2.0), 0.55),
               sdBox(p - vec3(0.0, 0.0, 2.0), vec3(0.42)), k);
// Facetas: cuantizar la normal solo en estado cristalino
vec3 n  = normalize(calcNormal(p));
vec3 nq = normalize(floor(n * mix(3.0, 24.0, visc)));         // pocas facetas = cristal
n = normalize(mix(nq, n, visc));
float spec = pow(max(dot(reflect(-L, n), V), 0.0), mix(96.0, 12.0, visc));
// Memoria: el mercurio deja estela
float persist = mix(0.78, 0.94, visc);
```

**Fenotipo:** una misma escena raymarch es obsidiana facetada en un tema de
techno percusivo y un blob de mercurio en un pasaje de pads trance.

### D5 · Grano y Presión (`u_whiteNoise`, `u_fluxBaseline`, `u_wallIntensity`, `u_agcStress`)

**Idea:** la textura física del sonido se vuelve textura de imagen. En un
buildup de ruido blanco (Opus, snare rolls), la estructura se disuelve en
arena luminosa. Un master brickwall (`u_wallIntensity`) **aplasta** la
imagen: satura hacia un plano de luminancia media, como la compresión aplasta
la dinámica. Si el AGC está inflando una fuente débil (`u_agcStress`), la
imagen gana grano "de ISO alto".

```glsl
float grit  = max(u_whiteNoise, u_spectralDensity);
float build = u_fluxBaseline;                                 // 0 silencio → 1 clímax denso
// Grano multiplicativo en lineal (respeta negros; el limitador gobierna el flicker)
float gr = hash21(fragCoord + fract(u_time * 7.13) * vec2(113.0, 71.0)) - 0.5;
col += col * gr * (0.08 + 0.35 * build * grit + 0.25 * u_agcStress);
// Disolución: la geometría se deshace en partículas cuando el ruido es la señal
float sand = step(1.0 - 0.6 * build * grit, hash21(floor(fragCoord / 2.0) + floor(beats * 16.0)));
col = mix(col, col * sand * 2.2, build * grit * 0.7);
// Brickwall: aplastamiento hacia la luminancia media (no es tonemap: no hay curva)
float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
col = mix(col, vec3(lum) * 1.1, 0.35 * u_wallIntensity);
```

**Fenotipo:** el mismo átomo es nítido y contrastado en un master dinámico y
arenoso y plano en un buildup de ruido masterizado a 0 dBFS.

### D6 · Fractura Topológica (`u_snareTruePulse`, `u_snareMomentum`, `u_gateHealth`)

**Idea:** la caja **verdadera** (sin falsos positivos vocales) fractura el
espacio a lo largo de las fronteras de Voronoi. El estado del detector se usa
como decisión estética: con la AND-gate viva (caja acústica, `gateHealth≈1`)
la fractura es orgánica y del color del chroma; con la gate muerta (caja
sintética) es una fractura digital binaria. El momentum negativo (la cola de
decaimiento) **implosiona** el espacio de vuelta.

```glsl
// Implosión en la cola de la caja (momentum < 0 = energía cayendo)
float implode = clamp(-u_snareMomentum * 10.0, 0.0, 1.0);
vec2  vuv = uv * (1.0 + 0.12 * implode) * 6.0;
vec2  g = floor(vuv), f = fract(vuv);
float d1 = 8.0, d2 = 8.0;  vec2 cell = vec2(0.0);
for (int j = -1; j <= 1; j++)
for (int i = -1; i <= 1; i++) {
  vec2  o = vec2(float(i), float(j));
  vec2  h = vec2(hash21(g + o), hash21(g + o + 17.3));
  vec2  rr = o + h - f;
  float dd = dot(rr, rr);
  if (dd < d1) { d2 = d1; d1 = dd; cell = g + o; } else if (dd < d2) { d2 = dd; }
}
float edge      = 1.0 - smoothstep(0.0, 0.07, sqrt(d2) - sqrt(d1));
float synthetic = 1.0 - u_gateHealth;
vec3  organic   = palette(u_chromaHue + hash21(cell) * 0.2, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.2, 0.4));
vec3  digital   = vec3(step(0.5, hash21(cell + floor(beats))));
col += u_snareTruePulse * edge * mix(organic, digital, synthetic) * 1.5;
col *= 1.0 - 0.3 * u_snareTruePulse * (1.0 - edge) * step(0.6, hash21(cell)); // células que "caen"
```

**Fenotipo:** Brejcha (gate muerta) genera cristales de píxel; una batería
de rock (gate viva) genera grietas de vidrio coloreado.

### D7 · El Átomo de Cuatro Fenotipos (`euTimbre()`), la meta-dinámica

**Idea:** responde directamente a *"un mismo shader puede parecer otro
shader"*. El átomo implementa cuatro modos de render y la música los mezcla
por sus pesos convexos. **Clave de rendimiento:** los pesos son uniforms, así
que la rama es **coherente**: todos los píxeles toman el mismo camino y la
GPU no paga divergencia. Se evalúan solo los modos con peso significativo
(normalmente uno o dos).

```glsl
vec4 T = euTimbre();                        // x voz · y synth · z perc · w grano
vec3 acc = vec3(0.0);
if (T.x > 0.04) acc += T.x * modeVoice(uv, beats);   // D1: mandala / garganta
if (T.y > 0.04) acc += T.y * modeMercury(uv, beats); // D4: metal líquido
if (T.z > 0.04) acc += T.z * modeCrystal(uv, beats); // D4/D6: cristal fracturado
if (T.w > 0.04) acc += T.w * modeSand(uv, beats);    // D5: disolución en grano
float wsum = dot(step(vec4(0.04), T), T);            // renormaliza lo evaluado
col = acc / max(wsum, 1e-3);
```

**Fenotipo:** una sola entrada del Opus Library vale por cuatro, y la
transición entre texturas es tan suave como las propias señales suavizadas.
`GenomeEvolver` puede tratar el umbral `0.04` y el exponente de contraste de
`euTimbre` como genes `expr`.

---

## 4. Hoja de ruta por fases

| Fase | Alcance | Criterio de salida |
|---|---|---|
| **F0: Deuda zero-alloc** | `TelemetrySnapshotter`, vistas cacheadas en pump/mirror, objeto de mensaje reutilizado. **Sin cambiar tamaños** | Tests existentes en verde; 0 `new` en `tick()`/snapshot (test que espía los constructores de TypedArray) |
| **F1: Anillo v2** | Constantes unificadas (§1.2), 512 B, `SCHEMA_VERSION=2`, tolerancia v1/v2 (§1.3), bucles hasta `TELEMETRY_RING_SLOTS`, schema página B con todo RESERVED | Tests de ring/wire/pump actualizados a 512; test de compatibilidad (frame de 256 B → página B = 0, `schemaVersion=1`) |
| **F2: UBO GLSL** | `EuclidTel` std140, generador de macros vec4 + macros de grupo, `u_chroma(i)` dinámico, UBO por contexto en worker/GenRuntime, `uniformBlockBinding` en main+sim, builtin con vista precreada | Tests del assembler (macro → `u_tel4[k].c` para los 60 slots existentes, idéntico semántico); compila Opus Library completa; smoke en GPU real |
| **F3: Productor Liquid** | `LiquidPhysicsTelemetry` + puntos de escritura (§1.7) incluidas las ramas silencio/glacier; getter en TitanEngine; fill de página B; relojes integrales `VOCAL_TIME`/`VOID_HOLD`; `spectralDensity` en TickEngine | Tests: silencio → zonas 0 y `REAL_SILENCE`; `synthSustain` continuo; fallbacks MACD en perfil no techno |
| **F4: Smoother y derivados** | Tabla de índices activos, `exp`/`ln1k`, `u_vocalOnset` / `u_snareTruePulse` / `u_voidRelease` (con amplitud por hold), flags 17-22, `euTimbre()` en el preámbulo | Tests de τ de cada pulso, amplitud de `voidRelease`, convexidad de `euTimbre` (Σ=1, fallback) |
| **F5: Deprecación del estrobo** | Bit 14 fijo a 0, `u_strobeGate = 0.0`, docs | Test: el bit 14 nunca se enciende |
| **F6: Docs y átomos piloto** | `SHADER_ATOM_BASE.md` §4/§6/§7 + §8 bis `euTimbre`; 2 átomos piloto (D2 + D7) | Revisión visual con pistas de referencia (Opus, Brejcha, una vocal pop) |

Cada fase deja el sistema compilable y en verde. **El espejo
`dist-electron-backend` se actualiza en la misma fase que su `src`**: F1 es
la fase de mayor riesgo (tamaño del wire) y la tolerancia §1.3 existe
precisamente para que un espejo desfasado no tire Theia.

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Programa sin `uniformBlockBinding` → lee ceros sin error | Binding centralizado en una función `bindEuclidBlock(prog)` llamada desde `cacheGenLocs`/`cacheSimLocs`; test que la verifica con un GL mock |
| Desfase entre el espejo dist y `src` | Tolerancia v1/v2 (§1.3) + log único `schemaVersion mismatch` |
| `vocalIsolation` confunde pads con voz | Documentarla como "presencia vocal/lead"; las dinámicas la cruzan con `melodicity`/`percussiveness` (vía `euTimbre`) |
| Señales MACD a 0 fuera de techno | Fallbacks universales (§2.2); `GATE_DEAD` solo se evalúa con el detector activo |
| Lag por doble suavizado de las zonas | k altos (0,9/0,6): solo interpolación de 44 → 144 Hz |
| Flicker de grano (D5) | Amplitud multiplicativa acotada + limitador fotosensible del epílogo (sin cambios) |
| Coste de D7 (4 modos) | Ramas coherentes por uniform y umbral de peso; el governor ya escala resolución bajo estrés |
