/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔨 FORGE HYBRID BUILDER STATE — WAVE 4732-A
 *
 * IForgeBuilderState: única fuente de verdad mientras la Forja está abierta.
 * Reducer puro + action types exhaustivos.
 *
 * DISEÑO: Dos mundos, un estado.
 *   - `channels`: el mundo físico DMX (1 entry por canal, indexed por dmxOffset).
 *   - `cells`:    el mundo lógico Aether (ICapabilityNode builders, N canales c/u).
 *
 * Las warnings emitidas por el reducer fluyen a través de `drainForgeWarnings()`
 * (side-channel intencional — el reducer permanece puro respecto al state React).
 *
 * @module core/forge/forgeBuilderState
 * @version WAVE 4732-A
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { NodeFamily } from '../aether/types';
import { canAdmit } from './cellTypeAdmittance';
// Mutable por diseño — side-channel fuera del state React.
let _pendingWarnings = [];
/** Consume y devuelve las warnings generadas por el reducer desde el último drain. */
export function drainForgeWarnings() {
    const w = _pendingWarnings;
    _pendingWarnings = [];
    return w;
}
function emitWarning(w) {
    _pendingWarnings.push(w);
}
// ═══════════════════════════════════════════════════════════════════════════
// INITIAL STATE & ID GENERATION
// ═══════════════════════════════════════════════════════════════════════════
export function makeInitialForgeState() {
    return {
        meta: {
            manufacturer: '',
            name: '',
            type: 'generic',
            channelCount: 8,
        },
        channels: [],
        cells: [],
        dmxGovernors: [],
        capabilities: {},
        physics: null,
        wheels: null,
        dirty: false,
    };
}
let _cellSerial = 0;
function nextCellId(family) {
    return `${String(family).toLowerCase()}-${++_cellSerial}`;
}
// ═══════════════════════════════════════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════════════
export function forgeReducer(state, action) {
    switch (action.type) {
        // ── META ────────────────────────────────────────────────────────────
        case 'META_SET_MANUFACTURER':
            return { ...state, meta: { ...state.meta, manufacturer: action.manufacturer }, dirty: true };
        case 'META_SET_NAME':
            return { ...state, meta: { ...state.meta, name: action.name }, dirty: true };
        case 'META_SET_TYPE':
            return { ...state, meta: { ...state.meta, type: action.fixtureType }, dirty: true };
        case 'META_SET_MODE':
            return { ...state, meta: { ...state.meta, mode: action.mode }, dirty: true };
        case 'META_SET_CHANNEL_COUNT': {
            const count = Math.max(1, action.channelCount);
            return {
                ...state,
                meta: { ...state.meta, channelCount: count },
                channels: resizeChannels(state.channels, count),
                dirty: true,
            };
        }
        // ── CHANNEL (DMX Layout) ─────────────────────────────────────────────
        case 'CHANNEL_REPLACE':
            return {
                ...state,
                channels: patchChannel(state.channels, action.idx, action.channel),
                dirty: true,
            };
        case 'CHANNEL_SET_TYPE':
            return {
                ...state,
                channels: patchChannel(state.channels, action.idx, { type: action.channelType }),
                dirty: true,
            };
        case 'CHANNEL_SET_NAME':
            return {
                ...state,
                channels: patchChannel(state.channels, action.idx, { name: action.name }),
                dirty: true,
            };
        case 'CHANNEL_SET_DEFAULT':
            return {
                ...state,
                channels: patchChannel(state.channels, action.idx, { defaultValue: action.value }),
                dirty: true,
            };
        case 'CHANNEL_SET_16BIT':
            return {
                ...state,
                channels: patchChannel(state.channels, action.idx, { is16bit: action.is16bit }),
                dirty: true,
            };
        case 'CHANNEL_CLEAR':
            return {
                ...state,
                channels: patchChannel(state.channels, action.idx, {
                    type: 'unknown', name: '', defaultValue: 0, is16bit: false, ignitionDeps: [],
                }),
                dirty: true,
            };
        case 'IGNITION_ADD': {
            const ch = state.channels[action.idx];
            if (!ch)
                return state;
            const deps = [...(ch.ignitionDeps ?? []), action.dep];
            return {
                ...state,
                channels: patchChannel(state.channels, action.idx, { ignitionDeps: deps }),
                dirty: true,
            };
        }
        case 'IGNITION_UPDATE': {
            const ch = state.channels[action.idx];
            if (!ch || !ch.ignitionDeps)
                return state;
            const deps = ch.ignitionDeps.map((d, i) => i === action.depIdx ? { ...d, ...action.patch } : d);
            return {
                ...state,
                channels: patchChannel(state.channels, action.idx, { ignitionDeps: deps }),
                dirty: true,
            };
        }
        case 'IGNITION_REMOVE': {
            const ch = state.channels[action.idx];
            if (!ch || !ch.ignitionDeps)
                return state;
            const deps = ch.ignitionDeps.filter((_, i) => i !== action.depIdx);
            // WAVE 4872: Simetría con handler V1 — eliminar la clave cuando queda vacía.
            // Dejar ignitionDeps:[] en forgeState causaba asimetría respecto al Channel Rack
            // (que omite la clave) y contaminaba la igualdad estructural sameDeps en sync.
            const patchedCh = deps.length === 0
                ? (({ ignitionDeps: _omit, ...rest }) => rest)(ch)
                : { ...ch, ignitionDeps: deps };
            return {
                ...state,
                channels: state.channels.map((c, i) => i === action.idx ? patchedCh : c),
                dirty: true,
            };
        }
        // ── CELL (Aether Modules) ────────────────────────────────────────────
        case 'CELL_CREATE': {
            const cellId = action.cellId ?? nextCellId(action.family);
            const newCell = {
                cellId,
                family: action.family,
                label: defaultLabelFor(action.family),
                role: 'primary',
                channelIndices: [],
                uiPosition: { x: 0, y: state.cells.length * 140 },
            };
            return { ...state, cells: [...state.cells, newCell], dirty: true };
        }
        case 'CELL_RENAME_LABEL':
            return {
                ...state,
                cells: state.cells.map(c => c.cellId === action.cellId ? { ...c, label: action.label } : c),
                dirty: true,
            };
        case 'CELL_SET_ROLE':
            return {
                ...state,
                cells: state.cells.map(c => c.cellId === action.cellId ? { ...c, role: action.role } : c),
                dirty: true,
            };
        case 'CELL_SET_ZONE':
            return {
                ...state,
                cells: state.cells.map(c => c.cellId === action.cellId ? { ...c, aetherZone: action.zone } : c),
                dirty: true,
            };
        case 'CELL_DELETE':
            return {
                ...state,
                cells: state.cells.filter(c => c.cellId !== action.cellId),
                dirty: true,
            };
        case 'CELL_ATTACH_CHANNEL': {
            const { cellId, channelIdx } = action;
            const targetCell = state.cells.find(c => c.cellId === cellId);
            if (!targetCell)
                return state;
            const channel = state.channels[channelIdx];
            if (!channel)
                return state;
            // Aduana de tipos — AUTORIDAD FINAL (triple validation §6.3)
            const admission = canAdmit(channel.type, targetCell.family);
            if (admission.ok === false) {
                emitWarning({ cellId, channelIdx, reason: admission.reason });
                return state; // no-op
            }
            // Invariant (§3): channelIdx pertenece como máximo a UNA célula.
            // Se detach de cualquier célula previa antes de añadir.
            const cells = state.cells.map(c => {
                if (c.cellId === cellId) {
                    if (c.channelIndices.includes(channelIdx))
                        return c; // ya está
                    return { ...c, channelIndices: [...c.channelIndices, channelIdx] };
                }
                if (c.channelIndices.includes(channelIdx)) {
                    return { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) };
                }
                return c;
            });
            return { ...state, cells, dirty: true };
        }
        case 'CELL_DETACH_CHANNEL': {
            const { cellId, channelIdx } = action;
            return {
                ...state,
                cells: state.cells.map(c => c.cellId === cellId
                    ? { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) }
                    : c),
                dirty: true,
            };
        }
        case 'CELL_MOVE_CHANNEL': {
            const { fromCellId, toCellId, channelIdx } = action;
            const destCell = state.cells.find(c => c.cellId === toCellId);
            if (!destCell)
                return state;
            const channel = state.channels[channelIdx];
            if (!channel)
                return state;
            // Aduana al destino
            const admission = canAdmit(channel.type, destCell.family);
            if (admission.ok === false) {
                emitWarning({ cellId: toCellId, channelIdx, reason: admission.reason });
                return state;
            }
            const cells = state.cells.map(c => {
                if (c.cellId === fromCellId) {
                    return { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) };
                }
                if (c.cellId === toCellId) {
                    if (c.channelIndices.includes(channelIdx))
                        return c;
                    return { ...c, channelIndices: [...c.channelIndices, channelIdx] };
                }
                return c;
            });
            return { ...state, cells, dirty: true };
        }
        // ── GOVERNOR (DMX last-mile rules) ───────────────────────────────────
        case 'GOVERNOR_SET_ALL':
            return { ...state, dmxGovernors: action.governors, dirty: true };
        case 'GOVERNOR_ADD':
            return {
                ...state,
                dmxGovernors: [...state.dmxGovernors, action.governor],
                dirty: true,
            };
        case 'GOVERNOR_UPDATE': {
            const govIdx = state.dmxGovernors.findIndex(g => g.channelIndex === action.channelIndex);
            if (govIdx === -1)
                return state;
            return {
                ...state,
                dmxGovernors: state.dmxGovernors.map((g, i) => i === govIdx ? action.governor : g),
                dirty: true,
            };
        }
        case 'GOVERNOR_REMOVE':
            return {
                ...state,
                dmxGovernors: state.dmxGovernors.filter(g => g.channelIndex !== action.channelIndex),
                dirty: true,
            };
        // ── CAPABILITY ─────────────────────────────────────────────────────────────
        case 'CAPABILITY_SET':
            return {
                ...state,
                capabilities: { ...state.capabilities, [action.key]: action.value },
                dirty: true,
            };
        case 'CAPABILITY_MERGE':
            return {
                ...state,
                capabilities: { ...state.capabilities, ...action.patch },
                dirty: true,
            };
        // ── PHYSICS ───────────────────────────────────────────────────────────────
        case 'PHYSICS_SET':
            return { ...state, physics: action.physics, dirty: true };
        // ── WHEELS ───────────────────────────────────────────────────────────────
        case 'WHEELS_SET':
            return { ...state, wheels: action.wheels, dirty: true };
        case 'WHEELS_SET_COLORS': {
            const wBase = state.wheels ?? { colors: [], colorEngine: 'rgb', minChangeTimeMs: 500 };
            return { ...state, wheels: { ...wBase, colors: action.colors }, dirty: true };
        }
        case 'WHEELS_SET_ENGINE': {
            const wBase = state.wheels ?? { colors: [], colorEngine: 'rgb', minChangeTimeMs: 500 };
            return { ...state, wheels: { ...wBase, colorEngine: action.engine }, dirty: true };
        }
        case 'WHEELS_SET_MIN_CHANGE': {
            const wBase = state.wheels ?? { colors: [], colorEngine: 'rgb', minChangeTimeMs: 500 };
            return { ...state, wheels: { ...wBase, minChangeTimeMs: action.ms }, dirty: true };
        }
        // ── SYNC — bidireccional (reemplaza useEffect WAVE 4742) ──────────────────
        case 'SYNC_RACK_TO_CELLS': {
            const { channelIdx } = action;
            const ch = state.channels[channelIdx];
            if (!ch)
                return state;
            let nextCells = state.cells;
            let changed = false;
            for (const cell of state.cells) {
                if (!cell.channelIndices.includes(channelIdx))
                    continue;
                const admission = canAdmit(ch.type, cell.family);
                if (admission.ok === false) {
                    emitWarning({
                        cellId: cell.cellId,
                        channelIdx,
                        reason: `Type change invalidated attachment: ${admission.reason}`,
                    });
                    nextCells = nextCells.map(c => c.cellId === cell.cellId
                        ? { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) }
                        : c);
                    changed = true;
                }
            }
            return changed ? { ...state, cells: nextCells, dirty: true } : state;
        }
        case 'SYNC_CELLS_TO_RACK': {
            const { cellId } = action;
            const cell = state.cells.find(c => c.cellId === cellId);
            if (!cell || cell.channelIndices.length === 0)
                return state;
            const maxIdx = Math.max(...cell.channelIndices);
            if (maxIdx < state.channels.length)
                return state;
            const needed = maxIdx + 1;
            const extended = resizeChannels(state.channels, needed);
            return {
                ...state,
                channels: extended,
                meta: { ...state.meta, channelCount: needed },
                dirty: true,
            };
        }
        // ── LIFECYCLE ────────────────────────────────────────────────────────
        case 'HYDRATE_FROM_FIXTURE': {
            const { fixture } = action;
            return {
                meta: {
                    manufacturer: fixture.manufacturer ?? '',
                    name: fixture.name ?? '',
                    type: fixture.type ?? 'generic',
                    mode: fixture.mode,
                    channelCount: fixture.channels.length,
                },
                channels: hydrateChannels(fixture),
                cells: hydrateAetherCells(fixture),
                dmxGovernors: fixture.dmxGovernors ?? [],
                capabilities: fixture.capabilities ?? {},
                physics: hydratePhysics(fixture),
                wheels: hydrateWheels(fixture),
                dirty: false,
            };
        }
        case 'MARK_CLEAN':
            return { ...state, dirty: false };
        case 'RESET':
            return makeInitialForgeState();
        default:
            return state;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// PURE HELPERS — reducer internals
// ═══════════════════════════════════════════════════════════════════════════
function patchChannel(channels, idx, patch) {
    if (idx < 0 || idx >= channels.length)
        return channels;
    return channels.map((ch, i) => (i === idx ? { ...ch, ...patch } : ch));
}
function resizeChannels(channels, count) {
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(channels[i] ?? { index: i, name: '', type: 'unknown', defaultValue: 0, is16bit: false });
    }
    return result;
}
function defaultLabelFor(family) {
    const labels = {
        COLOR: 'Color',
        IMPACT: 'Intensidad',
        KINETIC: 'Posición',
        BEAM: 'Haz',
        ATMOSPHERE: 'Atmósfera',
    };
    return labels[String(family)] ?? String(family);
}
// ── Hydration from FixtureDefinition ──────────────────────────────────────
function hydrateChannels(fixture) {
    const count = fixture.channels.length;
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(fixture.channels[i] ?? { index: i, name: '', type: 'unknown', defaultValue: 0, is16bit: false });
    }
    return result;
}
function hydrateCells(fixture) {
    // Ruta A: reconstruct from nodeGraph output_dmx nodes grouped by aetherNodeId.
    // Si no hay nodeGraph, la Tab Aether abre vacía (ruta B legacy, §8.1).
    const graph = fixture.nodeGraph;
    if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0)
        return [];
    const buckets = new Map();
    for (const node of graph.nodes) {
        if (node.type !== 'output_dmx')
            continue;
        const cfg = node.config;
        if (!cfg || typeof cfg.aetherNodeId !== 'string')
            continue;
        const id = cfg.aetherNodeId;
        if (!buckets.has(id)) {
            buckets.set(id, {
                indices: [],
                zone: cfg.aetherZone,
                label: typeof cfg.cellLabel === 'string' ? cfg.cellLabel : undefined,
            });
        }
        const dmxOffset = cfg.dmxOffset;
        if (typeof dmxOffset === 'number') {
            buckets.get(id).indices.push(dmxOffset);
        }
    }
    if (buckets.size === 0)
        return [];
    return Array.from(buckets.entries()).map(([cellId, bucket], i) => ({
        cellId,
        family: inferFamilyFromCellId(cellId),
        label: bucket.label || formatCellLabel(cellId),
        role: inferRoleFromCellId(cellId),
        channelIndices: [...bucket.indices].sort((a, b) => a - b),
        aetherZone: bucket.zone,
        uiPosition: { x: 0, y: i * 140 },
    }));
}
function inferFamilyFromCellId(cellId) {
    const id = cellId.toLowerCase();
    if (id.includes('color') || id.includes('petal') || id.includes('wash') || id.includes('pixel')) {
        return NodeFamily.COLOR;
    }
    if (id.includes('impact') || id.includes('golden') || id.includes('stain')) {
        return NodeFamily.IMPACT;
    }
    if (id.includes('kinetic') || id.includes('pan') || id.includes('tilt') || id.includes('position')) {
        return NodeFamily.KINETIC;
    }
    if (id.includes('beam') || id.includes('gobo') || id.includes('focus') || id.includes('zoom')) {
        return NodeFamily.BEAM;
    }
    return NodeFamily.ATMOSPHERE;
}
function inferRoleFromCellId(cellId) {
    const id = cellId.toLowerCase();
    if (id.includes('petal') || id.includes('pixel'))
        return 'pixel';
    if (id.includes('wash'))
        return 'ambient';
    if (id.includes('beam'))
        return 'decoration';
    return 'primary';
}
function formatCellLabel(cellId) {
    return cellId
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}
// ── hydrateAetherCells — Route A (aetherCells JSON) → Route B (legacy nodeGraph) ─
/**
 * WAVE FORGE CONVERGENCE:
 * Ruta A — lee el snapshot `aetherCells` guardado en el JSON.
 *           Restaura layout visual exacto (uiPosition preservada).
 * Ruta B — fallback legacy: reconstruye células desde nodeGraph.output_dmx.
 *           Solo activo para fixtures guardados ANTES de esta WAVE.
 */
function hydrateAetherCells(fixture) {
    const raw = fixture;
    const saved = raw.aetherCells;
    if (Array.isArray(saved) && saved.length > 0) {
        return saved.map((snap, i) => ({
            cellId: snap.cellId,
            family: parseNodeFamily(snap.family),
            label: snap.label,
            role: snap.role,
            channelIndices: [...snap.channelIndices],
            aetherZone: snap.aetherZone,
            uiPosition: snap.uiPosition ?? { x: 0, y: i * 140 },
        }));
    }
    return hydrateCells(fixture);
}
function parseNodeFamily(raw) {
    const up = raw.toUpperCase();
    if (up in NodeFamily)
        return NodeFamily[up];
    return NodeFamily.ATMOSPHERE;
}
// ── hydratePhysics — desde fixture.physics ────────────────────────────────
function hydratePhysics(fixture) {
    const p = fixture.physics;
    if (!p)
        return null;
    return {
        motorType: p.motorType ?? 'stepper',
        maxAcceleration: p.maxAcceleration ?? 2000,
        maxVelocity: p.maxVelocity ?? 500,
        safetyCap: Boolean(p.safetyCap ?? true),
        orientation: (p.orientation ?? 'floor'),
        invertPan: p.invertPan ?? false,
        invertTilt: p.invertTilt ?? false,
        swapPanTilt: p.swapPanTilt ?? false,
        homePosition: p.homePosition ?? { pan: 127, tilt: 127 },
        tiltLimits: p.tiltLimits ?? { min: 0, max: 270 },
    };
}
// ── hydrateWheels — desde fixture.wheels + capabilities ───────────────────
function hydrateWheels(fixture) {
    const colors = fixture.wheels?.colors ??
        fixture.capabilities?.colorWheel?.colors ??
        [];
    if (colors.length === 0)
        return null;
    return {
        colors,
        colorEngine: (fixture.capabilities?.colorEngine ?? 'rgb'),
        minChangeTimeMs: fixture.capabilities?.colorWheel?.minChangeTimeMs ?? 500,
    };
}
