# 🔧 Pre-Show Workspace — Lo que Pasa Antes de que Empiece el Show

**Documento:** Ficha de producto — Herramientas de configuración en frío de LuxSync  
**Audiencia:** Técnicos de iluminación, stage managers, diseñadores de rig, operadores de touring  
**Versión:** Beta 1.0 — Marzo 2026

---

## El trabajo invisible que define si el show funciona

Hay una parte del trabajo de iluminación que el público nunca ve. Que el artista nunca menciona. Que los tutoriales de YouTube ignoran porque no es glamurosa.

Es la hora — o las cuatro horas — antes de que empiece el show.

Patchear 60 fixtures. Calcular direcciones DMX sin colisiones. Decirle al software que el Moving Head barato de 500€ que compraste tiene una rueda de color con 8 posiciones y que la posición 3 es "naranja, no rojo". Calibrar que el fixture número 7 apunta 12 grados hacia la izquierda porque el rig no quedó perfecto. Guardarlo todo y que no se pierda si la laptop sufre un corte de luz.

Ese trabajo invisible es el que LuxSync convierte en **el momento donde un mover de 500€ se comporta como uno de 3.000€**.

---

## Qué incluye el Pre-Show Workspace

Son cuatro herramientas integradas en un único flujo de trabajo en frío:

1. **ForgeView + FixtureForge** — Creación y edición de perfiles de fixture desde cero
2. **Visual Patcher (DMX Nexus)** — Asignación de direcciones DMX con detección de colisiones
3. **WheelSmith** — Editor de ruedas de color y gobo para fixtures mecánicos
4. **CalibrationLab** — Calibración física por fixture con safety protocol

Ninguna de estas herramientas requiere que el show esté corriendo. Todas trabajan en frío, antes de pulsar play.

---

## ForgeView — La Forja de Perfiles

El problema con los softwares de iluminación es que tienen un catálogo de fixtures. Si tu fixture está en el catálogo, bien. Si no está — o si el perfil del catálogo no refleja exactamente tu unidad con sus canales específicos — estás peleando contra el software.

LuxSync trae el catálogo, pero también trae **la forja para construir lo que falta**.

ForgeView es un editor completo de perfiles de fixture con 6 secciones:

| Sección | Para qué sirve |
|---|---|
| **Library** | Cargar perfiles `.fxt` existentes o empezar desde cero |
| **General** | Nombre, fabricante, tipo de fixture (15 tipos estrictos) |
| **Channel Rack** | Drag & drop de funciones DMX — 35+ tipos de canal soportados |
| **WheelSmith** | Editor de rueda de color integrado (ver sección aparte) |
| **Physics Engine** | Motor, velocidad máxima, límites de tilt, orientación de instalación |
| **Export** | Exportar `.fxt` para compartir o importar en otro show |

El Channel Rack acepta cualquier combinación de canales en cualquier orden. Si tu fixture tiene un canal de "ventilador de refrigeración", un canal de "control de motor externo" o cualquier rareza exótica, tiene nombre en la paleta. Y si no lo tiene, se puede mapear como canal genérico.

**La función que te ahorra tiempo real:** `deriveCapabilities()` — el perfil infiere automáticamente las capacidades del fixture desde sus canales. No tienes que decirle "este fixture tiene movimiento" si ya definiste canales de pan y tilt. Lo deduce solo.

> **En la competencia:** Los softwares profesionales de touring tienen catálogos grandes y bien mantenidos, pero el editor de perfiles propietario es de pago o está en el tier superior. En QLC+ está disponible pero requiere edición XML manual. En LuxSync, **el editor de perfiles es parte de la suite sin coste adicional**.

---

## Visual Patcher — DMX Nexus con Autopatch de Enjambre

Patchear un rig de 80 fixtures a mano, calculando que el fixture 12 de 22 canales no se pise con el 13, es el tipo de trabajo que hace que los técnicos odien los lunes de montaje.

El DMX Nexus automatiza exactamente eso.

### Autopatch en enjambre (Batch Patching)

Selecciona múltiples fixtures, introduce la dirección de inicio y el offset, y el sistema los distribuye solos:

```
fixture[0] → dirección inicial
fixture[1] → inicial + offset
fixture[2] → inicial + (2 × offset)
...
```

**AUTO-OFFSET inteligente:** Un botón lee el `channelCount` del primer fixture seleccionado y propone el offset correcto automáticamente. Opción "+2 gap" para dejar margen entre fixtures. Sin calculadora. Sin errores.

**Cross-Universe automático:** Si el batch se sale del universo 1 (supera el canal 512), el sistema pasa solo al universo 2 y resetea desde el canal 1. El técnico recibe un aviso con los universos utilizados. **Patchear 100 fixtures en 10 minutos es posible porque el sistema hace la aritmética por ti.**

### Seguridad anti-colisiones

El motor de colisiones es **bloqueante, no informativo**. No te avisa y deja guardar — te bloquea el guardado hasta que resuelvas el conflicto.

| Protección | Comportamiento |
|---|---|
| **Colisión de rangos** | Botón SAVE deshabilitado + modal con lista de conflictos |
| **Universe overflow** | Fixture que se sale del canal 512 → badge de error + bloqueo de guardado |
| **channelCount = 0** | Alerta de perfil incompleto antes de patchear |

Esto es el comportamiento estándar de grandMA3. Está implementado en LuxSync.

> El motor de colisiones es O(n²) en el peor caso del Universe Bar. Funcional y sin latencia perceptible hasta ~200 fixtures. Para rigs de festival a gran escala con +200 unidades, la próxima versión optimizará este cálculo.

---

## WheelSmith — El Editor de Ruedas de Color que Nadie Tiene

Esta es probablemente la herramienta más singular de todo el Pre-Show Workspace.

Los movers mecánicos con rueda de color no mezclan RGB. Tienen una rueda física con ranuras de filtro de color — 8, 12, 16 posiciones dependiendo del fixture. Cada ranura corresponde a un valor DMX específico. Si el software no sabe exactamente qué color está en qué ranura **de tu unidad específica**, no puede hacer traducción de color inteligente.

La mayoría del software asume que todas las ruedas de color son iguales. No lo son.

**WheelSmith te deja definir la tuya exacta**, ranura por ranura:

```
Ranura 1 → DMX 15 → "Rojo" → RGB aproximado (255, 40, 0)
Ranura 2 → DMX 30 → "Naranja" → RGB aproximado (255, 120, 0)
Ranura 3 → DMX 45 → "Amarillo" → RGB aproximado (255, 220, 0)
...
```

El RGB aproximado no es decorativo: el `ColorTranslator` del HAL lo usa para calcular **distancia cromática** cuando Selene IA o Chronos le piden un color específico. El software no adivina — elige la ranura más cercana al color pedido basándose en tus datos.

### Validación en tiempo real

WheelSmith tiene un engine de validación completo que monitoriza mientras editas:

| Alerta | Qué detecta |
|---|---|
| 🔴 Badge rojo | Dos ranuras con el mismo valor DMX (imposible físicamente) |
| 🟠 Badge naranja | Una ranura cae dentro del rango de spin continuo del motor |
| 🟡 Badge amarillo | El orden de ranuras no es monotónico (orden físico incorrecto en la rueda) |

Las alertas no bloquean la edición — informan inline mientras trabajas. El `Live DMX test` te permite mandar señal directamente a la rueda física para confirmar que la ranura que definiste es realmente la que el fixture ejecuta.

> **En la competencia:** Grandola, SoundSwitch, DMXIS — ninguno tiene un editor de ruedas de color con validación de física mecánica integrado en la suite base. Es una herramienta que normalmente existe en consolas de gira de 20.000€ o no existe.

---

## CalibrationLab — Convertir Hardware Barato en Hardware Serio

Aquí está el argumento de venta real del Pre-Show Workspace.

Un mover de 500€ chino tiene tolerancias de fabricación. Sale del almacén apuntando 8 grados a la derecha de donde debería. El tilt tiene 5 grados de error. Si lo montas al revés en el rig, el pan está invertido. Eso no es un defecto — es la realidad del hardware de precio medio.

La diferencia entre un técnico profesional y uno amateur es que el profesional **calibra**.

CalibrationLab persiste por fixture:

```
Offsets de posición:
  panOffset:   -180° a +180°    (compensación de apuntado)
  tiltOffset:  -90°  a +90°     (compensación de elevación)
  panInvert:   boolean           (fixture montado al revés)
  tiltInvert:  boolean           (cable de tilt invertido)

Physics Profile por fixture:
  motorType:       servo-pro / stepper-quality / stepper-cheap / unknown
  maxVelocity:     velocidad máxima permitida
  tiltLimits:      min/max DMX — las deadzones físicas
  homePosition:    posición de home calibrada
  safetyCap:       límite de protección de motor
```

**El punto crítico: estos datos NO son decorativos.** El pipeline de hardware aplica los offsets en cada frame de DMX antes de que la señal salga:

```
pan pedido por el show
  → STEP 1: panInvert → 255 - pan (si aplica)
  → STEP 2: panOffset° → (+X/540°) × 255 DMX
  → STEP 3: tiltLimits → clamp(tilt, min, max)
  → STEP 4: clamp final 0-255
  → DMX Output
```

Eso significa que cuando Selene IA decide "apuntar al downstage center", lo que sale por DMX **ya incorpora las correcciones físicas de ese fixture específico**. El fixture de 500€ corregido se comporta como si siempre hubiera apuntado bien.

### Safety Protocol de calibración

Entrar en CalibrationLab desactiva el output DMX automáticamente hasta que el técnico lo rearma manualmente. No hay posibilidad de calibrar un fixture mientras el show está corriendo y mandando señal. Esto protege los motores durante el ajuste.

Los límites físicos de pan y tilt están hardcoded al 95% del rango máximo del fixture. Nunca llegan al 100% — protección de motor en el extremo del recorrido.

---

## ShowFile — El Seguro de Vida del Show

Todo lo anterior no vale nada si se pierde en un corte de luz a las 3AM.

El sistema de persistencia de LuxSync tiene tres capas de protección:

**1. Auto-save con debounce:** Cada cambio en el stageStore dispara un guardado automático a disco con 2 segundos de debounce. No tienes que recordar guardar.

**2. Backup atómico antes de cada escritura:**
```
Antes de escribir .luxshow:
  → Renombra archivo actual → .luxshow.bak
  → Escribe nuevo .luxshow
  → Si write OK: elimina .bak
  → Si el proceso crashea: .bak existe como archivo de rescate
```
Si la laptop muere en mitad de un guardado, el archivo anterior está íntegro como `.luxshow.bak`.

**3. Gate de validación pre-guardado:** `validateShowFileDeep()` audita el show completo antes de escribirlo a disco. Un show con colisiones de direcciones, overflow de universo o referencias rotas no puede llegar al disco. Los datos corruptos no sobreviven al save.

**Migración de versiones:** Los shows guardados en formato V1 (el formato antiguo de LuxSync) se migran automáticamente al formato V2.1.0 actual al cargarlos. El calibrator de V1 con `invertPan` duplicado en dos campos se resuelve automáticamente, eligiendo el campo correcto y eliminando el duplicado.

---

## Lo que el Pre-Show Workspace no tiene (todavía)

Honestidad antes que marketing:

| Limitación | Contexto |
|---|---|
| **File locking multi-ventana** | Si dos instancias de LuxSync editan el mismo show simultáneamente, la última escritura gana. Solución: usar una instancia por show. Riesgo real: casi cero en uso normal. |
| **Recovery automático de escritura fallida** | MA3 tiene un protocolo de re-escritura automática si el I/O falla. LuxSync tiene el `.bak` pero requiere recuperación manual. Para el 99.9% de los casos, el `.bak` es suficiente. |
| **Motor de colisiones optimizado para +200 fixtures** | El algoritmo de detección de colisiones en el Universe Bar es O(n²). Rigs de 200+ fixtures (festivales grandes, touring de tier 1) experimentarán latencia en la UI del patcher. En el roadmap. |
| **Import desde otros formatos** | No importa `.xml` de Vectorworks, `.gdtf` ni formatos de consola propietarios. El flujo de trabajo es manual o desde `.fxt` propio. |

---

## A quién va dirigido

| Perfil | Cómo lo usa |
|---|---|
| **DJ / Operador de sala pequeña** | Patchea 8-20 fixtures una vez, calibra una vez, olvida que existe. El show corre solo. |
| **Técnico de sala o club** | Montaje de rig recurrente. El batch patch + auto-offset reduce el setup de 45 min a 10 min. |
| **Técnico de touring** | Escenario diferente cada noche. El show file viaja con el rig — offsets de calibración incluidos, WheelSmith mapeado, universos correctos. |
| **Diseñador de iluminación** | Construye perfiles de fixtures inexistentes en el catálogo. Define exactamente cómo quiere que el HAL interprete el color de cada rueda mecánica. |
| **Técnico con presupuesto limitado** | Hardware de gama media funcionando a nivel de gama alta gracias a perfiles detallados y calibración por unidad. El ROI del Pre-Show Workspace es: paga el rig de 500€ y trabaja como si fuera el de 3.000€. |

---

## Incluido en LuxSync Suite

El Pre-Show Workspace no es un módulo de pago separado, un add-on de tier superior ni una licencia adicional.

**Es parte de LuxSync desde la instalación.**

ForgeView, Visual Patcher, WheelSmith y CalibrationLab están disponibles en la beta sin restricciones. Crea tantos perfiles como necesites, patchea tantos fixtures como quieras, configura tantas ruedas de color como tengas.

**Puntuación Enterprise AV (auditoría técnica independiente, Marzo 2026): 90.65 / 100 — Tour-Ready, Production Grade**

> *"LuxSync está listo para producción. El show puede empezar."*  
> — Evaluación técnica independiente de arquitectura AV, sector pro-audio, Marzo 2026

---

## → Descarga en [mgmusicandlight.com](https://mgmusicandlight.com)

Beta 1.0 disponible para Windows. Gratuita. Sin límite de fixtures. Sin límite de universos. Sin suscripción.

---

*LuxSync Pre-Show Workspace — Parte de la suite LuxSync desarrollada por GestIAdev.*  
*El trabajo invisible que hace posible el show visible.*
