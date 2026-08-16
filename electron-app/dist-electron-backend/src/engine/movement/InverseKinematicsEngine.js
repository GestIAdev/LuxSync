// ═══════════════════════════════════════════════════════════════════════════
// 🎯 WAVE 2601: INVERSE KINEMATICS ENGINE
//
// Motor matemático puro de Cinemática Inversa para Moving Heads.
// Convierte un Target 3D (punto en el espacio real, metros) en valores
// Pan/Tilt DMX (0-255) para cada fixture, según su posición y orientación.
//
// ── CONTRATO ──
// • Funciones PURAS y DETERMINISTAS: mismo input → mismo output, siempre.
// • Sin efectos secundarios. Sin estado mutable. Sin aleatorios.
// • Sin dependencias de React, Electron, IPC, ni DOM.
// • Solo matemáticas y geometría.
//
// ── SISTEMA DE COORDENADAS (ShowFileV2) ──
// • X: Left(-) ← → Right(+)  desde perspectiva de audiencia
// • Y: Down(-)  ↕  Up(+)      0 = suelo
// • Z: Back(-)  ↔  Front(+)   0 = centro escenario
// • Unidad: metros
//
// ── PIPELINE ──
// SpatialTargetPad (UI) → IKEngine.solve() → MasterArbiter → PhysicsDriver → HAL → DMX
// ═══════════════════════════════════════════════════════════════════════════
import { getIKMountAngles } from './mountTransforms';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
/** Defaults de industria para moving heads */
const DEFAULT_PAN_RANGE_DEG = 540;
const DEFAULT_TILT_RANGE_DEG = 270;
/** DMX resolution */
const DMX_MAX = 255;
/**
 * Umbral de distancia horizontal para detección de Gimbal Lock (metros).
 * Cuando el target está directamente arriba/abajo del fixture (dx≈0, dz≈0),
 * el ángulo de pan es indeterminado. Por debajo de este umbral, se preserva
 * el último pan conocido.
 *
 * WAVE 5022: ampliado de 1mm → 50mm. La zona de 1mm era demasiado estrecha:
 * deltas irregulares del Fluid Timing Engine (WAVE 5016) hacían que el target
 * suavizado oscilara alrededor del umbral de 1mm, causando latigazos de pan.
 * 5cm es suficientemente grande para absorber el jitter temporal pero
 * imperceptible en un escenario de 5-10m.
 */
const GIMBAL_LOCK_EPSILON = 0.05; // 50mm — WAVE 5022: zona de singularidad blindada
/**
 * Margen de seguridad en DMX units para pan.
 * El fixture nunca golpea los topes mecánicos.
 * Consistente con PAN_SAFETY_MARGIN del FixturePhysicsDriver.
 */
const PAN_SAFETY_MARGIN = 5;
/**
 * Ángulos base de montaje (grados) por tipo de instalación.
 *
 * ── WAVE 4899 — THE FINAL CONVERGENCE (PAN UNFLIP) ──
 *
 * WAVE 4898 confirmó que tiltDeg = atan2(horizontalDist, -local.y) es correcto.
 * El yaw:180 de WAVE 4898 invertía local.x → efecto aspa en pan.
 *
 * Solución: identidad para ceiling/truss-front (local = dx, dy, dz sin cambio).
 *   pan = atan2(dx, dz): fixture derecho (dx>0) → pan>127.5 → gira a la derecha ✓
 *   Dos fixtures simétricos convergen — sin aspa ✓
 *
 * tiltDeg = atan2(horizontalDist, -local.y) — BLINDADO, no tocar.
 *   0° = suelo bajo el fixture (alineado con visualizador WAVE 4898) ✓
 *
 * truss-back: yaw:180 voltea frente↔espalda para fixtures montados de espaldas.
 *
 * wall-left/right: solo yaw. Sin inversión Y↔Z.
 */
// ⚓ WAVE 7178 (M1.2): tabla local eliminada. Los ángulos de montaje ahora
// se derivan de la SSOT (mountTransforms.ts) vía getIKMountAngles(), que
// reproduce bit a bit estos mismos valores históricos (pitch siempre 0 —
// la verticalidad la resuelve el signo de dy más abajo, no una rotación).
/**
 * WAVE 4892/4893 — Telemetría temporal del solver IK.
 * Activar con env LUX_DEBUG_IK=1 o setIKDebug(true) en runtime.
 * Emite por cada solve() el frame completo: fixture, pos, target, local, ángulos.
 * Usado para cerrar diagnóstico mecánico fixture-por-fixture sin ensayo ciego.
 *
 * Desde DevTools de Electron: window.lux_ik_debug(true)
 */
let DEBUG_IK = typeof process !== 'undefined' &&
    typeof process.env !== 'undefined' &&
    process.env.LUX_DEBUG_IK === '1';
export function setIKDebug(enabled) { DEBUG_IK = enabled; }
export function isIKDebug() { return DEBUG_IK; }
// ═══════════════════════════════════════════════════════════════════════════
// MOTOR IK — FUNCIONES PURAS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Resuelve pan/tilt DMX para que un fixture apunte a un target 3D.
 *
 * @param fixture  - Perfil IK completo del fixture (posición, orientación, calibración, límites)
 * @param target   - Punto objetivo en coordenadas de escenario (metros)
 * @param currentPanDMX - Pan DMX actual del fixture (para anti-flip shortest-path).
 *                        Si es null, no se aplica anti-flip.
 * @returns IKResult con pan/tilt DMX listos para inyectar en MasterArbiter
 */
export function solve(fixture, target, currentPanDMX = null) {
    const out = { pan: 0, tilt: 0, reachable: false, antiFlipApplied: false };
    solveInto(out, fixture, target, currentPanDMX);
    return out;
}
/**
 * 🛠️ WAVE 5034: Zero-alloc variant — mutates `out` in-place.
 * Elimina la creación de un nuevo IKResult cada frame en el hot path.
 */
// K0-BATCH-3a: Pre-allocated local frame scratch — zero alloc @ 44Hz.
const _localFrameScratch = { x: 0, y: 0, z: 0 };
export function solveInto(out, fixture, target, currentPanDMX = null) {
    const dx = target.x - fixture.position.x;
    const dy = target.y - fixture.position.y;
    const dz = target.z - fixture.position.z;
    const mountAngles = getIKMountAngles(fixture.orientation.installation);
    const totalPitchRad = mountAngles.pitchRad + fixture.orientation.rotation.pitch * DEG_TO_RAD;
    const totalYawRad = mountAngles.yawRad + fixture.orientation.rotation.yaw * DEG_TO_RAD;
    const totalRollRad = mountAngles.rollRad + fixture.orientation.rotation.roll * DEG_TO_RAD;
    // K0-BATCH-3a: Mutate pre-allocated scratch instead of allocating new object.
    const local = _localFrameScratch;
    rotateToLocalFrameInto(local, dx, dy, dz, totalPitchRad, totalYawRad, totalRollRad);
    let horizontalDist = Math.sqrt(local.x * local.x + local.z * local.z);
    // WAVE 6020 DEFLECTOR: Si el target cruza demasiado cerca del eje Y del
    // fixture, empujamos artificialmente hacia adelante (Z local) para evitar
    // que horizontalDist caiga a 0. Esto previene el Pan Flip de 180° y el
    // tilt incorrecto sin alterar la fórmula trigonométrica base.
    if (horizontalDist < GIMBAL_LOCK_EPSILON) {
        local.z -= GIMBAL_LOCK_EPSILON;
        horizontalDist = Math.sqrt(local.x * local.x + local.z * local.z);
    }
    const panDeg = Math.atan2(local.x, -local.z) * RAD_TO_DEG;
    const tiltDeg = Math.atan2(horizontalDist, -local.y) * RAD_TO_DEG;
    if (DEBUG_IK) {
        // eslint-disable-next-line no-console
        console.log('[IK]', JSON.stringify({
            fixture: fixture.id,
            installation: fixture.orientation.installation,
            pos: [fixture.position.x, fixture.position.y, fixture.position.z],
            target: [target.x, target.y, target.z],
            local: [local.x, local.y, local.z],
            angles: [panDeg, tiltDeg],
        }));
    }
    let calibratedPanDeg = panDeg + fixture.calibration.panOffset;
    let calibratedTiltDeg = tiltDeg + fixture.calibration.tiltOffset;
    const panRange = fixture.limits.panRangeDeg || DEFAULT_PAN_RANGE_DEG;
    const tiltRange = fixture.limits.tiltRangeDeg || DEFAULT_TILT_RANGE_DEG;
    let panDMXRaw = ((calibratedPanDeg + panRange / 2) / panRange) * DMX_MAX;
    let tiltDMXRaw = ((calibratedTiltDeg + tiltRange / 2) / tiltRange) * DMX_MAX;
    let antiFlipApplied = false;
    if (currentPanDMX !== null) {
        const resolved = resolveShortestPanPath(panDMXRaw, currentPanDMX, panRange);
        panDMXRaw = resolved.dmx;
        antiFlipApplied = resolved.flipped;
    }
    let panDMX = fixture.calibration.panInvert ? (DMX_MAX - panDMXRaw) : panDMXRaw;
    let tiltDMX = fixture.calibration.tiltInvert ? (DMX_MAX - tiltDMXRaw) : tiltDMXRaw;
    const panInRange = panDMXRaw >= -PAN_SAFETY_MARGIN && panDMXRaw <= DMX_MAX + PAN_SAFETY_MARGIN;
    const tiltInRange = tiltDMXRaw >= -PAN_SAFETY_MARGIN && tiltDMXRaw <= DMX_MAX + PAN_SAFETY_MARGIN;
    if (fixture.limits.tiltLimits) {
        tiltDMX = Math.max(fixture.limits.tiltLimits.min, Math.min(fixture.limits.tiltLimits.max, tiltDMX));
    }
    panDMX = Math.max(PAN_SAFETY_MARGIN, Math.min(DMX_MAX - PAN_SAFETY_MARGIN, panDMX));
    panDMX = Math.max(0, Math.min(DMX_MAX, Math.round(panDMX)));
    tiltDMX = Math.max(0, Math.min(DMX_MAX, Math.round(tiltDMX)));
    out.pan = panDMX;
    out.tilt = tiltDMX;
    out.reachable = panInRange && tiltInRange;
    out.antiFlipApplied = antiFlipApplied;
}
/**
 * Resuelve pan/tilt DMX para un grupo de fixtures apuntando al mismo target.
 * Cada fixture recibe valores distintos según su posición en el escenario.
 *
 * @param fixtures - Array de perfiles IK
 * @param target   - Punto objetivo compartido
 * @param currentPanDMXMap - Map de fixtureId → pan DMX actual (para anti-flip).
 *                           Los fixtures sin entrada usan null.
 * @returns Map de fixtureId → IKResult
 */
export function solveGroup(fixtures, target, currentPanDMXMap = null) {
    const results = new Map();
    for (const fixture of fixtures) {
        const currentPan = currentPanDMXMap?.get(fixture.id) ?? null;
        results.set(fixture.id, solve(fixture, target, currentPan));
    }
    return results;
}
// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2621-2622: SPATIAL FANNING — FUNCIONES PURAS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Calcula offsets XZ (métros) para cada fixture en un fan LINEAL.
 *
 * Los fixtures se distribuyen equidistantemente a lo largo de una línea
 * perpendicular al vector centroide→target, pasando por el target.
 * El spread total abarca `amplitude` metros de extremo a extremo.
 *
 * Con N fixtures, el i-ésimo fixture recibe un offset de:
 *   t = (i / (N-1)) - 0.5  →  rango [-0.5, +0.5]
 *   offset = t * amplitude
 *
 * La dirección de spread se calcula como la perpendicular 2D (en el plano XZ)
 * al vector centroide→target. Si el vector es nulo, se usa la dirección X.
 *
 * @param fixturePositions - Posiciones de los fixtures (para calcular centroide)
 * @param target  - Target central del grupo
 * @param amplitude - Amplitud total del spread en metros (punta a punta)
 * @returns Array de offsets { dx, dz } en metros, uno por fixture (mismo orden)
 */
export function computeLineFanOffsets(fixturePositions, target, amplitude) {
    const count = fixturePositions.length;
    if (count === 0)
        return [];
    if (count === 1 || amplitude === 0)
        return fixturePositions.map(() => ({ dx: 0, dz: 0 }));
    // Centroide de los fixtures (en XZ, ignorando Y para la dirección del spread)
    let cx = 0, cz = 0;
    for (const p of fixturePositions) {
        cx += p.x;
        cz += p.z;
    }
    cx /= count;
    cz /= count;
    // Vector centroide → target (en el plano XZ)
    const vx = target.x - cx;
    const vz = target.z - cz;
    const vLen = Math.sqrt(vx * vx + vz * vz);
    // Perpendicular 2D (rotación 90° en sentido horario)
    // Si el vector es nulo (target en el centroide), spread por defecto en X
    let perpX, perpZ;
    if (vLen < 0.001) {
        perpX = 1;
        perpZ = 0;
    }
    else {
        perpX = -vz / vLen;
        perpZ = vx / vLen;
    }
    // Distribuir offsets equidistantes
    const offsets = [];
    for (let i = 0; i < count; i++) {
        // t: [-0.5, +0.5] distribuido uniformemente
        const t = (i / (count - 1)) - 0.5;
        offsets.push({
            dx: perpX * t * amplitude,
            dz: perpZ * t * amplitude,
        });
    }
    return offsets;
}
/**
 * Calcula offsets XZ (metros) para cada fixture en un fan CIRCULAR.
 *
 * Los fixtures se distribuyen uniformemente en una circunferencia
 * de radio `amplitude/2` alrededor del target en el plano XZ.
 * Cada fixture i recibe un ángulo θ = i * (2π / N), empezando a las 12h.
 *
 * @param count     - Número de fixtures
 * @param amplitude - Diámetro del círculo en metros (radio = amplitude/2)
 * @returns Array de offsets { dx, dz } en metros
 */
export function computeCircleFanOffsets(count, amplitude) {
    if (count === 0)
        return [];
    if (count === 1 || amplitude === 0)
        return [{ dx: 0, dz: 0 }];
    const radius = amplitude / 2;
    const offsets = [];
    for (let i = 0; i < count; i++) {
        // Ángulo: empezando a las 12h (Z-), sentido horario
        const theta = (i / count) * 2 * Math.PI;
        offsets.push({
            dx: Math.sin(theta) * radius,
            dz: -Math.cos(theta) * radius, // negativo porque Z- = back = top
        });
    }
    return offsets;
}
/**
 * Resuelve pan/tilt DMX para un grupo de fixtures con fan espacial.
 * Cada fixture recibe un sub-target diferente calculado a partir del target
 * central y el modo/amplitud de fan.
 *
 * ── CONVERGE (default): todos apuntan al mismo target → wrapper de solveGroup.
 * ── LINE: sub-targets distribuidos en línea perpendicular a centroide→target.
 * ── CIRCLE: sub-targets en circunferencia alrededor del target.
 *
 * @param fixtures       - Array de perfiles IK
 * @param target         - Target central del grupo
 * @param fanMode        - Modo de dispersión ('converge' | 'line' | 'circle')
 * @param fanAmplitude   - Amplitud en metros (0 = converge)
 * @param currentPanDMXMap - Map de fixtureId → pan DMX actual (para anti-flip)
 * @returns Map de fixtureId → IKFanResult (incluye sub-target para UI)
 */
export function solveGroupWithFan(fixtures, target, fanMode, fanAmplitude, currentPanDMXMap = null) {
    const results = new Map();
    if (fixtures.length === 0)
        return results;
    // Clamp amplitude to non-negative
    const amp = Math.max(0, fanAmplitude);
    // ── CONVERGE: sin offsets, todos al mismo punto ──
    if (fanMode === 'converge' || amp === 0) {
        for (const fixture of fixtures) {
            const currentPan = currentPanDMXMap?.get(fixture.id) ?? null;
            const ik = solve(fixture, target, currentPan);
            results.set(fixture.id, { ...ik, subTarget: { ...target } });
        }
        return results;
    }
    // ── Calcular offsets según modo ──
    let offsets;
    if (fanMode === 'line') {
        const positions = fixtures.map(f => f.position);
        offsets = computeLineFanOffsets(positions, target, amp);
    }
    else {
        // 'circle'
        offsets = computeCircleFanOffsets(fixtures.length, amp);
    }
    // ── Resolver cada fixture con su sub-target ──
    for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i];
        const offset = offsets[i];
        const subTarget = {
            x: target.x + offset.dx,
            y: target.y,
            z: target.z + offset.dz,
        };
        const currentPan = currentPanDMXMap?.get(fixture.id) ?? null;
        const ik = solve(fixture, subTarget, currentPan);
        results.set(fixture.id, { ...ik, subTarget });
    }
    return results;
}
/**
 * 🏗️ WAVE 7179 (M3): Calcula ÚNICAMENTE los sub-targets espaciales para un
 * grupo de fixtures con fan. No llama solve() — pura geometría de distribución.
 *
 * Reutiliza `computeLineFanOffsets` / `computeCircleFanOffsets` para calcular
 * las desviaciones, y devuelve las coordenadas XYZ modificadas por fixture.
 *
 * @param fixtures       - Array mínimo con id + posición de cada fixture
 * @param target         - Target central del grupo
 * @param fanMode        - Modo de dispersión ('converge' | 'line' | 'circle')
 * @param fanAmplitude   - Amplitud en metros (0 = converge)
 * @returns Map de fixtureId → Target3D (sub-target calculado)
 */
export function computeFanSubTargets(fixtures, target, fanMode, fanAmplitude) {
    const results = new Map();
    if (fixtures.length === 0)
        return results;
    const amp = Math.max(0, fanAmplitude);
    // ── CONVERGE: sin offsets, todos al mismo punto ──
    if (fanMode === 'converge' || amp === 0) {
        for (const fixture of fixtures) {
            results.set(fixture.id, { ...target });
        }
        return results;
    }
    // ── Calcular offsets según modo ──
    let offsets;
    if (fanMode === 'line') {
        const positions = fixtures.map(f => f.position);
        offsets = computeLineFanOffsets(positions, target, amp);
    }
    else {
        offsets = computeCircleFanOffsets(fixtures.length, amp);
    }
    // ── Construir sub-targets sin resolver IK ──
    for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i];
        const offset = offsets[i];
        results.set(fixture.id, {
            x: target.x + offset.dx,
            y: target.y,
            z: target.z + offset.dz,
        });
    }
    return results;
}
/**
 * Construye un IKFixtureProfile desde los datos de ShowFileV2/PatchedFixture.
 * Función de conveniencia para no tener que armar el perfil manualmente.
 *
 * @param id           - ID del fixture
 * @param position     - Position3D del ShowFile
 * @param rotation     - Rotation3D del ShowFile (default: sin rotación)
 * @param installation - InstallationOrientation del ShowFile (default: 'ceiling')
 * @param calibration  - Calibración del ShowFile (default: sin offsets ni inverts)
 * @param panRangeDeg  - Rango de pan en grados (default: 540)
 * @param tiltRangeDeg - Rango de tilt en grados (default: 270)
 * @param tiltLimits   - Límites DMX de tilt (default: sin límites específicos)
 */
export function buildProfile(id, position, rotation, installation, calibration, panRangeDeg, tiltRangeDeg, tiltLimits) {
    return {
        id,
        position,
        orientation: {
            installation: installation ?? 'ceiling',
            rotation: {
                pitch: rotation?.pitch ?? 0,
                yaw: rotation?.yaw ?? 0,
                roll: rotation?.roll ?? 0,
            },
        },
        limits: {
            panRangeDeg: panRangeDeg ?? DEFAULT_PAN_RANGE_DEG,
            tiltRangeDeg: tiltRangeDeg ?? DEFAULT_TILT_RANGE_DEG,
            tiltLimits,
        },
        calibration: {
            panOffset: calibration?.panOffset ?? 0,
            tiltOffset: calibration?.tiltOffset ?? 0,
            panInvert: calibration?.panInvert ?? false,
            tiltInvert: calibration?.tiltInvert ?? false,
        },
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES INTERNAS — GEOMETRÍA PURA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Transforma un vector del espacio de escenario al frame de referencia local
 * del fixture, aplicando la rotación inversa de montaje.
 *
 * La rotación de montaje define "hacia dónde mira el fixture" en reposo.
 * Para obtener el vector en el frame local, rotamos el vector mundo por
 * la INVERSA de la rotación de montaje (Euler YXZ inverso).
 *
 * Orden de aplicación: -Yaw → -Pitch → -Roll
 * (inverso del orden de composición Yaw·Pitch·Roll)
 *
 * INVARIANTE (WAVE 4889): con pitch=0 (ceiling/truss-front), esta función
 * produce local.x=dx, local.y=dy, local.z=dz (identidad en el plano XZ).
 * Solo el yaw mezcla X↔Z. El pitch NUNCA debe ser ±90° para orientaciones
 * donde el pan deba depender de la profundidad del escenario (dz).
 */
function rotateToLocalFrame(dx, dy, dz, pitchRad, yawRad, rollRad) {
    // Rotación inversa de Yaw (eje Y)
    const cy = Math.cos(-yawRad);
    const sy = Math.sin(-yawRad);
    const x1 = dx * cy + dz * sy;
    const y1 = dy;
    const z1 = -dx * sy + dz * cy;
    // Rotación inversa de Pitch (eje X)
    const cp = Math.cos(-pitchRad);
    const sp = Math.sin(-pitchRad);
    const x2 = x1;
    const y2 = y1 * cp - z1 * sp;
    const z2 = y1 * sp + z1 * cp;
    // Rotación inversa de Roll (eje Z)
    const cr = Math.cos(-rollRad);
    const sr = Math.sin(-rollRad);
    return {
        x: x2 * cr - y2 * sr,
        y: x2 * sr + y2 * cr,
        z: z2,
    };
}
/**
 * K0-BATCH-3a: Zero-alloc variant — mutates `out` in place.
 * Same math as rotateToLocalFrame, but writes to a pre-allocated object.
 */
function rotateToLocalFrameInto(out, dx, dy, dz, pitchRad, yawRad, rollRad) {
    // Rotación inversa de Yaw (eje Y)
    const cy = Math.cos(-yawRad);
    const sy = Math.sin(-yawRad);
    const x1 = dx * cy + dz * sy;
    const y1 = dy;
    const z1 = -dx * sy + dz * cy;
    // Rotación inversa de Pitch (eje X)
    const cp = Math.cos(-pitchRad);
    const sp = Math.sin(-pitchRad);
    const x2 = x1;
    const y2 = y1 * cp - z1 * sp;
    const z2 = y1 * sp + z1 * cp;
    // Rotación inversa de Roll (eje Z)
    const cr = Math.cos(-rollRad);
    const sr = Math.sin(-rollRad);
    out.x = x2 * cr - y2 * sr;
    out.y = x2 * sr + y2 * cr;
    out.z = z2;
}
/**
 * Resuelve la ruta más corta de pan para evitar el "Pan Flip".
 *
 * El problema: el rango de pan es 0-540°. Cuando un target cruza de un
 * lado al otro del fixture, el ángulo puede saltar de ~0° a ~540° o viceversa,
 * causando un giro mecánico violento de casi vuelta y media.
 *
 * La solución: el ángulo de pan tiene dos representaciones válidas
 * (panDeg y panDeg ± 360°). Elegimos la que minimiza el desplazamiento
 * respecto a la posición actual.
 *
 * @param rawDMX     - Pan DMX calculado por el IK (puede exceder 0-255)
 * @param currentDMX - Pan DMX actual del fixture
 * @param panRange   - Rango de pan en grados
 * @returns El DMX corregido y si se aplicó flip
 */
function resolveShortestPanPath(rawDMX, currentDMX, panRange) {
    // Un giro completo (360°) convertido a DMX
    const fullRotationDMX = (360 / panRange) * DMX_MAX;
    // Candidatos: el valor directo y las dos alternativas ±360°
    const candidate0 = rawDMX;
    const candidate1 = rawDMX + fullRotationDMX;
    const candidate2 = rawDMX - fullRotationDMX;
    // K0-BATCH-3b: Inline candidate selection — zero array alloc.
    // Valid range with safety margin
    const minValid = -PAN_SAFETY_MARGIN;
    const maxValid = DMX_MAX + PAN_SAFETY_MARGIN;
    // Start with candidate0 as best
    let bestDmx = rawDMX;
    let bestDelta = Math.abs(candidate0 - currentDMX);
    let flipped = false;
    // Check candidate1 (+360°)
    if (candidate1 >= minValid && candidate1 <= maxValid) {
        const d1 = Math.abs(candidate1 - currentDMX);
        if (d1 < bestDelta) {
            bestDmx = candidate1;
            bestDelta = d1;
            flipped = true;
        }
    }
    // Check candidate2 (-360°)
    if (candidate2 >= minValid && candidate2 <= maxValid) {
        const d2 = Math.abs(candidate2 - currentDMX);
        if (d2 < bestDelta) {
            bestDmx = candidate2;
            bestDelta = d2;
            flipped = true;
        }
    }
    // If bestDmx is still rawDMX but it's out of range, and no valid candidate was found,
    // the raw value will be clamped downstream — same behavior as the old code.
    return { dmx: bestDmx, flipped };
}
/**
 * Convierte un valor DMX (0-255) a grados relativos al centro mecánico.
 * Inversa del mapeo grados→DMX usado en solve().
 *
 * @param dmx      - Valor DMX (0-255)
 * @param rangeDeg - Rango total en grados (ej: 540 para pan)
 * @returns Grados relativos al centro (negativo = izquierda/abajo, positivo = derecha/arriba)
 */
function dmxToDegrees(dmx, rangeDeg) {
    // DMX 127.5 = centro = 0°
    // DMX 0     = -rangeDeg/2
    // DMX 255   = +rangeDeg/2
    return (dmx / DMX_MAX) * rangeDeg - rangeDeg / 2;
}
