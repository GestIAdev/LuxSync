# PLAN BOSS FINAL — Back R puro Snare/HiHat en Latino

Estado: Propuesta de análisis (sin cambios de código)
Fecha: 2026-05-16
Scope: Liquid 4.1 / Latino profile / BackRight (envSnare)

---

## 1) Objetivo operativo

Conseguir que Back R sea percusivo real (snare/hihat) con fuga vocal mínima y controlada, sin destruir el swing latino ni romper calibraciones estables en otros perfiles.

Objetivo cuantitativo inicial:
- SNR percusivo en Back R > 2.0
- Falsos positivos vocales < 5%
- Falsos negativos de snare real < 5%

Nota: No se propone uso de aleatoriedad ni simulaciones no deterministas en runtime. Todo el plan es determinista y medible.

---

## 2) Diagnóstico resumido

Back R nace del transient shaper y pasa por envSnare.

Arquitectura relevante:
- Base: `hybridSnare` se construye desde deltas espectrales y penalización de mid.
- Perfil latino actual: `percMidSubtract=2.0`, `percGate=0.065`, `percBoost=4.0`.
- Envelope snare latino: `gateOn=0.28`, `decayBase=0.45`, `crushExponent=1.0`.

Riesgo acústico principal:
- La voz en latino mete transientes en bandas altas (consonantes, sibilancias, artefactos de autotune).
- Esos eventos pueden parecer hi-hat al detector y cruzar gate si el contexto no discrimina sustain vocal.

---

## 3) Hipótesis técnicas a validar

H1. La mayor parte de la fuga vocal ocurre en ventanas de voz sostenida con micro-transientes repetitivos.

H2. Penalizar Back R cuando el sistema detecta "sustain vocal" reducirá fuga sin matar snare real.

H3. Endurecer la resta de mid en transient shaper (`percMidSubtract`) mejora separación con bajo riesgo.

H4. Si H2+H3 no alcanza objetivo, se requiere gate adaptativo por contexto espectral o ajuste de envelope 100% latino.

---

## 4) Matriz de estrategias (sin tocar código aún)

### Estrategia A — Sustain penalty en Back R (prioridad alta)

Idea:
- Reutilizar detector de vocal sostenida ya existente para penalizar apertura de Back R durante frases vocales.

Modelo propuesto:
```
si vocalEMA > umbral:
	gateEfectivo = gateBase * (1 + k * (vocalEMA - umbral))
```

Rango de barrido:
- umbral: 0.16, 0.18, 0.20
- k: 2.0, 3.0, 4.0

Beneficio esperado:
- Reducción fuerte de fuga vocal sostenida.

Riesgo:
- Lag de liberación puede recortar ataques válidos inmediatamente después de una frase.

---

### Estrategia B — Endurecer `percMidSubtract` (prioridad alta)

Idea:
- Aumentar rechazo de contenido medio antes del envSnare.

Barrido propuesto:
- `percMidSubtract`: 2.0 (baseline), 2.5, 3.0, 3.5
- `percExponent`: 0.6 (baseline), 0.7, 0.8

Beneficio esperado:
- Menos contaminación vocal por cuerpo medio.

Riesgo:
- Perder caja "gorda" cuando el snare legítimo tiene componente mid.

---

### Estrategia C — Gate adaptativo por contexto espectral (prioridad media)

Idea:
- Elevar gate cuando hay firma vocal probable (co-ocurrencia mid+treble sostenida), mantener gate cuando hay transiente percutivo claro.

Modelo:
```
scoreVoz = f(mid, highMid, treble, sustainEMA)
gateEfectivo = gateBase + alpha * scoreVoz
```

Barrido:
- alpha: 0.02, 0.04, 0.06

Beneficio:
- Más selectividad contextual.

Riesgo:
- Falsos positivos cuando instrumentos armónicos comparten firma con voz.

---

### Estrategia D — Envelope snare latino dedicado (prioridad media)

Idea:
- Mantener base global intacta y afinar envelope snare sólo para latino.

Barrido sugerido:
- `gateOn`: 0.28, 0.30, 0.32
- `decayBase`: 0.45, 0.40, 0.35
- `crushExponent`: 1.0, 1.1, 1.2
- `maxIntensity`: 0.85, 0.80

Beneficio:
- Control fino del carácter del TAcka.

Riesgo:
- Matar swing si decay queda demasiado corto.

---

### Estrategia E — Filtro temporal de transiente (prioridad baja, último recurso)

Idea:
- Distinguir evento percutivo real por caída rápida vs. voz sostenida por caída lenta.

Modelo:
```
decayRate = (x[t] - x[t-n]) / max(x[t-n], eps)
si decayRate es bajo y sustainEMA alto => penalizar apertura
```

Beneficio:
- Muy robusto contra voz sostenida.

Riesgo:
- Mayor complejidad y costo cognitivo de mantenimiento.

---

## 5) Plan de simulación y cálculo

### Fase 0 — Baseline (obligatoria)

Construir baseline con configuración actual y extraer:
- Distribución de energía Back R
- Distribución de eventos en segmentos vocales vs percutivos
- Métricas de fuga/fallo

Métricas:
- Precision percusiva = TP / (TP + FP)
- Recall percusivo = TP / (TP + FN)
- Vocal leak ratio = Energía vocal detectada en Back R / Energía total Back R
- SNR percutivo = Energía percutiva / Energía vocal en Back R

---

### Fase 1 — Barrido rápido (A + B)

Ejecutar grid determinista de bajo costo:
- A: 3 umbrales x 3 pendientes = 9 variantes
- B: 4 `percMidSubtract` x 3 `percExponent` = 12 variantes
- A+B combinadas: 9 x 12 = 108 variantes

Selección top-10 por criterio:
- Maximizar SNR
- Restringir FN < 5%
- Mantener dinámica (p95 de BackR no colapsada)

---

### Fase 2 — Barrido de envelope (D)

Sobre top-10 de fase 1:
- Probar 3x3x3x2 = 54 variantes por candidato
- Total tope: 540 corridas

Objetivo:
- Recuperar musicalidad del TAcka sin devolver fuga vocal.

---

### Fase 3 — Stress cross-género

Validar ganadores en:
- Reggaetón dembow denso
- Reggaetón minimal
- Salsa y timba
- Urbano con voz muy procesada

Criterio de salida:
- Variabilidad inter-género controlada
- Sin regressions severas en golpes reales

---

## 6) Propuesta de ejecución por hitos

Hito 1:
- Baseline + barrido A/B
- Entregable: ranking top-10 + curvas SNR/FN/FP

Hito 2:
- Envelope tuning sobre top-10
- Entregable: top-3 finalistas con perfil sonoro descrito

Hito 3:
- Stress cross-género + recomendación final
- Entregable: set de parámetros candidato para aprobación de arquitectura

---

## 7) Recomendación inicial (sin implementación)

Orden recomendado:
1. Estrategia A (sustain penalty)
2. Estrategia B (`percMidSubtract`)
3. Estrategia D (envelope dedicado)
4. Estrategia C (adaptativo espectral) sólo si aún hay fuga
5. Estrategia E como último recurso

Razonamiento:
- A y B atacan la fuga con menor riesgo arquitectónico.
- D recupera carácter musical si A/B endurecen demasiado.
- C/E añaden complejidad y deberían entrar sólo si el objetivo no se cumple.

---

## 8) Criterios de aceptación para pasar a código

Se aprueba implementación sólo si en simulación:
- SNR percutivo >= 2.0
- Fuga vocal <= 5%
- FN percusivo <= 5%
- Sin pérdida perceptual de swing en evaluación musical

Si no se cumplen, iterar parámetros sin tocar lógica estructural.

---

## 9) Preguntas para el arquitecto

1. ¿Objetivo de pureza vocal es <=5% o más estricto (<=3%)?
2. ¿Se prioriza cero fuga o conservar swing aun con fuga mínima?
3. ¿Se acepta perfil envelope snare exclusivo de latino si mejora significativamente?
4. ¿Presupuesto de complejidad: preferencia por A/B/D y evitar C/E salvo necesidad?

---

Cierre:
Este plan prioriza mitigación realista, medible y reversible. La ruta A+B+D permite atacar el boss final (voz en Back R) sin romper la arquitectura ni sacrificar la calibración histórica de otros géneros.
