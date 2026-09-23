/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 MASS OPS — WAVE 8130 (Fase 2): Clonación Masiva de Fixtures
 *
 * Generadores geométricos PUROS para Erebus: Array Lineal, Matriz,
 * Distribución Circular y Espejo X. Sin stores, sin Electron — testeable
 * en node. La inyección la hace `stageStore.addFixtures()` (un push +
 * una sola sync `lux.aether.setFixtures` — Amnesia Bug tapado).
 *
 * REGLAS DURAS:
 *   - Todo clon nace `address: 0` (UNPATCHED — WAVE 7731: la autoridad de
 *     routing vive en DMX Nexus/Patchbay; clonar jamás pisa el universo).
 *   - IDs por `generateId('fix')` del store — `fix-${Date.now()}` colisiona
 *     en batches del mismo ms.
 *   - Deep-clone REAL: `position`, `rotation`, `physics`, `channels`,
 *     `capabilities`, `calibration` nunca se comparten por referencia con
 *     la semilla (el `{...original}` shallow de duplicateFixture era una
 *     bomba de estado compartido — auditoría 8130-F1 bloqueo #3).
 *   - Semillas iteradas round-robin: una selección mixta genera un array
 *     que ALTERNAN los modelos seleccionados (A/B/A/B…). Con 1 semilla el
 *     comportamiento degenera al clásico "copiar N veces".
 *
 * @module core/stage/massOps
 * @version WAVE 8130-F2
 * ═══════════════════════════════════════════════════════════════════════════
 */
/**
 * 🛡️ WAVE 8140 (M1): epsilon anti-superposición.
 * `_syncDerivedState` snapea a voxel 0.25m → dos puntos a <0.125m colapsan
 * al mismo voxel. Cualquier clon dentro de este radio de una semilla se
 * omite: NUNCA estampamos un clon sobre una fixture original.
 */
const SEED_COLLISION_EPS = 0.125;
const collidesWithSeed = (pos, seeds) => seeds.some((s) => Math.abs(s.position.x - pos.x) < SEED_COLLISION_EPS &&
    Math.abs(s.position.y - pos.y) < SEED_COLLISION_EPS &&
    Math.abs(s.position.z - pos.z) < SEED_COLLISION_EPS);
// ═══════════════════════════════════════════════════════════════════════════
// DEEP CLONE — nada se comparte por referencia con la semilla
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Clona profundo un fixture: cada objeto anidado mutable recibe copia
 * propia. `address` se fuerza a 0 SIEMPRE (UNPATCHED) — puede sobreescribirse
 * vía `overrides` solo si el caller sabe lo que hace (el Patchbay lo hace).
 */
export function deepCloneFixture(original, newId, overrides = {}) {
    return {
        ...original,
        id: newId,
        address: 0, // 🏗️ WAVE 7731: nacen UNPATCHED — jamás pisar el patch
        position: { ...original.position },
        rotation: { ...original.rotation },
        physics: {
            ...original.physics,
            homePosition: { ...original.physics.homePosition },
            tiltLimits: { ...original.physics.tiltLimits },
        },
        channels: original.channels?.map((ch) => ({ ...ch })),
        capabilities: original.capabilities
            ? {
                ...original.capabilities,
                colorWheel: original.capabilities.colorWheel
                    ? {
                        colors: original.capabilities.colorWheel.colors.map((c) => ({
                            ...c,
                            rgb: { ...c.rgb },
                        })),
                    }
                    : undefined,
            }
            : undefined,
        calibration: original.calibration ? { ...original.calibration } : undefined,
        ...overrides,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// GENERADORES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * LINEAR ARRAY — repite la SELECCIÓN como bloque `count` veces:
 * la copia k de cada semilla nace en `seed.pos + k·offset` con
 * k = 1..count (WAVE 8140-M1: el multiplicador NUNCA parte de 0 — el
 * primer clon ya desplaza un offset completo, jamás pisa a la semilla).
 * Total = seeds.length × count. Con 1 semilla → N copias marchando.
 */
export function generateLinearArray(seeds, count, offset, idGen) {
    const out = [];
    for (let k = 1; k <= count; k++) {
        for (const seed of seeds) {
            const position = {
                x: seed.position.x + offset.x * k,
                y: seed.position.y + offset.y * k,
                z: seed.position.z + offset.z * k,
            };
            // Guard extra (offset 0 explícito del operador): un clon en la
            // posición exacta de una semilla no aporta nada — se omite.
            if (collidesWithSeed(position, seeds))
                continue;
            out.push(deepCloneFixture(seed, idGen(), {
                name: `${seed.name} ·L${k}`,
                position,
            }));
        }
    }
    return out;
}
/**
 * GRID MATRIX — retícula `cols × rows` anclada en la posición del
 * PRIMER seed (crece +X / +Z). La celda (c, r) usa la semilla
 * `(r·cols + c) mod n` — una selección mixta produce matrices que
 * alternan modelos (PAR/MH/PAR/MH…). Y se hereda de la semilla de la
 * celda (un fixture de suelo sigue en suelo, uno de truss en truss).
 */
export function generateGridMatrix(seeds, cols, rows, spacingX, spacingZ, idGen) {
    const out = [];
    const anchor = seeds[0];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // 🛡️ WAVE 8140-M1: la celda origen (0,0) coincide con la posición
            // del seed ancla — se omite para no estampar un clon encima.
            // La retícula produce (cols × rows) − 1 clones.
            if (c === 0 && r === 0)
                continue;
            const seed = seeds[(r * cols + c) % seeds.length];
            const position = {
                x: anchor.position.x + c * spacingX,
                y: seed.position.y,
                z: anchor.position.z + r * spacingZ,
            };
            if (collidesWithSeed(position, seeds))
                continue;
            out.push(deepCloneFixture(seed, idGen(), {
                name: `${seed.name} ·G${r + 1}x${c + 1}`,
                position,
            }));
        }
    }
    return out;
}
/**
 * CIRCULAR — `count` clones sobre un anillo de radio `radius` centrado
 * en el CENTROIDE de la selección. Celda i usa seeds[i % n].
 *
 * En el plano 'XZ' (vista cenital — el caso real de un ring de movers)
 * cada clon además rota yaw para MIRAR AL CENTRO del anillo. En XY/YZ
 * el giro de mirada no es un yaw simple → se conserva la rotación de la
 * semilla (honesto, sin magia).
 */
export function generateCircularArray(seeds, count, radius, axis, idGen) {
    const out = [];
    const cx = seeds.reduce((a, s) => a + s.position.x, 0) / seeds.length;
    const cy = seeds.reduce((a, s) => a + s.position.y, 0) / seeds.length;
    const cz = seeds.reduce((a, s) => a + s.position.z, 0) / seeds.length;
    for (let i = 0; i < count; i++) {
        const seed = seeds[i % seeds.length];
        const theta = (i / count) * Math.PI * 2;
        let position;
        if (axis === 'XY') {
            position = {
                x: cx + radius * Math.cos(theta),
                y: cy + radius * Math.sin(theta),
                z: seed.position.z,
            };
        }
        else if (axis === 'YZ') {
            position = {
                x: seed.position.x,
                y: cy + radius * Math.cos(theta),
                z: cz + radius * Math.sin(theta),
            };
        }
        else {
            // 'XZ' — cenital: mirar al centro → yaw apunta contra el radio
            position = {
                x: cx + radius * Math.cos(theta),
                y: seed.position.y,
                z: cz + radius * Math.sin(theta),
            };
        }
        // 🛡️ WAVE 8140-M1: si una semilla ya está EN el perímetro a ese
        // ángulo (p.ej. densificar un anillo existente), el clon colisionaría
        // con ella → se omite. Esto subsume el caso "i === 0": con centroide,
        // θ=0 no es especial salvo que una semilla ocupe ese punto exacto.
        if (collidesWithSeed(position, seeds))
            continue;
        const overrides = {
            name: `${seed.name} ·C${i + 1}`,
            position,
        };
        if (axis === 'XZ') {
            overrides.rotation = {
                ...seed.rotation,
                yaw: Math.round(Math.atan2(-Math.cos(theta), -Math.sin(theta)) * (180 / Math.PI)),
            };
        }
        out.push(deepCloneFixture(seed, idGen(), overrides));
    }
    return out;
}
/**
 * MIRROR X — espejo sobre el plano YZ: cada seleccionado genera un clon
 * en {-x, y, z} con reflexión geométrica real de rotación (yaw→−yaw,
 * roll→−roll; pitch intacto — la rotación sobre X no cambia de signo).
 * orientation/zone/rigId se heredan verbatim de la semilla.
 */
export function generateMirrorX(seeds, idGen) {
    const out = [];
    for (const seed of seeds) {
        const position = {
            x: -seed.position.x,
            y: seed.position.y,
            z: seed.position.z,
        };
        // 🛡️ WAVE 8140-M1: una semilla en x≈0 espeja sobre sí misma → skip.
        if (collidesWithSeed(position, seeds))
            continue;
        out.push(deepCloneFixture(seed, idGen(), {
            name: `${seed.name} ·M`,
            position,
            rotation: {
                pitch: seed.rotation.pitch,
                yaw: -seed.rotation.yaw,
                roll: -seed.rotation.roll,
            },
            // Un clon espejo no hereda el anclaje a rig — el truss no está espejado
            rigId: undefined,
        }));
    }
    return out;
}
