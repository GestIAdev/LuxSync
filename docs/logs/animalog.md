WAVE 4897 — REPORTE FORENSE
HIPÓTESIS 1: Desfase de 90° en el centro del Tilt
IK Engine — qué significa DMX 127.5 para Tilt
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\InverseKinematicsEngine.ts:271-274

ts
// panDeg=0 (frente) → centro mecánico → DMX 127.5
let tiltDMXRaw = ((calibratedTiltDeg + tiltRange / 2) / tiltRange) * DMX_MAX
Con tiltDeg = 0 y rango 270°:

tiltDMXRaw = ((0 + 135) / 270) * 255 = 127.5
IK define tiltDeg=0 como horizontal (cabeza apuntando perpendicular al yoke). DMX 127.5 = horizontal.

Visualizador 3D — qué significa DMX 127.5 para Tilt
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\visualizer\fixtures\HyperionMovingHead3D.tsx:54-56

ts
// WAVE 4642: reposo físico real en visualizador.
// En ceiling, DMX center (tilt=0.5) debe apuntar vertical al suelo.
const TILT_REST_ANGLE = 0
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\visualizer\fixtures\HyperionMovingHead3D.tsx:298-299

ts
const panAngle  = -(smoothPan.current!  - 0.5) * mechanicalPanRangeRad
const tiltAngle = -(smoothTilt.current! - 0.5) * mechanicalTiltRangeRad + TILT_REST_ANGLE
Con tilt = 127.5/255 = 0.5: tiltAngle = -(0.5 - 0.5) * range + 0 = 0 rad.

El head group emite el haz en -Y local (cilindro apunta a [0, -3.5/2 - 0.08, 0]). Con TILT_REST_ANGLE = 0, tiltAngle = 0 → R_X(0) = sin rotación → haz apunta en -Y local.

El modelo tiene ceiling = quaternion identidad en mountQuaternion.ts → -Y local = -Y mundo = hacia el suelo.

Visualizador define DMX 127.5 = apuntando verticalmente al suelo.

Veredicto Hipótesis 1
CONFIRMADO PARCIALMENTE — pero el desfase es 90° solo para floor, no para ceiling.

IK (tiltDeg=0)	Visualizador (tilt=0.5)
ceiling	Horizontal	Vertical al suelo
floor	Horizontal	Vertical al techo
Para ceiling: el IK con identidad genera tiltDeg = atan2(dy, dist). Fixture en y=6, target en y=0: dy=-6, tiltDeg = atan2(-6, dist) ≈ -72°. tiltDMX = ((-72 + 135)/270)*255 ≈ 59 DMX. El visualizador interpreta 59/255 = 0.23 → tiltAngle = -(0.23-0.5)*range = +0.27*4.71 = +1.27 rad = +73° → el haz rota +73° en el eje X desde -Y. Desde -Y (abajo) girando +73° → apunta aproximadamente hacia el display. ✓

El desfase de 90° se manifestaría si se comparara un floor con el ceiling. El ceiling actual (WAVE 4896) es internamente consistente con el visualizador.

HIPÓTESIS 2: Bypass del Adaptador (KineticAdapter vs NodeArbiter)
Ruta exacta del IK hacia DMX
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts:706-723

ts
const panNorm  = ikResult.pan  / 255   // 0-255 → 0.0-1.0
const tiltNorm = ikResult.tilt / 255
 
arbiter.setMotorKineticOverride(`${id}:kinetic`, {
  pan_base:  panNorm,
  tilt_base: tiltNorm,
})
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts:644-651

ts
const panBase  = channels['pan_base']   // 0.0-1.0
const tiltBase = channels['tilt_base']
if (isFiniteChannelValue(panBase)) {
  record['pan']  = panBase  < 0 ? 0 : panBase  > 1 ? 1 : panBase  // simple clamp
}
if (isFiniteChannelValue(tiltBase)) {
  record['tilt'] = tiltBase < 0 ? 0 : tiltBase > 1 ? 1 : tiltBase
}
No hay inversión, no hay transformación. Es un clamp [0,1] directo. El visualizador lee pan/255 y tilt/255 desde el transientStore — misma normalización.

¿KineticAdapter interfiere?
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\KineticAdapter.ts tiene if (node.isContinuous) return (WAVE 4824) — los nodos IK no son isContinuous, pero el IK usa setMotorKineticOverride que es un mapa separado e independiente de _manualOverrides. El KineticAdapter escribe en _manualOverrides (vía setManualOverride). El bloque _motorKineticOverrides se aplica después de todo (línea 638), con supremacía absoluta.

No hay colisión de rutas.

Veredicto Hipótesis 2
REFUTADO. La ruta IK → setMotorKineticOverride → record['pan'] es directa, sin alteración ni inversión. El valor panDMX/255 del IK llega exactamente como livePan al visualizador. Las dos rutas (IK y VMM clásico) terminan en el mismo record['pan'] en [0,1] sin diferencia de polaridad.

HIPÓTESIS 3: Inversión de Pan (Efecto Aspa)
IK: Pan positivo → ¿DMX sube o baja?
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\InverseKinematicsEngine.ts:273

ts
let panDMXRaw = ((calibratedPanDeg + panRange / 2) / panRange) * DMX_MAX
panDeg > 0 → panDMXRaw > 127.5 → DMX sube con pan positivo.

panDeg = atan2(local.x, local.z). Target a la derecha (dx > 0, dz > 0): panDeg > 0 → panDMX > 127.5.

Visualizador: DMX sube → ¿gira a qué lado?
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\visualizer\fixtures\HyperionMovingHead3D.tsx:298

ts
const panAngle = -(smoothPan.current! - 0.5) * mechanicalPanRangeRad
panDMX > 127.5 → livePan > 0.5 → (livePan - 0.5) > 0 → panAngle < 0 (negativo).

panAngle < 0 sobre PAN_AXIS = Y → rotación negativa en Y = gira hacia -X = gira a la derecha en Three.js (right-hand rule: Y+ arriba, rotar Y negativo = horario visto desde arriba = gira a la derecha).

¿Coincide con lo esperado?
Con ceiling = quaternion identidad y baseQuat = identity, target a la derecha en el escenario (dx > 0) → panDeg > 0 → panDMX > 127.5 → panAngle < 0 → haz gira a la derecha (-X en Three.js).

¿Pero el escenario de Three.js tiene X hacia la derecha? Sí — el sistema de coordenadas de Three.js (Y-up, right-hand) tiene +X hacia la derecha desde la perspectiva del público. El escenario LuxSync coincide (x positivo = lado derecho del escenario). El haz girando en -Y → hacia la derecha → coincide con el target estando a la derecha. ✓

PERO: El comentario en la línea 297 del visualizador dice explícitamente:

ts
// Pan invertido para alinear con IK (ceiling): target +X => physicalPan>0.5 => haz hacia +X en top-down.
Esto confirma que el visualizador tiene el negativo en el panAngle intencionalmente como compensación para el IK — fueron diseñados juntos. No hay inversión accidental.

Veredicto Hipótesis 3
REFUTADO como bug de pipeline. La convención es consistente. Si se observa efecto aspa en la pantalla, la causa es matemática en el IK (qué panDeg calcula para un target dado), no una inversión en la capa de traducción.

CONCLUSIÓN FORENSE
Hipótesis	Veredicto	Causa real
H1: Desfase 90° en Tilt	REFUTADO para ceiling actual (WAVE 4896). El IK con identidad + atan2(dy, dist) es coherente con TILT_REST_ANGLE=0 del visualizador.	No existe desfase en ceiling. Existiría en floor si se compararan, pero los fixtures ceiling están bien.
H2: Bypass/inversión en adaptador	REFUTADO. Ruta IK → setMotorKineticOverride → record['pan'] es passthrough directo sin transformación.	No hay diferencia de polaridad entre rutas.
H3: Pan invertido en pipeline	REFUTADO. El negativo en panAngle del visualizador es intencional y documentado como compensación para el IK. panDMX > 127.5 → gira hacia +X correctamente.	Si hay efecto aspa, la causa es el atan2 recibiendo los signos incorrectos de local.x y local.z.
Implicación directa
La matemática del pipeline es correcta. El único nodo de variabilidad real es la señal que entra al pipeline: los valores panDeg y tiltDeg calculados por atan2 en solve(). Si los focos forman un "aspa", significa que local.x y/o local.z tienen el signo incorrecto para alguna clase de fixture — lo que es exactamente el terreno que las WAVEs 4892-4896 han estado ajustando. La configuración actual de WAVE 4896 (identidad completa) produce local = (dx, dy, dz) sin transformación, que es matemáticamente la más limpia posible.