# WAVE 4935 — Plan Arquitectónico Back R / Back L con Harmonic Rejection Gate

Estado: Propuesta para revisión arquitectónica
Fecha: 2026-05-28
Scope: Liquid 4.1 / 7.1 / perfil Latino / BackRight y BackLeft percusivos

---

## 1) Decisión propuesta

La vía elegida no es endurecer gates ni tunear envelopes como solución principal.

La vía elegida es introducir un discriminador estructural antes del envSnare: un Harmonic Rejection Gate.

Idea central:
- Back R y Back L no deben responder a cualquier transiente brillante.
- Deben responder sólo a eventos con firma de percusión corta y baja coherencia armónica.
- La voz debe ser rechazada no por volumen, sino por naturaleza espectro-temporal.

Conclusión operativa:
- La fuga vocal no es un problema de umbral solamente.
- Es un problema de clasificación incompleta del evento de entrada.
- Si el detector sigue confundiendo consonantes, sibilancias y bordes vocales con hi-hat/snare, cualquier ajuste de gate seguirá siendo un parche.

---

## 2) Por qué se descarta el plan anterior como solución raíz

El plan anterior era útil como batería de tuning, pero no como arquitectura base.

### Estrategia A — Sustain penalty

Valor:
- Puede reducir fuga vocal sostenida.

Problema estructural:
- Actúa después de que el evento ya fue interpretado como percusivo.
- Penaliza contexto, pero no identifica la naturaleza real del transiente.

Veredicto:
- Puede quedar como capa secundaria de refinamiento, no como núcleo.

### Estrategia B — Mid subtraction más agresivo

Valor:
- Ayuda a sacar cuerpo vocal del detector.

Problema estructural:
- La voz contaminante no vive sólo en medios; muchas fugas vienen de consonantes de alta energía y borde rápido.
- También puede amputar caja real con componente mid útil.

Veredicto:
- Puede ayudar, pero no resuelve la ambigüedad semántica del evento.

### Estrategia C — Gate adaptativo por contexto espectral

Valor:
- Mejora selectividad contextual.

Problema estructural:
- Sigue siendo una lógica de umbral sobre una señal mal tipada.
- Si el score base no distingue armonicidad vs percusión, el gate adaptativo sólo redistribuye errores.

Veredicto:
- No es arquitectura raíz. Es una optimización posterior.

### Estrategia D — Envelope latino dedicado

Valor:
- Recupera carácter musical y control fino.

Problema estructural:
- Modela la respuesta de salida, no la clasificación de entrada.
- Si la entrada está contaminada, el envelope sólo maquilla el síntoma.

Veredicto:
- Debe reservarse para musicalidad una vez resuelta la pureza del disparo.

### Estrategia E — Filtro temporal de decay

Valor:
- Es la única del plan original que sí apunta parcialmente a la física del evento.

Problema estructural:
- Aislada, sigue siendo insuficiente.
- La caída rápida ayuda, pero no basta cuando hay vocales muy procesadas o sibilancia muy seca.

Veredicto:
- Debe integrarse dentro de un clasificador más completo.

---

## 3) Principio arquitectónico correcto

La decisión correcta es reclasificar el problema así:

No queremos "bajar voz" en Back R/L.

Queremos aceptar únicamente eventos con probabilidad alta de percusión corta.

Por tanto, el bloque correcto no es un atenuador. Es un filtro de admisión semántica del evento.

Ese filtro de admisión debe construirse con tres ejes deterministas:
- Fuerza transitoria
- Baja armonicidad
- Decaimiento compatible con percusión corta

---

## 4) Arquitectura propuesta

### 4.1 Pipeline lógico

Pipeline propuesto:

1. Extraer candidato transitorio bruto
2. Medir contenido armónico local
3. Medir perfil de decay corto
4. Componer score de confianza percusiva
5. Abrir envSnare sólo si la confianza supera umbral

En forma conceptual:

```text
transientCandidate
  -> harmonicEstimator
  -> decayMatcher
  -> percussiveConfidence
  -> envSnare gate
```

### 4.2 Componentes

#### A) Transient Strength

Mide si ocurrió un evento impulsivo real.

Entrada posible:
- delta espectral
- energía positiva instantánea por bandas
- relación ataque/ventana previa

Salida normalizada:

$$
T \in [0,1]
$$

#### B) Harmonic Content Estimator

Mide cuánto se parece el evento a una fuente armónica o cuasi-armónica.

Objetivo:
- Voz, formantes y material tonal deben empujar el score hacia rechazo.
- Hi-hat, clap seco y snare corto deben empujarlo hacia aceptación.

Señales útiles:
- estabilidad de picos entre frames consecutivos
- concentración de energía en relaciones armónicas compatibles
- coherencia tonal local
- persistencia espectral de banda alta con soporte medio sostenido

Salida normalizada:

$$
H \in [0,1]
$$

Interpretación:
- $H \approx 1$: evento armónico o vocal probable
- $H \approx 0$: evento ruidoso/percusivo probable

#### C) Decay Matcher

Mide si el evento cae como una percusión corta o si permanece como fuente sostenida.

Se evalúa en una ventana corta posterior al ataque.

Salida normalizada:

$$
D \in [0,1]
$$

Interpretación:
- $D \approx 1$: decay corto compatible con snare/hat
- $D \approx 0$: persistencia más propia de voz o material sostenido

#### D) Percussive Confidence

La apertura final debe depender del producto de las tres propiedades anteriores.

Fórmula conceptual propuesta:

$$
C_p = T \times (1 - H) \times D
$$

Donde:
- $T$ exige ataque real
- $(1-H)$ exige baja armonicidad
- $D$ exige caída percusiva

Interpretación:
- Si hay transiente pero también alta armonicidad, el score cae.
- Si hay transiente pero decay sostenido, el score cae.
- Sólo abre fuerte cuando las tres evidencias convergen.

---

## 5) Ventaja sobre las alternativas

Este enfoque corrige la causa raíz porque cambia el criterio de admisión del evento.

Ventajas:
- Es determinista.
- Es medible.
- Escala mejor entre géneros que un tuning de thresholds aislados.
- Deja las capas de musicalidad para después, donde realmente pertenecen.
- Reduce el riesgo de perseguir regressions infinitas tema por tema.

En otras palabras:
- El plan anterior intentaba "castigar fugas".
- Este plan intenta "no admitirlas como percusión".

---

## 6) Diseño matemático inicial

No se fija aquí implementación final, pero sí contrato matemático.

### 6.1 Score transitorio

Debe normalizarse contra ventana local para evitar sesgo por loudness global.

Forma conceptual:

$$
T = clamp\left(\frac{E_{attack} - E_{prev}}{E_{prev} + \epsilon}, 0, 1\right)
$$

Donde:
- $E_{attack}$ es la energía del frame o microventana de ataque
- $E_{prev}$ es la energía inmediatamente anterior
- $\epsilon$ evita división por cero

### 6.2 Score de armonicidad

Debe construirse desde estabilidad tonal local, no desde una FFT decorativa.

Forma conceptual:

$$
H = clamp\left(w_1 P + w_2 S + w_3 M, 0, 1\right)
$$

Donde:
- $P$: confianza de pitch o pseudo-pitch local
- $S$: estabilidad de picos entre frames
- $M$: soporte medio/alto persistente asociado a voz
- $w_1 + w_2 + w_3 = 1$

No hace falta un detector vocal total. Sólo hace falta un score que suba cuando el evento tiene firma armónica incompatible con snare/hat.

### 6.3 Score de decay

Debe medir cuán rápido muere el evento después del ataque.

Forma conceptual:

$$
D = clamp\left(1 - \frac{E_{tail}}{E_{attack} + \epsilon}, 0, 1\right)
$$

Donde:
- $E_{tail}$ es la energía integrada en la cola corta posterior al ataque

Cuanto menor sea la cola relativa, mayor será $D$.

### 6.4 Apertura final

La apertura del envSnare no debería dispararse por raw transient solamente.

Regla conceptual:

$$
gateOpen \iff C_p > \theta_p
$$

Donde:
- $\theta_p$ es el umbral de confianza percusiva

Opcionalmente, la intensidad del envSnare puede escalar con $C_p$ en vez de ser binaria.

---

## 7) Contrato funcional esperado

### Back R / Back L deben hacer

- Responder a snare real
- Responder a hi-hat marcado cuando el patrón lo justifique
- Mantener carácter seco, rápido y legible
- Sostener el swing latino sin abrir por voz principal

### Back R / Back L no deben hacer

- Dispararse por sílabas, eses, tés o bordes de voz procesada
- Convertirse en pseudo-vocal accent lights
- Depender de un tuning frágil tema a tema

### Movers sí pueden seguir haciendo

- Soportar voz, lead, hooks y energía melódica

Esto preserva la separación funcional del sistema:
- Back pars = percusión de apoyo
- Movers = narrativa vocal/melódica

---

## 8) Fases de trabajo recomendadas

### Fase 0 — Baseline obligatoria

Antes de tocar lógica:
- medir cuánto de Back R/L actual es percusión real
- medir cuánto es fuga vocal
- medir sensibilidad por género y por mezcla

Métricas mínimas:

$$
Precision = \frac{TP}{TP + FP}
$$

$$
Recall = \frac{TP}{TP + FN}
$$

$$
Leak = \frac{E_{vocal\ in\ back}}{E_{total\ back}}
$$

$$
SNR_p = \frac{E_{percussive\ in\ back}}{E_{vocal\ in\ back} + \epsilon}
$$

### Fase 1 — Harmonic Estimator mínimo viable

Objetivo:
- construir el score $H$ más simple que ya separe voz de percusión mejor que el sistema actual

No buscar perfección musical aún.
Buscar separación semántica reproducible.

### Fase 2 — Decay Matcher

Objetivo:
- añadir $D$ para rechazar eventos vocales de borde rápido pero cola sostenida

Esto es especialmente importante en voces procesadas y consonantes agresivas.

### Fase 3 — Integración del Percussive Confidence

Objetivo:
- reemplazar el gate actual basado sólo en transiente por uno basado en $C_p$

### Fase 4 — Ajuste musical posterior

Sólo después de lograr pureza estructural:
- envelope dedicado latino si hace falta
- sustain penalty como refinamiento adicional si aún queda leak residual
- small tuning de mid subtraction si mejora precisión sin dañar caja real

Orden correcto:
- primero clasificación
- después carácter

### Fase 5 — Stress cross-género

Validar al menos en:
- reggaetón denso
- reggaetón minimal
- salsa / timba
- urbano con voz hip procesada
- mezcla con hi-hats muy secos

---

## 9) Riesgos reales del enfoque elegido

Riesgo 1:
- Un harmonic estimator demasiado agresivo puede comerse cajas con componente tonal o resonancia útil.

Mitigación:
- no usar un único indicador; usar combinación de armonicidad y decay.

Riesgo 2:
- Un decay matcher demasiado duro puede recortar hats abiertos musicales.

Mitigación:
- separar criterios para snare y hi-hat si el análisis lo exige.

Riesgo 3:
- Si el baseline es pobre, el tuning posterior se hará a ciegas.

Mitigación:
- no avanzar sin métricas reales por segmento etiquetado.

Riesgo 4:
- El problema de BackLeft muerto en 7.1 puede mezclarse con el de discriminación y ocultar fallos de routing o energía.

Mitigación:
- auditar BackLeft por dos ejes separados:
  - eje A: ¿llega señal?
  - eje B: si llega, ¿se clasifica mal?

---

## 10) Criterios de aceptación para aprobar implementación

La arquitectura pasa a fase de código sólo si el arquitecto acepta estos principios:

1. El problema raíz es de clasificación de evento, no de threshold aislado.
2. Back pars deben operar con score de confianza percusiva, no sólo con transiente bruto.
3. Los ajustes A/B/D del plan viejo se degradan a capas secundarias de refinamiento.
4. Se hará baseline medible antes de tocar el núcleo.

Criterios técnicos mínimos de éxito posterior:
- fuga vocal muy reducida y estable
- conservación de snare/hat útiles
- comportamiento consistente entre 4.1 y 7.1
- separación funcional clara entre back pars y movers

---

## 11) Recomendación final para el arquitecto

Recomendación:
- Aprobar Harmonic Rejection Gate como arquitectura base.
- No arrancar por sustain penalty ni por tuning de envelope como primera línea.
- Reservar esas herramientas como post-ajuste una vez resuelta la admisión semántica del evento.

Traducción directa:
- Si queremos una solución rápida, el plan viejo puede dar alivio parcial.
- Si queremos una solución correcta, escalable y defendible, el núcleo debe ser Harmonic Rejection Gate.

---

## 12) Preguntas para decisión final

1. ¿Se aprueba explícitamente que Back R/L pasen a depender de un score de confianza percusiva y no de transiente bruto?
2. ¿Se quiere un único clasificador snare/hat o se acepta bifurcar snare y hi-hat si el baseline demuestra comportamientos distintos?
3. ¿La prioridad máxima es pureza percusiva o preservar hats abiertos musicales aunque aumente un poco el leak?
4. ¿BackLeft 7.1 se trata en la misma wave o se separa el problema de señal muerta del problema de clasificación?

---

## 13) Cierre

Este documento no propone aún parámetros finales ni cambios de código.

Propone la decisión arquitectónica correcta:
- dejar de parchear fugas en la salida
- empezar a discriminar correctamente qué eventos merecen entrar en Back R/L

Si el arquitecto valida esta dirección, el siguiente paso correcto es redactar la especificación técnica de Fase 0 y del contrato exacto de los scores $T$, $H$, $D$ y $C_p$ antes de implementar nada.