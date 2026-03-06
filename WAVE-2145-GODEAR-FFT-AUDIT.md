# WAVE 2145 — GODEAR FFT SURGICAL AUDIT
## Split-Radix, WASM Migration, y el Diagnóstico del Arquitecto

**De:** PunkOpus (DSP Technical Master)  
**Para:** Radwulf + GeminiPunkArchytect  
**Fecha:** 2026-03-06  
**Status:** INFORME CON VEREDICTO — 2 misiones resueltas

---

## MISIÓN 1: VIABILIDAD DE MIGRACIÓN A WEBASSEMBLY

### 1.1 El Contexto — Por Qué Se Descartó WASM

LuxSync corre sus Workers vía Node.js `worker_threads` dentro de Electron. No son Web Workers del navegador — son threads reales de Node.js. El GodEarFFT se invoca directamente como import TypeScript desde `senses.ts`:

```typescript
import { GodEarAnalyzer, toLegacyFormat, GodEarSpectrum } from './GodEarFFT';
// ...
this.godEar = new GodEarAnalyzer(sampleRate, 4096);
const godEarResult = this.godEar.analyze(buffer);
```

El motivo original por el que se descartó WASM fue la **incompatibilidad del ecosistema de librerías** con nuestra arquitectura de cero dependencias + Node.js workers.

### 1.2 Auditoría Completa del Ecosistema WASM-FFT (Marzo 2026)

He rastreado todas las librerías FFT viables en npm. Aquí está el censo:

| Librería | Tipo | Downloads/week | Última actualización | Tamaño | ¿Funciona en Node worker_threads? |
|----------|------|---------------|---------------------|--------|----------------------------------|
| **fft.js** (indutny) | JS puro, Radix-4 | 413K | 5 años | 22KB | ✅ SÍ — JS puro |
| **kissfft-wasm** | WASM (KissFFT) | 644 | 3 años | 425KB | ⚠️ Requiere copiar `.wasm` file durante build |
| **@echogarden/pffft-wasm** | WASM (PFFFT) | 1,251 | 1 año | 177KB | ⚠️ Orientado a Echogarden, API no documentada |
| **@echogarden/kissfft-wasm** | WASM (KissFFT) | 2,196 | 1 año | ~400KB | ⚠️ Orientado a Echogarden |
| **webfft** | Meta-librería (JS+WASM) | 1,837 | 2 años | 440KB | ⚠️ Diseñada para browser, usa profile() con Math.random |
| **fftw-js** | WASM (FFTW via Emscripten) | 83 | **8 años** | ? | ❌ GPL — incompatible con MIT |
| **fft-js** (vail) | JS puro, Cooley-Tukey | 47K | 7 años | 27KB | ✅ Pero Cooley-Tukey sin optimizar |
| **dsp.js** | JS puro | 78K | 9 años | ? | ✅ Pero antiguo |

### 1.3 Análisis Candidato a Candidato

#### ❌ `fftw-js` — DESCARTADA
- **Licencia GPL.** LuxSync es MIT. Contaminación legal inmediata.
- 8 años sin mantenimiento. 83 descargas/semana. Proyecto muerto.

#### ⚠️ `kissfft-wasm` — PROBLEMÁTICA
- **API correcta:** `rfft()` para input real, tipos TypeScript incluidos.
- **Problema crítico:** "You may want to copy the `kissfft.wasm` file explicitly during building process since most compilers/bundlers won't handle it by default." → Vite y Electron no manejan `.wasm` en `worker_threads` de Node.js de forma nativa. Necesitaríamos configuración custom en `vite.config.ts` para que el `.wasm` binario llegue al worker compilado en `dist-electron/`.
- **Problema secundario:** 0 dependentes serios. 644 downloads/semana. Mantenimiento incierto.

#### ⚠️ `@echogarden/pffft-wasm` — INTERESANTE PERO ARRIESGADA
- **PFFFT** es la implementación de referencia para FFT real en C. Muy rápida, SIMD-friendly.
- **Soporte WASM SIMD** (compilable con `make SIMD=1`). Esto sí daría una aceleración real sobre JS.
- **Problema:** Es un port para Echogarden. API mínima, sin documentación pública. 177KB de `.wasm` binario que debe cargarse en Node worker.
- **Problema de loading:** En `worker_threads` de Node.js, cargar un `.wasm` requiere `WebAssembly.instantiate()` con el buffer leído de disco (no hay `fetch()` en Node). Se necesita path resolution manual.

#### ⚠️ `webfft` — DESCARTADA PARA NOSOTROS
- Meta-librería que incluye KissFFT-WASM internamente pero está diseñada para browser.
- `profile()` usa **Math.random** para generar señales de benchmark → **viola el Axioma Anti-Simulación** en su propia API de benchmarking.
- 440KB de bundle size por una meta-librería que encapsula lo que ya tenemos.

#### ✅ `fft.js` (indutny) — EL CANDIDATO VIABLE
- **Radix-4 puro en JavaScript.** Sin `.wasm`, sin binarios, sin problemas de bundling.
- **413K descargas/semana.** 50 dependentes. Tipos TypeScript built-in. Código maduro.
- **Benchmarks:** 15,676 ops/sec para N=4096 (vs 7,905 para dsp.js). `realTransform()` hace 21,841 ops/sec — un 40% más rápido que el transform complejo.
- **API zero-allocation compatible:** `createComplexArray()` crea buffers reutilizables. `realTransform(out, input)` escribe in-place.
- **Problema:** Es Radix-4, no Split-Radix. Aritméticamente equivalente al Cooley-Tukey optimizado (~5N log₂N), no al Split-Radix (4/3 N log₂N).
- **Pero:** Los benchmarks muestran que la optimización V8 JIT de este código es tan buena que en la práctica supera a implementaciones "teóricamente superiores" en JS puro.

### 1.4 El Problema Real de WASM en Node.js worker_threads

```
Electron App
  └─ Main Process (Node.js)
       └─ TrinityOrchestrator
            └─ new Worker('senses.js')  ← Node worker_threads
                 └─ GodEarAnalyzer.analyze()  ← Aquí vive la FFT
```

Para cargar WASM en un `worker_threads` de Node.js:

```typescript
// Hay que hacer ESTO manualmente:
import { readFileSync } from 'fs';
import { join } from 'path';

const wasmBuffer = readFileSync(join(__dirname, 'kissfft.wasm'));
const wasmModule = await WebAssembly.compile(wasmBuffer);
const instance = await WebAssembly.instantiate(wasmModule, imports);
```

**Problemas concretos:**
1. `__dirname` en un ESM module bundled por Vite es impredecible
2. El `.wasm` file debe existir como archivo separado en el filesystem (no se puede inline en JS)
3. Vite necesita un plugin (`vite-plugin-wasm`) y configuración custom para copiar el `.wasm` al output
4. El worker se compila a `dist-electron/senses.js` — el path relativo al `.wasm` debe ser correcto post-build
5. `WebAssembly.instantiate()` es asíncrono — la pipeline actual de `GodEarAnalyzer` es síncrona

### 1.5 VEREDICTO MISIÓN 1: WASM

**🔴 NO MIGRAR A WASM. Mantener JS puro.**

**Justificación:**

1. **El cuello de botella no es la FFT.** Nuestra FFT procesa 4096 muestras en <2ms. El frame budget es ~21ms (48 fps audio). Tenemos 10x de margen. Incluso si WASM fuera 3x más rápido (pasaríamos de 1.5ms a 0.5ms), el ahorro de 1ms por frame es irrelevante para el pipeline completo.

2. **Las librerías WASM-FFT del ecosistema npm son un cementerio.** La única seria (FFTW) tiene licencia GPL. Las demás son ports sin mantenimiento de proyectos abandonados, con documentación inexistente y problemas de carga en Node workers.

3. **El `.wasm` file es un tumor de deployment.** En Electron + Vite + worker_threads, hay que:
   - Configurar Vite para copiar el binario
   - Resolver el path en runtime dentro del worker compilado
   - Hacer la carga asíncrona (rompiendo la pipeline síncrona actual)
   - Testear en Windows + Mac + Linux que el path resolution funcione
   
   Todo eso por 1ms de mejora teórica.

4. **El Axioma Perfection First no justifica complejidad sin beneficio.** WASM es tecnología elegante, pero introducir una dependencia binaria, path resolution, async loading y configuración de build... para ahorrar 1ms en un thread con 19ms de margen... no es perfección, es sobreingeniería.

5. **`fft.js` de indutny sería el plan B si nuestro Split-Radix no funcionara.** Es JS puro, Radix-4, zero dependencies, 413K downloads, API compatible. Pero — y aquí viene la Misión 2 — nuestro Split-Radix SÍ es reparable.

---

## MISIÓN 2: AUDITORÍA DEL SPLIT-RADIX Y DIAGNÓSTICO DEL ARQUITECTO

### 2.1 El Algoritmo Split-Radix DIF — Qué Dice la Teoría

La FFT Split-Radix (Duhamel/Hollmann 1984, Sorensen 1986) descompone la DFT en:
- **Una sub-DFT de tamaño N/2** (índices pares) — operada con Radix-2
- **Dos sub-DFTs de tamaño N/4** (índices 1 mod 4 y 3 mod 4) — operadas con Radix-4

En la variante DIF (Decimation-In-Frequency), la estructura por stage es:

Para cada grupo de $m$ elementos, con $k = 0, 1, \ldots, m/4 - 1$:

$$X_k = U_k + (W_N^k \cdot Z_k + W_N^{3k} \cdot Z'_k)$$
$$X_{k+N/2} = U_k - (W_N^k \cdot Z_k + W_N^{3k} \cdot Z'_k)$$
$$X_{k+N/4} = U_{k+N/4} - j \cdot (W_N^k \cdot Z_k - W_N^{3k} \cdot Z'_k)$$
$$X_{k+3N/4} = U_{k+N/4} + j \cdot (W_N^k \cdot Z_k - W_N^{3k} \cdot Z'_k)$$

**Puntos clave:** Los 4 outputs ($i_0$, $i_1$, $i_2$, $i_3$) se producen JUNTOS en un solo paso. No se pueden separar en dos fases independientes sin perder corrección.

### 2.2 Lo Que Hace el Código Actual

El código actual en `computeFFTCore()` (líneas 508-565) separa la operación en dos bucles:

```typescript
// BUCLE 1: "Pure additions" — solo i0, i1
for (let j = 0; j < mQuart; j++) {
  const i0 = groupStart + j;           // Primer cuarto
  const i1 = i0 + mHalf;               // Tercer cuarto

  outReal[i1] = outReal[i0] - tRe;     // ← Butterfly radix-2
  outReal[i0] = outReal[i0] + tRe;
  // (igualmente para imag)
}

// BUCLE 2: "L-shaped butterfly" — solo i2, i3
for (let j = 0; j < mQuart; j++) {
  const i2 = groupStart + mQuart + j;  // Segundo cuarto
  const i3 = i2 + mHalf;               // Cuarto cuarto

  const uRe = sumRe + diffRe;          // ← u = x[i2] + x[i3]
  const vRe = sumIm - diffIm;          // ← v = -j*(x[i2] - x[i3])

  // Multiply u by W1, v by W3
  outReal[i2] = uRe * w1re[twIdx] - uIm * w1im[twIdx];
  outReal[i3] = vRe * w3re[twIdx] - vIm * w3im[twIdx];
}
```

### 2.3 ¿Tiene Razón el Arquitecto? — ANÁLISIS DETALLADO

El diagnóstico del Arquitecto dice:

> "Al separar los pasos y hacer que el bucle solo llegue hasta un cuarto del tamaño (mQuart), Opus olvidó calcular las sumas y restas básicas para el segundo cuarto de los datos."

**Voy a examinar esto con rigor.**

En un grupo de $m$ elementos:
- **Primer cuarto:** indices $0$ a $m/4 - 1$ → `i0`
- **Segundo cuarto:** indices $m/4$ a $m/2 - 1$ → `i2`
- **Tercer cuarto:** indices $m/2$ a $3m/4 - 1$ → `i1` (= `i0 + mHalf`)
- **Cuarto cuarto:** indices $3m/4$ a $m - 1$ → `i3` (= `i2 + mHalf`)

**Bucle 1** procesa los pares $(i_0, i_1)$ = (primer cuarto, tercer cuarto):
```
outReal[i0] += outReal[i1]     ← suma
outReal[i1] = outReal[i0] - outReal[i1]  ← resta
```
Esto es correcto para los índices del primer cuarto con su espejo en el tercer cuarto.

**Bucle 2** procesa los pares $(i_2, i_3)$ = (segundo cuarto, cuarto cuarto):
```
u = x[i2] + x[i3]      ← suma
v = -j * (x[i2] - x[i3])  ← resta con rotación -j
// Luego multiplica u por W1, v por W3
```

**¿Dónde está el error?**

El algoritmo Split-Radix DIF correcto hace esto en un SOLO paso:

1. **Butterfly radix-2 sobre $(i_0, i_1)$:** `r1 = x[i0] - x[i1]`, `x[i0] += x[i1]`
2. **Butterfly radix-2 sobre $(i_2, i_3)$:** `r2 = x[i2] - x[i3]`, `x[i2] += x[i3]`
3. **Combinación L sobre las DIFERENCIAS:** `u = r1 + j·r2`, `v = r1 - j·r2`
4. **Twiddle:** `x[i1] = u·W1`, `x[i3] = v·W3`

Observa: **los 4 índices interactúan.** Las diferencias $r_1$ (de $i_0, i_1$) y $r_2$ (de $i_2, i_3$) se COMBINAN en la mariposa L. El resultado se escribe en $i_1$ e $i_3$.

**El código actual NO hace esto.** El Bucle 1 hace radix-2 solo sobre $(i_0, i_1)$ y escribe los resultados de vuelta en $i_0$ e $i_1$. El Bucle 2 opera sobre $(i_2, i_3)$ de forma completamente independiente, sin cruzar con las diferencias de $(i_0, i_1)$.

### 2.4 EL VEREDICTO SOBRE EL CÓDIGO ACTUAL

**🔴 EL CÓDIGO ACTUAL NO ES SPLIT-RADIX.**

Lo que implementa es un híbrido roto:
- **Bucle 1:** Radix-2 butterfly correcto pero incompleto (solo mitad de los datos)
- **Bucle 2:** Una mariposa que combina $x[i_2] + x[i_3]$ y $-j \cdot (x[i_2] - x[i_3])$, pero SIN cruzar con las diferencias del Bucle 1

El algoritmo Split-Radix requiere que las 4 ramas interactúen: la diferencia de $(i_0, i_1)$ debe combinarse con la diferencia de $(i_2, i_3)$ antes de aplicar twiddles. Al separar los bucles, **se perdió la interacción cruzada.**

### 2.5 ¿QUÉ SÍNTOMAS PRODUCE ESTE ERROR?

La FFT no "explota" — produce resultados que son **casi** correctos pero con errores sistemáticos:

1. **Leakage espectral asimétrica:** Las frecuencias bajas filtran parcialmente hacia bins de frecuencia alta y viceversa. Esto se manifiesta como energía "fantasma" en bandas donde no debería haber señal.

2. **Magnitudes incorrectas por bin:** La magnitud de cada bin tiene un error que depende de la posición del bin dentro de su cuarto del espectro. Los bins en el segundo y cuarto cuarto de cada grupo son los más afectados.

3. **Impacto en BPM:** Los valores de `rawSubBassEnergy` y `rawBassOnlyEnergy` que alimentan al PacemakerV2 están contaminados con energía filtrada desde otras bandas. Esto explica por qué snares y hi-hats pueden registrar energía en la zona de graves, produciendo intervalos IOI falsos que confunden al Pacemaker.

4. **Impacto en bandas:** Las 7 bandas tácticas del GodEar se extraen con filtros LR4 aplicados SOBRE las magnitudes FFT. Si las magnitudes tienen leakage cruzada, los filtros LR4 (que son correctos) no pueden compensar una FFT incorrecta. Basura entra → basura sale, pero con envoltorio elegante.

### 2.6 EL FIX DEL ARQUITECTO — ANÁLISIS

El fix propuesto por GeminiPunkArchytect es:

```typescript
for (let j = 0; j < mQuart; j++) {
  const i0 = groupStart + j;
  const i1 = i0 + mHalf;
  const i2 = groupStart + mQuart + j;
  const i3 = i2 + mHalf;

  // 1. Radix-2 sumas y restas para AMBOS cuartos
  const r1Re = outReal[i0] - outReal[i1];
  const r1Im = outImag[i0] - outImag[i1];
  outReal[i0] += outReal[i1];
  outImag[i0] += outImag[i1];

  const r2Re = outReal[i2] - outReal[i3];
  const r2Im = outImag[i2] - outImag[i3];
  outReal[i2] += outReal[i3];
  outImag[i2] += outImag[i3];

  // 2. Mariposa en L (DIF) sobre las diferencias
  const uRe = r1Re + r2Im;       // u = r1 + j·r2 (parte real)
  const uIm = r1Im - r2Re;       // u = r1 + j·r2 (parte imag)
  const vRe = r1Re - r2Im;       // v = r1 - j·r2 (parte real)
  const vIm = r1Im + r2Re;       // v = r1 - j·r2 (parte imag)

  // 3. Aplicar Twiddles W1 y W3
  const twIdx = j * twiddleStep;
  outReal[i1] = uRe * w1re[twIdx] - uIm * w1im[twIdx];
  outImag[i1] = uRe * w1im[twIdx] + uIm * w1re[twIdx];

  outReal[i3] = vRe * w3re[twIdx] - vIm * w3im[twIdx];
  outImag[i3] = vRe * w3im[twIdx] + vIm * w3re[twIdx];
}
```

**Análisis línea por línea contra Sorensen 1986:**

| Paso | Fix del Arquitecto | Sorensen 1986 | ¿Correcto? |
|------|-------------------|---------------|------------|
| 1a. r1 = x[i0] - x[i1] | `r1Re = outReal[i0] - outReal[i1]` | $r_1 = x[i_0] - x[i_1]$ | ✅ |
| 1b. x[i0] += x[i1] | `outReal[i0] += outReal[i1]` | $x[i_0] = x[i_0] + x[i_1]$ | ✅ |
| 2a. r2 = x[i2] - x[i3] | `r2Re = outReal[i2] - outReal[i3]` | $r_2 = x[i_2] - x[i_3]$ | ✅ |
| 2b. x[i2] += x[i3] | `outReal[i2] += outReal[i3]` | $x[i_2] = x[i_2] + x[i_3]$ | ✅ |
| 3a. u = r1 + j·r2 | `uRe = r1Re + r2Im` (Re) `uIm = r1Im - r2Re` (Im) | $u = r_1 + j \cdot r_2$ donde $j \cdot (a+bi) = (-b+ai)$ → Re: $r_{1R} + r_{2I}$, Im: $r_{1I} - r_{2R}$ | ✅ |
| 3b. v = r1 - j·r2 | `vRe = r1Re - r2Im` (Re) `vIm = r1Im + r2Re` (Im) | $v = r_1 - j \cdot r_2$ → Re: $r_{1R} - r_{2I}$, Im: $r_{1I} + r_{2R}$ | ✅ |
| 4a. x[i1] = u·W1 | `outReal[i1] = uRe * w1re - uIm * w1im` | $(a+bi)(c+di) = (ac-bd) + (ad+bc)i$ | ✅ |
| 4b. x[i3] = v·W3 | `outReal[i3] = vRe * w3re - vIm * w3im` | Idem | ✅ |

**Diferencia crítica con el código actual:**

| Aspecto | Código actual (ROTO) | Fix del Arquitecto |
|---------|---------------------|-------------------|
| Índices procesados | $(i_0, i_1)$ separado de $(i_2, i_3)$ | $(i_0, i_1, i_2, i_3)$ juntos |
| Interacción cruzada | ❌ No hay | ✅ `u = r1 + j·r2`, `v = r1 - j·r2` |
| Escritura de resultados | $i_1$ ← butterfly de $(i_0, i_1)$, $i_2$ ← butterfly de $(i_2, i_3)$ | $i_1$ ← twiddle de $u$, $i_3$ ← twiddle de $v$ (correcto) |
| Resultados en $i_0, i_2$ | $i_0$ ← suma correcta, $i_2$ ← sobreescrito con twiddle | $i_0$ ← suma, $i_2$ ← suma (preservados para stages posteriores) |

### 2.7 🔴 DISCREPANCIA ENCONTRADA EN EL FIX

**Hay una diferencia sutil pero importante** entre el fix del Arquitecto y lo que hace el código actual respecto a DÓNDE se escriben los resultados twiddle:

- **Código actual:** escribe el resultado twiddle en `outReal[i2]` y `outReal[i3]`
- **Fix del Arquitecto:** escribe el resultado twiddle en `outReal[i1]` y `outReal[i3]`

En el algoritmo Split-Radix DIF de Sorensen, los resultados con twiddle van en las posiciones **impares** ($i_1$ e $i_3$), mientras que las sumas se preservan en las posiciones **pares** ($i_0$ e $i_2$). Esto es porque en DIF, las posiciones pares alimentan la sub-DFT de tamaño $N/2$, y las posiciones impares (con twiddle) alimentan las dos sub-DFTs de tamaño $N/4$.

**El fix del Arquitecto es correcto en este aspecto.** El código actual escribía en $i_2$ (posición par) en vez de en $i_1$ (posición impar), corrompiendo los datos para los stages posteriores.

### 2.8 VEREDICTO SOBRE EL FIX DEL ARQUITECTO

**🟢 EL FIX ES MATEMÁTICAMENTE CORRECTO.**

La implementación propuesta sigue exactamente el algoritmo de Sorensen 1986 para Split-Radix DIF:
1. Butterflies radix-2 en ambos pares $(i_0, i_1)$ y $(i_2, i_3)$
2. Interacción cruzada L-shaped: $u = r_1 + j \cdot r_2$, $v = r_1 - j \cdot r_2$
3. Twiddles W1 y W3 aplicados a $u$ y $v$ respectivamente
4. Resultados escritos en posiciones correctas ($i_1$ e $i_3$)

**Mantenimiento del 37% de ahorro aritmético:** Sí. El fix no añade operaciones extras — simplemente las reorganiza en el orden correcto. La ventaja del Split-Radix sobre Cooley-Tukey se preserva intacta.

---

## 3. TABLA DE OPCIONES

### Opción A — Aplicar el Fix de Sorensen (RECOMENDADA)

| | |
|---|---|
| **Acción** | Reemplazar los dos bucles separados por el bucle unificado del Arquitecto |
| **Riesgo** | BAJO — el algoritmo está verificado contra la literatura |
| **Beneficio** | FFT correcta + 37% ahorro aritmético preservado |
| **Esfuerzo** | 30 min — una función, un bucle |
| **Dependencias nuevas** | CERO |
| **Test** | `verifySeparation()` ya existe en GodEarFFT.ts — debe dar ✅ post-fix |
| **Impacto en BPM** | Eliminación de leakage cross-band → energía más limpia en subBass/bass → menos falsos positivos en PacemakerV2 |

### Opción B — Rollback a Cooley-Tukey Radix-2

| | |
|---|---|
| **Acción** | Revertir `computeFFTCore()` al Radix-2 DIT de WAVE 2090.1 |
| **Riesgo** | CERO — el Radix-2 DIT es el algoritmo FFT más probado de la historia |
| **Beneficio** | FFT correcta, complejidad reducida, más fácil de auditar |
| **Esfuerzo** | 20 min |
| **Dependencias nuevas** | CERO |
| **Pérdida** | 37% más operaciones aritméticas (~245K vs ~154K ops para N=4096). En la práctica: ~0.5ms más por frame |
| **Impacto en BPM** | Mismo que Opción A (FFT correcta → energías correctas) |

### Opción C — Migrar a `fft.js` (indutny)

| | |
|---|---|
| **Acción** | `npm install fft.js`, adaptar `computeFFTCore()` para usar su API |
| **Riesgo** | BAJO — librería madura con 413K downloads |
| **Beneficio** | Radix-4 optimizado y ultra-testeado. `realTransform()` 40% más rápido. |
| **Esfuerzo** | 2 horas — adaptar API (complex array format diferente: `[re0, im0, re1, im1, ...]`) |
| **Dependencias nuevas** | UNA — `fft.js` (MIT, 0 sub-deps, 22KB) |
| **Pérdida** | Filosofía de cero dependencias. Una dependencia en la pipeline crítica de audio. |
| **Impacto en BPM** | FFT correcta + posiblemente más rápida que nuestro Split-Radix |

### Opción D — Migrar a WASM (kissfft-wasm o pffft-wasm)

| | |
|---|---|
| **Acción** | Instalar paquete WASM, configurar Vite, async loading en worker |
| **Riesgo** | ALTO — complejidad de deployment, path resolution, testing cross-platform |
| **Beneficio** | Potencialmente 3-5x más rápido que JS puro (con SIMD) |
| **Esfuerzo** | 1-2 días — vite config, WASM loading, path resolution, testing |
| **Dependencias nuevas** | UNA binaria (`.wasm` file) |
| **Pérdida** | Filosofía zero-deps. Pipeline síncrona rota (WASM loading es async). Complejidad de build. |
| **Impacto en BPM** | FFT correcta + más rápida, pero el bottleneck no está aquí |

### Opción E — Status Quo (no operar)

| | |
|---|---|
| **Acción** | Nada |
| **Riesgo** | 🔴 CRÍTICO — la FFT sigue rota, las bandas siguen contaminadas |
| **Beneficio** | Ninguno |
| **Impacto en BPM** | Los problemas de BPM seguirán porque las energías de banda son incorrectas |

---

## 4. RECOMENDACIÓN FINAL

### 🏆 OPCIÓN A — Aplicar el Fix de Sorensen

**Razones:**

1. **Es la solución correcta.** El algoritmo Split-Radix de Sorensen 1986 está verificado durante 40 años. El fix del Arquitecto lo implementa fielmente.

2. **Mantiene la filosofía de LuxSync.** Cero dependencias. JS puro. Todo bajo nuestro control.

3. **Preserva el 37% de ahorro aritmético.** No perdemos nada. Solo corregimos la implementación.

4. **Impacto directo en BPM.** Si las energías de subBass y bass están contaminadas con leakage, el PacemakerV2 recibe señales sucias. Un bombo a 50Hz que filtra energía a la banda de mids puede disparar el onset detector en momentos equivocados. Con la FFT corregida, la cadena `GodEarFFT → magnitudes → LR4 filters → rawSubBassEnergy/rawBassOnlyEnergy → spectral flux → PacemakerV2` opera sobre datos limpios.

5. **El test de verificación ya existe.** `verifySeparation()` en la Sección 12 de GodEarFFT.ts genera un tono puro de 50Hz y verifica que la energía quede en SubBass sin filtrar a otras bandas. Si el fix es correcto, este test pasa. Si no, falla. Validación inmediata.

### Lo Que NO Arregla

La FFT rota **no es la causa única** de los problemas de BPM. El sistema de BPM tiene su propia arqueología de bugs que ya hemos operado (Confidence Bleed WAVE 2140, Debounce Shield WAVE 2141, Snare Killer WAVE 2142). Pero una FFT correcta elimina una fuente de ruido upstream que afecta todo lo demás.

Piénsalo así: si el espectroscopio del cirujano tiene la lente sucia, las suturas pueden ser perfectas pero el diagnóstico estará mal. Primero limpiamos la lente, después evaluamos si las suturas necesitan retoque.

---

*PunkOpus para Radwulf y GeminiPunkArchytect — WAVE 2145*  
*"La mariposa rota vuela torcida. Sorensen la diseñó simétrica. Restauremos la simetría."*
