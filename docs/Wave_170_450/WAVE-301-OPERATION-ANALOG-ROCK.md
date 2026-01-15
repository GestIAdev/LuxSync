# 🎸 WAVE 301 - OPERATION ANALOG ROCK

## 📅 Fecha: 6 de Enero 2026
## 👥 Equipo: Gemini (Arquitecto) + PunkOpus (Developer) + Radwulf (Comandante)

---

## 🔥 FILOSOFÍA: DE DIGITAL A ANALÓGICO

El enfoque digital de WAVE 300 (triggers, gates, thresholds) **FALLÓ** en Pop-Rock.
La música pop es demasiado densa y comprimida. Intentar limpiar la señal **mata la dinámica**.

### La Revelación Punk
> "El rock es sucio y analógico. Nosotros somos PUNKS."

**Volver al pasado para conquistar el futuro.**

En lugar de buscar "el golpe perfecto" con gates digitales, medimos **PRESIÓN**.
Simulamos el comportamiento de equipos analógicos de iluminación de los 70s/80s.

---

## 📐 ESPECIFICACIONES TÉCNICAS

### 1. 🔥 FRONT PARs: EL FILAMENTO INCANDESCENTE

**Filosofía:** No es un estrobo. Es una bombilla halógena gigante que se CALIENTA con el bajo.

- **Input:** `normalizedBass`
- **Curva Gamma:** `target = bass^2.0` (expande picos, limpia suelo)
- **Inercia Térmica:**
  - **Calentar (Heat):** LERP 0.4 - Rápido pero no instantáneo
  - **Enfriar (Cool):** LERP 0.1 - MUY lento, la luz "respira"

**Resultado:** El bajo de Michael Jackson **RESPIRA**, nunca se apaga del todo.

```
BASS 0.5 → TARGET 0.25 (gamma²)
Si target > voltage: CALENTAR (lerp 0.4)
Si target < voltage: ENFRIAR (lerp 0.1)
```

### 2. ⚡ BACK PARs: LA CHISPA DE ALTO VOLTAJE

**Filosofía:** Blinders que SALTAN con agudos agresivos. Afterimage en la retina.

- **Input:** `normalizedTreble`
- **Trigger Suave (Anti-voz):**
  - `treble > 0.30` (la voz no llega tan alto)
  - `trebleDelta > 0.10` (subida súbita = golpe)
- **Comportamiento:**
  - Si dispara: `intensity = 1.0` (FLASHAZO)
  - Si no: Decay 0.05 por frame (afterimage lento)

**Resultado:** Snare/Crash disparan flash cegador. La voz NO dispara nada.

### 3. 🎸 MOVERS: EL CABEZAZO

**Filosofía:** Fuerza bruta mecánica. La guitarra MUEVE los movers.

- **Input:** `normalizedMid`
- **Mapeo Directo:** `intensity = mid^1.5`
- **Smoothing:** LERP 0.3 (reactivo pero no espasmódico)

**Resultado:** Si hay guitarra, hay luz. PUNTO. Sin suavizado digital excesivo.

---

## 🔄 DIFERENCIAS CON WAVE 300 (DIGITAL)

| Aspecto | WAVE 300 (Digital) | WAVE 301 (Analógico) |
|---------|-------------------|---------------------|
| Front PARs | Gate + Transiente + Histéresis | Curva Gamma + Inercia Térmica |
| Back PARs | MID + Validación Treble | Treble Delta (subida súbita) |
| Movers | Gate + Decay lento | Mapeo directo + LERP suave |
| Filosofía | Buscar el golpe perfecto | Medir presión/voltaje |
| Complejidad | ~500 líneas, 15+ constantes | ~270 líneas, 8 constantes |

---

## 📁 ARCHIVOS MODIFICADOS

### `src/hal/physics/RockStereoPhysics.ts`
- **REESCRITO COMPLETAMENTE** (de 506 → 269 líneas)
- Nueva estructura con estado analógico:
  - `filamentVoltage` (voltaje del filamento)
  - `sparkCharge` (carga de la chispa)
  - `headbangForce` (fuerza del cabezazo)
  - `previousTreble` (para calcular delta)

### `src/core/reactivity/SeleneLux.ts`
- Actualizado tipo `rockOverrides.debug` para formato ANALOG:
  - `mode: 'ANALOG'`
  - `frontVoltage`, `backCharge`, `moverForce`
- Actualizado logging para mostrar voltajes en lugar de transientes

---

## 🎯 CONSTANTES DEL MOTOR ANALÓGICO

```typescript
// FILAMENTO (Front PARs)
FILAMENT_GAMMA = 2.0        // Curva de respuesta
FILAMENT_HEAT_RATE = 0.4    // Velocidad de calentamiento
FILAMENT_COOL_RATE = 0.1    // Velocidad de enfriamiento (LENTO)

// CHISPA (Back PARs)
SPARK_TREBLE_THRESHOLD = 0.30   // Umbral de treble
SPARK_DELTA_THRESHOLD = 0.10    // Subida súbita necesaria
SPARK_DECAY_RATE = 0.05         // Decay lento (afterimage)

// CABEZAZO (Movers)
HEADBANG_GAMMA = 1.5        // Curva de respuesta
// LERP interno: 0.3
```

---

## 📊 EJEMPLO DE LOG

```
[AGC TRUST 🎸ANALOG] IN[B:0.65, M:0.45, T:0.28] -> ⚡ VOLTS[Filament:0.42, Spark:0.15, Force:0.28] -> 💡 OUT[F:0.42, B:0.15, M:0.28]
```

- **IN:** Valores de entrada (Bass, Mid, Treble)
- **VOLTS:** Estado del simulador analógico
- **OUT:** Intensidades finales de fixtures

---

## 🎵 COMPORTAMIENTO ESPERADO

### Billy Jean (Michael Jackson)
- **Front PARs:** Pulsan suavemente con el bajo, NUNCA se apagan del todo
- **Back PARs:** Flash en cada golpe de caja (delta de treble)
- **Movers:** Siguen la melodía con movimiento fluido

### Thunderstruck (AC/DC)
- **Front PARs:** Bombo pesado, filamento caliente todo el rato
- **Back PARs:** Cegadoras en cada golpe de caja/crash
- **Movers:** Clavados arriba siguiendo la guitarra de Angus

---

## ✅ ESTADO

- [x] Diagnóstico completado (WAVE 300 era demasiado digital)
- [x] Diseño de arquitectura analógica (Blueprint de Gemini)
- [x] Implementación de RockStereoPhysics v2.0
- [x] Integración con SeleneLux
- [x] Build exitoso
- [ ] Test con Billy Jean
- [ ] Test con Thunderstruck

---

## 📝 NOTAS DEL DESARROLLADOR

> "506 líneas de lógica digital → 269 líneas de simulación analógica.
> A veces, el pasado es el futuro."
> 
> — PunkOpus, 6 de Enero 2026

El rock NO necesita precisión digital. El rock necesita **CALOR**.
Un filamento que se calienta. Una chispa que ciega. Un cabezazo que rompe.

**ESTO ES PUNK.**
