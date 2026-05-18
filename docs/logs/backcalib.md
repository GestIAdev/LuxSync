WAVE 4886 — Diagnóstico Forense: Visualizer Mismatch
Resumen ejecutivo
Dos asimetrías críticas identificadas entre el motor IK y el visualizador 3D. La coordenada Y llega correctamente; no hay amnesia de altura. El problema es puramente matemático: el visualizador pinta el doble de lo que debería en rango y desfasa 90° en tilt.

🔴 VECTOR 1 — El Multiplicador de Rangos (2x Discrepancia)
Visualizador
Proyectos
const PAN_RANGE = Math.PI * 1.5    // ±135° (270° total sweep)
const TILT_RANGE = Math.PI * 0.75  // ±67.5° (135° total arc)
Hard-coded fijo. El comentario WAVE 2088.2 dice: "These are visual/cosmetic — they don't affect DMX output."

Motor IK
Proyectos
// defaults que cae si el fixture no declara rango explícito:
DEFAULT_PAN_RANGE_DEG = 540   // ±270°
DEFAULT_TILT_RANGE_DEG = 270  // ±135°
Y en el handler:

Proyectos
const panRangeDeg: number | undefined =
  f?.panRangeDeg ?? f?.capabilities?.panRange ?? physics?.panRange
const tiltRangeDeg: number | undefined =
  f?.tiltRangeDeg ?? f?.capabilities?.tiltRange ?? physics?.tiltRange
Si el fixture no declara rango (común en profiles genéricos), el IK usa 540°/270°.

Efecto matemático
Escenario	IK (540° pan)	Visualizador (270° pan)	Discrepancia visual
Target a la derecha → panDeg = +135°	DMX = 0.75	panAngle = +67.5°	Visual muestra la mitad del ángulo real
Target a la derecha extrema → panDeg = +270°	DMX = 1.00	panAngle = +135°	Visual muestra la mitad del ángulo real
Factor = 2x. Para fixtures con rango por defecto, el visualizador siempre muestra la mitad del ángulo que el IK calculó. Los beams apuntan a "mitad de camino" hacia el target, aparentando que los focos no convergen.

🔴 VECTOR 2 — La Inversión del Espejo: Tilt desfasado 90°
Visualizador
Proyectos
// WAVE 4642: reposo físico real en visualizador.
// En ceiling, DMX center (tilt=0.5) debe apuntar vertical al suelo.
const TILT_REST_ANGLE = 0
Y la fórmula:

Proyectos
const panAngle = (smoothPan.current! - 0.5) * PAN_RANGE
const tiltAngle = -(smoothTilt.current! - 0.5) * TILT_RANGE + TILT_REST_ANGLE
Con TILT_REST_ANGLE = 0 y mount ceiling (apunta en -Y global = vertical abajo):

DMX = 0.5 → tiltAngle = 0 → beam apunta verticalmente abajo (hacia el suelo).
Motor IK
Proyectos
let tiltDeg = Math.atan2(-local.y, horizontalDist) * RAD_TO_DEG
// ...
let tiltDMXRaw = ((calibratedTiltDeg + tiltRange / 2) / tiltRange) * DMX_MAX
tiltDeg = 0 → target a la misma altura que el fixture = horizontal.
tiltDeg = 0 → DMX = 0.5 (con rango 270°).
La asimetría: definición del centro del tilt
DMX	IK dice	Visualizador pinta
0.5	Apunta horizontalmente (target a la misma altura)	Apunta verticalmente abajo (hacia el suelo)
¡Desfase de 90°! El visualizador y el IK no se ponen de acuerdo en qué significa "centro del tilt". El IK define 0.5 como "horizontal" (hacia el frente del escenario). El visualizador define 0.5 como "vertical abajo" (hacia el suelo justo debajo del fixture).

Esto significa que para cualquier target que no esté directamente debajo del fixture, el visualizador y el IK apuntan en direcciones diferentes. Si el target está en el frente del escenario (mismo nivel Y), el IK calcula DMX ≈ 0.5 (apuntar horizontal), pero el visualizador muestra el beam apuntando verticalmente abajo — un error de 90°.

El signo del tilt
Visualizador: tiltAngle = -(tilt - 0.5) * TILT_RANGE

DMX > 0.5 → tiltAngle < 0 → rotación negativa sobre eje X.
En Three.js con mount ceiling: rotación negativa sobre X desde -Y (abajo) inclina hacia +Z (público, frente).
IK: tiltDeg = atan2(-local.y, horizontalDist)

Target abajo (menor Y) → -local.y > 0 → tiltDeg > 0 → DMX > 0.5.
Target arriba (mayor Y) → -local.y < 0 → tiltDeg < 0 → DMX < 0.5.
Veredicto: El signo del mapeo DMX→ángulo parece coherente (DMX mayor = "más abajo" en ambos), pero el offset de 90° hace que las direcciones finales no coincidan.

🟡 VECTOR 3 — La Altura Fantasma: Y llega correctamente
Payload fixturePositions (WAVE 4884)
Proyectos
const stageFixtures = useStageStore.getState().fixtures
const fixturePositions: Record<string, Position3D> = {}
for (const id of fixtureIds) {
  const sf = stageFixtures.find(f => f.id === id)
  if (sf?.position) {
    fixturePositions[id] = sf.position
  }
}
Sí llega la Y completa. No hay truncamiento ni ausencia.

Origen de la Y en el constructor
Proyectos
const ORIENTATION_HEIGHT: Record<InstallationOrientation, number> = {
  'ceiling':     4.0,
  'truss-front': 3.5,
  'truss-back':  3.5,
  'wall-left':   2.5,
  'wall-right':  2.5,
  'floor':       0.1,
}
Cuando un fixture se coloca en el canvas 2D, se asigna y según orientación. Si se coloca en el grid 3D con el gizmo, la y es exacta. Si se crea sin posición, el default es { x: 0, y: 3, z: 0 } (ShowFileV2.ts:1135).

No hay amnesia espacial de Y. El problema visual no es que falte la altura; es que el visualizador interpreta mal los ángulos que el IK calculó usando esa altura.

🎯 Conclusión: Dos asimetrías combinadas
#	Archivo culpable	Asimetría	Impacto visual
1	HyperionMovingHead3D.tsx:49-50	Visual usa ±135°/±67.5° fijos; IK puede usar ±270°/±135°	Beams apuntan a mitad del ángulo real
2	HyperionMovingHead3D.tsx:72-74	Visual define DMX=0.5 como vertical abajo; IK define DMX=0.5 como horizontal	Beams desfasados 90° en tilt
Factor combinado: Un target en el frente del escenario (mismo nivel Y, a la derecha del fixture) produce DMX ≈ (0.75, 0.5) en el IK. El visualizador pinta:

Pan: 67.5° en lugar de 135° (mitad del sweep).
Tilt: vertical abajo en lugar de horizontal (90° de error).
El resultado: los beams aparecen apuntando hacia el suelo cerca del fixture, en lugar de hacia el target en el frente del escenario. Esto coincide con el síntoma reportado: "apuntan de forma errática, se cruzan y sobrecompensan".

🔧 Vía de corrección recomendada
Sincronizar rangos: El visualizador debe leer panRangeDeg/tiltRangeDeg del fixture (disponible en el transientStore o pasado como prop) en lugar de hard-codear 270°/135°.
Corregir TILT_REST_ANGLE: Para un mount ceiling, DMX=0.5 debe representar la orientación horizontal (no vertical abajo), igual que el IK. El TILT_REST_ANGLE debería ser +π/2 (+90°) para ceiling, compensando la rotación base del mount que ya apunta en -Y. Alternativamente, el visualizador podría aplicar el tilt como "elevación desde la horizontal" (como el IK) en lugar de "desviación desde la dirección base del mount".

------------------------------------
--------------------------------------
------------------------------------
------------------------------------------

🔴 ASIMETRÍA 1 — ESPEJO DE PAN (CAUSA DIRECTA DEL "SE CRUZAN")
Ficheros: FixtureLayer.ts:177-182 y HyperionMovingHead3D.tsx:49

El IK (ceiling) en InverseKinematicsEngine.ts:222-226:

local.x = dx, local.z = -dy   (fixture a 5m de altura → dy=-5 → local.z=+5)
panDeg = atan2(local.x, local.z)
→ target a +X (derecha): panDeg > 0 → DMX > 127.5 → norm > 0.5

2D FixtureLayer — slope negativa:

// FixtureLayer.ts L182
const panAngle = mapRange(physicalPan, 0, 1, Math.PI * 0.45, -Math.PI * 0.45)
// norm > 0.5 → angle < 0 → endX = x + sin(negativo)*L → beam va a la IZQUIERDA

3D HyperionMovingHead — slope positiva:

// HyperionMovingHead3D.tsx
const panAngle = (smoothPan.current! - 0.5) * PAN_RANGE
// norm > 0.5 → panAngle > 0
// El comentario WAVE 4620-B lo confirma: pan=0 (DMX mín = físico máximo-LEFT) → beam +X (derecha)
// Luego norm > 0.5 (IK: "apunta a la derecha") → panAngle > 0 → beam a la IZQUIERDA

El 2D fue alineado con el 3D en WAVE 4620-B — ambos son internamente consistentes entre sí, pero AMBOS están en espejo respecto al IK.

Efecto concreto — el cruce:



Foco IZQUIERDO, target en el centro: IK → panDeg > 0 → norm > 0.5 → visual dibuja beam hacia la IZQUIERDA (alejándose del centro)
Foco DERECHO, target en el centro: IK → panDeg < 0 → norm < 0.5 → visual dibuja beam hacia la DERECHA (alejándose del centro)
Resultado visual: ambos focos parecen huir del target — se "cruzan" en la dirección opuesta
🟠 ASIMETRÍA 2 — MULTIPLICADOR DE RANGO (CAUSA DE LA "SOBRECOMPENSACIÓN")
Tres rangos distintos, ninguno coordinado:

Componente	Rango Pan	Fichero
IK Engine (default)	540°	InverseKinematicsEngine.ts:129
3D Visualizer	270° (π * 1.5)	HyperionMovingHead3D.tsx:49
2D TacticalCanvas	162° (π * 0.45 × 2)	FixtureLayer.ts:182
Ejemplo numérico: fixture con panRange real = 540° movido 135° hacia la derecha:

IK produce DMX ≈ 191 → norm = 0.75
3D muestra: (0.75 - 0.5) * 270° = 67.5° — 2× comprimido
2D muestra: 81° - 162°*0.75 = -40.5° — 3.3× comprimido Y en dirección contraria
Sumado al espejo: el visual presenta movimiento más pequeño y hacia el lado equivocado. Combined, un foco que realmente apunta 135° a la derecha aparece apuntando ~41° a la izquierda en el canvas 2D.

El comentario en el propio código lo confirma pero lo justifica erróneamente:

// WAVE 2088.2: PAN_RANGE = Math.PI * 1.5 — Matched to professional moving head specs
// Pan: ±135° (270° total) — Standard for Clay Paky, Robe, etc.
// These are visual/cosmetic — they don't affect DMX output.

El comentario asume que 270° es correcto "para visualización" pero el IK usa 540° por defecto. Si los fixtures tienen panRangeDeg sin declarar en el ShowFile, el IK cae a 540° mientras el visualizador usa 270° hardcodeado — desacople estructural garantizado.

🟡 ASIMETRÍA 3 — ALTURA FANTASMA (EJE Y)
La cadena del Y desde stageStore al IK:

En KineticsBridge.ts:617-631:

const sf = stageFixtures.find(f => f.id === id)
if (sf?.position) {
  fixturePositions[id] = sf.position  // ← envía sf.position.y al IK
}

sf.position.y viene del ShowFile. Para fixtures no colocados (isPlaced=false), la posición sentinel es {x:0, y:3, z:0} — confirmado en ShowFileV2.ts:1135 y por los tests del migrador (posición {0, 3, 0} = no-placed).

En el visualizador 3D, el mismo fixture se renderiza a:

// useFixture3DData.ts — fixtures no-placed, ruta horizontal:
y = layout.heightFactor * trussHeight   // ej: 0.9 * 5 = 4.5m

Discrepancia: IK calcula con y=3m, el visual muestra el fixture a ~4.5-5m.

Caso extremo (y=0 en el ShowFile): si algún fixture llega con position.y = 0 (posible en shows muy anteriores o con importaciones mal formadas):

dy = target.y - 0 = 0   (si target también en y=0)
local.z = -dy = 0
panDeg = atan2(dx, 0) = ±90° para cualquier dx ≠ 0

→ Cualquier offset horizontal → pan máximo instantáneo — esto es la "sobrecompensación" en su versión más pura.

Para el caso sentinel (y=3m): el tilt que calcula el IK es ligeramente más agresivo que lo que visualmente parece correcto a 5m de altura. No es catastrófico pero sí visible cuando el target está cerca del suelo.

TABLA RESUMEN DIAGNÓSTICA
#	Asimetría	Severidad	Efecto visible	Localización
1	Espejo de pan (sign flip)	🔴 CRITICAL	Focos "huyen" del target — cruces	FixtureLayer.ts:182, HyperionMovingHead3D.tsx:49
2	Rango 540° vs 270° vs 162°	🟠 HIGH	Movimiento 2-3× comprimido + invertido	IK default vs PAN_RANGE hardcodeado
3	Y-sentinel 3m vs visual 4.5-5m	🟡 MEDIUM	Tilt levemente off en fixtures no-placed	KineticsBridge.ts:621, useFixture3DData.ts:157
PRESCRIPCIÓN QUIRÚRGICA (para la siguiente WAVE)
Fix 1 (el más importante) — invertir el signo en FixtureLayer:

// ANTES (espejo):
const panAngle = mapRange(physicalPan, 0, 1, Math.PI * 0.45, -Math.PI * 0.45)
// DESPUÉS (alineado con IK):
const panAngle = mapRange(physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45)

Y verificar si 3D también necesita invertir: en HyperionMovingHead3D.tsx, comprobar si panAngle = (pan - 0.5) * PAN_RANGE produce el beam correcto testando con un fixture conocido en el escenario. Si la misma inversión aplica:

const panAngle = -(smoothPan.current! - 0.5) * PAN_RANGE  // signo negado

Fix 2 — alinear rangos: El 3D debería leer panRangeDeg del fixture del showStore en lugar de hardcodear 270°, o al menos usar la misma escala que el IK. Alternativamente, pasar el rango desde useFixture3DData como prop a HyperionMovingHead3D.

Fix 3 — Y para fixtures no-placed: En KineticsBridge._flushSpatial(), si sf.isPlaced !== true, usar la altura calculada por zona lugar de sf.position.y:

const y = sf.isPlaced ? sf.position.y : resolveZoneHeight(sf.zone)

Donde resolveZoneHeight mapea zonas a alturas reales (ej: movers-left/right → TRUSS_HEIGHT ≈ 5m).