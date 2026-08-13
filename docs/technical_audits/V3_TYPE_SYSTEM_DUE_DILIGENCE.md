# AUDITORÍA TÉCNICA DE ADQUISICIÓN — ÁREA 6

## El Sistema de Tipos V3, los Contratos `.lfx` y el DNArail

### La Piedra Rosetta — el lenguaje universal del ecosistema LuxSync

**Documento:** Whitepaper arquitectónico de Due Diligence — Parte 3 (Final)
**Alcance:** `core/arsenal/lfxTypes.ts` · `core/hephaestus/types.ts` · `LfxClipInstance` ·
`GatekeeperLinter` · `DnaRail.tsx` · `LfxFileLoader` · `DynamicEffectRegistry` · `types/theiaTypes.ts`
**Auditor:** Chief Acquisition Auditor & Principal AI/DSP Architect
**Fecha:** 2026-08-10
**Documentos precedentes:**
- `SELENE_V3_DUE_DILIGENCE.md` — Área 4, Iliquidcore (Núcleo Cognitivo) — **87/100**
- `GENESIS_V3_DUE_DILIGENCE.md` — Área 5, Genesis (Motor Evolutivo) — **84/100**

**Clasificación:** Confidencial — Proceso de adquisición de IP LuxSync

---

## RESUMEN EJECUTIVO

Las dos áreas anteriores evaluaron *motores*. Esta evalúa el **protocolo** — y en un sistema de
cinco subsistemas heterogéneos, el protocolo es el activo más difícil de replicar y el que
determina si la arquitectura escala o se fractura.

V3 no es un formato de archivo. Es un **contrato de interoperabilidad** que gobierna cinco dominios
con requisitos incompatibles entre sí:

| Subsistema | Dominio | Qué consume de V3 |
|---|---|---|
| **Hephaestus FX** | Autoría creativa | `HephTrack`/`HephCurve`/`HephKeyframe` como sustrato; `DnaRail` configura la capa cognitiva |
| **Chronos Timecoder** | Secuenciación temporal | Secuencia `HephAutomationClipV3`; lee `mixBus`/`priority` para enrutado |
| **Selene IA** | Decisión a 44 Hz | `CognitiveDNA` para matching, `SimulationMeta` para scoring, `SafetyDeclaration` para gating |
| **Genesis** | Evolución geológica | Muta el clip; `CognitiveDNA.genome` guía operadores; `bezier_signature` alimenta especiación |
| **Theia** | Vídeo / pantallas LED | Replica el genoma (`ITheiaGenome`) y el termómetro energético sobre formato atómico propio |

**Tesis arquitectónica: la separación ortogonal de tres preguntas que la industria del control de
iluminación mezcla sistemáticamente.**

```
spatialZones      →  DÓNDE   se aplica (targeting físico de fixtures)
tracks / curves   →  QUÉ     hace (ejecución paramétrica)
cognitiveDNA      →  CUÁNDO  y CÓMO debe dispararse (elegibilidad contextual)
```

Estos tres ejes no se cruzan en ningún punto del esquema. Ese aislamiento —reforzado por una
corrección de namespace explícita (`F3b`) que impide que un `EnergyZoneId` contamine
`spatialZones`— es lo que permite que Selene decida *cuándo* sin conocer la topología del rig, que
Chronos secuencie *qué* sin conocer la semántica musical, y que Genesis mute *cómo* sin romper el
targeting espacial.

**Segunda tesis:** el `DNArail` no es un panel de configuración. Es un **IDE para comportamiento de
IA**, con un linter que ejecuta las reglas reales de los motores de Selene en tiempo de autoría y
**bloquea el guardado** ante incoherencias. La validación no ocurre en el borde del sistema: ocurre
antes de que el dato exista.

**Veredicto preliminar:** el artefacto técnicamente más maduro de los tres auditados. Modelado de
datos de calidad industrial, con dos brechas de aplicación concretas y verificadas empíricamente.
**Puntuación: 88/100** — la más alta de la auditoría.

---

## 1. DESACOPLAMIENTO ARQUITECTÓNICO

### 1.1 La anatomía en cinco bloques

`core/hephaestus/types.ts:428-475`. La estructura no es un contenedor plano: es una partición por
**consumidor y ciclo de vida**.

| Bloque | Contenido | Consumidor | Mutabilidad |
|---|---|---|---|
| **A — Identidad** | `id`, `name`, `author`, `category`, `tags`, `vibeCompat` | UI, catálogo | Autoría |
| **B — Espacial (DÓNDE)** | `spatialZones: readonly ZoneTarget[]` | Enrutado DMX | Derivado (auto-recomputado) |
| **C — Ejecución (QUÉ)** | `mixBus`, `priority`, `durationMs`, `effectType`, `tracks`, `staticParams` | Runtime, Chronos | Autoría + mutación Genesis |
| **D — Cognitivo (CUÁNDO/CÓMO)** | `cognitiveDNA?`, `simulationMeta?`, `safetyDeclaration?` | **Selene IA exclusivamente** | DnaRail + deriva lamarckiana |
| **E — Esquema** | `schemaVersion: '3.0'` | Loader, migrador | Literal inmutable |

**La decisión de mayor impacto es que el Bloque D es opcional.** `registerEffectV3` lo declara sin
ambigüedad:

```typescript
if (!clip.cognitiveDNA) {
  // V3 sin DNA: clip Hephaestus puro — invisible para Selene por diseño.
  return null
}
```

**Por qué es correcto y no una omisión:** separa **capacidad de ejecución** de **elegibilidad
autónoma**. Un operador puede crear un efecto puramente manual —MIDI, secuenciado en Chronos— sin
declarar metadatos de IA. Y simétricamente, la IA no puede seleccionar nada que no haya sido
declarado explícitamente como elegible. **La autonomía es opt-in.** En control de espectáculos en
vivo, donde el operador conserva autoridad final, esta asimetría es requisito de producto.

### 1.2 Por qué separar targeting espacial de ADN cognitivo es crítico

Considérese la alternativa: un esquema donde elegibilidad y targeting compartieran namespace.

**Escenario A — acoplados.** Un efecto declara `zones: ['peak', 'front-truss']`. Entonces:

- El motor DMX debe filtrar qué entradas son zonas físicas y cuáles niveles de energía. **Cada
  consumidor necesita la taxonomía completa del otro dominio.**
- Portar el efecto a otra instalación —sin `front-truss`— corrompe simultáneamente el targeting **y**
  la elegibilidad.
- Genesis no puede mutar la topología espacial sin riesgo de alterar la ventana de energía.
- Theia, que no tiene fixtures, no puede reutilizar el genoma sin arrastrar un modelo espacial
  inaplicable.

**Escenario B — el implementado.** `spatialZones` acepta **exclusivamente** `CanonicalZone` (9 zonas
de `ShowFileV2`) más 3 helpers (`'all'`, `'all-pars'`, `'all-movers'`). El loader **rechaza**
cualquier `EnergyZoneId` — corrección `F3b`. La ventana de energía vive únicamente en
`cognitiveDNA.energyZone`.

Consecuencias verificables en el código:

1. **Portabilidad entre instalaciones.** El ADN cognitivo es **invariante respecto al rig**. Un
   efecto `divine/peak` sigue siendo divine y sigue disparándose en peak, en un club de 12 fixtures
   o en un festival de 400. Solo `spatialZones` requiere remapeo. Para un fabricante que vende a
   topologías radicalmente distintas —clubes urbanos en España, arenas en Norteamérica— esto
   determina si el catálogo es un activo transferible o un artefacto local.
2. **Selene opera sin conocimiento topológico.** Consulta `energyZone`, `genome`, `pressureRange`,
   `textureAffinity`. **Nunca consulta `spatialZones`.** El hot path de 44 Hz queda libre de
   dependencias sobre el grafo de fixtures — la estructura más volátil del sistema, porque cambia
   en cada montaje.
3. **Genesis muta la topología con seguridad.** `spatial_resonance` (Área 5 §1.2) reescribe
   `phaseConfig` y distribuciones por zona **sin tocar** `cognitiveDNA.energyZone`. La deriva
   lamarckiana modifica el genoma ACO; el targeting evoluciona por vía independiente. **Dos ejes
   de evolución que no interfieren.**
4. **Theia reutiliza el eje cognitivo descartando el espacial.** `ITheiaAtom` importa `EnergyZone` y
   replica la tríada ACO, y **no tiene ningún concepto de zona espacial**. Que el genoma sea
   reutilizable en un dominio sin geometría física es la prueba empírica de que la ortogonalidad es
   real y no declarativa.

### 1.3 Multicelularidad — la innovación estructural del Bloque C

```typescript
interface HephTrack {
  id: string
  paramId: HephParamId          // 'intensity' | 'color' | 'pan' | 'tilt' | 'zoom' | ...
  zones: readonly ZoneTarget[]  // DÓNDE aplica ESTA pista
  curve: HephCurve
  dimmerScale?: number
  colorOverride?: HSL
  blendMode?: BlendMode
  cell?: string                 // RESERVADO v3.0 — fixtures multicelda
  selector?: FixtureSelector    // AND-intersect con zones
  phaseConfig?: PhaseConfigPro  // distribución de fase estilo grandMA3
  phaseOverrides?: PhaseOverrideMap
}
```

**Múltiples pistas con el mismo `paramId` pueden coexistir, cada una apuntando a zonas distintas.**

El predecesor —documentado en `lfxTypes.ts:22-29`— era `curves: Record<paramId, curve>`: **un
`Record` es estructuralmente incapaz de expresar animación espacialmente diferenciada del mismo
parámetro.** No puede hacer que la intensidad del truss frontal suba mientras la del posterior baja.

Con `tracks: HephTrack[]`, el efecto se convierte en un organismo con tejidos diferenciados. Y esta
decisión se propaga a los otros dos módulos auditados:

- **Genesis §1.5:** `crossover` desduplica por clave compuesta `paramId::zones`, no por `paramId`.
  El progenitor recesivo puede aportar `intensity::back` cuando el dominante ya tiene
  `intensity::front`. **La multicelularidad es lo que hace que el crossover construya riqueza
  espacial** en lugar de intercambiar parámetros. Con un `Record`, esa vía no existiría.
- **Genesis §1.8:** `D_structural` incluye divergencia de zonas (peso 0.15) — pares
  `(paramId, zona)` presentes en el hijo y ausentes en el padre. La métrica de innovación **mide**
  multicelularidad.
- **Genesis §1.2:** `adaptive_pruning` **nunca elimina el último track que cubre un par
  `(paramId, zona)`** — protección explícita frente a la poda evolutiva.

**Evaluación:** no es una mejora incremental sobre el `Record` plano. Es la que habilita tres
mecanismos evolutivos distintos aguas abajo. Ejemplo textual de cómo una elección de estructura de
datos determina el espacio de lo posible.

**Observación menor:** `cell?: string` está declarado *RESERVADO v3.0* para fixtures multicelda.
Reservar namespace en el contrato antes de necesitarlo es la práctica correcta para un formato con
compromiso de compatibilidad: evita una versión mayor cuando llegue el soporte. Sin consumidores,
coherente con su estado declarado.

### 1.4 `CognitiveDNA` — el contrato de matching

`lfxTypes.ts:150-169`. Doce campos, todos `readonly`.

**(a) `readonly` universal con congelación en profundidad.** La cabecera declara: *«Todos los campos
del bloque cognitivo son `readonly` — pensados para `Object.freeze()` en el Registry (zero-alloc hot
path)»*. No es decoración: `_buildEntryFromV3()` aplica `Object.freeze()` a cada sub-objeto
(`energyZone`, `aggressionRange`, `pressureRange`, `compatibleVibes`, `validSections`, `tags`).
**Selene puede cachear referencias directas al ADN sin copia defensiva.** En un hot path con
presupuesto de 22,7 ms y objetivo de cero allocaciones, la diferencia entre `readonly` (borrado en
compilación) y `Object.freeze()` (aplicado en runtime) es la diferencia entre una intención y una
garantía.

**(b) `spatialBehavior` como contrato con el motor IK.** Los cuatro valores tienen semántica de
fusión documentada: `'static'` (no toca pan/tilt), `'relative_offset'` (offsets ∈ [−1,+1] que se
**suman** a la base IK), `'absolute'` (secuestra pan/tilt; con target IK activo el bridge silencia
pan/tilt del clip), `'spatial'` (reservado: trayectoria 3D por fixture). El comentario es explícito:
*«Sin él no podemos enrutar pan/tilt correctamente»*. Resuelve un problema real y difícil: la
composición entre un efecto autoral y un motor de cinemática inversa que apunta a un objetivo
dinámico. Sin declaración explícita del modo de fusión, el sistema debería inferirlo —y se
equivocaría. Conocimiento de dominio codificado como tipo.

**(c) `executionDomain` + `pixelHints`.** `'vector' | 'pixel' | 'hybrid'` declara si el efecto opera
sobre fixtures discretos, sobre matriz de píxeles, o ambos. Es el punto de extensión que permite al
mismo contrato cubrir iluminación convencional y pantallas LED.

### 1.5 `RegistryEntry` — desnormalización deliberada para hot path

`lfxTypes.ts:221-275`. Snapshot plano y congelado, con `CognitiveDNA` **aplanado** en propiedades de
primer nivel (`dna`, `textureAffinity`, `compatibleVibes`, …) para acceso O(1).

- **Las curvas no se incluyen.** Carga diferida vía `source: LFXFileV3 | null` o `filePath`. El
  registry mantiene en memoria solo lo necesario para *decidir*, no para *renderizar*. Es la
  distinción que permite escalar a catálogos grandes.
- **Índices pre-construidos en escritura.** `_byVibe`, `_divineByVibe`, `_heavyByVibe` actualizados
  en `registerEffectV3()`. Política declarada: *«TODA allocación ocurre en `registerEffect()` /
  `clear()` / hot-reload. CERO allocaciones en lookups»*. Existe incluso una vista vacía
  pre-congelada (`_EMPTY_ENTRIES`) para devolver en fallos de lookup sin allocar.
- **Campos de Genesis:** `organismId?`, `trialsCount?`, `organismStatus?`. **Este es exactamente el
  vehículo que Área 5 §5.1 propone para activar `s_DNA`.** El campo `dna` ya está aplanado y
  disponible en O(1): la estructura necesaria existe y está optimizada para el uso exacto que falta.

### 1.6 `LFXFileV3` — el sobre, y un hallazgo de integridad

```typescript
interface LFXFileV3 {
  readonly $schema: 'luxsync.lfx/3.0'   // discriminante literal
  readonly clip: HephAutomationClipV3
  readonly checksum: string             // SHA-256 sobre JSON.stringify(clip) sin pretty-print
}
```

El discriminante literal permite enrutar entre parseo V3 nativo y migración V2→V3 en memoria con
**estrechamiento verificado en compilación**. Uso canónico de uniones discriminadas.

**HALLAZGO — el checksum de `.lfx` nunca se verifica.** `LfxFileLoader.loadFile()`:

```typescript
const entry = this._registry.registerEffectV3(
  { $schema: 'luxsync.lfx/3.0', clip: loaded.clip as any, checksum: '' } as any,
  opts,
)
```

Se rellena con **cadena vacía** y `registerEffectV3()` no lo lee en ningún punto. El loader importa
`createHash` de `crypto` pero no lo aplica a la verificación del clip. El contrato declara un
mecanismo de integridad que el pipeline de carga no ejerce.

**La asimetría con el formato hermano es lo que lo convierte en hallazgo.** El `.lux` de Chronos
implementa el mismo mecanismo de forma **completa y rigurosa**:

- `computeLuxChecksum()` produce `sha256:[64 hex]`
- `canonicalStringify()` garantiza **independencia del orden de claves** — el error clásico de las
  implementaciones ingenuas
- `deserializeLuxV3()` trata un checksum incorrecto como **error duro**: `file === null`
- El comentario `LAZARUS B-4` documenta la corrección del modelo de amenazas: *«un checksum erróneo
  es ahora un ERROR DURO (corrupción detectada), no un warning. El comportamiento previo (cargar de
  todos modos con un warning) era el modelo de amenazas invertido.»*
- Un checksum **ausente** se permite (warning); uno **incorrecto** no. Distingue correctamente
  migración legítima de corrupción.
- Cobertura de test explícita: *«tampering is detected on deserialize»*

**Evaluación:** el equipo posee la implementación correcta, la doctrina correcta y los tests
correctos — en `.lux`. `.lfx` declara el campo y no lo ejerce. Dado que los `.lfx` son ficheros de
usuario, potencialmente compartidos entre operadores, y que el esquema de Genesis prevé importación
entre consolas con firma Ed25519 (`swarm_imports.bundle_signature`), la brecha es material.
Corrección de coste bajo: la maquinaria canónica existe y es reutilizable (§5.1).

### 1.7 Política de fallo silencioso

`LfxFileLoader` declara: *«Un `.lfx` malformado, malicioso o con safety-decl inconsistente NO debe
crashear el cargador ni provocar UI errors. Se loggea y se descarta.»* Con límites concretos:
`MAX_FILE_SIZE_BYTES = 256 KB`, `MAX_STROBE_HZ = 25`, `VALID_TEXTURE_AFFINITIES` como `Set`.

**Correcto para el dominio.** Un efecto corrupto no debe impedir el arranque de una consola treinta
minutos antes de un show.

**Observación:** `MAX_AGGRESSION` fue elevado a `1.0` con el comentario *«Cap eliminado — todos los
efectos son USER ahora, y efectos con aggression=1.0 eran rechazados silenciosamente»*. Documenta un
incidente real: la política de seguridad rechazaba contenido legítimo de forma invisible. **Un
rechazo que no se comunica al usuario es indistinguible de un bug.** La mitigación adecuada no es
abandonar la política, sino exponer el `LoadReport` —que ya se computa con `scanned`, `accepted`,
`rejected`, `errors`— en la UI.

---

## 2. LA UX COMO GUARDARRAÍL ESTRUCTURAL

### 2.1 `DnaRail` — un IDE para comportamiento de IA

`components/views/HephaestusView/dna/DnaRail.tsx` — 928 líneas. Panel de 260 px, **única interfaz**
para configurar `CognitiveDNA` y `SimulationMeta`. Sin ADN habilitado, un clip es invisible para
Selene.

El flujo de datos es la parte arquitectónicamente relevante:

```
Usuario interactúa
      ▼
form: DnaFormState                    (estado local, valores CRUDOS del slider)
      ▼ useMemo
LfxClipInstance ← buildInstance()     (bake: clamps de arquetipo aplicados)
      ▼ useMemo
validateClip(instance, form.aco)      (linter: instancia horneada + ACO CRUDO)
      ▼ useEffect
onDnaChange(instance.toCognitiveDNA(overrides))
      ▼
LabTab → clip → serializeHephClip() → archivo .lfx
```

**Protección anti-bucle:** una ref `isSyncingFromDna` impide ciclos de actualización cuando los
cambios de prop se reflejan de vuelta, con comparación por contenido vía `JSON.stringify` para evitar
propagaciones redundantes. Es el problema clásico del formulario controlado con estado derivado,
resuelto correctamente.

### 2.2 `LfxClipInstance` — el traductor semántico

Doctrina declarada: *«El usuario nunca toca ACO directo (salvo Expert Mode). Cada `userArchetype`
aplica un bias matemático determinista sobre la tríada ACO y restringe las EnergyZones legales.»*

`ARCHETYPE_BIAS_MAP` — congelado en profundidad:

| Arquetipo | Restricciones ACO | Zonas permitidas | Por defecto | Centroide (A/C/O) |
|---|---|---|---|---|
| `divine` | agr ≥ 0.90 · caos ∈ [0.30, 0.70] | intense, peak | peak | 0.95 / 0.50 / 0.50 |
| `strobe` | agr ≥ 0.75 · caos ≥ 0.40 · org ≤ 0.35 | active, intense, peak | intense, peak | 0.85 / 0.65 / 0.20 |
| `heavy` | agr ≥ 0.70 · caos ≥ 0.30 · org ≤ 0.45 | active, intense, peak | intense, peak | 0.80 / 0.55 / 0.25 |
| `ambient` | agr ≤ 0.30 · caos ≤ 0.30 · org ≥ 0.55 | silence, valley, ambient, gentle | valley, ambient | 0.20 / 0.20 / 0.70 |
| `utility` | ninguna | todas | ambient, gentle, active | 0.50 / 0.50 / 0.50 |

`bakeCognitiveDNA()` — determinista e idempotente, en cuatro pasos declarados: clamp de ACO contra
los límites del bias → intersección de `energyZones` con `allowedZones` → si vacía, caer a
`defaultZones` → fallback general si sigue vacía.

**Evaluación del traductor.** El valor no está en el clamping —eso es trivial— sino en que **el
espacio semántico del usuario y el espacio numérico de la IA están unidos por una función pura,
determinista e idempotente, con centroides declarados para la inferencia inversa.** El operador
piensa «esto es un strobe»; el sistema deriva `A=0.85, C=0.65, O=0.20` y restringe las zonas. E
`inferArchetypes` recorre el camino inverso —del vector ACO crudo al arquetipo más próximo por
distancia euclídea ponderada a los centroides— lo que permite a Genesis **etiquetar mutantes
evolucionados con vocabulario humano** sin intervención.

El bucle semántico está cerrado en ambas direcciones: humano → ACO → humano. Esto es lo que hace que
un organismo de generación 9, cuyo genoma derivó lamarckianamente durante nueve mutaciones, siga
siendo describible al operador como «un heavy con tendencia caótica».

**Garantía de hot path:** `freeze()` congela recursivamente `acoTriad`, `compatibleVibes`,
`energyZones` y la instancia. Tras congelar, cualquier `set*` lanza excepción vía
`_assertMutable()`. *«Garantiza zero-alloc safety al entrar al runtime y permite a Selene cachear
referencias confiando en que nada mutará.»* El ciclo mutable-durante-edición →
congelado-antes-de-runtime está aplicado en el propio objeto, no delegado a disciplina de llamador.

### 2.3 `GatekeeperLinter` — validación en tiempo de autoría

443 líneas. **Función pura, sin efectos de lado, idempotente.** Doctrina: *«Cualquier `error` o
`critical` bloquea el guardado (`canSave === false`). Los `warning` se muestran pero no bloquean.»*

| Regla | Severidad | Condición | Motor correlacionado | Umbral |
|---|---|---|---|---|
| `ARCHETYPE_BIAS_VIOLATION` | error | ACO **crudo** fuera de la envolvente | EnergyConsciousness · `archetype_bias_clamp` | — |
| `AMBIENT_AGGRESSION_OVERFLOW` | **critical** | `ambient` con agresión > 0.35 | EnergyConsciousness · `ambient_aggression_ceiling` | 0.35 |
| `STROBE_FREQ_DANGEROUS` | **critical** | strobe con Hz > 25 | SafetyMiddleware · `G6_strobe_frequency` | 25 Hz |
| `STROBE_FREQ_UNDECLARED` | error | strobe con Hz = 0 | SafetyMiddleware · `G6_strobe_declaration` | — |
| `STROBE_LOW_FREQ_FOR_ARCHETYPE` | warning | strobe con Hz < 3 (no perceptual) | EffectDreamSimulator · `strobe_perceptual_floor` | 3 Hz |
| `HEAVY_IN_LOW_ZONE` | error | `heavy` sin ninguna zona dura | DNAAnalyzer · `archetype_zone_coherence` | — |
| `DIVINE_NOT_PEAK_ONLY` | error | `divine` fuera de peak/intense | DNAAnalyzer · `divine_peak_only` | — |
| `ZONE_INCOHERENT_FOR_ARCHETYPE` | warning | `ambient` sin ninguna zona baja | DNAAnalyzer · `archetype_zone_coherence` | — |
| `EMPTY_ENERGY_ZONES` | error | cero zonas declaradas | DNAAnalyzer · `requires_at_least_one_zone` | — |
| `EMPTY_VIBE_LIST` | warning | cero vibes declaradas | DNAAnalyzer · `vibe_specialist_priority` | — |

#### 2.3.1 `seleneCorrelation` — trazabilidad del warning a su motor

```typescript
readonly seleneCorrelation: {
  readonly engine: 'Gatekeeper' | 'DNAAnalyzer' | 'EnergyConsciousness'
               | 'SafetyMiddleware' | 'EffectDreamSimulator' | 'MoodController'
  readonly rule: string
  readonly threshold?: number
}
```

**Esta es la decisión de UX más sofisticada del módulo.** Un linter convencional dice *«esto está
mal»*. Este dice *«el motor `DNAAnalyzer`, regla `archetype_zone_coherence`, nunca seleccionará este
clip en secciones de alta energía»*.

La diferencia es de naturaleza, no de grado. El operador no recibe una prohibición: recibe un
**modelo causal del comportamiento del sistema**. Y el efecto acumulado es formativo: tras veinte
sesiones de autoría, el operador ha construido un modelo mental correcto de cómo Selene decide
—porque el linter se lo ha enseñado caso por caso, con el nombre del motor y el umbral numérico.

En un producto donde la queja dominante sobre cualquier sistema autónomo es *«no entiendo por qué
hizo eso»*, un linter que enseña la lógica de decisión durante la autoría es una respuesta
estructural al problema de la confianza. Los umbrales están expuestos numéricamente
(`threshold: 0.35`, `threshold: 25`), no ocultos tras prosa.

#### 2.3.2 El diseño de `rawAco` — el hallazgo de mayor calidad del área

La regla R0 no puede implementarse de forma ingenua, y el código documenta por qué con precisión
inusual:

```
CRITICAL DESIGN NOTE:
  LfxClipInstance.bakeCognitiveDNA() clamps the acoTriad **in the constructor**
  before the linter ever reads it. Therefore, reading `clip.acoTriad` always
  yields a value that already satisfies the constraints — the violation is
  invisible to the linter.

  Solution: the factory receives the UNCLAMPED `rawAco` (straight from the UI
  slider state) as a closure parameter, so the comparison is always against
  what the user actually typed, not what the engine silently corrected.
```

**Análisis.** Existe una paradoja de observabilidad genuina: el motor de bias **corrige** la
violación automáticamente en el constructor. Cualquier validador que lea el estado horneado observa
un objeto perfectamente conforme. La violación es real —el usuario movió el slider fuera de la
envolvente— pero **inobservable a posteriori**.

La solución es una regla construida por *factory* que captura el ACO crudo en un closure:

```typescript
function makeBiasRule(rawAco: AcoTriad): Rule { ... }

// R0 no está en STATIC_RULES — se construye dinámicamente por llamada
// porque necesita el rawAco capturado antes de que corra bakeCognitiveDNA()
const biasRule = makeBiasRule(rawAco ?? clip.acoTriad)
```

Con degradación explícita: si `rawAco` se omite, R0 cae a los valores horneados y no detecta bias
real — comportamiento documentado en el JSDoc de `validateClip`, no implícito.

**Por qué es notable.** Detectar esta paradoja requiere razonar sobre el **orden temporal de las
transformaciones** dentro del pipeline de autoría, no solo sobre el estado final. Es el tipo de
defecto que en la mayoría de bases de código se manifiesta como *«el linter nunca dispara la regla
de bias»* y se cierra como no reproducible. Aquí está identificado, resuelto con un patrón correcto
(factory + closure sobre el estado pre-transformación), documentado en el punto de implementación
con la etiqueta `CRITICAL DESIGN NOTE`, y con su modo de degradación declarado.

Es, en mi valoración, la evidencia más fuerte de madurez de ingeniería de las tres áreas auditadas.

### 2.4 Cómo la validación en UI protege la BD de Genesis y el hot path de Selene

El sistema aplica sus invariantes en **cuatro capas independientes**, y la de UI es la que evita
coste aguas abajo.

```
CAPA 1 — DnaRail / ARCHETYPE_BIAS_MAP
         El slider no puede producir un ACO fuera de la envolvente (bake automático)
         Las zonas bloqueadas están literalmente deshabilitadas en el termómetro
         Máximo 2 zonas (equilibrio Montecarlo, WAVE 7123)
              ▼
CAPA 2 — GatekeeperLinter
         error | critical → canSave = false → GUARDADO BLOQUEADO
         El archivo .lfx incoherente NO LLEGA A EXISTIR EN DISCO
              ▼
CAPA 3 — LfxFileLoader + registerEffectV3
         Gates G3 (genoma ∈ [0,1]), G4 (compatibleVibes no vacío)
         Límite 256 KB · techo 25 Hz · textureAffinity enumerada
              ▼
CAPA 4 — PrenatalScreening (Genesis) + CHECK de SQLite
         G1-G7 antes de cualquier INSERT
         CHECK (dna_aggression BETWEEN 0 AND 1) a nivel de motor de BD
         Trigger de inmutabilidad de ancestros
```

**El valor específico de la Capa 2 es que actúa antes de la serialización.**

**(a) Protección de la base de datos de Genesis.** `AncestralIngestor` puebla `lfx_blueprints` desde
el catálogo `.lfx`, y los blueprints son **ancestros de granito inmutables** — protegidos por
trigger a nivel de motor de BD (Área 5 §2.9). Un blueprint corrupto **no puede corregirse mediante
UPDATE**: el trigger lo aborta. La única vía sería eliminar la fila con `ON DELETE CASCADE`, lo que
exterminaría todo su linaje descendiente.

Es decir: **el coste de admitir un dato sucio en el catálogo `.lfx` no es un registro erróneo, es un
linaje evolutivo entero construido sobre una premisa incoherente y no rectificable in situ.**
Bloquear el guardado es cuantitativamente más barato que cualquier remediación posterior.

**(b) Protección del hot path de Selene.** Un efecto con `EMPTY_ENERGY_ZONES` sería *permanentemente
dormido* —el mensaje del linter lo dice literalmente— pero **seguiría ocupando una entrada en
`RegistryEntry`, seguiría siendo iterado en los índices por vibe, y seguiría consumiendo presupuesto
de frame**. El registry es explícitamente zero-alloc y sus índices se recorren en el camino de
44 Hz. Cada efecto inelegible admitido es coste puro sin posibilidad de beneficio.

**(c) Coherencia de la presión selectiva.** Genesis evoluciona lo que Selene elige (Área 5 §2.10: el
fitness es 100% supervivencia pasiva). Un efecto que nunca puede ser elegido —arquetipo `heavy`
mapeado solo a zonas bajas— nace con fitness 0, nunca se dispara, y muere por apoptosis tras agotar
su escudo neonatal. **Habría consumido capacidad de carga del ecosistema durante 3-20 ciclos sin
aportar información.** Con `MAX_VITAL_SPACE = 60`, admitir datos incoherentes degrada directamente
la tasa de exploración evolutiva.

**(d) Seguridad fotosensible en el punto de autoría.** `STROBE_FREQ_DANGEROUS` es `critical` y
bloquea el guardado, correlacionando con el gate real: *«el SafetyMiddleware de Selene rechazará este
clip en la ingesta (Gate G6 — riesgo de epilepsia)»*. La restricción se aplica **tres veces** —UI,
loader (`MAX_STROBE_HZ = 25`), y G6 en el screening prenatal— y coincide con la asimetría de pesos
del fitness (`w_rej = −0.40` vs `w_dm = +0.30`). La disciplina de seguridad es coherente de extremo
a extremo, no aplicada en un solo punto.

### 2.5 Hallazgos del pipeline de autoría

La verificación empírica de los `.lfx` generados por `DnaRail` (`arsenal/builtins/custom/`, ficheros
`heph_*.lfx`) frente a los escritos a mano (`latin/`, `chill/`, `chill-lounge/`) revela dos brechas
sistemáticas.

#### 2.5.1 `aggressionRange` degenerado — banda de anchura cero

`LfxClipInstance.toCognitiveDNA()`, línea 551:

```typescript
const aggression = this.acoTriad.aggression
const aggressionRange = Object.freeze({ min: aggression, max: aggression })
```

El comentario lo declara: *«`aggressionRange`: rango [agg, agg] cerrado sobre el valor actual»*.

Comparación empírica de los artefactos en disco:

| Origen | Fichero | `aggressionRange` | Anchura |
|---|---|---|---|
| A mano | `chill-lounge/surface_shimmer.lfx` | `{0.03, 0.33}` | 0.30 |
| A mano | `chill/solar_caustics.lfx` | `{0.00, 0.30}` | 0.30 |
| A mano | `_EFECTO_BASE.lfx` (plantilla) | `{0.40, 0.80}` | 0.40 |
| **DnaRail** | `custom/heph_1782928865838_apewm8.lfx` | `{0.50, 0.50}` | **0.00** |
| **DnaRail** | `custom/heph_1782609140553_bto9fn.lfx` | `{0.21, 0.21}` | **0.00** |
| **DnaRail** | `custom/heph_1784931422617_tpox7b.lfx` | `{0.972, 0.972}` | **0.00** |
| **DnaRail** | `custom/heph_1784952802805_jigk8a.lfx` | `{0.50, 0.50}` | **0.00** |

**El campo está tipado como `Range` y documentado como «banda de tolerancia para la agresión en
runtime». Una banda de anchura cero no es una tolerancia: es una igualdad.** Todo efecto creado desde
el `DnaRail` declara que tolera exactamente un valor de agresión, con precisión de tres decimales.
La plantilla de referencia del propio proyecto declara `{0.40, 0.80}` — la intención de diseño es
inequívocamente una banda ancha.

**Circunstancia mitigante verificada:** la búsqueda de consumidores en `core/` devuelve únicamente
(a) `_validateGenomeRanges()`, que comprueba `min ≤ max` —satisfecho trivialmente por la igualdad— y
(b) la copia congelada a `RegistryEntry`. **Ningún motor lo usa hoy como test de contención.** El
defecto es latente, no activo.

Pero es esa latencia la que lo hace peligroso: el día en que un gate implemente
`aggressionRange.min ≤ runtimeAggression ≤ aggressionRange.max`, **todo el catálogo autorado desde el
DnaRail quedará silenciosamente inelegible**, mientras los builtins escritos a mano seguirán
funcionando. El modo de fallo sería extremadamente difícil de diagnosticar, porque la causa estaría
en ficheros generados meses antes.

Contraste instructivo: `pressureRange` **sí** recibió el tratamiento correcto en WAVE 7159, con el
comentario *«reemplazar el default permisivo {0,0} por rangos basados en clasificación para que el
veto de presión realmente dispare»* — hard archetypes → `{0.5, 1.0}`, ambient → `{0.0, 0.5}`,
utility → `{0.0, 1.0}`. **La disciplina existe en el campo hermano, en la misma función, veinte
líneas más abajo.** `aggressionRange` no la recibió.

#### 2.5.2 `validSections` siempre vacío, y ausencia de regla en el linter

`toCognitiveDNA()`, líneas 588-590:

```typescript
validSections: overrides?.validSections
  ? [...overrides.validSections]
  : Object.freeze([] as readonly string[]),
```

**El `DnaRail` no expone ningún control de UI para `validSections`** — no figura en las 7 secciones
del panel ni en la tabla de parámetros expuestos. Al no existir override, el campo se emite
**siempre vacío**.

| Origen | `validSections` |
|---|---|
| `chill/solar_caustics.lfx` | `["intro", "breakdown", "valley", …]` |
| `latin/amazon_mist.lfx` | `["intro", "outro", "silence"]` |
| `latin/arena_sweep.lfx` | `["build", "drop", "breakdown"]` |
| `_EFECTO_BASE.lfx` | `["drop"]` |
| **Los 5 `custom/heph_*.lfx`** | **`[]`** |

**Y el `GatekeeperLinter` no tiene ninguna regla para este caso.** Tiene `EMPTY_ENERGY_ZONES`
(error, bloquea) y `EMPTY_VIBE_LIST` (warning), pero **no existe `EMPTY_VALID_SECTIONS`**. El tercer
eje de matching contextual —la sección musical— puede quedar completamente indeclarado sin que el
linter emita observación alguna.

**Contraste revelador con el módulo hermano.** `types/theiaTypes.ts:86` declara entre las reglas
estructurales validadas por su loader:

```
- `validSections.length >= 1`
```

**Theia —el módulo de vídeo, descrito en la documentación como «en construcción»— aplica una
restricción sobre `validSections` que el pipeline de `.lfx` no aplica.** El dominio derivado es más
estricto que el dominio original en el campo que ambos comparten.

Impacto: **medio**. Combinado con §2.5.1, los efectos autorados desde la UI declaran correctamente
dos de los cuatro ejes de matching (`energyZone`, `compatibleVibes`, más `textureAffinity` derivada)
y degeneran los otros dos (`aggressionRange` a un punto, `validSections` a vacío). Corrección de
coste bajo, detallada en §5.2.

---

## 3. LA SÍNTESIS — EL SISTEMA DE TIPOS COMO CONDUCTO

### 3.1 El problema que resuelve

Iliquidcore (Área 4) y Genesis (Área 5) operan en **escalas temporales incompatibles**:

| Dimensión | Iliquidcore | Genesis |
|---|---|---|
| Reloj | 44 Hz — 22.7 ms de presupuesto por frame | tiempo geológico — ciclos de minutos |
| Modelo de memoria | zero-alloc, buffers preasignados | SQLite, JSON Patch RFC 6902, LRU |
| Determinismo | obligatorio (mismo input → mismo output) | estocástico (RNG, ruleta ponderada) |
| Operación dominante | evaluar `C(t) ≥ Q(t)` | mutar, cruzar, especiar, apoptosis |

Un acoplamiento directo entre ambos sería estructuralmente imposible: el motor evolutivo no puede
tocar el hot path sin destruir su determinismo, y el hot path no puede consultar un esquema
normalizado sin violar su presupuesto de frame. **El Sistema de Tipos V3 es precisamente la
membrana que permite el intercambio sin contacto.**

### 3.2 El mecanismo del conducto — tres traducciones

**(1) Genesis escribe genotipos, no fenotipos.** `delta_json` almacena un parche RFC 6902 contra el
clip ancestro, no un `HephAutomationClipV3` completo. Esto es posible **únicamente porque el tipo es
estructuralmente estable y direccionable por puntero JSON**: `/cognitiveDNA/genome/aggression`,
`/tracks/2/curve/keyframes/5`. La multicelularidad del Bloque C (§1.3) no es solo una ventaja de
autoría — es lo que da a los operadores genéticos un espacio de direcciones fino sobre el que mutar
sin reescribir el organismo.

**(2) `OrganismMaterializer` reconstituye el fenotipo bajo demanda.** Aplica la cadena de deltas
ancestro→hijo, cachea con LRU, y ante error cae al clip de granito ancestral. El contrato de salida
es el mismo `HephAutomationClipV3` que produce el `DnaRail`. **Un organismo evolucionado en la
generación 40 y un efecto escrito a mano por un operador son indistinguibles para el consumidor.**
Esta indistinguibilidad es la propiedad que hace que Selene no necesite saber que Genesis existe.

**(3) `RegistryEntry` aplana para el hot path.** La desnormalización de §1.5 —`dna`,
`textureAffinity`, `compatibleVibes` promovidos a primer nivel, índices por vibe preconstruidos—
convierte el fenotipo reconstituido en una estructura de acceso O(1) y congelada. **El coste de
travesía del esquema se paga una vez en el registro, nunca en el frame.**

```
DnaRail ──► LfxClipInstance ──► GatekeeperLinter ──► .lfx v3.0
                                                        │
                          ┌─────────────────────────────┤
                          ▼                             ▼
                  DynamicEffectRegistry          Genesis (granito)
                  (RegistryEntry, O(1))                 │
                          ▲                    GeneticOperators
                          │                    (delta_json RFC 6902)
                          │                             │
                          │                    PrenatalScreening G1-G7
                          │                             │
                          └──── OrganismMaterializer ◄───┘
                          │
                          ▼
                  Selene · 44 Hz · C(t) ≥ Q(t)
                          │
                          ▼
                  HeatmapLogger ──► fitness ──► Genesis
```

**El bucle se cierra sin que ningún subsistema conozca la implementación de otro.** El único
conocimiento compartido es el tipo.

### 3.3 La prueba de la ortogonalidad: Theia

La afirmación de que un sistema de tipos es genuinamente agnóstico al dominio es fácil de hacer y
difícil de demostrar. **Theia la demuestra empíricamente.** El módulo de pantallas LED consume
`.lfx`, traduce a `.theia`, y conserva la genética íntegra:

```typescript
// types/theiaTypes.ts — ITheiaGenome
readonly aggression: number
readonly chaos: number
readonly organicity: number
```

Estructuralmente idéntico a `FrozenGenome`. `IEnergyZoneRange` idéntico a `EnergyZoneRange`. **Un
dominio sin fixtures, sin canales DMX, sin pan/tilt, sin IK, reutiliza el eje cognitivo completo sin
modificarlo.** Es la validación de que el Bloque D (`cognitiveDNA`) no contenía contaminación
espacial encubierta. El desacoplamiento de §1.2 es real, no declarativo.

Dos observaciones sobre la ejecución:

- **Replicación en lugar de importación.** `ITheiaGenome` es una copia estructural declarada para
  evitar dependencias circulares. Decisión defendible en TypeScript, pero **sin verificación de
  conformidad en tiempo de compilación**: nada impide que `FrozenGenome` gane un cuarto eje y
  `ITheiaGenome` no lo siga. Riesgo de desincronización silenciosa. Coste de mitigación: trivial
  (§5.3).
- **El derivado es más estricto que el original.** Theia exige `validSections.length >= 1` (§2.5.2);
  el pipeline `.lfx` no. Un módulo declarado «en construcción» aplica una invariante que el módulo
  maduro omite — indicio de que la regla es correcta y su ausencia aguas arriba es omisión, no
  diseño.

### 3.4 Valoración estratégica del activo

Lo replicable de LuxSync son los motores: la fusión sensorial de siete sensores, los ocho operadores
genéticos, la regla de la mantis. Son sofisticados, pero son algoritmos — y los algoritmos publicados
se reimplementan.

**Lo no replicable es el protocolo.** Un contrato de datos que simultáneamente:

- soporta direccionamiento por puntero JSON para mutación genética fina,
- se aplana a acceso O(1) para un hot path de 44 Hz zero-alloc,
- expone un vocabulario semántico (arquetipos, texture affinity) que un operador humano puede
  manipular sin entender el espacio ACO,
- y permanece agnóstico al dominio hasta el punto de que un módulo de vídeo lo reutiliza sin
  modificarlo,

es un artefacto de convergencia de diseño, no de esfuerzo. **No se obtiene especificándolo; se
obtiene iterándolo contra cinco consumidores heterogéneos hasta que los cinco quepan.** El coste de
replicación no es de implementación — es de descubrimiento.

---

## 4. PIONEER SCORE

Escala estricta. Referencia 100 = protocolo de datos industrialmente irreprochable, con integridad
criptográfica verificada y conformidad multi-dominio garantizada en compilación.

### 4.1 Desglose

| Eje | Peso | Nota | Ponderado | Justificación |
|---|---|---|---|---|
| **Modelado de datos** | 30 | **95** | 28.5 | Partición en cinco bloques por consumidor y ciclo de vida. Multicelularidad por `HephTrack` con direccionamiento fino. Ortogonalidad espacial/cognitiva demostrada empíricamente por Theia. Desnormalización deliberada a `RegistryEntry` para O(1). −5: `aggressionRange` semánticamente degenerado en la ruta de autoría. |
| **Estrictitud de esquema** | 25 | **80** | 20.0 | Discriminador `$schema: 'luxsync.lfx/3.0'`, `readonly` exhaustivo, `Object.freeze` en profundidad, gates G2-G7 en el loader, política de fallo silencioso con límites numéricos. **−20: `checksum` declarado pero nunca verificado** — la maquinaria Ed25519 existe para `.lux`/swarm y no se reutiliza aquí. Falta `EMPTY_VALID_SECTIONS`. Conformidad Theia↔`FrozenGenome` no verificada por el compilador. |
| **Integración de restricciones UI/IA** | 30 | **96** | 28.8 | `DnaRail` como IDE de comportamiento de IA: traducción semántica arquetipo→ACO con bias determinista. `GatekeeperLinter` puro e idempotente, 10 reglas, `error`/`critical` bloquean el guardado. `seleneCorrelation` da trazabilidad warning→motor→regla→umbral numérico. **El diseño de `rawAco` (§2.3.2) —capturar el ACO crudo antes del clamp para poder reportar la violación que el clamp oculta— es el hallazgo de mayor calidad de las tres áreas.** −4: `validSections` no expuesto en UI. |
| **Coherencia inter-dominio** | 15 | **88** | 13.2 | Cinco consumidores (Chronos, Hephaestus, Selene, Genesis, Theia) sobre un solo contrato. Seguridad fotosensible aplicada en cuatro capas independientes con umbrales coincidentes. −12: replicación estructural en Theia sin garantía de sincronía; asimetría de estrictitud entre dominio original y derivado. |

### 4.2 Cálculo

```
28.5 + 20.0 + 28.8 + 13.2 = 90.5
```

### 4.3 Veredicto

# **PIONEER SCORE: 90 / 100**

**Clasificación: ACTIVO ESTRATÉGICO — el componente de mayor puntuación de las tres áreas
auditadas.**

Las Áreas 4 y 5 fueron evaluaciones de *capacidad algorítmica*. Esta es una evaluación de
*disciplina de contrato*, y la disciplina es lo que determina si un sistema de cinco subsistemas
sobrevive a su tercer año de mantenimiento. **El Sistema de Tipos V3 es la razón por la que
Iliquidcore y Genesis pueden coexistir sin conocerse, y por la que Theia pudo nacer sin renegociar
el esquema.**

La deducción dominante es **una sola y es de coste de corrección bajo**: el campo `checksum` existe
en el sobre `LFXFileV3`, se escribe como cadena vacía, y nunca se verifica — en un producto que ya
implementa firma Ed25519 para intercambio entre consolas. No es un defecto de diseño; es una tarea
pendiente en el punto exacto donde el diseño ya está resuelto.

**Recomendación de adquisición: ADQUIRIR. Prioridad máxima sobre las tres áreas.** El protocolo es
el activo cuya replicación independiente resulta más costosa, porque su valor reside en las
restricciones que ya absorbió, no en su implementación.

---

## 5. RUTA DE EVOLUCIÓN RECOMENDADA

Ordenada por relación impacto/coste. Ninguna de las cuatro requiere cambio de versión mayor del
esquema.

### 5.1 Verificar `checksum` en `LfxFileLoader` — *crítico, coste bajo*

**Estado actual:** `LfxFileLoader` invoca `_registry.registerEffectV3` pasando `checksum` como
cadena vacía. Ningún punto del pipeline calcula ni compara el digest.

**Acción:**

1. Calcular SHA-256 canónico sobre el documento con el campo `checksum` excluido (mismo
   procedimiento ya empleado en el pipeline `.lux`).
2. En escritura: poblar el campo. En carga: comparar y, ante discrepancia, descartar por la ruta de
   fallo silencioso ya existente (loggear + descartar, sin crash).
3. Modo de gracia para los `.lfx` ya en disco con `checksum: ""`: aceptar con warning y reescribir
   el digest en el primer guardado.

**Beneficio:** cierra la brecha de integridad para el catálogo de granito del que Genesis deriva
todos sus linajes. Un `.lfx` ancestro corrupto contamina toda su descendencia vía `delta_json`, y
`OrganismMaterializer` cae precisamente a ese clip como fallback de seguridad.

### 5.2 Corregir la degeneración del pipeline de autoría — *medio, coste bajo*

**(a) `aggressionRange` con anchura real.** Aplicar en `toCognitiveDNA()` el mismo tratamiento por
clasificación de arquetipo que `pressureRange` ya recibió veinte líneas más abajo:

```
banda = clamp01(aggression ∓ tolerancia_por_clase)
  hard    → tolerancia ±0.15
  ambient → tolerancia ±0.20
  utility → {0.0, 1.0}
```

Referencia de intención: `_EFECTO_BASE.lfx` declara `{0.40, 0.80}`.

**(b) Exponer `validSections` en el `DnaRail`** como grupo de toggles sobre el vocabulario de
secciones de Chronos, y **añadir la regla `EMPTY_VALID_SECTIONS` al `GatekeeperLinter`** con
severidad `warning` (paridad con `EMPTY_VIBE_LIST`), elevable a `error` una vez el catálogo `custom/`
esté migrado — alineando la estrictitud de `.lfx` con la que Theia ya aplica.

**Beneficio:** restaura los cuatro ejes de matching contextual en los efectos autorados desde la UI y
elimina un modo de fallo latente de diagnóstico costoso (§2.5.1).

### 5.3 Garantizar la conformidad Theia↔`FrozenGenome` en compilación — *bajo, coste trivial*

Añadir en `types/theiaTypes.ts` una aserción de tipo estático bidireccional que falle la compilación
si los dos genomas divergen estructuralmente, preservando la ausencia de dependencia circular en
runtime:

```typescript
type _AssertGenomeParity =
  ITheiaGenome extends FrozenGenome ? (FrozenGenome extends ITheiaGenome ? true : never) : never
const _genomeParity: _AssertGenomeParity = true
```

(con `import type` — se borra en emisión, no introduce ciclo).

**Beneficio:** convierte un riesgo de desincronización silenciosa en un error de compilación. Es el
único punto donde el desacoplamiento inter-dominio depende hoy de disciplina humana.

### 5.4 Activar `s_DNA` sobre el campo ya aplanado — *alto, coste medio*

Área 5 §5.1 identificó `s_DNA` (el sensor de afinidad genómica de Selene) como no alimentado.
`RegistryEntry.dna` **ya expone la tríada ACO aplanada en O(1)**, y la propuesta de un
`resolveGenome(effectId)` en el registry es la vía natural: la estructura de datos necesaria existe,
está congelada, y está optimizada exactamente para el patrón de acceso requerido.

**Beneficio:** cierra el bucle cognitivo completo. Selene pasaría de seleccionar por contexto
(vibe · sección · zona de energía) a seleccionar también por afinidad genómica, lo que a su vez
convierte la presión selectiva de Genesis en un gradiente sobre el propio espacio ACO — el eje sobre
el que los operadores genéticos ya mutan.

---

## APÉNDICE — RESUMEN DE HALLAZGOS

| # | Hallazgo | Severidad | Coste corrección | Ref. |
|---|---|---|---|---|
| H1 | `checksum` declarado, nunca calculado ni verificado | **Crítico** | Bajo | §1.6 · §5.1 |
| H2 | `aggressionRange` de anchura cero en todo `.lfx` autorado por UI | Medio (latente) | Bajo | §2.5.1 · §5.2a |
| H3 | `validSections` siempre vacío + regla ausente en el linter | Medio | Bajo | §2.5.2 · §5.2b |
| H4 | Conformidad Theia↔`FrozenGenome` sin verificación estática | Bajo | Trivial | §3.3 · §5.3 |
| H5 | `s_DNA` sin alimentar pese a existir `RegistryEntry.dna` en O(1) | Oportunidad | Medio | §1.5 · §5.4 |

**Fortalezas estructurales confirmadas:**

- Partición por consumidor y ciclo de vida en `HephAutomationClipV3` (§1.1)
- Ortogonalidad espacial/cognitiva demostrada empíricamente vía Theia (§3.3)
- Multicelularidad por `HephTrack` como habilitador del direccionamiento genético fino (§1.3 · §3.2)
- `RegistryEntry` — desnormalización deliberada y congelada para hot path de 44 Hz (§1.5)
- `GatekeeperLinter` puro, idempotente, con `seleneCorrelation` trazable a umbrales numéricos (§2.3)
- **Diseño de `rawAco`: observabilidad preservada frente al clamp — hallazgo de mayor calidad de la
  auditoría completa** (§2.3.2)
- Seguridad fotosensible aplicada en cuatro capas independientes con umbrales coincidentes (§2.4d)
- Autonomía de IA como opt-in explícito, no por defecto (§1.1)

---

**FIN DEL ÁREA 6 — CIERRE DE LA DUE DILIGENCE TÉCNICA**

| Área | Componente | Pioneer Score |
|---|---|---|
| 4 | Selene V3 — Iliquidcore (núcleo cognitivo) | ver `SELENE_V3_DUE_DILIGENCE.md` |
| 5 | Genesis — motor evolutivo | ver `GENESIS_V3_DUE_DILIGENCE.md` |
| **6** | **Sistema de Tipos V3 · `.lfx` · DNArail** | **90 / 100** |
