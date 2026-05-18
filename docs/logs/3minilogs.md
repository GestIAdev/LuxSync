WAVE 4901 — KINEMATIC LITMUS TEST
Test 1: ¿Yaw:180 invierte solo X o también Z?
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\InverseKinematicsEngine.ts:572-577

ts
const cy = Math.cos(-yawRad)   // yaw=180° → cos(-π) = -1
const sy = Math.sin(-yawRad)   // yaw=180° → sin(-π) =  0
const x1 =  dx * cy + dz * sy  //  dx*(-1) + dz*0   = -dx
const z1 = -dx * sy + dz * cy  // -dx*0   + dz*(-1) = -dz
Veredicto: yaw:180 invierte AMBOS — local.x = -dx y local.z = -dz. No solo X.

Test 2: Aislamiento X puro — DMX 191 ¿gira a qué lado?
IK con identidad, target en dx=+4, dz=0:

panDeg = atan2(4, 0) = +90°
panDMX = ((90 + 270) / 540) * 255 = (360/540) * 255 ≈ 170 DMX
Nota: con rango 540° el +90° da 170, no 191. El 191 correspondería a atan2(dx, dz) con otro rango o offset. Pero el análisis de polaridad es el mismo.

Visualizador con pan = 170/255 = 0.667:

@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\visualizer\fixtures\HyperionMovingHead3D.tsx:298

ts
panAngle = -(0.667 - 0.5) * panRangeRad = -0.167 * 9.425 = -1.571 rad = -90°
panAngle = -90° sobre PAN_AXIS = Y(0,1,0): rotación negativa en Y = gira hacia -X en Three.js (right-hand rule desde arriba: negativo = sentido horario = hacia la derecha del escenario = +X visual desde perspectiva del público).

Polaridad del visualizador: panDMX > 127.5 → panAngle < 0 → gira hacia la derecha (+X visual).

Con dx = +4 (target a la derecha), IK produce panDMX ≈ 170 > 127.5 → visualizador gira a la derecha. Correcto: sin inversión X.

Test 3: Aislamiento Z puro — DMX 127.5 ¿mira al frente o al fondo?
IK con identidad, target al frente dx=0, dz=+4:

panDeg = atan2(0, 4) = 0°
panDMX = ((0 + 270) / 540) * 255 = 127.5
Visualizador con pan = 0.5:

ts
panAngle = -(0.5 - 0.5) * panRangeRad = 0 rad
yokeQuat = R_Y(0) = identidad. El yokeRef con rotación cero tiene al headRef apuntando en -Y local. El modelo ceiling = quaternion identidad → -Y local = -Y mundo = hacia el suelo.

DMX 127.5 → yoke sin rotación → el haz apunta verticalmente al suelo (-Y). No apunta ni al frente ni al fondo — es totalmente vertical. La dirección Z solo aparece cuando el tilt es distinto de cero.

Con tilt > 127.5 (inclinado): tiltAngle < 0 sobre TILT_AXIS = X(1,0,0) → rota en -X → haz se mueve de -Y hacia +Z (frente del escenario).

Diagnóstico del Rombo
Con panDeg = atan2(dx, dz) e identidad, para un target fijo con dz > 0:

Fixture izquierdo (x=-5, pos): dx = targetX - (-5) = targetX + 5 > 0 → panDeg > 0 → panDMX > 127.5 Fixture derecho (x=+5, pos): dx = targetX - 5 < 0 (si targetX < 5) → panDeg < 0 → panDMX < 127.5

El fixture izquierdo gira a la derecha y el derecho a la izquierda → convergen hacia el centro. Matemáticamente no hay rombo en el IK.

La causa probable del rombo observado es el tiltDeg aún siendo positivo para targets por encima del fixture. Con atan2(horizontalDist, -local.y), si el target está encima del fixture (dy > 0), entonces -local.y = -dy < 0 → atan2(hdist, negativo) > 90° → tiltDMX > 127 + range/4. En un fixture de techo (y=6m) apuntando a un target en y=1m (dy=-5): -local.y=+5, correcto. Pero si el sistema envía targets sobre y=6m, el tilt se invierte.

Diagnóstico definitivo
Test	Resultado
yaw:180	Invierte X y Z simultáneamente — no es cirugía limpia
panDMX > 127.5	Gira visual hacia +X (derecha) ✓ sin inversión
panDMX = 127.5	Yoke neutral, haz al suelo (no hay desfase Z en el pan)
Rombo	No proviene de inversión X/Z. El atan2(dx, dz) converge correctamente.
La causa más probable del "rombo" observado no es el eje Z del pan. Es que el visualizador muestra el pan con la fórmula correcta pero el hardware físico tiene la convención de pan invertida respecto al IK — es decir, en el fixture real panDMX > 127.5 gira a la izquierda física, no a la derecha. Eso produce que los fixtures laterales diverjan en lugar de converger.

Recomendación: antes de tocar matrices, activar LUX_DEBUG_IK y comparar los valores [IK] con el movimiento visual en el visualizador para un solo fixture. Si el visualizador muestra convergencia pero el hardware diverge, el fix correcto es panInvert: true en el perfil del fixture o en MOUNT_ANGLES vía roll:180 (que solo invierte X sin tocar Z ni Y).