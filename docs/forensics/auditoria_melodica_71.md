# AUDITORÍA DE ENRUTAMIENTO MELÓDICO 7.1 — CANAL IZQUIERDO Y SOSTENIDO

**Alcance:** estático. Cruce de `LiquidEngine71.ts` + `LiquidEngineBase.ts` + `LiquidEnvelope.ts` con `techno.ts` y `latino.ts`.
**Síntoma:** Front L / Back L / Movers quedan "pegajosos" con voces y synths sostenidos.

---

## 0. Hallazgo previo que condiciona todo

1. **`LiquidStereoPhysics.ts` está deprecado** (su propio encabezado: "ESTE ARCHIVO SE ELIMINARÁ... Última referencia activa: LiquidStereoPhysics.test.ts"). La topología viva es `LiquidEngineBase.process()` → `LiquidEngine71.routeZones()`.
2. **Los `overrides41` NO se aplican en 7.1.** `LiquidEngineBase.ts:516` y `:540`:

   ```ts
   const effective = this.layout === '4.1' ? fuseProfileFor41(profile) : profile
   ```

   El motor 7.1 usa el **perfil base puro**. Toda la calibración anti-melaza que vive en `overrides41` (techno: cap de `envHighMid` a 0.60 + decay 0.45; latino: bloque "LOBOTOMÍA" WAVE 6071) es **código muerto para la vibe Club**. Cualquier análisis basado en esos overrides describe el motor 4.1, no el que ilumina tu club.

---

## 1. Topología del Left — qué consume cada canal (7.1 activo)

Fuente: `LiquidEngineBase.ts:776, 1929-1975`, `LiquidEngine71.ts:167-168`.

```
Front L = envSubBass( bands.subBass )                          ← sub crudo, sin resta
Back L  = envHighMid( midSynthInput )                           ← SÍ, el remanente mid:
           midSynthInput = max(0, lowMid·w_lm
                                  + cleanMidL·w_mid·(1 − vocalPenalty·0.80)
                                  − treble·backLTrebleSub − bass·backLBassSub)
           cleanMidL = max(0, mid − bass·dmz)   dmz: 0.55 techno / 0.30 resto
           vocalPenalty = (profile.id === 'techno-industrial') ? 0 : min(0.75, vocalSustainEMA·(1 − midDelta/EMA))
Mover L = envTreble( max(0, highMid·w_hm + treble·w_tr + mid·w_m) × isTonal )
           isTonal = flatness < moverLTonalThreshold ? 1 : 0   ← gate BINARIO, dura mientras dure la nota
Mover R = envVocal( max(0, mid − bass·sub − treble·moverRTrebleSub) )
```

- **Confirmación de la sospecha:** Back L consume directamente el remanente de `mid`/`lowMid` (con DMZ de bombo y subtractores, pero sin detección de transitorio). Mover L consume `highMid+treble+mid` crudos multiplicados por un gate tonal binario — **una vocal es tonal, así que pasa íntegra**.
- `vocalSustainEMA` (`LiquidEngineBase.ts:681-687`): EMA asimétrica del mid — sube con α=0.25, baja con α=0.04. Es la única señal "anti-vocal" que existe, y solo la consume Back L.
- **Latino hace swap físico espacial** (`LiquidEngine71.ts:167-168`): Mover L físico ← `envVocal` (El Galán), Mover R físico ← `envTreble` (La Dama). El gate tonal de Mover L queda en 0.45 (el 0.99 que lo desactiva vive en overrides41 → muerto en 7.1).

---

## 2. Parámetros de envelope — perfil base (lo que corre en 7.1)

### Techno (futuro Club)

| Envelope | decayBase | decayRange | squelchBase | squelchSlope | attackSlopeMin | anti-sustain |
|---|---|---|---|---|---|---|
| Front L `envSubBass` (techno.ts:33) | 0.30 | 0.166 | 0.0613 | 0.5788 | **— (0)** | — |
| Back L `envHighMid` (techno.ts:119) | 0.50 | 0.25 | 0.25 | 0.10 | **— (0)** | **maxBoost 0.0, adaptiveNoiseAlpha 0.0** (WAVE 8009.3) |
| Mover L `envTreble` (techno.ts:141) | 0.78 | 0.03 | 0.15 | 0.10 | **— (0)** | — |
| Mover R `envVocal` (techno.ts:79) | 0.70 | 0.05 | 0.15 | 0.10 | **— (0)** | — |

Pesos relevantes: `backLMidWeight 0.85`, `backLTrebleSub −0.3` (¡**suma** 30% de treble!), `moverLHighMidWeight 1.0 + moverLMidWeight 0.4`, `moverLTonalThreshold 0.40`.

### Latino

| Envelope | decayBase | decayRange | squelchBase | squelchSlope | attackSlopeMin | anti-sustain |
|---|---|---|---|---|---|---|
| Front L (latino.ts:45) | 0.50 | 0.08 | 0.18 | 0.50 | — | — |
| Back L `envHighMid` (latino.ts:132) | 0.14 | 0.03 | 0.20 | 0.10 | 0.02 | — |
| Mover L `envTreble` (latino.ts:156) | 0.72 | 0.05 | 0.12 | 0.15 | 0.02 | **startFrames 9999, flatVelMax 0.50** (WAVE 6050) |
| Mover R `envVocal` (latino.ts:83) | 0.72 | 0.05 | 0.08 | 0.15 | 0.02 | **startFrames 9999, flatVelMax 0.50** (WAVE 6050) |

Pesos: `moverLHighMidWeight 2.50, moverLTrebleWeight 1.50, moverLMidWeight 1.50` (×3 sobre techno — "Turbomegaboost" WAVE 6050).

**Nota:** no existe ningún parámetro llamado `sustainChoke` en los envelopes. El "Sustain Choke" que describe la directiva es la familia `sustainedSquelch*` + `adaptiveNoiseAlpha` de `LiquidEnvelope` (WAVE 4780). Su estado real se detalla a continuación.

---

## 3. El mecanismo anti-sustain — matemática y por qué no corta

El choke vive en `LiquidEnvelope.ts:278-310` (etapa 6). Diseño teórico:

```
isSustainCandidate = signal > dynamicGate && |velocity| <= flatVelocityMax
si sustainStart > 0 && sustainRise > 0 && candidate:
    sustainedFrames++
    tras startFrames: squelch += risePerFrame   (cap maxBoost)
    kickPower > squelch → dispara;  squelch creciente → asfixia la nota
    adaptiveNoiseAlpha: avgSignal persigue la nota → dynamicGate sube → gate cierra
```

### Por qué nunca se ejecuta — cuatro cortacircuitos

**C1. La rama está muerta en los dos perfiles.** La condición exige `sustainStart > 0 && sustainRise > 0`.
- Techno: `sustainedSquelchStartFrames` y `RisePerFrame` **no existen** en ningún envelope → `?? 0` → `0 > 0` es falso. Además Back L trae `sustainedSquelchMaxBoost: 0.0` y `adaptiveNoiseAlpha: 0.0` explícitos ("WAVE 8009.3: anti-freeze") — triple kill por si acaso.
- Latino Mover L/R: `startFrames: 9999` (227 s) + `flatVelocityMax: 0.50` (una velocidad de 0.5/frame es un transitorio, no "plano") + `RisePerFrame` ausente → `sustainRise > 0` falso. Los comentarios lo admiten: *"umbral absurdo, nunca considera plano"*, *"nunca penaliza notas sostenidas"*.
- Latino Back L (base): sin parámetros sustained → muerto. (La "LOBOTOMÍA" documentada vive en overrides41 → inaplicada en 7.1.)

**C2. El Velocity Gate considera "plano" como ataque.** `LiquidEnvelope.ts:195`: `isRisingAttack = velocity >= -0.005`. Una señal perfectamente constante (velocity = 0) **es ataque válido**. Y la compuerta principal (línea 328) exige `velocity >= attackSlopeMin` — que es **0 en los cuatro envelopes izquierdos de techno**. La única defensa contra señal plana en latino es `attackSlopeMin 0.02-0.03`, que bloquea la señal *totalmente* muerta pero no un vibrato: una voz a 5 Hz sobre `mid≈0.5` produce deltas de ±0.01-0.05/frame → cada fase ascendente del vibrato re-abre la compuerta (~10 veces/segundo) → visualmente continuo.

**C3. La única defensa viva — el EMA asimétrico — es derrotada por la modulación natural.** Sin choke, el gate solo cierra cuando `avgSignal` alcanza a la nota (líneas 206-212):

```
subida:  avgSignal ← avgSignal·0.98 + signal·0.02    (α=0.02, τ≈49 frames ≈ 1.1 s)
bajada:  avgSignal ← avgSignal·0.88 + signal·0.12    (α=0.12, τ≈8 frames)
```

- Nota perfectamente plana: convergencia completa tarda `ln(ε/(S−avg₀))/ln(0.98)` ≈ **4-6 segundos a brillo máximo** antes de que `dynamicGate` cruce `signal` y cierre.
- Nota real (vibrato/respiración): cada micro-valle usa la rama de bajada, que es **6× más rápida** → `avgSignal` se desinfla en los valles y nunca alcanza la cresta → **el gate no cierra nunca**. La asimetría diseñada para "detectar valles entre kicks" impide activamente el cierre frente a voz cantada.

**C4. El Back L Vocal Gate está bypasseado para techno.** `LiquidEngineBase.ts:1958-1959`:

```ts
const vocalPenalty = isTechnoProfile ? 0 : min(0.75, vocalSustainEMA·(1 − midDelta/EMA))
```

El único supresor vocal específico del canal melódico se desactiva para `profile.id === 'techno-industrial` — razonable para techno instrumental, **falso para la vibe Club (Tiësto/Karol G tienen voz dominante)**. Y en los perfiles donde vive, está capado a 0.75 y solo atenúa el componente mid ×0.80: nunca cierra el canal.

**Y el decay es inocente.** Las semi-vidas de los envelopes izquierdos son de 1-3 frames (decayBase 0.50-0.78 → 1.0→0.5→0.25...). La pegajosidad no es decay lento: es que `intensity = max(intensity, hit)` (línea 368) **re-fija el brillo al máximo en cada frame** mientras el gate permanezca abierto. El decay solo corre en los huecos que el sustain nunca deja existir.

---

## 4. Cadena causal del síntoma (resumen)

```
voz/synth sostenido (tonal)
  → isTonal=1 pasa el cross-filter de Mover L; mid residual entra a Back L (vocalPenalty=0 en techno)
  → velocity ≈ 0 cuenta como "ataque" (attackSlopeMin=0)         [C2]
  → anti-sustain muerto por omisión/teatro (C1) y maxBoost=0     [C1]
  → EMA asimétrico no converge sobre señal modulada               [C3]
  → gate abierto segundos (o indefinidamente con vibrato)
  → intensity re-fijada a max cada frame → zona "pegada"
  → cuando por fin cierra, el decay (rápido) sí corta — demasiado tarde
```

**Veredicto:** al canal melódico 7.1 no le falta velocidad de decaimiento — le falta un mecanismo de cierre de compuerta frente a señal tonal sostenida. El Sustain Choke (WAVE 4780) está implementado en el envelope pero neutralizado en ambos perfiles (omisión + ceros en techno, constantes-absurdas en latino), el gate de velocidad trata la planicie como ataque, y el único supresor vocal (WAVE 4812 M3) está excluido para el id de perfil que usará la vibe Club. Los `overrides41` que alguien calibró pensando en esto no se fusionan en 7.1 (`fuseProfileFor41` solo corre con layout `'4.1'`).
