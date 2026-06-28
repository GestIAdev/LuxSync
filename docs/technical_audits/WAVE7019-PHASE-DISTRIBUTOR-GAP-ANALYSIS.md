# WAVE 7019 — Phase Engine vs. UI Gap Analysis

**Fecha:** 2026-06-26
**Auditor:** Cascade (Audio-Visual Industrial Designer & Math Auditor)
**Archivos inspeccionados:**
- `src/core/hephaestus/phase/PhaseConfigPro.ts` (motor matemático, 167 líneas)
- `src/core/hephaestus/types.ts` (tipos V2 legacy, líneas 80-147)
- `src/components/views/HephaestusView/PhaseControls.tsx` (UI actual, 290 líneas)
- `src/core/hephaestus/runtime/HephaestusRuntime.ts` (bridge V2→Pro, líneas 870-920)
- `src/components/views/HephaestusView/tabs/LabTab.tsx` (consumidor de PhaseControls)

---

## 1. Radiografía del ADN Matemático (`PhaseConfigPro`)

El motor `PhaseConfigPro` (WAVE 7001) expone **7 propiedades** que controlan la distribución de fase. El pipeline de cálculo en `computeOffsetPro()` ejecuta 7 etapas en orden estricto:

```
① BLOCKING → ② SHUFFLE → ③ NORMALIZE → ④ SYMMETRY → ⑤ WINGS → ⑥ DIRECTION → ⑦ SPREAD→TIME
```

| Propiedad | Tipo TS | Rango permitido | Default | Etapa pipeline | Descripción matemática |
|---|---|---|---|---|---|
| `spreadDeg` | `number` (float) | `[0, 1440]` (0-4 ciclos) | `0` | ⑦ SPREAD→TIME | Grados de ciclo de animación. `360° = 1 ciclo completo (durationMs)`. Conversión final: `offset = d × (spreadDeg/360) × durationMs` |
| `symmetry` | `PhaseSymmetryMode` | `'linear' \| 'mirror' \| 'center-out'` | `'linear'` | ④ SYMMETRY | `linear`: identidad `u→u`. `mirror`: `1-\|2u-1\|` (pico central). `center-out`: `\|2u-1\|` (valle central, expansión radial) |
| `wings` | `number` (float, usado como int implícito) | `[1, ∞)` (clampeado a ≥1) | `1` | ⑤ WINGS | Multiplicador de frecuencia espacial. `wings=1` → un barrido. `wings=N` → la onda recorre el grupo N veces. Usa `fract(s × wings)` — parte fraccionaria continua, no subdivisión dura |
| `blocks` | `number` (int) | `[1, ∞)` (clampeado a ≥1) | `1` | ① BLOCKING | Agrupa N fixtures consecutivas para compartir fase idéntica. `iBlock = floor(index/blocks)`, `nBlock = ceil(total/blocks)`. Efecto "escalera"/columnas MAtricks |
| `shuffle` | `number` (float) | `[0, 1]` | `0` | ② SHUFFLE | Mezcla orden determinista ↔ caótico. `iEff = (1-shuffle)×iBlock + shuffle×iRandom` donde `iRandom = hash01(seed, iBlock) × (nBlock-1)` |
| `shuffleSeed` | `number` (int) | `[1, ∞)` | `1` | ② SHUFFLE | Semilla del hash pseudo-aleatorio. Fija → reproducible. `hash01(seed, k) = fract(sin(k×127.1 + seed×311.7) × 43758.5453)` |
| `direction` | `1 \| -1` | `{1, -1}` | `1` | ⑥ DIRECTION | `1` = forward (fixture 0 primero). `-1` = reverse (`d = 1 - w`, invierte la onda) |

**Función hash:** `hash01(seed, k)` — implementación GLSL-style `fract(sin(x)×43758.5453)`. Determinista, sin estado, reproducible. No es criptográfica pero suficiente para permutación visual.

**Tipo legacy V2 (`PhaseConfig` en `types.ts`):**
| Propiedad V2 | Tipo | Rango | Default | Estado |
|---|---|---|---|---|
| `spread` | `number` | `[0, 1]` | `0` | **DEPRECATED** — convertido a `spreadDeg × 1440` en `_extractPhaseConfig()` |
| `symmetry` | `PhaseSymmetryMode` | mismo | `'linear'` | Migrado directo |
| `wings` | `number` | `[1, N]` | `1` | Migrado directo |
| `direction` | `PhaseDirection` | `{1, -1}` | `1` | Migrado directo |

**Gap V2→Pro:** V2 no tiene `blocks`, `shuffle`, ni `shuffleSeed`. El bridge `_extractPhaseConfig()` los inicializa a defaults al upgradear.

---

## 2. El Abismo de la Interfaz (`PhaseControls.tsx`)

### 2.1 Propiedades del motor CONEXIONADAS a la UI

| Propiedad motor | Control UI | Tipo de input | Línea | Estado |
|---|---|---|---|---|
| `spreadDeg` | Slider range 0—1440 | `<input type="range">` | 164-173 | **Conectado** — muestra valor en º + badge % |
| `symmetry` | 3 botones (LINEAR/MIRROR/CENTER) | `<button>` group | 182-194 | **Conectado** — icono + label + hint tooltip |
| `wings` | Input numérico 1—8 | `<input type="number">` | 202-210 | **Conectado** — hint contextual ("Single sweep" / "N× freq") |
| `blocks` | Input numérico 1—16 | `<input type="number">` | 221-229 | **Conectado** — hint contextual ("Individual" / "Groups of N") |
| `shuffle` | Slider range 0—1 | `<input type="range">` | 240-250 | **Conectado** — muestra % |
| `shuffleSeed` | Input numérico ≥1 | `<input type="number">` | 256-263 | **Conectado** |
| `direction` | Toggle button (→/←) | `<button>` | 270-283 | **Conectado** — arrow + label FORWARD/REVERSE |

### 2.2 Propiedades huérfanas / ignoradas por la UI

**Ninguna.** Las 7 propiedades de `PhaseConfigPro` están todas conectadas a un control visual. No hay propiedades del motor sin UI.

### 2.3 Inputs legacy V2 que no hacen nada

| Input/elemento | Línea | Diagnóstico |
|---|---|---|
| `spatialBehavior` (WAVE 4811) | 137-158 | **No es legacy** — es funcional pero es un módulo independiente (DNA spatial, no PhaseConfig). Se renderiza condicionalmente si `onSpatialBehaviorChange` existe. No interfere con el motor de fase. |

**Conclusión:** No hay código muerto V2 en `PhaseControls.tsx`. El componente fue escrito desde cero para WAVE 7001 contra `PhaseConfigPro`, no es un upgrade de V2.

### 2.4 Gaps de UX detectados (no de conexión, sino de experiencia)

| Gap | Severidad | Descripción |
|---|---|---|
| **Sin feedback visual de la onda** | Alta | No hay preview gráfico de la distribución de fase. El usuario ajusta sliders a ciegas. MA3 muestra un diagrama de fase en tiempo real. |
| **Wings como input numérico seco** | Media | `wings` es un multiplicador de frecuencia — un slider con visualización de onda sinusoidal sería más intuitivo. |
| **Blocks sin indicador de agrupamiento** | Media | No se muestra cuántos bloques resultan dado el fixtureCount actual. El usuario no sabe si `blocks=4` con 12 fixtures = 3 bloques o 4. |
| **Shuffle sin preview de permutación** | Media | El slider de shuffle no muestra qué orden resultante produce la semilla actual. |
| **Sin presets** | Baja | No hay botones de preset ("Chase", "Breathing", "Radial", "Cascade"). MA3 tiene presets de MAtricks. |
| **Agrupación plana** | Baja | Los 7 controles están apilados linealmente sin jerarquía visual. No hay separación entre "forma de onda" (spread, wings, symmetry) y "caos" (shuffle, seed). |

---

## 3. Propuesta de Blueprint "Eurorack" (Estructura DOM para 340px)

### 3.1 Filosofía de diseño

Transformar `PhaseControls` de un panel plano de sliders a un **bastidor de sintetizador Eurorack** con 4 módulos visualmente distinguibles. Cada módulo es una "faceplate" con su propio header coloreado, knobs en lugar de sliders planos, y feedback visual integrado.

### 3.2 Árbol JSX esquemático

```jsx
<aside className="heph-phase-rack" style={{ width: '340px', flexShrink: 0 }}>
  
  {/* ═══ MÓDULO 0: HEADER + PRESET STRIP ═══ */}
  <div className="heph-rack__header">
    <span className="heph-rack__title">PHASE ENGINE</span>
    <div className="heph-rack__preset-strip">
      <button>CHASE</button>      {/* preset: spread=360, linear, wings=1, blocks=1 */}
      <button>BREATHING</button>  {/* preset: spread=180, mirror, wings=1, blocks=1 */}
      <button>RADIAL</button>     {/* preset: spread=360, center-out, wings=1, blocks=1 */}
      <button>CASCADE</button>    {/* preset: spread=720, linear, wings=2, blocks=4 */}
      <button>CHAOS</button>      {/* preset: spread=360, linear, wings=1, shuffle=0.8 */}
    </div>
  </div>

  {/* ═══ MÓDULO 1: WAVE SHAPER (forma de onda espacial) ═══ */}
  <div className="heph-rack__module heph-rack__module--wave">
    <div className="heph-rack__faceplate">
      <span className="heph-rack__module-title">WAVE SHAPER</span>
      
      {/* Mini-canvas SVG: preview de la onda espacial */}
      <svg className="heph-rack__wave-preview" viewBox="0 0 300 40">
        {/* Renderiza la forma de onda resultante de symmetry+wings+direction */}
        {/* Polilínea que muestra offset vs índice de fixture */}
      </svg>
      
      {/* Spread — Knob rotativo grande (estilo Eurorack) */}
      <div className="heph-rack__knob-row">
        <Knob label="SPREAD" min={0} max={1440} value={spreadDeg} unit="º" size="lg" />
        <div className="heph-rack__knob-readout">
          <span>{spreadDeg}º</span>
          <span className="heph-rack__knob-sub">{spreadPercent}%</span>
        </div>
      </div>
      
      {/* Symmetry — 3 botones icono (estilo toggle Eurorack) */}
      <div className="heph-rack__toggle-row">
        <span className="heph-rack__row-label">SYMMETRY</span>
        <div className="heph-rack__toggle-group">
          <button className="heph-rack__toggle" data-active={symmetry==='linear'}>📐</button>
          <button className="heph-rack__toggle" data-active={symmetry==='mirror'}>🪞</button>
          <button className="heph-rack__toggle" data-active={symmetry==='center-out'}>🎯</button>
        </div>
      </div>
      
      {/* Wings — Knob + visualización de ciclos */}
      <div className="heph-rack__knob-row">
        <Knob label="WINGS" min={1} max={8} value={wings} size="md" />
        <div className="heph-rack__knob-readout">
          <span>{wings}×</span>
          <span className="heph-rack__knob-sub">{wings===1?'single':`${wings} cycles`}</span>
        </div>
      </div>
      
      {/* Direction — Switch físico (estilo Eurorack) */}
      <div className="heph-rack__switch-row">
        <span className="heph-rack__row-label">DIRECTION</span>
        <ToggleSwitch value={direction} onLabel="FWD" offLabel="REV" />
      </div>
    </div>
  </div>

  {/* ═══ MÓDULO 2: BLOCK MATRIX (agrupamiento MAtricks) ═══ */}
  <div className="heph-rack__module heph-rack__module--blocks">
    <div className="heph-rack__faceplate">
      <span className="heph-rack__module-title">BLOCK MATRIX</span>
      
      {/* Blocks — Knob + visualización de columnas */}
      <div className="heph-rack__knob-row">
        <Knob label="BLOCKS" min={1} max={16} value={blocks} size="md" />
        <div className="heph-rack__knob-readout">
          <span>{blocks}</span>
          <span className="heph-rack__knob-sub">
            {blocks===1 ? 'individual' : `${Math.ceil(fixtureCount/blocks)} groups`}
          </span>
        </div>
      </div>
      
      {/* Visualización de columnas: grid de LEDs */}
      <div className="heph-rack__block-grid">
        {/* N LEDs que muestran qué fixtures comparten fase */}
        {/* Color = misma fase = mismo color */}
        {Array.from({ length: fixtureCount }).map((_, i) => (
          <div className="heph-rack__led" data-group={Math.floor(i / blocks)} />
        ))}
      </div>
    </div>
  </div>

  {/* ═══ MÓDULO 3: CHAOS ENGINE (shuffle determinista) ═══ */}
  <div className="heph-rack__module heph-rack__module--chaos">
    <div className="heph-rack__faceplate">
      <span className="heph-rack__module-title">CHAOS ENGINE</span>
      
      {/* Shuffle — Slider con visualización de permutación */}
      <div className="heph-rack__slider-row">
        <span className="heph-rack__row-label">SHUFFLE</span>
        <input type="range" min={0} max={1} step={0.01} value={shuffle} />
        <span className="heph-rack__value">{Math.round(shuffle*100)}%</span>
      </div>
      
      {/* Visualización: barras que muestran el orden resultante */}
      <div className="heph-rack__permutation-viz">
        {/* N barras verticales, altura = posición permutada */}
        {permutation.map((origIdx, i) => (
          <div className="heph-rack__bar" style={{ height: `${(origIdx/(N-1))*100}%` }} />
        ))}
      </div>
      
      {/* Seed — Knob numérico + botón randomize */}
      <div className="heph-rack__knob-row">
        <Knob label="SEED" min={1} max={9999} value={shuffleSeed} size="sm" />
        <button className="heph-rack__dice" title="Randomize seed">🎲</button>
      </div>
    </div>
  </div>

  {/* ═══ MÓDULO 4: SPATIAL BEHAVIOR (DNA, colapsable) ═══ */}
  <div className="heph-rack__module heph-rack__module--spatial">
    <div className="heph-rack__faceplate heph-rack__faceplate--collapsible">
      <span className="heph-rack__module-title">SPATIAL BEHAVIOR</span>
      <button className="heph-rack__collapse-btn">▾</button>
      
      <div className="heph-rack__spatial-grid">
        <button data-active={sb==='static'}>STATIC</button>
        <button data-active={sb==='absolute'}>ABSOLUTE</button>
        <button data-active={sb==='relative_offset'}>RELATIVE</button>
        <button data-active={sb==='spatial'}>3D</button>
      </div>
      <p className="heph-rack__spatial-hint">{activeHint}</p>
    </div>
  </div>

</aside>
```

### 3.3 Especificaciones de empaquetado para 340px

| Módulo | Altura estimada | Contenido | Color faceplate |
|---|---|---|---|
| **Header + Presets** | 48px | Título + 5 botones preset horizontales | `#1a1a1a` |
| **Wave Shaper** | 200px | SVG preview (40px) + Knob Spread (lg) + 3 toggles symmetry + Knob Wings + Switch direction | `#1e1a14` (tinte cálido) |
| **Block Matrix** | 120px | Knob Blocks + grid LED de agrupamiento | `#141a1e` (tinte frío) |
| **Chaos Engine** | 140px | Slider shuffle + viz permutación (30px) + Knob seed + dice | `#1e1414` (tinte rojo) |
| **Spatial Behavior** | 80px (colapsable a 32px) | 4 botones grid + hint | `#141e14` (tinte verde) |
| **Total expandido** | ~588px | | |
| **Total colapsado** | ~412px | (solo Spatial colapsado) | |

### 3.4 Componentes reutilizables a crear

| Componente | Descripción | Props |
|---|---|---|
| `Knob` | Dial rotativo SVG (estilo Eurorack). Drag vertical para cambiar valor. | `label, min, max, value, size, unit, onChange` |
| `ToggleSwitch` | Switch físico binario con animación. | `value, onLabel, offLabel, onChange` |
| `WavePreview` | SVG mini-canvas que renderiza la forma de onda resultante. | `symmetry, wings, direction, fixtureCount` |
| `BlockGrid` | Grid de LEDs coloreados por grupo. | `fixtureCount, blocks` |
| `PermutationViz` | Barras verticales mostrando orden permutado. | `shuffle, shuffleSeed, fixtureCount, blocks` |

### 3.5 Ventaja sobre MAtricks (GrandMA3)

| Feature | MA3 MAtricks | LuxSync Eurorack (propuesto) |
|---|---|---|
| Spread | Wings × offset fijo | `spreadDeg` continuo 0-1440° (4 ciclos) |
| Symmetry | Limitado (mirror, center) | 3 modos + preview visual en tiempo real |
| Wings | División dura | Multiplicador de frecuencia con `fract()` continuo |
| Blocks | Sí (MAtricks Blocks) | Sí + visualización LED de agrupamiento |
| Shuffle | No existe | **Exclusivo** — caos determinista controlado + seed reproducible |
| Presets | Fixed presets del fabricante | Presets custom + guardable en DNA del clip |
| Feedback visual | Diagrama estático | SVG dinámico: onda + permutación + agrupamiento |
| Dirección | Forward/Reverse | Forward/Reverse + visualización inmediata |

---

**Conclusión:** El motor `PhaseConfigPro` está **100% cableado** a la UI actual. No hay propiedades huérfanas ni código legacy V2 muerto. El gap es puramente de **experiencia visual**: falta feedback gráfico en tiempo real (forma de onda, permutación, agrupamiento) y jerarquía de módulos. La propuesta Eurorack empaqueta los 7 parámetros + spatial behavior en 4 módulos visualmente distinguibles dentro de 340px, con 5 componentes nuevos reutilizables.
