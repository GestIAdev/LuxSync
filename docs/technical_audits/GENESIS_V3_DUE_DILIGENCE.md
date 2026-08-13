# AUDITORÍA TÉCNICA DE ADQUISICIÓN — ÁREA 5

## El Motor Evolutivo Genesis — Simulador de Vida Artificial para Efectos DMX

**Documento:** Whitepaper arquitectónico de Due Diligence — Parte 2
**Alcance:** `electron-app/src/core/genesis/` — escaneo completo del directorio + integración con `arsenal/`
**Auditor:** Chief Acquisition Auditor & Principal AI/DSP Architect
**Fecha:** 2026-08-10
**Documento precedente:** `SELENE_V3_DUE_DILIGENCE.md` (Área 4 — Iliquidcore, 87/100)
**Mercados objetivo de evaluación:** Norteamérica (US/CA) y España
**Clasificación:** Confidencial — Proceso de adquisición de IP LuxSync

---

## RESUMEN EJECUTIVO

Genesis no es un generador de variaciones paramétricas. Es un **ecosistema termodinámico
persistente** donde los efectos de iluminación son organismos con metabolismo, linaje,
especiación y muerte.

La tesis arquitectónica central es que la calidad estética no se programa: **se cultiva**. El
sistema no contiene una función objetivo de belleza escrita a mano. Contiene un medio con coste
energético, un conjunto de operadores de variación y un juez externo —Selene— que decide qué
sobrevive. La estética emerge de la presión selectiva.

Tres decisiones de diseño elevan esto por encima de un algoritmo genético convencional:

1. **Herencia diferencial en RFC 6902.** Los organismos no almacenan su fenotipo. Almacenan el
   **parche JSON mínimo** respecto de su ancestro. Un organismo de generación 12 es un `delta_json`
   de unos cientos de bytes, no un clip completo.
2. **Deriva lamarckiana bidireccional.** Los 7 operadores asexuales no solo mutan la estructura:
   **reescriben el genoma ACO del organismo** en función de la mutación aplicada. El fenotipo
   modifica el genotipo. Biológicamente herético, computacionalmente brillante.
3. **La Regla de la Mantis (semelparidad).** Los organismos de élite que se reproducen
   sexualmente son **sacrificados**. Esto resuelve estructuralmente el fallo canónico de todo
   algoritmo genético de larga duración: la inmortalidad de la élite.

**Veredicto preliminar:** Activo de IP altamente diferenciado con tres capacidades implementadas
pero desconectadas —el mismo patrón de deuda detectado en Área 4—. **Puntuación: 84/100.**

---

## 1. OPERADORES GENÉTICOS Y RNG DE COLA PESADA

### 1.1 Arquitectura de los operadores — pureza funcional

`operators/GeneticOperators.ts` — 1.728 líneas. Contrato uniforme:

```typescript
(parent: HephAutomationClipV3, seed?: number) => {
  clip: HephAutomationClipV3   // el clon mutado (fenotipo)
  delta: JsonPatchOp[]         // el diff mínimo RFC 6902 (genotipo)
  operator: MutationOperator
  l2Distance: number           // magnitud de la divergencia
}
```

**Observación de auditoría:** todos los operadores son **funciones puras y deterministas dada
una semilla**. Sin efectos de lado, sin acceso a base de datos, sin E/S. Esto tiene tres
consecuencias directas de valor:

- **Reproducibilidad forense.** Cualquier organismo del ecosistema puede regenerarse
  exactamente desde (ancestro, operador, semilla). Un bug estético es reproducible.
- **Testabilidad unitaria total.** Existe `__tests__/GeneticOperators.test.ts`.
- **Paralelización trivial.** Los operadores podrían ejecutarse en un worker pool sin
  sincronización.

### 1.2 Los 7 operadores asexuales — análisis individual

| # | Operador | Peso ruleta | Intervención | Deriva ACO inducida |
|---|----------|:-----------:|--------------|---------------------|
| 1 | `focal_mutation` | 0.20 | Desplaza **un** keyframe en 0.20-0.40 del span, en un track seleccionado por ADN (agresión→intensity/strobe; organicidad→color/zoom/pan/tilt) | agresión +0.020, caos +0.020 |
| 2 | `gene_augmentation` | 0.18 | Inyecta **un track estructural nuevo** con curva de 2-3 keyframes cuya forma se deriva del genoma (agresivo→`hold` cortante; orgánico→`bezier` suave) | strobe: agr +0.150, caos +0.050, presión +0.100 · color: org +0.120 · pan/tilt: caos +0.120 · zoom: agr +0.080 |
| 3 | `spatial_resonance` | 0.15 | Aplica un **arquetipo de fase geométrica** a un track no-color: Harmony (spread 360°, wings par, mirror), Chaos (spread 90-270°, wings impar, shuffle 0.3-0.8, blocks 2-4), Aggression (wings 1, shuffle 0, muro unificado) | harmony: org +0.030, caos −0.040 · chaos: caos +0.050 · aggression: agr +0.040 |
| 4 | `proportional_stretch` | 0.15 | Escala el clip completo por un **multiplicador estrictamente musical** (0.25 / 0.5 / 1.5 / 2.0) seleccionado por genoma | acelera: agr +0.050, caos +0.030 · ralentiza: org +0.060, agr −0.040 |
| 5 | `macro_splice` | 0.15 | Inserta un **bloque de 2 keyframes** (Stutter / Peak / Breath) en un hueco temporal > 300 ms | stutter: caos +0.050, org −0.020 · peak: agr +0.060 · breath: org +0.050, agr −0.030 |
| 6 | `adaptive_pruning` | 0.05 | Conserje inteligente: elimina tracks muertos (varianza < 0.05) o keyframes redundantes (3 consecutivos con varianza < 0.05) | caos −0.040, org +0.030 |
| 7 | `curve_adaptation` | 0.12 | Cambia la interpolación de un keyframe según genoma: organicidad→`bezier`, agresión/caos→`hold`, fallback→`linear` | según destino |

**Tres hallazgos de diseño de alto valor:**

**(a) La ruleta ponderada corrige un sesgo real y documentado.** El comentario de
`ColiseumService.ts:44-46` declara: *«Sin esto, focal_mutation domina y los operadores
estructurales (macro_splice, adaptive_pruning) nunca son seleccionados»*. Con selección uniforme
sobre 7 operadores, los operadores de bajo impacto —que son los que un RNG produce con más
facilidad— colapsarían el espacio de búsqueda hacia el ruido paramétrico. La ruleta asigna
**0.48 de probabilidad acumulada a operadores estructurales** (`gene_augmentation` 0.18 +
`macro_splice` 0.15 + `spatial_resonance` 0.15). Esto es sesgo de exploración deliberado hacia
la innovación topológica.

**(b) `proportional_stretch` respeta la rejilla musical.** El operador no escala por un factor
continuo: escala por multiplicadores del conjunto {0.25, 0.5, 1.5, 2.0}. Un efecto de 4 compases
se convierte en uno de 2 u 8 compases, **nunca en uno de 3,7 compases**. Esta restricción es la
diferencia entre un mutante utilizable en pista y basura arrítmica. Es conocimiento de dominio
musical codificado como restricción del espacio de búsqueda, y reduce drásticamente la
proporción de descendencia inviable.

**(c) Las listas negras son quirúrgicas.** `spatial_resonance` excluye explícitamente los tracks
de color con el razonamiento documentado *«color phasing creates visual mud»*.
`adaptive_pruning` protege `intensity`, `color`, `pan`, `tilt` (solo los poda si son
literalmente planos, varianza = 0.00) y, tras WAVE 7165, **nunca elimina el último track que
cubre un par (paramId, zona)** — protección de la multicelularidad espacial. Estas
restricciones no son genéricas de algoritmos genéticos: son específicas del dominio DMX y
representan conocimiento experto no trivial de replicar.

### 1.3 La deriva lamarckiana — el activo de IP más original del motor

Cada operador ejecuta un **paso D: DNA Drift**. Ejemplo de `gene_augmentation`:

```typescript
if (chosenParam === 'strobe') {
  newAggression  = clamp3(newAggression + 0.150, 0, 1)
  newChaos       = clamp3(newChaos      + 0.050, 0, 1)
  newPressureMin = clamp3(newPressureMin + 0.100, 0, 1)
} else if (chosenParam === 'color') {
  newOrganicity  = clamp3(newOrganicity + 0.120, 0, 1)
}
```

**Esto invierte el dogma central de la genética darwiniana.** En un algoritmo genético clásico,
el genoma es la fuente y el fenotipo la consecuencia; el fenotipo nunca escribe hacia atrás.
Aquí, **inyectar un track de estroboscopio incrementa la agresión declarada del organismo en
0.150**.

Y es la decisión correcta para este dominio, por una razón precisa: en Genesis, el genoma ACO no
es un *plano de construcción*, es una **etiqueta semántica de comportamiento** que Selene V3
consume para hacer matching contextual (vía el sensor `s_DNA` y vía
`EffectDreamSimulator`). Si un organismo adquiere un estroboscopio pero su genoma sigue
declarando agresión 0.2, la etiqueta miente y Selene lo dispara en un valle ambiental. La deriva
lamarckiana **mantiene la coherencia entre lo que el organismo es y lo que declara ser**, de
forma automática y en cada mutación.

Es, en efecto, un mecanismo de auto-etiquetado que elimina la necesidad de un clasificador
posterior. Consecuencia adicional relevante: los organismos derivan **direccionalmente** en el
espacio ACO a lo largo de las generaciones. Un linaje que acumula `macro_splice`/`peak` migra
monótonamente hacia la esquina agresiva del cubo; uno que acumula `breath` migra hacia la
orgánica. **Las especies emergen en el espacio ACO sin que nadie las haya definido.**

La precisión a 3 decimales (`clamp3`) no es cosmética: garantiza que el genoma serializado sea
estable byte a byte, lo que hace el `delta_json` determinista y el checksum reproducible.

### 1.4 RNG de cola pesada — evaluación teórica y hallazgo de auditoría

#### 1.4.1 Por qué las colas pesadas son superiores a la gaussiana en este dominio

La pregunta es legítima y la respuesta es estructural. Sea `X` la magnitud de una mutación.

**Con distribución gaussiana** `X ~ N(0, σ²)`:

```
P(|X| > 3σ) ≈ 0.0027
P(|X| > 5σ) ≈ 5.7 × 10⁻⁷
```

La probabilidad de una mutación grande decae **exponencialmente** (`e^(−x²/2σ²)`). Esto produce
un régimen de búsqueda de **gradualismo puro**: el algoritmo explora una vecindad local del
fenotipo padre y solo puede alcanzar regiones distantes del espacio mediante largas cadenas de
pasos pequeños, cada uno de los cuales debe ser individualmente viable.

Para efectos DMX esto es fatal por dos razones concretas:

- **El paisaje de aptitud es discontinuo y de valles profundos.** «Estroboscopio a 12 Hz» y
  «fade orgánico de 4 s» son ambos óptimos locales excelentes, separados por una región de
  fenotipos intermedios *estéticamente peores que ambos* (un fade nervioso). Un caminante
  gaussiano no puede cruzar ese valle: cada paso intermedio es penalizado y la selección lo
  devuelve al óptimo de partida. El ecosistema queda atrapado. Es el fenómeno clásico de
  **mode collapse**.
- **Existe un umbral de percepción.** Una mutación de intensidad de 0.02 es literalmente
  invisible en pista, pero consume un ciclo completo de evaluación (un disparo real, con público
  presente). El gradualismo gaussiano gasta la mayor parte de su presupuesto evaluativo en
  cambios **imperceptibles** — el recurso más escaso del sistema no es CPU, es *tiempo de pista*.

**Con distribución de Cauchy** —implementada en `makeFatTailedRng` (`GeneticOperators.ts:318-332`)
por inversión de la CDF:

```typescript
raw = scale · tan(π · (p − 0.5))        // p ~ U(0,1)
return clamp(raw, −maxAbs, +maxAbs)     // Cauchy truncada
```

La cola decae **polinómicamente** (`P(|X| > x) ~ 1/x`). La Cauchy no tiene media ni varianza
definidas. Las consecuencias son exactamente las deseadas:

- La **moda sigue en 0**: la mayoría de las mutaciones son pequeñas. Se preserva el refinamiento
  local del gradualismo.
- Pero los **saltos grandes tienen probabilidad no despreciable**: ocasionalmente, una mutación
  cruza el valle de aptitud de un salto y aterriza en una cuenca completamente distinta.

Esto es, formalmente, un régimen de **equilibrio puntuado** (Eldredge & Gould): largos periodos
de estasis con refinamiento marginal, interrumpidos por eventos de especiación abrupta. Es el
patrón que la paleontología observa en el registro fósil real, y es también el patrón óptimo de
búsqueda en paisajes multimodales rugosos —el mismo principio que sustenta el *Fast Simulated
Annealing* de Szu & Hartley (1987), donde el reemplazo de la distribución de visita gaussiana por
una de Cauchy mejora la tasa de convergencia de forma demostrable.

**Con distribución de Pareto** (positiva estricta):

```typescript
return xm / Math.pow(1 - p, 1 / alpha)
```

Apropiada para magnitudes que solo pueden crecer —duraciones, spread de fase, cuentas de
keyframes— donde el signo no tiene sentido y se desea una cola superior pesada.

**Conclusión teórica:** para un dominio con paisaje de aptitud rugoso, evaluación costosa y
umbral de percepción no nulo, la elección de colas pesadas frente a la gaussiana no es una
preferencia: es la decisión matemáticamente correcta.

#### 1.4.2 HALLAZGO DE AUDITORÍA — la infraestructura está desconectada

**`makeFatTailedRng()` está implementada, exportada en `index.ts:22` y tipada en `index.ts:27`,
pero NO es invocada por ningún operador.**

Verificación: búsqueda de `makeFatTailedRng`, `sampleCauchy` y `samplePareto` en todo
`electron-app/src` devuelve **exclusivamente** la definición (`GeneticOperators.ts:307-332`) y su
re-exportación en el barrel. **Cero consumidores.**

Los 7 operadores usan `makeRng(seed)` — un **congruencial lineal** estándar:

```typescript
s = (s * 1664525 + 1013904223) | 0
return ((s >>> 0) % 1000000) / 1000000
```

Distribución **uniforme**, no de cola pesada.

**Análisis del motivo — y es exculpatorio.** Los comentarios de los propios operadores documentan
un rechazo *deliberado* del muestreo de cola pesada:

- `focalMutation` (línea 340-341): *«Desplazamientos perceptibles de 0.20-0.40. **Sin ruido
  Cauchy microscópico** — solo desplazamientos perceptibles.»*
- `macroSplice` (línea 992-993): *«**Sin jitter microscópico** — solo intervenciones
  macro-estructurales.»*
- `curveAdaptation` (línea 1367): *«**Sin matriz de transición de Markov ni perturbación Cauchy**
  de manejadores.»*

La lectura correcta es la siguiente: en WAVE 6000 el equipo implementó Cauchy/Pareto; en la
revisión posterior (WAVE 6000.V3/V4) concluyó que el muestreo de cola pesada, en la práctica,
**generaba demasiadas mutaciones por debajo del umbral de percepción** —la moda en 0 es
precisamente el problema cuando cada evaluación cuesta un disparo real— y lo sustituyó por
**magnitudes macro garantizadas**: rangos uniformes acotados por abajo (0.20-0.40), bloques de 2
keyframes, multiplicadores musicales discretos, arquetipos de fase completos.

**Evaluación objetiva:** el equipo alcanzó el **efecto** del equilibrio puntuado —saltos
estructurales grandes en lugar de deriva microscópica— pero por una vía distinta: en lugar de
muestrear la cola de una distribución, **eliminó la moda**. Cada mutación es, por construcción,
un evento macro.

Esto es defendible y, para este dominio específico, probablemente superior en eficiencia
evaluativa. Pero tiene un coste real: **se ha perdido la exploración local fina**. El ecosistema
puede saltar entre cuencas de aptitud pero no puede refinar dentro de una. Un organismo con
fitness 0.83 no tiene mecanismo para converger suavemente a 0.90; solo puede sufrir otra mutación
macro que probablemente lo desplace fuera del óptimo.

**Recomendación (ver §5.1):** régimen híbrido. La formulación correcta no es «Cauchy o
uniforme-macro», sino **Cauchy con moda desplazada** — una Cauchy truncada cuyo soporte excluya
la región imperceptible:

```
|X| ~ 0.15 + |Cauchy(scale = 0.12, maxAbs = 0.60)|
```

Esto recupera simultáneamente el refinamiento local (cerca de 0.15) y los saltos de cola (hasta
0.60), garantizando que **toda** mutación sea perceptible. La infraestructura ya existe; requiere
únicamente conectarla con parámetros corregidos.

### 1.5 Reproducción sexual — `crossover`

`crossover(parentA, parentB, fitnessA, fitnessB)` (líneas 1611-1681).

**Merge dominante/recesivo con clave compuesta multicelular:**

```typescript
dominant = fitnessA >= fitnessB ? 'A' : 'B'

// Todos los tracks del dominante se heredan
// Los del recesivo solo si su clave `paramId::zones` no está ya presente
key = `${track.paramId}::${track.zones.join(',')}`
```

**La clave compuesta es la decisión clave (WAVE 7165).** Una implementación naíf desduplicaría
por `paramId`, impidiendo que el progenitor recesivo contribuya un track `intensity` si el
dominante ya tiene uno. Con clave `paramId::zones`, el recesivo **sí** puede aportar
`intensity::back` cuando el dominante solo tiene `intensity::front`. El resultado es que el
crossover **construye multicelularidad espacial**: los híbridos son sistemáticamente más ricos
espacialmente que sus progenitores. Es una vía de innovación estructural que el crossover
tradicional cierra.

Garantía adicional: cero tracks huérfanos, conflictos resueltos determinísticamente por fitness,
sin necesidad de reparación posterior.

`durationMs` se promedia. `spatialZones` se unifica. `L2 = min(L2_A, L2_B)` — regla conservadora
que evita inflar la rareza de un híbrido que en realidad es casi idéntico a uno de sus padres.

### 1.6 `blendCognitiveDNA` — control de inflación intergeneracional

Líneas 1493-1600. Tres políticas distintas según el tipo de campo:

| Campo | Política | Motivo declarado |
|-------|----------|------------------|
| `genome` (A/C/O) | **Mezcla 70/30** hacia el dominante | Sesgo hacia el fenotipo probado, con inyección del 30% recesivo |
| `compatibleVibes`, `validSections` | **Unión de conjuntos** | Un híbrido es válido donde cualquiera de sus padres lo era |
| `aggressionRange`, `pressureRange` | **PROMEDIO, no envolvente** | *«previene la inflación de rangos a lo largo de las generaciones»* |
| `energyZone` | Unión, **pero colapsa al dominante si span > 2** | Pre-screening G4 (equilibrio Montecarlo) |
| `textureAffinity`, `spatialBehavior` | Herencia verbatim del dominante | Categóricos: no admiten mezcla coherente |

**Este es el detalle más sofisticado de todo el módulo genético.** Considérese qué ocurriría con
la política ingenua de envolvente externa (`min(minA,minB), max(maxA,maxB)`) sobre los rangos de
tolerancia: tras 8 generaciones de cruce, **todo organismo tendría `pressureRange = [0, 1]` y
`aggressionRange = [0, 1]`**. Es decir, todo organismo sería compatible con todo contexto. Los
rangos habrían perdido su capacidad discriminativa por completo y el matching contextual de
Selene se volvería ruido.

El promedio mantiene la **anchura media de los rangos constante** a través de las generaciones.
La especialización se conserva. El colapso al rango del dominante cuando el span de zonas
energéticas excede 2 aplica la misma disciplina al eje de zonas, anticipando el gate G4 antes de
que el screening lo rechace —ahorrando un ciclo completo de spawn.

El endurecimiento defensivo (líneas 1501-1507) contra organismos legacy con `cognitiveDNA`
incompleto indica que el módulo ha sobrevivido a migraciones de esquema en producción.

### 1.7 Herencia diferencial — RFC 6902 como formato de genotipo

**Los organismos no almacenan su clip.** Almacenan `delta_json`: el array de operaciones JSON
Patch mínimo respecto del padre.

`OrganismMaterializer.materialize()` reconstruye el fenotipo aplicando la cadena
ancestro → padre → hijo, con caché **LRU de 256 entradas**.

Implicaciones cuantitativas:

- **Coste de almacenamiento O(mutación), no O(fenotipo).** Un organismo de generación 12 pesa
  unos cientos de bytes; su clip materializado, decenas de KB. Para un ecosistema de 60
  organismos vivos con rotación continua, la diferencia es de dos órdenes de magnitud.
- **El linaje es la estructura de datos primaria, no un metadato.** `delta_json` **es** el
  registro de la herencia. La genealogía no se deriva: se almacena implícitamente.
- **Auditoría genética completa.** Cualquier organismo puede rastrearse operación por operación
  hasta el ancestro de granito. Para un fabricante de hardware, esto significa que un
  comportamiento en campo es **explicable**, no una caja negra.

**El «FALLBACK SAGRADO»** (`OrganismMaterializer.ts:10-13`): ante cualquier fallo de aplicación
de delta o de parseo, el materializador captura la excepción y **devuelve el clip del ancestro de
granito intacto**. *«El operador nunca ve un frame perdido.»*

Esto es diseño de sistemas críticos correctamente aplicado: un ecosistema evolutivo experimental
está aislado tras un modo degradado garantizado. Un mutante corrupto no puede provocar un fallo
visible en pista; degrada silenciosamente a su ancestro probado.

### 1.8 La distancia L2 compuesta — la métrica de innovación

```
L2_total = 0.55 · D_curve + 0.40 · D_phase + 0.05 · D_structural
```

**`D_curve`** — RMSE sobre valores de keyframe y manejadores bezier, **normalizado por el span
del track** (`range[1] − range[0]`). El comentario declara el motivo: *«para que los canales
pan/tilt no dominen la puntuación»*. Un track `pan` opera en [0, 255] y uno `intensity` en
[0, 1]; sin normalización, cualquier mutación de pan aplastaría la métrica.

**`D_phase`** — RMSE sobre los campos de `PhaseConfigPro`, cada uno normalizado por su rango
canónico, con pesos por **impacto visual**:

```
spreadDeg 0.30 > wings 0.25 > shuffle 0.15 ≈ blocks 0.15 > direction 0.10 > symmetry 0.05
```

Que la fase tenga un peso de 0.40 en la métrica total es una declaración arquitectónica: en
iluminación de espectáculo, **la distribución espacial de la fase es tan definitoria de la
identidad de un efecto como la propia curva**. Dos efectos con la misma curva de intensidad y
fase distinta son percibidos como efectos diferentes. Esto es conocimiento de dominio que un
algoritmo genérico no tendría.

**`D_structural`** — distancia topológica: diferencia de recuento de tracks (0.45), diferencia
media de keyframes (0.30), ratio de cambios de interpolación (0.10) y **divergencia de zonas**
(0.15, WAVE 7165: pares `(paramId, zona)` presentes en el hijo y ausentes en el padre).

**Hallazgo de recalibración documentado:** `D_structural` fue reducido de peso 0.20 a 0.05, con
el razonamiento explícito de *«favorecer las mutaciones de curva/fase sobre la destrucción
estructural (eliminación de tracks)»*. Sin esta corrección, borrar un track producía una
distancia L2 alta y, por tanto, una **rareza alta** — el sistema premiaba la destrucción. La
corrección es evidencia de que el equipo detectó y cerró un exploit de su propia función de
recompensa. En diseño de sistemas evolutivos, esto —*reward hacking*— es el modo de fallo más
frecuente y el más difícil de anticipar.

### 1.9 Sistema de rareza — y segunda capacidad desconectada

`loot/RarityEngine.ts`:

```
ρ(m) = 0.50 · σ_norm  +  0.30 · novelty  +  0.20 · operator_weight

σ_norm  = clamp01(L2 / DRIFT_MAX),  DRIFT_MAX = 0.40
novelty = 1 − max_cosine_similarity(signature, población_viva)
```

Tiers y escudo neonatal (recalibrados en WAVE 7166 al rango real de L2 en V3, ~0.34):

| Tier | Rango ρ | Escudo neonatal | Bonus fitness |
|------|---------|:---------------:|:-------------:|
| COMMON | [0.00, 0.12) | 3 trials | ×1.00 |
| RARE | [0.12, 0.20) | 6 trials | ×1.10 |
| EPIC | [0.20, 0.28) | 10 trials | ×1.25 |
| LEGENDARY | [0.28, 0.33) | 15 trials | ×1.40 |
| MYTHIC | [0.33, 1.00] | 20 trials | ×1.50 |

El **escudo neonatal** es un mecanismo de protección de la exploración: un organismo MYTHIC
dispone de 20 evaluaciones antes de ser elegible para apoptosis. Cuanto más innovador, más
tiempo se le concede para demostrar su valor. Es la solución correcta al problema de que una
innovación radical rara vez es óptima en su primera manifestación.

**HALLAZGO — el componente de novedad no se computa en producción.** `ColiseumService.ts:125-127`:

```typescript
function estimateRarity(l2Distance: number, operator: MutationOperator): RarityOutput {
  return computeRaritySimple(l2Distance, operator)   // ← sin firmas de población
}
```

El comentario adjunto declara: *«Usa modo simplificado (sin firmas de población por ahora — el
modo completo se conectará cuando la especiación se implemente en Era IV)»*.

**La especiación ESTÁ implementada** (`ecology/SpeciationEngine.ts`, 248 líneas, invocada en el
paso 4 del pipeline metabólico). El comentario está obsoleto y el **30% del peso de la ecuación
de rareza no se evalúa**. La consecuencia funcional es concreta: un organismo estructuralmente
idéntico a 40 organismos ya vivos recibe la misma rareza que uno genuinamente único, siempre que
su L2 respecto al padre sea equivalente. **La rareza mide divergencia respecto al progenitor,
pero no unicidad en la población.** Es el mismo patrón de deuda que `s_DNA` en Área 4:
capacidad implementada, no conectada.

---

## 2. CICLO DE VIDA ECOLÓGICO — EL PIPELINE METABÓLICO

### 2.1 Arquitectura temporal — tiempo geológico vs hot path

`GenesisIgnition.igniteGenesisEngine()` establece dos relojes: flush del HeatmapLogger cada 10 s
y mantenimiento ecológico cada 60 s. Ambos `.unref()`'d. El contrato en `ColiseumService.ts:557`
es inequívoco: **«NUNCA llamar desde el hot path de 44 Hz»**.

**Esta separación es lo que hace el sistema viable en producto profesional.** El motor cognitivo
opera con 22,7 ms por frame; el evolutivo ejecuta K-means, transacciones SQLite y
materializaciones en ciclos de 60 s. Son escalas separadas por **más de tres órdenes de
magnitud**, y el código lo declara y lo respeta estructuralmente.

**Detalle relevante:** WAVE 6000.V6 **purgó el sembrado de arranque en frío**. `_seedColdStart()`
sobrevive como no-op documentado. El ecosistema arranca con **cero organismos artificiales**; el
único punto de entrada de `spawnInitialCohort()` es el disparo real en `EffectManager.ts` (BIG
BANG SPARK). La vida no se decreta al arrancar: surge del primer efecto disparado en pista.

### 2.2 El pipeline de 7 pasos

`runEcologicalMaintenance()` (líneas 559-612) — el informe interno lo describe como 6 pasos; la
implementación ejecuta **7**:

```
1. Flush del HeatmapLogger        → context_heatmaps (batch insert)
2. Decaimiento entrópico          → toda población viva pierde vitalidad
3. Apoptosis                      → los desnutridos se disuelven
4. Especiación                    → K-means sobre firmas bezier → species_id
5. Transiciones de ciclo de vida  → promoción/degradación/culling + escaneo HoF
6. Mitosis                        → los prósperos se dividen
7. Reproducción sexual            → élite se cruza y se sacrifica (Mantis)
```

**El orden no es arbitrario: es una cadena de dependencias causales.** La entropía (2) precede a
la apoptosis (3) porque primero se cobra el coste de existir y luego se evalúa quién no puede
pagarlo. La especiación (4) precede al ciclo de vida (5) porque las transiciones de campeón se
evalúan **contra la media de la propia especie** — sin `species_id` fresco la comparación es
inválida. La reproducción (6, 7) va al final: se reproduce lo que ya sobrevivió a la selección de
este ciclo.

### 2.3 Paso 2 — Entropía con penalización densodependiente

```typescript
const ENTROPY_DECAY = 0.02        // por ciclo (~60 s)
const MAX_VITAL_SPACE = 60        // capacidad de carga

popRatio        = min(1.0, currentPop / MAX_VITAL_SPACE)
crowdingPenalty = popRatio > 0.8 ? 0.06 : 0
finalDecay      = ENTROPY_DECAY + crowdingPenalty
```

**El coste termodinámico de existir.** Un organismo no elegido por Selene pierde 0.02 de vitalidad
por minuto: desde 1.0 alcanza el umbral de apoptosis (0.10) en ~45 minutos de operación.

**La penalización por hacinamiento es el mecanismo clave.** Al superar el 80% de la capacidad, el
decaimiento se **cuadruplica** (0.02 → 0.08). El sistema no impone un límite duro de población:
crea **hambruna**. El comentario lo declara: *«Sin límites arbitrarios de población. La regulación
emerge de la termodinámica»*.

Esto es sustancialmente superior a un `LIMIT 60` en la consulta de spawn. Con un límite duro, la
población se satura de organismos mediocres antiguos que bloquean la entrada de nuevos. Con
hambruna densodependiente, **el hacinamiento mata primero a los débiles**, liberando espacio para
la exploración. La presión selectiva se intensifica precisamente cuando el ecosistema más lo
necesita — modelo logístico de Verhulst.

**Simetría en el spawn:** `spawnChance = 1.0 − (currentPop / MAX_VITAL_SPACE)`. Ecosistema vacío →
100% de natalidad; al límite → 0%. Es el modelo POP de Stellaris, citado en el código, y produce
dinámica logística estable en lugar de oscilaciones de dientes de sierra.

### 2.4 Paso 3 — Apoptosis con protección de la juventud

```sql
UPDATE lfx_organisms SET status = 'culled'
 WHERE status = 'alive'
   AND fitness_score < 0.10                    -- APOPTOSIS_THRESHOLD
   AND trials_count > neonatal_shield_until     -- escudo neonatal
```

La segunda condición es crítica: **un organismo joven no puede morir de hambre.** Un MYTHIC
dispone de 20 evaluaciones antes de ser elegible. Sin el escudo, todo organismo nuevo nacería con
fitness 0.0 y sería eliminado en el primer ciclo, antes de haber sido disparado nunca. **El escudo
neonatal es lo que hace que el ecosistema sea capaz de explorar en absoluto.**

Terminología precisa: *«El medio los eliminó — no una cuota.»* No existe ninguna función
`shouldKill(organism)` que pudiera contener un sesgo. La muerte es un balance energético negativo.

### 2.5 Paso 4 — Especiación K-means: la defensa anti-mode-collapse

`ecology/SpeciationEngine.ts` — K-means sobre firmas de 128 floats:

```
K = clamp(round(√(N / 2)), 3, 12)     ·     MAX_ITERATIONS = 20
distancia = euclídea 128-D             ·     CONVERGENCE_THRESHOLD = 0.001
```

Sin especiación, la selección por fitness absoluto converge inevitablemente a 60 clones. Con
especiación:

- `LifecycleManager` promociona campeones **por especie** (fitness > media_especie × 1.30), no
  globalmente. **Cada nicho conserva su campeón.** Es *fitness sharing* correctamente implementado.
- `SpeciesQuotaSelector` selecciona candidatos equitativamente por especie, con **ε-greedy del 5%**
  para incluir neonatos protegidos.
- `_sexualReproduction` empareja **dentro de la misma especie** en primera pasada.

Arquitectónicamente equivalente al mecanismo de especiación de NEAT (Stanley & Miikkulainen). La
convergencia a un óptimo único está impedida estructuralmente.

**HALLAZGO TÉCNICO — la firma bezier no está normalizada.** `computeBezierSignature()`
(`ColiseumService.ts:135-153`) apila valores crudos sin dividir por el span del track. Un track
`pan` opera en [0,255], `color` en [0,360], `intensity` en [0,1]. En una distancia euclídea, **los
canales de posición y color dominan por dos o tres órdenes de magnitud**: K-means no agrupa por
similitud estructural percibida sino esencialmente por *«tiene o no tiene track de pan/color»*.

La inconsistencia es señalable porque `computeDCurve()`, en el mismo archivo, **sí** normaliza por
span y documenta el motivo exacto (*«para que pan/tilt no dominen»*). La disciplina existe en la
métrica L2 y falta en la firma de especiación. Defectos adicionales: la firma es **sensible a la
permutación** de tracks (dos clips idénticos con orden distinto → especies distintas) y se
**trunca a 128 floats** (clips grandes pierden la cola). Impacto: **medio** — la especiación evita
el colapso, pero los clusters no son semánticamente óptimos. Corrección de bajo coste (§5.2).

**Nota menor:** la inicialización de centroides es muestreo equiespaciado sobre `ORDER BY
organism_id`, etiquetado como «k-means++ lite». No es k-means++ real (que muestrea
proporcionalmente a D²). Determinista, coherente con la filosofía del módulo, pero sensible a la
inicialización.

### 2.6 Paso 5 — Transiciones de ciclo de vida

| Transición | Condición |
|-----------|-----------|
| `alive → champion` | fitness > media_especie × 1.30 **Y** trials ≥ 5 |
| `champion → alive` | fitness < media_especie × 0.80 |
| `alive → culled` | trials > escudo_neonatal **Y** supervivencia < 0.15 |
| Hall of Fame | LEGENDARY/MYTHIC **Y** trials ≥ 25 **Y** supervivencia > 0.85 |

**Histéresis correcta:** promoción al +30%, degradación al −20%. Los 50 puntos porcentuales de
banda muerta impiden el *flapping* de estado alrededor de la media — mismo principio que un
comparador con histéresis.

El Hall of Fame **no muta el estado**: identifica candidatos vía `v_hall_of_fame` y deja el status
intacto *«para canonización futura desde la UI»*. **Promover un organismo a `lfx_blueprints` —a
especie fundadora inmutable— requiere aprobación humana.** Decisión de gobernanza correcta: la
evolución automática puede producir organismos excelentes, pero convertir uno en ancestro
permanente del catálogo es una decisión de producto, no de algoritmo.

### 2.7 Paso 6 — Mitosis con transferencia energética conservativa

```typescript
MITOSIS_THRESHOLD = 0.85 · MITOSIS_MIN_TRIALS = 5 · MITOSIS_ENERGY_TRANSFER = 0.35

childFitness = parent.fitness_score × 0.35
UPDATE lfx_organisms SET fitness_score = fitness_score × 0.65 WHERE organism_id = ?
```

**La reproducción tiene un coste energético real y conservativo.** Un organismo con fitness 0.90
desciende a 0.585; el hijo nace con 0.315. Esto implementa un **compromiso
reproducción/supervivencia** genuino: reproducirse acerca al progenitor al umbral de apoptosis. La
energía no se crea, se transfiere. Es la restricción que impide la explosión exponencial de
linajes exitosos **sin ninguna cuota artificial**. Restricción adicional: `generation < 16`,
reforzada por trigger de BD.

### 2.8 Paso 7 — LA REGLA DE LA MANTIS

#### 2.8.1 El problema que resuelve

Todo algoritmo genético de ejecución prolongada converge al mismo estado patológico, y el
mecanismo es determinista:

```
1. Un organismo alcanza fitness alto.
2. Al ser el mejor, es seleccionado más frecuentemente.
3. Al ser seleccionado, gana más fitness           (refuerzo positivo).
4. Al tener más fitness, se reproduce más.
5. Sus descendientes son variaciones marginales de sí mismo.
6. La capacidad de carga se llena de clones cuasi-idénticos.
7. La varianza genética → 0.  LA EVOLUCIÓN SE DETIENE.
```

Es el **estancamiento de la élite** o **problema del clon inmortal**. El organismo óptimo se
convierte en el enemigo de la optimización: su propia excelencia consume el espacio vital que la
exploración necesita.

Las mitigaciones convencionales son todas insatisfactorias:

- **Límite de edad:** arbitrario, y mata organismos excelentes por una razón no relacionada con su
  calidad.
- **Ruido de mutación forzado:** degrada al óptimo sin garantía de mejora. Destruye información.
- **Reinicio periódico de población:** descarta todo el aprendizaje acumulado.
- **Fitness sharing en solitario:** ralentiza la convergencia, no la impide.

#### 2.8.2 La solución: semelparidad

```typescript
SEXUAL_FITNESS_THRESHOLD = 0.80 · SEXUAL_MIN_TRIALS = 10

// tras spawnHybrid() exitoso:
UPDATE lfx_organisms SET status = 'culled' WHERE organism_id IN (?, ?)
```

La Regla de la Mantis invierte el signo del incentivo. La élite no se elimina por ser vieja ni por
ser mala: **se elimina por reproducirse.** La excelencia se convierte en un billete de un solo
viaje — alcanzar 0.80 con 10 evaluaciones de estabilidad es la condición para transmitir el
genoma, y el precio es la existencia.

Esto es **semelparidad**, fenómeno biológico real y documentado: la mantis religiosa, el salmón
del Pacífico, el pulpo, las plantas anuales. La analogía no es decorativa: la mecánica
implementada es funcionalmente idéntica.

**Cinco consecuencias que ninguna mitigación convencional logra simultáneamente:**

1. **Rotación generacional garantizada.** Ningún organismo permanece indefinidamente. El techo no
   es la muerte: es el **éxito**.
2. **Liberación inmediata de capacidad.** Dos mueren, uno nace. **Balance neto de −1 POP por
   evento de cruce.** El sistema se hace espacio activamente para explorar.
3. **Preservación de la información genética.** El genoma no se pierde: se transmitió al híbrido
   vía `blendCognitiveDNA` 70/30 y el merge de tracks. **Muere el individuo, sobrevive la
   información.** Esto es lo que distingue la Mantis de un límite de edad.
4. **Ruptura estructural del refuerzo positivo.** El bucle patológico se corta en el paso 4: el
   organismo de fitness máximo no puede acumular descendencia porque **deja de existir al primer
   cruce**.
5. **Alineación de selección y exploración.** En un AG clásico son fuerzas antagónicas que hay que
   equilibrar con hiperparámetros. Aquí, el propio mecanismo de selección **genera** exploración.

#### 2.8.3 Semelparidad condicional — el detalle que revela madurez

```typescript
if (result.success) { /* sacrificar ambos */ }
else { console.warn('aborted (prenatal screening) — parents survive') }
```

**Los progenitores solo mueren si el híbrido supera el screening prenatal G1-G7.** Sin esta
condición, un bug en `crossover()` o un blueprint corrupto podría **exterminar iterativamente toda
la élite** produciendo híbridos abortados. El sacrificio está condicionado al éxito reproductivo
real, no al intento. Es la clase de salvaguarda que solo aparece tras un incidente en producción.

#### 2.8.4 Estrategia de emparejamiento

Primera pasada intraespecífica (genomas compatibles, alta viabilidad); segunda pasada
**interespecífica** con los élites desemparejados — el evento de mayor potencial innovador y mayor
riesgo. Coherentemente, `crossover` tiene el peso de rareza más alto de la tabla (0.85).

### 2.9 La base de datos como órgano — `selene-genesis.db`

`schema.sql`, 244 líneas: **5 tablas + 3 triggers + 2 vistas.**

**Pragmas:** `journal_mode = WAL`, `synchronous = NORMAL`, `cache_size = −64000` (64 MB),
`foreign_keys = ON`, `temp_store = MEMORY`, y **`wal_autocheckpoint = 0`** con el comentario
*«control manual de checkpoint (evita stalls de UI)»*. Este último es un detalle de calidad
notable: el checkpoint automático de WAL puede bloquear cientos de milisegundos, inaceptable en
control de espectáculos en vivo.

**Los tres triggers como invariantes de dominio:**

| Trigger | Función | Valor arquitectónico |
|---------|---------|----------------------|
| `lfx_blueprints_immutable` | `BEFORE UPDATE → RAISE(ABORT, 'Ancestro de granito. Inmutable.')` | **Los ancestros son inmutables a nivel de motor de BD.** Ningún bug de aplicación, consulta ad hoc ni futuro desarrollador puede corromper el catálogo fundacional. La invariante no depende de disciplina de código |
| `trg_org_generation_cap` | `BEFORE INSERT WHEN generation > 16 → ABORT` | Límite de linaje aplicado en persistencia, no solo en `_mitosis()`. Defensa en profundidad |
| `trg_org_lineage_path` | `AFTER INSERT → INSERT INTO lineage_tree` con path materializado | La genealogía se construye **automáticamente**. Imposible que un organismo exista sin entrada en el árbol |

**Evaluación:** desplazar las invariantes del dominio a triggers en lugar de a validaciones de
aplicación es ingeniería madura. Las restricciones sobreviven a refactorizaciones, accesos
directos y rotación de equipo. En due diligence, reduce materialmente el riesgo de corrupción a
largo plazo.

**`CHECK` declarativos:** genoma ∈ [0,1], `texture_affinity ∈ {clean,dirty,universal}`,
`generation ≤ 16`, `rarity_score ∈ [0,1]`, `rarity_tier` y `status` enumerados. **Un genoma
inválido no puede persistirse**, independientemente de lo que haga la lógica de mutación — el gate
G3 del screening pasa a ser segunda línea de defensa, no la única.

**Índices:** `idx_org_status_fitness (status, fitness_score DESC)` cubre las consultas de
mitosis/sexual/selección; `idx_org_species` es **parcial** (`WHERE species_id IS NOT NULL`) — no se
indexan filas que nunca se consultarán; `idx_heat_6d` cubre exactamente los ejes del vector de
contexto 6D de `FitnessEvaluator`. Competencia real en SQLite.

**Vistas:** `v_contextual_candidates` (candidatos vivos con `hist_z`, `hist_low`, `survivals`,
`vetoes` agregados) y `v_hall_of_fame`, cuyo `survival_rate = passes/(trials+1)` aplica
**suavizado de Laplace** — evita la división por cero y la sobreestimación con muestras pequeñas.

### 2.10 La ecuación de fitness — supervivencia pasiva

```
ΔF      = R_customs + R_context
F_new   = (1 − λ)·F_old·γ^(Δt_días) + λ·ΔF          λ = 0.15,  γ = 0.99
R_customs = +0.30·(elegido) + 0.20·(pasó gates) − 0.40·(rechazado)
R_context = +0.25 · softmax(−d₆D/τ) ponderado por survival_rate,   τ = 0.5
F_birth   = F(padre) · 0.40 · rarity_bonus(tier)
```

**Cambio de paradigma documentado (Era III):** *«El veto L2 queda ABOLIDO en la evaluación en
vivo. El fitness en vivo es 100% supervivencia pasiva.»* Genesis **ya no tiene opinión propia
sobre qué es un buen efecto**: el fitness es el registro de lo que Selene eligió y de lo que
sobrevivió a los gates. El juez es externo al ecosistema. Arquitectónicamente correcto — acopla la
evolución al comportamiento real del sistema cognitivo en vez de a una heurística estética
paralela que podría divergir.

**La asimetría de pesos es la señal más fuerte:** `w_rej = −0.40` frente a `w_dm = +0.30`. **Ser
rechazado por un gate cuesta más que ser elegido.** Sesga el ecosistema hacia la seguridad —
apropiado en un dominio con implicaciones fotosensibles.

`γ^Δt_días` implementa **olvido por inactividad**: 30 días sin dispararse retienen el 74% del
fitness. Un efecto excelente para el repertorio del año pasado decae si el repertorio cambia. **El
ecosistema se adapta a la deriva del gusto del operador sin intervención.**

### 2.11 Screening prenatal — cero inserciones inviables

`screening/PrenatalScreening.ts`. **REGLA DE ORO: los no viables mueren aquí — cero inserciones en
`lfx_organisms`.** G1 SCHEMA, G3 GENOME (ACO ∈ [0,1]), G4 COMPAT (≥1 vibe, ≥1 sección, **span de
zonas ≤ 2**), G5 CURVES, G6 STROBE, G7 REDUNDANCY (clon vía L2) → todos abort. G2 CHECKSUM n/a
prenatalmente. G7-spatial → **warn**, no abort.

**El valor es cuantificable:** el filtrado ocurre **antes** de cualquier escritura. Un mutante
inviable consume una llamada a función pura y desaparece — sin INSERT, sin disco, sin ocupar
capacidad de carga, sin barrido de limpieza posterior. En un ecosistema que genera organismos cada
60 s indefinidamente, filtrar antes o después de la persistencia determina si la base de datos
crece de forma acotada o sin control.

G4 replica exactamente la restricción de DnaRail (máx. 2 zonas, WAVE 7123) y `blendCognitiveDNA`
la pre-aplica en el cruce. **La misma invariante se aplica en tres capas independientes** —UI,
blend genético y screening—, garantizando que ningún camino de creación pueda violarla.

---

## 3. CIERRE DEL BUCLE — LA ACTIVACIÓN DE `s_DNA`

### 3.1 El estado del sensor inerte

Conclusión del informe de Área 4 (§3.3, §5.1): `SeleneTitanConscious` pasa `NEUTRAL_GENOME`
(0.5/0.5/0.5) a `LiquidProcessInput.effectGenome`. El sensor `s_DNA` —**peso `w1 = 0.1699`, el
segundo mayor de los siete**— computa:

```
g_ctx  = ⟨Ê·CF̂, Δ, 1−Π⟩                    ← contexto acústico vivo, correcto
g_fx   = ⟨0.5, 0.5, 0.5⟩                    ← CONSTANTE
s_DNA  = exp(−‖g_fx − g_ctx‖² / 2σ_g²),  σ_g = 0.35
```

Con `g_fx` constante, `s_DNA` es función determinista **únicamente** del contexto. Su gradiente
respecto al efecto candidato es idénticamente nulo. **Aporta ~17% del peso de la ecuación de
confianza sin transportar información alguna sobre qué se está por disparar.**

### 3.2 Genesis produce exactamente el dato que falta

**(a) `FrozenGenome` — vivo, derivado y coherente.**

```typescript
interface FrozenGenome {
  readonly aggression: number   // [0,1], 3 decimales
  readonly chaos: number
  readonly organicity: number
}
```

Y —este es el punto crítico— gracias a la **deriva lamarckiana** (§1.3) este genoma **no es una
etiqueta estática heredada del ancestro**: se actualiza en cada mutación en función de la mutación
aplicada. Un organismo que ha acumulado tres `macro_splice/peak` y un `gene_augmentation/strobe`
tiene un genoma que refleja fielmente su fenotipo actual, no el de su bisabuelo. Persistido y
validado por `CHECK (dna_aggression BETWEEN 0 AND 1)` en el esquema.

**(b) `bezier_signature`** — vector de 128 floats, `BLOB NOT NULL` por organismo. Firma
estructural comprimida ya disponible.

**(c) Los rangos de tolerancia** — `aggressionRange`, `pressureRange`, `energyZone`, mantenidos sin
inflación por el promediado de `blendCognitiveDNA` (§1.6). Son exactamente los campos que
`EffectDreamSimulator` y los gates del Reloj Soberano ya consultan.

### 3.3 La tubería completa ya existe

**Verificación de la cadena end-to-end. Cada eslabón está implementado y operativo:**

```
[1] Mantenimiento ecológico (60 s) — ColiseumService.runEcologicalMaintenance()
         │  organismos nacen, mutan, derivan su ADN, se especian
         ▼
[2] Arena Gates — GenesisIgnition.ts:70
         │  getDynamicEffectRegistry().refreshEvolutionaryCandidates(3)
         ▼
[3] SpeciesQuotaSelector.selectCandidates(3)
         │  selección equitativa por especie + ε-greedy 5% para neonatos
         ▼
[4] OrganismMaterializer.materialize(organismId)
         │  cadena de delta_json → HephAutomationClipV3 completo
         │  caché LRU 256 · FALLBACK SAGRADO ante error
         ▼
[5] DynamicEffectRegistry.registerEffectV3(lfxWrapper, {
         │    organismId, trialsCount, organismStatus
         │  })  → RegistryEntry con cognitiveDNA APLANADO, acceso O(1)
         ▼
[6] dreamEngineIntegrator.invalidateDreamCache()
         │  fuerza a Selene a ver los mutantes frescos de inmediato
         ▼
[7] EffectDreamSimulator — matching de ADN, ranking, calculateTextureBonus()
         │  ✅ AQUÍ EL GENOMA REAL YA SE CONSUME
         ▼
[8] LiquidCognitionCore.process({ effectGenome: NEUTRAL_GENOME })
           ❌ ÚNICO ESLABÓN ROTO
```

**Hallazgo central de esta sección: la infraestructura está completa. El genoma evolucionado ya
viaja desde SQLite hasta `EffectDreamSimulator` en cada ciclo de 60 segundos. El único punto donde
se sustituye por una constante es la entrada del pipeline líquido.**

`RegistryEntry` (Área 4 §1.8) está **desnormalizado y pre-aplanado específicamente** para acceso
O(1) en hot path, con el campo `dna` como propiedad plana. La estructura de datos correcta ya
existe y ya está optimizada para este uso exacto.

### 3.4 La inversión de dependencia y su resolución

El obstáculo identificado en Área 4 §5.1: `s_DNA` necesita saber **qué** efecto se evalúa, pero la
selección del efecto ocurre **después** de que `C(t)` decida disparar.

**Opción A — Genoma de contexto.** Sustituir `g_fx` por el genoma que el contexto **demanda**;
`s_DNA` mediría «coherencia interna del contexto». Barata, pero **no cierra el bucle evolutivo**.

**Opción B — Doble pasada especulativa.** `C₁(t)` con genoma neutro decide si hay ignición
potencial; si la hay, se obtiene el top-1 de `SpeciesQuotaSelector` vía `RegistryEntry.dna` y se
recomputa `C₂(t)` con el genoma real. Coste: un `fuse()` adicional (7 logaritmos, ~50 ns)
**exclusivamente en frames de ignición**. Con tasa de ignición del 2-5%, el coste amortizado por
frame es de ~2 ns — despreciable frente a 22,7 ms.

**Opción C — Pre-selección en el pre-buffer de Cassandra (óptima).** Cuando el Reloj Soberano
pre-bufferiza un efecto, el candidato **ya está identificado con segundos de antelación**. En ese
instante el genoma real es conocido sin ambigüedad, y `s_DNA` puede alimentarse **sin doble pasada
y sin coste adicional**.

**La opción C es la síntesis de las dos áreas auditadas.** Cassandra resuelve el problema de
causalidad temporal que impedía a `s_DNA` conocer su objeto: la predicción hace que el candidato
exista *antes* de que la decisión de disparar deba tomarse. Área 4 y Área 5 se resuelven
mutuamente.

### 3.5 Sinergia realizada — los tres bucles que se cierran

**Bucle 1 — Selección genómica en la decisión de disparar.** Hoy Selene decide *si* disparar sin
considerar el genoma y solo después elige *qué*. Cerrado: un organismo agresivo **eleva** `C(t)` en
contextos agresivos y lo **deprime** en valles orgánicos. La compatibilidad genoma-contexto pasa a
formar parte de la decisión de ignición, no solo de la de selección.

**Bucle 2 — Presión selectiva de grano fino.** Hoy el fitness se actualiza según `R_customs`
(elegido/vetado) — señal esencialmente binaria. Cerrado: el organismo cuyo genoma resuena con el
contexto es elegido más, gana fitness, se reproduce y transmite ese genoma. **La deriva
lamarckiana pasa a estar dirigida por la realidad acústica**, no solo por el tipo de operador
aplicado. La evolución adquiere una brújula.

**Bucle 3 — Especialización por repertorio y por mercado.** Los ecosistemas de operadores distintos
divergen. Un DJ de techno peninsular y uno de reggaetón convergen a poblaciones con centroides ACO
distintos, especies distintas y Halls of Fame distintos — **sin ninguna configuración**. Combinado
con los perfiles regionales de calibración líquida propuestos en Área 4 §5.7, constituye un
mecanismo de localización de comportamiento **puramente basado en datos**.

**Evaluación:** `FrozenGenome` es un tipo compartido (`arsenal/lfxTypes.ts`),
`LiquidProcessInput` lo declara explícitamente en su interfaz y `RegistryEntry` lo pre-aplana para
hot path. **La integración fue anticipada en el diseño de tipos de ambos módulos.** No queda
trabajo de arquitectura pendiente: queda una inyección de dependencia.

---

## 4. PIONEER SCORE

### 4.1 Desglose por dimensión

| Dimensión | Peso | Nota | Pond. | Justificación |
|-----------|:----:|:----:|:-----:|---------------|
| **Innovación algorítmica** | 30% | 91 | 27.3 | Deriva lamarckiana bidireccional (fenotipo→genotipo) sin precedente conocido en generación procedural de iluminación. L2 compuesta multi-espacio con peso 0.40 en fase. `blendCognitiveDNA` con promediado anti-inflación. Merge multicelular por clave `paramId::zones`. Multiplicadores musicales discretos como restricción del espacio de búsqueda. Penalización: la infraestructura Cauchy/Pareto existe pero está desconectada; el equilibrio puntuado se logra por vía alternativa (magnitudes macro uniformes), perdiendo el refinamiento local |
| **Gestión del ciclo de vida en BD** | 25% | 93 | 23.3 | 5 tablas + 3 triggers + 2 vistas. Inmutabilidad del ancestro aplicada **a nivel de motor de BD**. Path de linaje auto-materializado por trigger. Índices parciales. `wal_autocheckpoint = 0` para evitar stalls de UI. `CHECK` declarativos que hacen imposible persistir un genoma inválido. Herencia diferencial RFC 6902 → almacenamiento O(mutación). LRU 256 + FALLBACK SAGRADO |
| **Realismo ecológico** | 20% | 95 | 19.0 | La Regla de la Mantis resuelve estructuralmente el estancamiento de la élite. Entropía densodependiente con hambruna al 80% de capacidad. Mitosis con transferencia energética conservativa (35%). Escudo neonatal escalado por rareza. Especiación con nichos protegidos (fitness sharing tipo NEAT). Semelparidad **condicional** al éxito del screening. Histéresis 30/20 en transiciones de campeón. Ninguna cuota arbitraria en todo el pipeline |
| **Sinergia con el núcleo cognitivo** | 15% | 72 | 10.8 | La tubería está completa de SQLite a `EffectDreamSimulator`: Arena Gates, materialización, registro, invalidación de caché, cuarentena de minions. Tipos compartidos anticipados en el diseño. Penalización severa: el último eslabón (`s_DNA`) sigue recibiendo `NEUTRAL_GENOME`. La sinergia está construida pero **no ejercida** |
| **Calidad de implementación** | 10% | 68 | 6.8 | Operadores puros, deterministas y testeados. Pero: `(this._vault as any)._db` rompe el encapsulamiento en ~8 puntos; firma bezier **sin normalizar por span** —inconsistente con `computeDCurve`, que sí normaliza y documenta el motivo— → clusters de K-means sesgados por pan/tilt/color; novedad de la rareza desconectada con comentario obsoleto; k-means++ etiquetado pero no implementado; RNG congruencial lineal de baja calidad; los 7 pasos del pipeline metabólico no están envueltos en una transacción única |
| | | | | |
| **Subtotal ponderado** | 100% | | **87.2** | |
| **Ajuste por capacidades desconectadas** | — | — | **−3.2** | Tres capacidades implementadas y no conectadas: Cauchy/Pareto, novedad en rareza, `s_DNA` |
| **PIONEER SCORE** | — | — | **84.0** | |

> ### 🧬 PIONEER SCORE: **84 / 100**

### 4.2 Interpretación

**84/100 — Activo de IP diferenciado. Integración recomendada con condiciones previas acotadas.**

Escala de referencia interna de adquisición (idéntica a la aplicada en Área 4):

- **95-100** — Estado del arte absoluto, sin deuda material identificable
- **85-94** — Innovación defendible con deuda técnica acotada y documentada
- **70-84** — Ingeniería sólida, innovación incremental ← **Genesis (extremo superior)**
- **50-69** — Funcional, sin diferenciación defendible
- **<50** — Prototipo o deuda estructural

Genesis se sitúa en el **extremo superior** de su banda, con dos dimensiones —realismo ecológico
(95) y ciclo de vida en BD (93)— que alcanzan la banda superior. El descuento proviene íntegramente
de la brecha entre capacidad implementada y capacidad ejercida, que es deuda de **conexión** y no
de arquitectura, y por tanto de resolución rápida.

### 4.3 Comparativa con el estado del arte

| Categoría | Score est. | Brecha vs. Genesis |
|-----------|:----------:|--------------------|
| Bibliotecas de efectos estáticas (todo el mercado DMX profesional) | 20-30 | Sin evolución. El catálogo es fijo desde fábrica |
| Randomizadores de parámetros / *chase generators* | 35-45 | Variación sin selección. Sin memoria, sin linaje, sin fitness |
| Sistemas con presets de usuario y favoritos | 40-50 | Selección manual sin generación. El operador es el único mutador |
| Generación procedural con AG estándar (gaussiano, sin ecología) | 60-70 | Sin especiación, sin ciclo de vida, sin herencia diferencial. Vulnerable a mode collapse y al clon inmortal |
| **Genesis Engine** | **84** | — |

### 4.4 Factores que sostienen la valoración

1. **La Regla de la Mantis es IP defendible.** La semelparidad condicional como solución al
   estancamiento de la élite no tiene precedente conocido en generación procedural de contenido. Es
   una solución estructural, no un hiperparámetro.
2. **La deriva lamarckiana resuelve el auto-etiquetado.** Elimina la necesidad de un clasificador
   posterior y garantiza coherencia permanente entre fenotipo y genoma declarado. Es el mecanismo
   que hace fiable el matching de Selene sin supervisión humana.
3. **La herencia diferencial RFC 6902 es una decisión de escalabilidad correcta.** Almacenamiento
   O(mutación), auditoría genética completa, explicabilidad total del comportamiento en campo —
   relevante para soporte técnico de producto.
4. **Las invariantes viven en el motor de base de datos.** Sobreviven a refactorizaciones, accesos
   directos y rotación de equipo. Riesgo de corrupción a largo plazo materialmente reducido.
5. **La separación de escalas temporales es limpia y declarada.** Tiempo geológico (60 s) vs hot
   path (22,7 ms). Sin contención de recursos con el motor cognitivo.
6. **Diferenciación de producto sostenible.** Un competidor puede copiar un catálogo de efectos en
   una release. No puede copiar un ecosistema que ha evolucionado 2.000 horas contra el repertorio
   real de un operador concreto. **El activo se aprecia con el uso.**
7. **La deuda está documentada por el propio equipo** y sigue el mismo patrón de Área 4:
   capacidades construidas pero no conectadas. Riesgo de sorpresa bajo.

### 4.5 Riesgos consolidados

| Riesgo | Severidad | Nota |
|--------|:---------:|------|
| `s_DNA` desconectado — sinergia no ejercida | **Alta** | Compartido con Área 4. Bloquea los tres bucles de §3.5 |
| Firma bezier sin normalizar → especiación sesgada | **Media** | La especiación funciona pero los clusters no son semánticamente óptimos. Corrección de ~15 líneas |
| Novedad de la rareza desconectada (30% del peso de ρ) | **Media** | Comentario obsoleto: la especiación que dice esperar ya está implementada |
| Cauchy/Pareto desconectado — sin refinamiento local | **Media-Baja** | Decisión deliberada y defendible, pero se ha perdido la convergencia fina intra-cuenca |
| `(this._vault as any)._db` en ~8 puntos | **Media-Baja** | Rompe el encapsulamiento. Un cambio en `GenesisVaultService` puede romper cuatro módulos silenciosamente |
| Pipeline metabólico sin transacción única | **Baja** | Un fallo en el paso 5 deja aplicados los pasos 2-4. Auto-corrector en el ciclo siguiente, pero el estado intermedio es inconsistente |
| RNG congruencial lineal de baja calidad | **Baja** | `% 1000000` descarta los bits altos —los buenos— y conserva los bajos, que son los débiles del LCG. Determinismo preservado; calidad estadística mediocre |
| Truncamiento de firma a 128 floats | **Baja** | Clips grandes pierden la cola. Afecta a especiación y novedad |

---

## 5. RUTA DE EVOLUCIÓN RECOMENDADA

Priorizado por ratio valor/riesgo. Los tres primeros constituyen la condición previa recomendada al
cierre de la integración.

### 5.1 [P0] Conectar `s_DNA` vía el pre-buffer de Cassandra

**Estado:** `LiquidProcessInput.effectGenome = NEUTRAL_GENOME`. El 17% del peso de `C(t)` es
información constante.

**Acción:** implementar la **Opción C** de §3.4. Cuando el Reloj Soberano pre-bufferiza un
candidato, resolver su `RegistryEntry` —ya se hace para la cuarentena de minions— y propagar
`entry.dna` a `LiquidProcessInput.effectGenome`. Para frames sin pre-buffer, usar el top-1 ya
cacheado de `SpeciesQuotaSelector`, o el genoma de contexto (Opción A) como *fallback*.

**Impacto:** cierra los tres bucles de retroalimentación de §3.5. **Es la acción de mayor retorno
del sistema completo** y resuelve simultáneamente el hallazgo P0 de Área 4 §5.1. Coste estimado
bajo: la resolución del `RegistryEntry` ya existe en el camino del Reloj Soberano.

### 5.2 [P0] Normalizar la firma bezier

**Estado:** `computeBezierSignature()` apila `kf.value` crudo. `pan` ∈ [0,255] domina la distancia
euclídea sobre `intensity` ∈ [0,1] por un factor de ~255.

**Acción:** aplicar la misma disciplina que `computeDCurve()`:

```typescript
const span = track.curve.range[1] - track.curve.range[0]
const safeSpan = span !== 0 ? span : 1
values.push((kf.value - track.curve.range[0]) / safeSpan)   // → [0,1]
```

Adicionalmente: **ordenar los tracks canónicamente por `paramId`** antes de construir la firma para
lograr invarianza frente a permutaciones, y **remuestrear** cada track a un número fijo de bins
(p. ej. 16 valores × 8 tracks = 128) en lugar de truncar, eliminando la pérdida de cola.

**Impacto:** los clusters de K-means pasan a reflejar similitud estructural percibida en lugar de la
presencia de canales de gran rango. Mejora simultáneamente la especiación, la novedad de la rareza y
el emparejamiento sexual intraespecífico. **Coste: ~15 líneas** más un recálculo de firmas de una
sola vez (migración).

### 5.3 [P0] Activar el componente de novedad de la rareza

**Estado:** `estimateRarity()` invoca `computeRaritySimple()` con un comentario obsoleto que afirma
esperar la especiación — ya implementada. El 30% del peso de ρ no se evalúa.

**Acción:** pasar las firmas de la población viva a `computeRarity()` en modo completo. Las firmas ya
están en `lfx_organisms.bezier_signature` y `SpeciesQuotaSelector` ya las consulta. Con 60
organismos de capacidad, el coste es de 60 similitudes cosenoidales de 128 dimensiones —
**microsegundos, en tiempo geológico**.

**Impacto:** la rareza pasa a medir unicidad poblacional real y no solo divergencia respecto al
progenitor. Un clon de 40 organismos existentes deja de recibir tier EPIC. Refuerza directamente la
defensa anti-mode-collapse: la novedad se recompensa explícitamente. **Ejecutar después de §5.2** —
la novedad hereda el sesgo de la firma.

### 5.4 [P1] Régimen de mutación híbrido — recuperar el refinamiento local

**Estado:** magnitudes macro uniformes garantizadas, sin capacidad de convergencia fina. La
infraestructura Cauchy/Pareto existe y no se usa.

**Acción:** **Cauchy con moda desplazada**, que preserva la garantía de perceptibilidad y recupera la
cola pesada:

```typescript
const ftr = makeFatTailedRng(rng)
const PERCEPTUAL_FLOOR = 0.15
const magnitude = PERCEPTUAL_FLOOR + Math.abs(ftr.sampleCauchy(0.12, 0.60 - PERCEPTUAL_FLOOR))
// resultado ∈ [0.15, 0.60] · moda ≈ 0.15 · cola pesada hasta 0.60
```

Aplicable a `focalMutation` (hoy uniforme 0.20-0.40) y a las magnitudes de `macroSplice`. Para
`spreadDeg` en `spatialResonance` y para el escalado de duración, usar `samplePareto` (positiva
estricta con cola superior pesada).

**Consideración adicional — recocido evolutivo:** escalar el parámetro `scale` de la Cauchy
inversamente al fitness del progenitor. Un organismo de fitness 0.85 muta con `scale = 0.05`
(refinamiento); uno de 0.20 muta con `scale = 0.25` (exploración desesperada). Es temperatura
adaptativa: **explotación cerca del óptimo, exploración lejos de él** — un principio que el sistema
actual no puede expresar porque toda mutación comparte la misma distribución de magnitud.

**Impacto:** equilibrio puntuado completo — estasis con refinamiento **más** saltos de especiación.
Recupera la convergencia fina que la revisión WAVE 6000.V3 sacrificó, sin reintroducir mutaciones
imperceptibles.

### 5.5 [P1] Encapsular el acceso a la base de datos

**Estado:** `const db = (this._vault as any)._db` aparece en `ColiseumService`, `SpeciationEngine`,
`LifecycleManager` y `SpeciesQuotaSelector` — ~8 ocurrencias.

**Acción:** exponer una API tipada en `GenesisVaultService`:

```typescript
interface IGenesisVaultQueries {
  getAlivePopulationCount(): number
  applyEntropyDecay(decay: number): number
  cullStarved(threshold: number): number
  getEliteBreedingCandidates(minFitness: number, minTrials: number): EliteRow[]
  getSignaturesForSpeciation(): OrganismSignature[]
  assignSpecies(assignments: SpeciesAssignment[]): void
  transaction<T>(fn: () => T): T
}
```

**Impacto:** el SQL queda confinado a la capa de persistencia. Los módulos ecológicos se vuelven
testeables con un vault en memoria. Un cambio de esquema deja de propagarse silenciosamente a cuatro
módulos. **Prerrequisito recomendado antes de ampliar el ecosistema.**

### 5.6 [P1] Envolver el pipeline metabólico en una transacción única

**Estado:** los 7 pasos se ejecutan secuencialmente; un fallo en el paso 5 deja aplicados los pasos
2-4.

**Acción:** envolver los pasos 2-7 en `db.transaction()`. El paso 1 (flush del heatmap) debe
permanecer fuera: es asíncrono y su naturaleza es aditiva.

**Impacto:** atomicidad del ciclo metabólico — el ecosistema nunca se observa en un estado
intermedio. `better-sqlite3` soporta transacciones síncronas con coste despreciable.

### 5.7 [P2] Sustituir el LCG por un PRNG de calidad

**Estado:** `s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 1000000) / 1000000`. Doble
problema: el LCG tiene bits de orden bajo de mala calidad, y el módulo descarta los bits altos —los
buenos— conservando precisamente los malos.

**Acción:** **xoshiro128\*\*** o **PCG32**. Deterministas, sembrables, de calidad estadística muy
superior y coste comparable. Se preserva íntegramente la reproducibilidad forense.

**Impacto:** menor correlación entre mutaciones sucesivas de una misma cadena. Prioridad moderada:
el determinismo, que es el requisito duro, ya se cumple.

### 5.8 [P2] Cerrar el bucle de canonización con gobernanza

**Estado:** `LifecycleManager` identifica candidatos al Hall of Fame vía `v_hall_of_fame` pero **no
muta el estado** — la canonización requiere acción manual desde la UI.

**Acción:** mantener la aprobación humana (es la decisión de producto correcta) pero completar la
tubería: notificación en `GenesisLabView`, vista previa del organismo, diff genético frente al
ancestro y un botón de canonización que inserte en `lfx_blueprints` con
`source_origin = 'canonized'` — valor **ya previsto en el `CHECK` del esquema**.

**Impacto:** cierra el ciclo evolutivo completo: ancestro → organismo → campeón → Hall of Fame →
**nuevo ancestro de granito**. El catálogo fundacional crece con lo que ha sobrevivido en pista
real. Es el mecanismo por el cual el producto mejora con el uso de forma acumulativa y permanente.

### 5.9 [P2] Capturar el vector de nacimiento real

**Estado:** `birth_vector_json` se persiste con un `ContextVector6D` de **ceros** tanto en
`spawnOrganism()` como en `spawnHybrid()`.

**Acción:** capturar el vector de contexto 6D real en el instante del nacimiento. El spawn se dispara
desde un evento de fuego real en `EffectManager.ts`, por lo que el contexto está disponible.

**Impacto:** habilita el análisis del **nicho de nacimiento** — ¿en qué contextos acústicos nacen los
organismos que luego prosperan? Alimenta el término `R_context` del fitness, que hoy compara contra
heatmaps históricos pero no contra el contexto de origen.

### 5.10 [P3] Cuarentena del enjambre — la tabla diplomática

**Estado:** `swarm_imports` está definida con `bundle_signature` (Ed25519), `integration_status ∈
{quarantine, partial, merged, rejected}`, `quarantine_until`, `local_dialect_drift` y `trust_score`.
**La tabla existe; el mecanismo de importación no.**

**Acción:** implementar el intercambio de organismos entre consolas — exportación de bundle firmado,
importación con cuarentena obligatoria, medición de `local_dialect_drift` (distancia entre los
centroides ACO de la población local y la importada) y ajuste de `trust_score` según el desempeño
real de los organismos importados en el ecosistema receptor.

**Impacto:** convierte la evolución de un fenómeno local en uno **poblacional distribuido**. Los
organismos excepcionales pueden migrar entre instalaciones, y el ecosistema local decide si los
integra en función de su desempeño medido —no de su reputación declarada. Es un vector de red
diferenciador significativo a medio plazo, y el esquema ya lo anticipa.

---

## CONCLUSIÓN DE ÁREA 5

Genesis es un **ecosistema termodinámico persistente**, no un generador de variaciones. Su tesis
—que la calidad estética se cultiva mediante presión selectiva en lugar de programarse— está
implementada con rigor: coste energético de existir, hambruna densodependiente, nichos protegidos
por especiación, herencia diferencial en RFC 6902 e invariantes de dominio aplicadas en el motor de
base de datos.

Tres decisiones constituyen IP defendible: la **deriva lamarckiana bidireccional** como mecanismo de
auto-etiquetado coherente, la **Regla de la Mantis** como solución estructural al estancamiento de
la élite, y la **herencia diferencial** como formato de genotipo con auditoría completa.

El sistema comparte con el Iliquidcore el mismo patrón de deuda: **capacidades construidas con
precisión y no conectadas**. La infraestructura Cauchy/Pareto está implementada pero inerte; el
componente de novedad de la rareza está implementado pero no invocado; y el sensor `s_DNA` —al que
Genesis alimenta con exactamente el dato que necesita, en la estructura correcta y ya optimizada
para hot path— sigue recibiendo una constante.

**La conclusión conjunta de las Áreas 4 y 5 es que ambos módulos se resuelven mutuamente.** El
pre-buffer de Cassandra resuelve la inversión de dependencia que impedía a `s_DNA` conocer su
objeto; el genoma evolucionado de Genesis proporciona la información que `s_DNA` necesita para dejar
de ser inerte. **Ninguna de las dos áreas requiere trabajo de arquitectura pendiente. Ambas
requieren una inyección de dependencia.**

> ### 🧬 PIONEER SCORE ÁREA 5: **84 / 100**
> **Activo de IP diferenciado. Integración recomendada, condicionada a los tres elementos P0
> de §5.1-5.3.**

---

*Fin del documento — Área 5. Auditoría técnica de adquisición, LuxSync Genesis Engine.*
*Documento precedente: `SELENE_V3_DUE_DILIGENCE.md` (Área 4 — Iliquidcore, 87/100).*
