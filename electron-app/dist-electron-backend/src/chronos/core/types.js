/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ CHRONOS TYPES - THE DNA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2001: THE FOUNDATION
 *
 * Define todas las interfaces del sistema Chronos.
 * Este archivo es el contrato de tipos para todo el módulo.
 *
 * ARQUITECTURA:
 * - ChronosProject: Raíz del documento (como un .als de Ableton)
 * - TimelineTrack: Capas paralelas de contenido
 * - TimelineClip: Bloques semánticos posicionados en tiempo
 * - AutomationLane: Curvas de parámetros (Bézier)
 * - AnalysisData: Datos pre-computados del audio (waveform, beats, sections)
 *
 * @module chronos/core/types
 * @version 2001.0.0
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🏭 FACTORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Genera un ID único para Chronos
 */
export function generateChronosId() {
    return `chr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
/**
 * Crea un proyecto vacío por defecto
 */
export function createDefaultProject(name = 'Untitled') {
    const now = new Date().toISOString();
    return {
        version: '1.0.0',
        id: generateChronosId(),
        meta: {
            name,
            description: '',
            audioPath: null,
            durationMs: 180000, // 3 minutos default
            bpm: 120,
            timeSignature: 4,
            key: null,
            createdAt: now,
            modifiedAt: now,
            audioHash: null,
        },
        playback: {
            loop: false,
            loopRegion: null,
            snapToBeat: true,
            snapResolution: 'beat',
            overrideMode: 'whisper',
            latencyCompensationMs: 10,
        },
        analysis: null,
        tracks: [],
        globalAutomation: [],
        markers: [],
    };
}
/**
 * Crea una track vacía
 */
export function createDefaultTrack(type, name, order = 0) {
    const trackColors = {
        audio: '#64748b',
        vibe: '#8b5cf6',
        effect: '#22d3ee',
        intensity: '#f59e0b',
        zone: '#10b981',
        color: '#ec4899',
        automation: '#6366f1',
        marker: '#94a3b8',
    };
    return {
        id: generateChronosId(),
        name: name ?? `${type.charAt(0).toUpperCase() + type.slice(1)} Track`,
        type,
        enabled: true,
        solo: false,
        locked: false,
        height: type === 'automation' ? 80 : 60,
        color: trackColors[type],
        clips: [],
        automation: [],
        order,
    };
}
/**
 * Crea un clip de efecto
 */
export function createEffectClip(trackId, effectId, startMs, durationMs, intensity = 1.0) {
    return {
        id: generateChronosId(),
        trackId,
        type: 'effect_trigger',
        startMs,
        durationMs,
        data: {
            type: 'effect_trigger',
            effectId,
            intensity,
            speed: 1.0,
            zones: [],
            bpmSync: true,
            params: {},
        },
        easeIn: 'linear',
        easeOut: 'linear',
        loop: false,
        priority: 0,
        enabled: true,
        meta: {
            label: effectId,
        },
    };
}
/**
 * Crea un punto de automation
 */
export function createAutomationPoint(timeMs, value, interpolation = 'linear') {
    return {
        id: generateChronosId(),
        timeMs,
        value,
        interpolation,
    };
}
/**
 * Crea una lane de automation
 */
export function createAutomationLane(target, name) {
    return {
        id: generateChronosId(),
        name: name ?? target,
        target,
        range: { min: 0, max: 1 },
        points: [],
        enabled: true,
        defaultValue: target.includes('intensity') ? 1.0 : 0.5,
        color: '#7c4dff',
    };
}
