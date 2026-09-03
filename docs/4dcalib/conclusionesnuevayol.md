
### 📂 DOCUMENTO DE AFINACIÓN - V4 (Nueva Yol — Bad Bunny "El Conejo Malo")

**Objetivo:** Análisis del log `nuevayol.md` — sabro-son cubano → coro → denbow. El primer caso con instrumentación acústica/latina.

#### 🎺 12. El ADN de Nueva Yol — Tres Mundos en Una Canción

Nueva Yol es un Frankenstein musical perfecto para calibrar:
- **Fase A (Sabro-son cubano, líneas 1-116):** Trompetas, trombones, congas. AGC altísimo (5.38x → 4.35x). Sin caja electrónica.
- **Fase B (Coro de voces + mini buildup, líneas 113-123):** "Si te quieres divertir..." con pad ambiental increscendo. Transición suave.
- **Fase C (Denbow, líneas 117-1324):** Beat electrónico latino rápido. AGC bajo (1.4-1.6x). Snares electrónicos + sub-bajo masivo. BPM estabiliza en ~117.

Secciones MSST recorridas: `buildup → verse → breakdown → buildup → chorus → breakdown → chorus → breakdown → verse → drop → verse → chorus → verse → chorus → verse → textural_drop → drop → chorus → buildup → verse → chorus → drop → textural_drop → drop → chorus → buildup → chorus → verse → buildup → chorus → verse → chorus → drop → chorus → buildup → drop → chorus → buildup → chorus → drop → chorus → textural_drop → buildup → chorus → verse → textural_drop → chorus → verse → chorus → verse → chorus → buildup → chorus → verse → chorus → verse → chorus → verse → chorus → verse → chorus`

#### 🎷 13. Fase A — El Sabro-Son Limpio (AGC 5.38x, CERO Falsos)

**Líneas 1-116:** La intro cubana con trompetas y congas.

| Métrica | Valor | Comentario |
|---------|-------|------------|
| SnareE | 0.040 → 0.000 | **Casi cero durante toda la intro** |
| WNS | 0.000 | Sin ruido broadband |
| Veto | 0.101 (constante) | Veto base, sin activación |
| OutSnare | 0.000 | **CERO disparos — perfecto** |
| OutKick | 0.800 c/beat | Tempo tracking correcto |
| AGC | 5.38x → 4.35x | Compresión altísima |

**Hallazgo crítico:** A pesar de AGC 5.38x (el más alto de todos los logs analizados), **NO hay falsos positivos**. ¿Por qué?

**Las trompetas/congas NO sangran en la crack band (2-5kHz).** Su energía está concentrada en medios-graves (200Hz-2kHz). El `SnareE` se queda en 0 porque la banda de detección de caja está vacía. El AGC amplifica todo 5x, pero 5 × 0 = 0.

**Esto es lo OPUESTO a Brejcha:** En Brejcha, el piano tenía armónicos en 2-5kHz que mantenían `SnareE` en 0.40-0.66. En Nueva Yol, las trompetas no tienen contenido ahí. **El AGC alto NO es problema por sí solo — el problema es AGC alto + contenido en la crack band.**

#### 🎤 14. Fase B — Coro de Voces + Pad (Transición Limpia)

**Líneas 113-123:** El coro "si te quieres divertir" con pad increscendo.

- `SnareE`: 0.133 → 0.001 (las voces no tienen crack band energy)
- `WNS`: 0.000
- `OutSnare`: 0.000 (correcto, no hay caja)
- `BassE`: sube de 0.189 → 0.606 (el pad/buildup sube el bajo)
- `OutKick`: 0.800 (el sistema sigue el tempo)

**Las voces humanas no confunden al detector.** El formante vocal está en 200-1000Hz, no en la crack band. El pad sintético tampoco. Transición perfecta.

#### 🥁 15. Fase C — El Denbow (AGC 1.4x, Detección Intensa)

**Líneas 117-1324:** El denbow electrónico de Bad Bunny.

**Patrón dominante del denbow:**
- `SnareE` oscila violentamente: 0.001 → 1.000 → 0.300 → 0.800
- `WNS` frecuentemente alto (0.4-1.0) en los onsets reales
- `Veto` 0.3-1.0 (variable, pasa el filtro)
- `Flux` 0.15-0.45 en onsets
- `BassE` 0.6-0.9 (sub-bajo masivo constante)
- `OutKick` 0.800 en casi todos los frames

**El denbow dispara MUCHO y CORRECTO.** Los snares electrónicos del denbow son ráfagas de ruido broadband — exactamente lo que `WNS` fue diseñado para detectar. Path 1 (WNS-confirmed) acierta una y otra vez.

**Patrón "SnareE = 1.000 plateau":** En los redobles de denbow, `SnareE` satura a 1.000 durante 3-8 frames consecutivos. Ejemplos:
- Líneas 448-465: SnareE 1.000 durante 8 frames
- Líneas 526-528: SnareE 1.000 durante 3 frames
- Líneas 746-749: SnareE 1.000 durante 4 frames
- Líneas 862-866: SnareE 1.000 durante 5 frames
- Líneas 990-994: SnareE 1.000 durante 5 frames
- Líneas 1074-1079: SnareE 1.000 durante 6 frames
- Líneas 1150-1156: SnareE 1.000 durante 7 frames

**Esto NUNCA ocurrió en Brejcha** (donde SnareE máx era 0.66) ni en Anyma (donde SnareE máx era 0.88 esporádico). El denbow satura la crack band porque sus snares son electrónicos puros, concentrados exactamente en 2-5kHz, y muy fuertes.

#### ⚡ 16. EL HALLAZGO CRÍTICO — Path 3 es IGUAL en Falsos (Brejcha) y Reales (Denbow)

**Este es el descubrimiento más importante del análisis.** Examinemos los onsets de Path 3 (WNS ≈ 0, SnareE alto, Veto moderado) en Nueva Yol:

| Línea | SnareE | RawΔ | Flux | WNS | Veto | Contexto |
|-------|--------|------|------|-----|------|----------|
| 190 | 0.704 | 0.315 | 0.304 | 0.000 | 0.509 | Denbow stab |
| 323 | 0.632 | 0.349 | 0.346 | 0.000 | 0.545 | Denbow snare |
| 335 | 0.952 | 0.358 | 0.244 | 0.000 | 0.524 | Denbow snare |
| 422 | 0.902 | 0.367 | 0.282 | 0.000 | 0.563 | Denbow snare |
| 584 | 1.000 | 0.278 | 0.149 | 0.000 | 0.516 | Denbow snare |
| 600 | 0.776 | 0.126 | 0.366 | 0.000 | 0.660 | Denbow snare |
| 763 | 0.657 | 0.142 | 0.270 | 0.001 | 0.549 | Denbow snare |
| 806 | 1.000 | 0.178 | 0.238 | 0.000 | 0.441 | Denbow snare |
| 816 | 0.931 | 0.152 | 0.167 | 0.000 | 0.316 | Denbow snare |
| 921 | 0.751 | 0.354 | 0.176 | 0.000 | 0.497 | Denbow snare |
| 997 | 0.854 | 0.129 | 0.177 | 0.000 | 0.515 | Denbow snare |
| 1080 | 0.782 | 0.344 | 0.163 | 0.000 | 0.387 | Denbow snare |
| 1208 | 0.974 | 0.547 | 0.337 | 0.000 | 0.391 | Denbow snare |

**Ahora comparemos con los falsos de Brejcha (de conclusionesbrejcha1.md):**

| Caso | SnareE | RawΔ | Flux | WNS | Veto |
|------|--------|------|------|-----|------|
| Brejcha (falso) | 0.40-0.66 | 0.14-0.33 | 0.15-0.23 | 0.000 | 0.30-0.48 |
| Denbow (real) | 0.63-1.00 | 0.13-0.55 | 0.15-0.37 | 0.000 | 0.32-0.66 |

**¡La firma es CASI IDÉNTICA!** El sistema NO puede distinguir entre:
- Brejcha: piano (SnareE 0.50) + kick amplificado (Flux 0.20) = FALSO
- Denbow: snare electrónico sin HF (SnareE 0.85, Flux 0.25, WNS 0) = REAL

**Conclusión devastadora para la Solución 1 (Exigir WNS en Path 3):** Si exigimos `WNS > 0` en Path 3, **MATAMOS la detección de denbow**. Los snares electrónicos del denbow frecuentemente tienen `WNS = 0` porque su energía está concentrada en la crack band, no distribuida broadband. Esto los hace indistinguibles de los falsos de Brejcha.

#### 📊 17. Tabla Comparativa Triple — Brejcha vs Anyma vs Nueva Yol

| Métrica | Brejcha (break) | Anyma (caos) | Nueva Yol (intro) | Nueva Yol (denbow) |
|--------|-----------------|--------------|--------------------|--------------------|
| Género | Minimal techno | Melodic techno | Sabro-son cubano | Denbow electrónico |
| AGC | 4.0x (alto) | 3.0-4.0x (medio) | 5.38x (máximo) | 1.4-1.6x (bajo) |
| SnareE en "piso" | 0.40-0.66 (piano) | 0.30-0.80 (synth) | 0.000 (trompetas) | 0.001-1.000 (variable) |
| WNS | 0.000 (siempre) | 0.000-1.000 (variable) | 0.000 (siempre) | 0.000-1.000 (variable) |
| Path que falla | Path 3 (Energy) | Path 3 + Path 2 | NINGUNO ✅ | Path 3 (pero son reales) |
| Falsos por segundo | ~2 (cada kick) | ~0.5 (esporádicos) | 0 | 0 (Path 3 dispara reales) |
| Causa raíz | AGC 4x + piano floor | Synth bleed + sweeps | N/A (limpio) | N/A (correcto) |
| Veto efectivo | NO (Flux del kick) | SÍ para muro, NO para stabs | N/A | SÍ (pasa legítimamente) |

#### 🎯 18. Re-evaluación de las Soluciones Propuestas

**Solución 1: Exigir WNS en Path 3** ❌ **DESCARTADA**
- Matría la detección de denbow (Nueva Yol)
- Los snares electrónicos del denbow tienen WNS=0 pero son reales
- No hay forma de distinguir "WNS=0 porque es piano+kick" de "WNS=0 porque es snare electrónico sin HF"

**Solución 2: Umbrales AGC-Aware** ✅ **GANA FUERTE APOYO**
- Brejcha falsos: AGC 4.0x → threshold debería subir
- Nueva Yol reales: AGC 1.4x → threshold se mantiene bajo
- Anyma stabs: AGC 3.0x → threshold intermedio
- **La correlación es perfecta:** AGC alto = más probabilidad de falso, AGC bajo = más probabilidad de real
- Implementación: `finalSnareThreshold = baseThreshold × (1 + (agcGain - 1) × k)` donde k es un factor de escala a calibrar

**Solución 3: Suelo de Energía Adaptativo** ⚠️ **PARCIALMENTE PROMETEDORA**
- Brejcha: SnareE piso 0.40-0.66 (piano), salto del kick no supera `piso + 0.20`
- Nueva Yol denbow: SnareE salta de 0.001 a 1.000 (salto masivo, supera cualquier piso relativo)
- **Problema:** En Anyma, los stabs también saltan de 0.30 a 0.80 (salto 0.50), lo que superaría `piso + 0.20`. No distingue suficientemente.
- **Mejor combinación:** Suelo adaptativo + AGC-aware juntos

**NUEVA Solución 4: Ratio SnareE/BassE como discriminador** 💡 **PROPUESTA**
- Brejcha falsos: SnareE 0.50, BassE 0.35 (piano suave) → ratio 1.4
- Nueva Yol denbow: SnareE 0.85, BassE 0.80 (sub-bajo masivo) → ratio 1.06
- Anyma stabs: SnareE 0.60, BassE 0.65 → ratio 0.92
- **No distingue bien** — los ratios se solapan. Descartada.

**NUEVA Solución 5: SnareE absoluto como gate** 💡 **PROPUESTA**
- Brejcha falsos: SnareE MÁX 0.66 (nunca satura)
- Nueva Yol denbow: SnareE frecuentemente 0.85-1.000 (satura)
- Anyma stabs: SnareE 0.46-0.78 (no satura)
- **Idea:** Si SnareE > 0.80, Path 3 es casi seguro real. Si SnareE 0.40-0.70, es ambiguo (más probable falso si AGC alto).
- **Combinación ganadora:** `Path 3 válido si (SnareE > 0.80) OR (SnareE > 0.40 AND AGC < 2.5x)`

#### 🏆 19. La Solución Recomendada — Gate Híbrido AGC + SnareE

Basado en los tres logs analizados, el gate óptimo para Path 3 (Energy Bypass) sería:

```
Path 3 válido si:
  (SnareE > 0.80)                          // Snare saturado = casi seguro real (denbow)
  OR
  (SnareE > 0.40 AND agcGain < 2.5x)       // Snare moderado + AGC bajo = probable real
  OR
  (SnareE > 0.40 AND WNS > 0.15)           // Snare moderado + algo de WNS = confirmado
```

**Verificación contra los tres logs:**

| Caso | SnareE | AGC | WNS | ¿Pasa el gate? | ¿Es real? | ¿Correcto? |
|------|--------|-----|-----|----------------|-----------|------------|
| Brejcha falso | 0.50 | 4.0x | 0.000 | NO (0.50 < 0.80, AGC > 2.5, WNS < 0.15) | Falso | ✅ Bloqueado |
| Anyma stab | 0.60 | 3.0x | 0.000 | NO (0.60 < 0.80, AGC > 2.5, WNS < 0.15) | Ambiguo | ✅ Conservador |
| Denbow snare | 0.95 | 1.5x | 0.000 | SÍ (SnareE > 0.80) | Real | ✅ Detectado |
| Denbow snare | 0.65 | 1.5x | 0.000 | SÍ (SnareE > 0.40 AND AGC < 2.5) | Real | ✅ Detectado |
| Anyma WNS-onset | 0.50 | 3.0x | 0.40 | SÍ (WNS > 0.15) | Real | ✅ Detectado |
| Brejcha WNS-onset | 0.50 | 4.0x | 0.30 | SÍ (WNS > 0.15) | Real | ✅ Detectado |

**El gate híbrido distingue correctamente los tres géneros.** Los falsos de Brejcha se bloquean, los reales de denbow pasan, los confirmados por WNS siempre pasan.

#### 🎵 20. Lo que SÍ funciona perfecto en Nueva Yol

1. **Intro de sabro-son:** CERO falsos positivos con AGC 5.38x. El detector de caja correctamente identifica que trompetas/congas = no snare. **Esto valida que el problema NO es el AGC por sí solo.**
2. **Coro de voces:** Las voces humanas no confunden al detector. SnareE se queda en 0.
3. **WNS en denbow:** Los snares electrónicos del denbow son ráfagas de ruido broadband. WNS los detecta perfectamente. Path 1 acierta una y otra vez.
4. **Tracking de BPM:** El sistema pasa de 123 BPM (freewheel, oracle 161) a 117 BPM (locked, conf 0.86) sin problemas.
5. **OutKick en denbow:** El sub-bajo masivo del denbow dispara OutKick en casi todos los frames. Esto es correcto — el bajo ES el ritmo en denbow.
6. **Sustain choke:** Después de cada onset, OutSnare decae en 2-3 frames incluso cuando SnareE se mantiene en 1.000. El choke funciona.

#### ⚠️ 21. Lo que NO funciona (casos puntuales)

1. **Path 3 sin WNS en denbow (¡pero son reales!):** Los snares de denbow sin contenido HF (WNS=0) disparan Path 3. Son reales, pero el sistema no puede confirmarlo. **Si se aplica un gate demasiado agresivo, se pierden.**
2. **SnareE saturado a 1.000 durante 5-8 frames:** En los redobles de denbow más intensos, SnareE satura. El sistema dispara en el primer frame y decae correctamente, pero la saturación podría causar problemas si el TCT no se rearma entre redobles.
3. **BassE 0.90+ constante:** El sub-bajo del denbow mantiene BassE cerca de 1.000. OutKick dispara en cada frame. Esto satura la zona Front R, pero es correcto para el género.

#### 📊 22. Comparativa Final — Los Tres Géneros

| Pregunta | Brejcha | Anyma | Nueva Yol |
|----------|---------|-------|-----------|
| ¿AGC alto causa falsos? | SÍ (4x + piano) | PARCIAL (3x + synth) | NO (5x pero sin crack band) |
| ¿Path 3 es el problema? | SÍ (falsos) | SÍ (ambiguo) | NO (dispara reales) |
| ¿WNS distingue real de falso? | SÍ (WNS=0 = falso) | PARCIAL | NO (WNS=0 = real en denbow) |
| ¿Veto funciona? | NO (Flux del kick) | SÍ para muro | SÍ (pasa legítimamente) |
| ¿SnareE satura a 1.000? | NUNCA (máx 0.66) | Raramente (máx 0.88) | FRECUENTE (denbow) |
| ¿Gate AGC-aware funcionaría? | SÍ (bloquea falsos) | SÍ (bloquea stabs) | SÍ (permite reales) |

#### 🎯 23. Conclusión Maestra — El Gate Híbrido es el Camino

**El análisis de tres géneros (Brejcha minimal, Anyma melodic techno, Nueva Yol denbow/sabro-son) converge en una conclusión:**

1. **WNS por sí solo NO puede gatear Path 3** — el denbow lo demuestra. Hay snares reales con WNS=0.
2. **AGC es el mejor discriminador** — cuando AGC es alto (>2.5x), Path 3 es sospechoso. Cuando es bajo, Path 3 es confiable.
3. **SnareE absoluto ayuda** — SnareE > 0.80 es casi seguro real (denbow saturado). SnareE 0.40-0.70 es la zona ambigua donde AGC decide.
4. **El gate híbrido `(SnareE > 0.80) OR (SnareE > 0.40 AND AGC < 2.5x) OR (WNS > 0.15)`** distingue correctamente los tres géneros.

**Próximo paso:** Recolectar más géneros (silenceredoubleanyma.md pendiente) para validar el gate híbrido antes de implementar fixes.

---
