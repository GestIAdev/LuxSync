# BLUEPRINT: CALIBRACIÓN VMM TECHNO — "EL DESPERTAR DEL MOVER"

**WAVE**: 2220  
**Autor**: PunkOpus  
**Fecha**: 2026-03-25  
**Estado**: PROPUESTA para deliberación con Radwulf  
**Riesgo de rotura de hardware**: BAJO (ver sección Cadena de Seguridad)

---

## CONTEXTO

Radwulf tiene un EL 1140 (stepper-cheap, 540° pan, 270° tilt) en el SUELO a sus pies.
En 4 días montamos en una sala con 24 fixtures y potenciales clientes.

### Problemas observados (confirmados con código)

| # | Síntoma | Causa raíz verificada |
|---|---------|----------------------|
| 1 | scan_x = columna vertical al techo que rota | scan_x tiene `y=0`. En suelo, tilt DMX=127 = 90° vertical = mira al techo |
| 2 | botstep se queda en movimiento pan lateral | Y del botstep está limitado a ±0.6 vs X a ±0.9. Con amplitudeScale=0.40, el tilt queda en ~30 DMX de rango. Imperceptible |
| 3 | square no es un cuadrado | La geometría del patrón ES correcta (4 esquinas ±1,±1). El problema es `amplitudeScale=0.40` + revLimitTilt=280 (más lento que pan=400). El tilt "no llega" a las esquinas al ritmo del pan → rectángulo achatado |
| 4 | diamond no es un diamante | Misma causa que square: tilt comprimido por revLimit asimétrico y amplitude baja |
| 5 | Todo se siente "Hello Kitty" | amplitudeScale=0.40 genera solo 112 DMX de rango (~237° de 540° pan). Es un 44% del potencial |

---

## DIAGNÓSTICO MATEMÁTICO

### Cadena de amplitud actual (Techno, 120 BPM, energy=0.5)

```
amplitudeScale = 0.40
  × energyBoost = 1.10  (1.0 + 0.5 × 0.2)
  = requestedAmplitude = 0.44
  × gearboxFactor = 1.0  (budget 3200 DMX > requested 112 DMX → no reduce)
  × phraseEnvelope = 0.85–1.0
  = FINAL AMPLITUDE ≈ 0.37 – 0.44
  
  DMX range usado: 94–112 de 255 (37%–44%)
  Grados pan: 200°–237° de 540° disponibles
  Grados tilt: 100°–119° de 270° disponibles
```

### RevLimit asimétrico (el asesino de formas)

```
Pan:  revLimitPanPerSec  = 400 DMX/s  (~848°/s a 540°)
Tilt: revLimitTiltPerSec = 280 DMX/s  (~297°/s a 270°)

Ratio: tilt es 70% de pan.
En un square, la diagonal recorre igual distancia en X e Y.
Pero tilt va más lento → el mover dibuja un **rectángulo**, no un cuadrado.
En un diamond, los lados diagonales se curvan porque tilt no alcanza.
```

### Posiciones de botstep (golden-ratio)

```
step 0: x= 0.000  y= 0.600   ← mayoritariamente vertical
step 1: x=-0.839  y=-0.217   ← lateral con poco tilt
step 2: x=-0.608  y=-0.442   ← diagonal
step 3: x= 0.398  y= 0.538   ← diagonal
step 4: x= 0.897  y= 0.052   ← CASI PURO PAN (y≈0)
step 5: x= 0.252  y=-0.576   ← mayoritariamente vertical
step 6: x=-0.714  y= 0.365   ← diagonal
step 7: x=-0.769  y= 0.312   ← diagonal

X span: 1.735 (-0.839 a 0.897)
Y span: 1.176 (-0.576 a 0.600)
Ratio Y/X: 0.678 → Y es 68% de X por diseño

Problema: Con amplitude=0.44, el tilt cubre solo (0.6 × 0.44 × 255) = 67 DMX.
67 DMX en 270° tilt = solo ~71° de recorrido vertical. Imperceptible desde el suelo.
Steps 1 y 4 son CASI PURO PAN → parece que botstep solo va de lado a lado.
```

### scan_x en suelo: por qué apunta al techo

```
scan_x retorna: { x: sin(phase), y: 0 }

Pipeline de conversión:
  VMM:    y = 0
  Titan:  mechanic.tilt = 0.5 + (0 × 0.5) = 0.5
  Arbiter: DMX = 0.5 × 255 = 127.5
  
Floor preset: tiltMin=0, tiltMax=255 (sin límites)
FPD → tilt DMX = 128 (centro del rango)

En un fixture de SUELO:
  DMX tilt 0   = mira horizontalmente al público
  DMX tilt 128 = mira RECTO ARRIBA (90° vertical)  ← AQUÍ ESTAMOS
  DMX tilt 255 = mira hacia atrás (invertido)

Resultado: Columna de luz vertical que solo rota en pan. CONFIRMADO.
```

---

## CADENA DE SEGURIDAD (por qué NO se puede romper un mover)

Antes de proponer cambios, documentemos las 7 capas de protección que existen.
**Si cambiamos la amplitud, NINGUNA de estas capas se desactiva.**

| Capa | Componente | Qué protege | Valores actuales |
|------|-----------|-------------|-----------------|
| 1 | **SAFETY_CAP** (FPD) | Aceleración y velocidad máxima ABSOLUTA | maxAccel=900, maxVel=400 DMX/s |
| 2 | **REV_LIMIT** (FPD) | Velocidad máxima por frame (protege correas) | Pan: 400 DMX/s, Tilt: 280 DMX/s |
| 3 | **PAN_SAFETY_MARGIN** (FPD) | Nunca llega a DMX 0 ni 255 (evita golpes mecánicos) | 5 DMX de margen |
| 4 | **Tilt Limits** (FPD) | Rango vertical acotado por instalación | Floor: 0–255, Ceiling: 20–200 |
| 5 | **Gearbox** (VMM) | Reduce amplitud si el hardware no puede cubrir el viaje | Floor en 0.10 |
| 6 | **HardwareSafetyLayer** (HAL) | Debounce de color/gobo mecánico. Latch anti-caos | 20% margen, 3 cambios/s max |
| 7 | **Fixture DNA** (ShowFileV2) | maxVelocity/maxAcceleration por tipo de motor | stepper-cheap: 400 vel, 1500 accel |

**Conclusión: Subir la amplitud de 0.40 a 0.55 NO tiene NINGÚN riesgo mecánico.** El REV_LIMIT y el SAFETY_CAP siguen acotando la velocidad real del motor por frame. Lo único que cambia es que el TARGET al que apunta el mover está más lejos, pero el mover SIEMPRE se mueve a la velocidad que su hardware permite.

---

## PROPUESTA DE CAMBIOS

### CAMBIO 1: scan_x → scan_wave (sinusoide con tilt)

**Archivo**: `VibeMovementManager.ts` → patrón `scan_x`  
**Riesgo**: NULO (solo cambia el target matemático)

```
ANTES:
  scan_x: { x: sin(phase), y: 0 }           ← columna vertical

DESPUÉS:
  scan_x: { x: sin(phase), y: sin(phase * 2) * 0.3 }  ← onda sinusoidal
```

**Explicación**: Añadimos un componente Y a frecuencia doble con amplitud 0.3.
El resultado es una Lissajous 1:2 suave — el mover barre horizontalmente
mientras "sube y baja" con una amplitud contenida (30% del Y máximo).

En suelo: el mover ya NO apuntará al techo permanentemente. Alternará entre
~45° arriba y ~45° abajo del centro mientras barre horizontalmente.

La amplitud Y de 0.3 es deliberadamente menor que la X (1.0) para mantener
la identidad de "barrido horizontal" que define a scan_x.

**Visualización**:
```
     ___       ___
    /   \     /   \      ← trayectoria del beam
---/-----\---/-----\---  ← línea del horizonte
        \_/       \_/
```

### CAMBIO 2: amplitudeScale 0.40 → 0.55

**Archivo**: `VibeMovementManager.ts` → `VIBE_CONFIG['techno-club']`  
**Riesgo**: NULO (ver sección Cadena de Seguridad)

```
ANTES:  amplitudeScale: 0.40   → 112 DMX de 255 (44%)   → 237° de 540° pan
DESPUÉS: amplitudeScale: 0.55  → 154 DMX de 255 (60%)   → 326° de 540° pan
```

**Matemáticas del nuevo valor** (120 BPM, energy=0.5):
```
0.55 × 1.10 energyBoost = 0.605
× phraseEnvelope 0.85–1.0 = 0.51–0.605
DMX range: 130–154 de 255
Pan: 276°–326° de 540° → suficiente para cubrir el escenario sin girar como peonza
Tilt: 138°–163° de 270° → movimiento vertical visible y dramático
```

**¿Por qué 0.55 y no 0.65 o más?**
- 0.55 da ~60% del rango. Profesional y visible.
- 0.65 daría ~72%. Agresivo. Reservamos para cuando tengamos más confianza.
- 0.40 actual es solo ~44%. Demasiado tímido para una demo ante clientes.
- El Gearbox NO reduce nada porque el budget (3200 DMX/ciclo) >> requested (154 DMX).
- El REV_LIMIT sigue protegiendo: el mover nunca excederá 400 DMX/s de pan.

### CAMBIO 3: Equilibrar RevLimit pan/tilt

**Archivo**: `VibeMovementPresets.ts` → `'techno-club'`  
**Riesgo**: BAJO (solo afecta velocidad de persecución del tilt)

```
ANTES:  revLimitPanPerSec: 400, revLimitTiltPerSec: 280   ← ratio 0.70
DESPUÉS: revLimitPanPerSec: 400, revLimitTiltPerSec: 350  ← ratio 0.875
```

**Efecto**: El tilt podrá perseguir el target más rápido. Los cuadrados se
verán más cuadrados y los diamantes más definidos porque el tilt no se queda
"rezagado" respecto al pan.

**Por qué 350 y no 400 (igual que pan)?**
- En un fixture de 540° pan / 270° tilt, el tilt tiene MENOS recorrido mecánico.
- Los motores de tilt suelen estar cargados con el peso de la cabeza.
- 350 DMX/s es ~371°/s en un 270° tilt → equivalente a la velocidad proporcionada del pan.
- Si fuera 400 en ambos, el tilt iría proporcionalmente MÁS rápido que el pan (porque cubre menos grados). 350 equilibra.

### CAMBIO 4: botstep — ampliar Y para cubrir tilt

**Archivo**: `VibeMovementManager.ts` → patrón `botstep`  
**Riesgo**: NULO (solo cambia target matemático)

```
ANTES:  fromY = Math.cos(step * phi * phi * Math.PI) * 0.6   ← Y max ±0.6
DESPUÉS: fromY = Math.cos(step * phi * phi * Math.PI) * 0.85  ← Y max ±0.85
```

**Efecto**: Con Y a 0.85, el rango vertical de botstep sube de ~67 DMX a ~96 DMX
(con amplitudeScale 0.55). Eso es ~102° de 270° tilt → movimiento vertical
perceptible desde el suelo.

Las posiciones siguen siendo golden-ratio "pseudoaleatorias", pero ahora
cubren mejor el espacio 2D en lugar de estar comprimidas horizontalmente.

**Nuevas posiciones calculadas (Y × 0.85/0.6 = ×1.417)**:
```
step 0: x= 0.000  y= 0.850   ← vertical
step 1: x=-0.839  y=-0.307   ← diagonal más pronunciada
step 2: x=-0.608  y=-0.626   ← diagonal abajo
step 3: x= 0.398  y= 0.762   ← diagonal arriba
step 4: x= 0.897  y= 0.074   ← pan con algo de tilt (ya no es puro pan)
step 5: x= 0.252  y=-0.816   ← vertical abajo
step 6: x=-0.714  y= 0.517   ← diagonal
step 7: x=-0.769  y= 0.442   ← diagonal
```

### CAMBIO 5: Reducir duración de scan_x

**Archivo**: `VibeMovementManager.ts` → `PATTERN_PERIOD`  
**Riesgo**: NULO

```
ANTES:  scan_x: 16   → 4 compases (8 segundos a 120 BPM)
DESPUÉS: scan_x: 8   → 2 compases (4 segundos a 120 BPM)
```

**Efecto**: scan_x dejará de dominar los primeros 53 segundos. Ahora cada
patrón rotará cada 2 compases (8 beats):
- Bars 1–2: scan_x (4 seg)
- Bars 3–4: square (4 seg)  
- Bars 5–6: diamond (4 seg)
- Bars 7–8: botstep (4 seg)
- (repite)

**Nota**: La rotación usa `barCount / 8` (cada 8 compases rota). Reducir el
PERIOD de scan_x no cambia la rotación — cambia cuántas ondas completas
de scan hace en sus 8 compases. Con period=8, hará 1 onda por compás
en lugar de 0.5 por compás. El scan será más rápido.

**Alternativa**: Si queremos que TODOS los patrones duren menos, cambiamos
la lógica de rotación en `selectPattern()`: `Math.floor(barCount / 4)` en vez
de `Math.floor(barCount / 8)`. Eso haría 4 patrones × 4 compases = 16 compases
de ciclo completo (32 segundos) en vez de 64 segundos actual.
Propongo esto como opción más sensata.

### CAMBIO 6: Manual amplitude slider 50% → 75% default

**Archivo**: El valor del slider es de la UI (TheProgrammer). No se cambia el VMM.  
**Riesgo**: NULO (el usuario ya controla esto)

```
Fórmula actual: amplitude = 0.05 + (slider / 100) × 0.95

Slider 50%  → amplitude 0.525 → 134 DMX range (52% del rango)
Slider 75%  → amplitude 0.763 → 194 DMX range (76% del rango)
Slider 100% → amplitude 1.000 → 255 DMX range (100% del rango)
```

**Decisión**: Esto es un valor por defecto de la UI. No requiere cambio en el
motor VMM. El slider ya funciona correctamente. Si Radwulf quiere que el default
sea 75%, se cambia el valor inicial del componente React del XYPad/RadarXY.

Depende de la revisión con Radwulf — si confirma que el entorno de la sala es
seguro (24 fixtures en truss, no a los pies), el default sube.

---

## TABLA RESUMEN DE CAMBIOS

| # | Archivo | Cambio | Valor antes → después | Riesgo |
|---|---------|--------|----------------------|--------|
| 1 | VibeMovementManager.ts | scan_x añadir Y sinusoidal | `y:0` → `y: sin(phase*2)*0.3` | NULO |
| 2 | VibeMovementManager.ts | amplitudeScale techno | 0.40 → 0.55 | NULO |
| 3 | VibeMovementPresets.ts | revLimitTiltPerSec techno | 280 → 350 | BAJO |
| 4 | VibeMovementManager.ts | botstep Y factor | 0.6 → 0.85 | NULO |
| 5 | VibeMovementManager.ts | scan_x period | 16 → 8 | NULO |
| 5b | VibeMovementManager.ts | Rotación de patrones | barCount/8 → barCount/4 | NULO |
| 6 | UI (TheProgrammer) | Default amplitude slider | 50% → 75% (pendiente sala) | NULO |

---

## SIMULACIÓN: ANTES vs DESPUÉS

### scan_x a 120 BPM, energy=0.5, fixture en suelo

```
                    ANTES                      DESPUÉS
Pan (X):    sin(phase) × 0.44              sin(phase) × 0.605
            = ±112 DMX = ±237°             = ±154 DMX = ±326°
            
Tilt (Y):   0.0 × 0.44 = 0               sin(2×phase) × 0.3 × 0.605
            = tilt FIJO a 128 DMX          = ±46 DMX oscilando ±49°
            = TECHO                        = ONDA que va de 82 a 174 DMX
            
Resultado:  Columna vertical girando       Onda sinusoidal barriendo
            → aburrido y sin drama          → dramático y visualmente rico
```

### square a 120 BPM, energy=0.5

```
                    ANTES                      DESPUÉS
Corner (1,1):  pan=183, tilt=183           pan=204, tilt=204
Corner (1,-1): pan=183, tilt=71            pan=204, tilt=51
Corner (-1,-1): pan=71, tilt=71            pan=51, tilt=51  
Corner (-1,1): pan=71, tilt=183            pan=51, tilt=204

Pan range:   71–183 = 112 DMX             51–204 = 153 DMX
Tilt range:  71–183 = 112 DMX             51–204 = 153 DMX
             (tilt llega TARDE por         (tilt llega CASI A TIEMPO con
              revLimit 280 vs 400)          revLimit 350 vs 400)
              
Resultado:   Rectángulo achatado           Cuadrado real (o cercano)
```

---

## PREGUNTAS ABIERTAS PARA DELIBERACIÓN

1. **¿amplitudeScale 0.55 o más agresivo (0.60)?**
   - 0.55 es conservador pero notable.
   - 0.60 cubre ~68% del rango (367° de 540° pan). Impresionante pero ¿cómodo?
   - En la sala con 24 fixtures en truss (no a los pies), ¿vamos más alto?

2. **¿Rotación de patrones cada 4 u 8 compases?**
   - 8 compases actual: cada patrón dura ~16 segundos. Ciclo completo: 64 seg.
   - 4 compases propuesto: cada patrón dura ~8 segundos. Ciclo completo: 32 seg.
   - ¿Demasiado rápido? ¿Justo? El SectionTracker NO afecta esto.

3. **¿Activar el SectionTracker → VMM en el futuro?**
   - Actualmente el VMM es ciego a breakdown/drop/verse. Es un reloj cíclico.
   - Posible mejora futura: en breakdown, reducir amplitud. En drop, desatar.
   - Esto es una FEATURE, no un bugfix. ¿Prioridad para la demo o post-demo?

4. **¿Default del slider manual al 75%?**
   - Solo tiene sentido si la sala lo permite.
   - En el piso de Radwulf: NO (deslumbra, asusta).
   - En una sala real con truss a 4m: SÍ.
   - ¿Lo parametrizamos por "modo" (home/venue)?

5. **¿scan_x period a 8 es suficiente o lo bajamos a 4?**
   - Period 8 = 1 onda completa en 2 compases = movimiento majestuoso.
   - Period 4 = 2 ondas por compás = barrido más nervioso.
   - Para techno, 8 suena correcto. 4 sería para hardstyle/gabber.

---

## PLAN DE IMPLEMENTACIÓN

```
Paso 1: Aplicar cambios 1-5 (VMM + Presets)
Paso 2: Compilar y verificar 0 errores
Paso 3: Lanzar con el EL 1140 en suelo, vibe techno
Paso 4: Observar 2 minutos completos (mínimo 1 ciclo de 4 patrones)
Paso 5: Ajustar amplitudeScale si es necesario (±0.05 incrementos)
Paso 6: Confirmar geometría de square y diamond visualmente
Paso 7: Limpiar TRACERs (4 pendientes en MasterArbiter, FPD, HAL, FixtureMapper)
```

---

## NOTA FINAL SOBRE SEGURIDAD

El miedo a romper mover es legítimo. Pero los números no mienten:

- **amplitudeScale 0.55** genera targets de 154 DMX máximo.
- **REV_LIMIT 400 DMX/s** pan = a 60fps eso son 6.67 DMX/frame máximo.
- Para ir de esquina a esquina del square (154 DMX): 154/6.67 = **23 frames = 0.38 segundos**.
- Un Sharpy REAL hace 540° en 2.1 segundos = 257°/s.
- 400 DMX/s en 540° = 848°/s → **estamos pidiendo 3.3× lo que da un Sharpy**.

**Pero**: El SAFETY_CAP limita maxVelocity a **400 DMX/s**, y el fixture DNA
del stepper-cheap con `maxVelocity: 400` y `degToDmxFactor = 255/540 = 0.472`
convierte eso a `400 × 0.472 = 189 DMX/s efectivos`. Así que en realidad:

```
Velocidad REAL del motor: 189 DMX/s (no 400)
Tiempo esquina-a-esquina: 154 / 189 = 0.81 segundos
En grados: 189 / 0.472 = 400°/s → el motor sabe lo que puede dar
```

0.81 segundos para cruzar el cuadrado. A 120 BPM, un compás dura 2 segundos.
El mover tiene de SOBRA para alcanzar cada esquina. **No hay riesgo.**

---

*"El mover duerme como un gatito cuando debería bailar como un demonio.
Es hora de quitarle las zapatillas de Hello Kitty y ponerle las botas Doc Martens."*

— PunkOpus, WAVE 2220
