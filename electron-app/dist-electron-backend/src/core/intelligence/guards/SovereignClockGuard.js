/**
 * SELENE V3 — STRUCTURAL MASONRY: Sovereign Clock Guard
 *
 * Extracted from SeleneTitanConscious.ts (§5.2 of Due Diligence audit).
 * Contains all pre-buffer safety gates: ARS zone veto, epicness floor,
 * divine gate, pressure veto, heavy/divine re-routing, and the Glass Break sensor.
 *
 * Vibe branches (isTechnoVibe / isLatinVibe) have been migrated to continuous
 * ΠMΔG interpolation — the system is 100% genre-agnostic.
 */
import { getDynamicEffectRegistry, effectDisplayName } from '../../arsenal/DynamicEffectRegistry';
// ═══════════════════════════════════════════════════════════════════════════
// Utils
// ═══════════════════════════════════════════════════════════════════════════
function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
}
// ═══════════════════════════════════════════════════════════════════════════
// Sovereign Clock Guard
// ═══════════════════════════════════════════════════════════════════════════
export class SovereignClockGuard {
    constructor() {
        this.SOVEREIGN_WINDOW_MS = 500;
    }
    /**
     * Evaluate the pre-buffered candidate against all safety gates.
     * Returns a verdict telling the orchestrator what to do.
     */
    evaluate(ctx) {
        const { bufferStatus } = ctx;
        if (!bufferStatus) {
            return { action: 'wait', candidate: null, reroutedEffectId: null, reason: null, trigger: null };
        }
        const timeToEvent = bufferStatus.predictedEventAt - ctx.now;
        // ── Glass Break Sensor (WAVE 5016 + WAVE 6040 Regla del Valle) ──
        // 🪟 TRUE CREST DETECTOR: un Z-Score se calcula sobre una ventana de 30s y
        // difumina los transitorios; un evento de cresta CF>2 es evidencia física
        // de que ALGO acaba de golpear en este frame. Corrobora la anomalía, así que
        // relaja el umbral Z medio sigma — nunca lo bypasea (una cresta sola ocurre
        // ~4 veces por segundo en techno; no es un drop).
        const valleyBreath = ctx.minEnergySinceLastEffect <= 0.45;
        const crestCorroboration = ctx.crestEvent === true ? 0.5 : 0;
        const GLASS_BREAK_Z = Math.max(2.0, (valleyBreath ? 2.5 : 3.5) - crestCorroboration);
        const glassBreak = timeToEvent > 0 &&
            ctx.isWarmedUp &&
            ctx.currentZScore >= GLASS_BREAK_Z &&
            ctx.titanState.rawEnergy > 0.55;
        const withinSovereignWindow = timeToEvent <= 0 && timeToEvent >= -this.SOVEREIGN_WINDOW_MS;
        if (!withinSovereignWindow && !glassBreak) {
            if (timeToEvent < -this.SOVEREIGN_WINDOW_MS) {
                return { action: 'clear', candidate: null, reroutedEffectId: null, reason: null, trigger: null };
            }
            return { action: 'wait', candidate: null, reroutedEffectId: null, reason: null, trigger: null };
        }
        const trigger = glassBreak ? 'glass_break' : 'sovereign_window';
        const candidate = ctx.candidate;
        if (!candidate) {
            return { action: 'clear', candidate: null, reroutedEffectId: null, reason: null, trigger: null };
        }
        // ── Minion Quarantine ──
        const registryEntry = getDynamicEffectRegistry().getEntry(candidate.effect);
        if (registryEntry?.organismStatus === 'alive') {
            return {
                action: 'abort',
                candidate: null,
                reroutedEffectId: null,
                reason: `Minion quarantine enforced — "${candidate.effectName ?? candidate.effect}" blocked from live fire`,
                trigger,
            };
        }
        // ── ΠMΔG Interpolated Thresholds (replacing isTechnoVibe / isLatinVibe) ──
        const Π = ctx.descriptors.percussiveness;
        const M = ctx.descriptors.melodicity;
        const G = ctx.descriptors.groove;
        // 🔬 WAVE 7542: Divine threshold lowered 0.60 → 0.50 (Divine Resuscitation).
        const V3_EPSILON_DIVINE = 0.50 - 0.10 * clamp01(Π * (1 - M));
        // Divine RMS floor: lower for high-groove (latin), higher for ambient
        const SOVEREIGN_DIVINE_RMS_FLOOR = 0.75 - 0.10 * clamp01(G);
        // 🔬 WAVE 7542: Sustained epicness lowered 0.50 → 0.40.
        const SOVEREIGN_DIVINE_EPICNESS = 0.40;
        const SOVEREIGN_DIVINE_MIN_Z = 2.10;
        const v3EpicnessNow = ctx.epicness;
        const ars = ctx.acousticReality;
        const isHeavyEffect = registryEntry?.simMeta.isHeavyCandidate
            || registryEntry?.simMeta.isDivineCandidate
            || (registryEntry?.dna.aggression ?? 0) > 0.7;
        // ═══════════════════════════════════════════════════════════════════════
        // 🩸 WAVE 7543: UNIVERSAL SPECTRAL BASS GATE (Anti-Autotune Veto)
        // 🩸 WAVE 7553: REVERTED to simple bass <= 0.35. Purgado de zL/vocal/ratio.
        // ═══════════════════════════════════════════════════════════════════════
        const BASS_GATE_THRESHOLD = 0.35;
        const hasSubstantialBass = ctx.titanState.bass > BASS_GATE_THRESHOLD;
        let aborted = false;
        let abortReason = '';
        let heavyRerouted = false;
        let reroutedEffectId = null;
        // ── UNIVERSAL CLAMP: Heavy effect in silence/valley = ABORT ──
        // 🩸 WAVE 7543: Also abort if bass gate fails (vocal/autotune false positive)
        if (isHeavyEffect) {
            // Bass Gate veto — applies to ALL heavy effects (heavy, divine, aggression > 0.7)
            if (!hasSubstantialBass) {
                aborted = true;
                abortReason =
                    `Bass Gate veto (bass=${ctx.titanState.bass.toFixed(3)} ≤ ${BASS_GATE_THRESHOLD})` +
                        ` — heavy effect "${candidate.effectName ?? candidate.effect}" suppressed (vocal/autotune false positive)`;
            }
            else if (ars) {
                const zoneLabel = ars.zone.label;
                const phaseLabel = ars.phase.phase;
                const inLowZone = zoneLabel === 'silence' || zoneLabel === 'valley';
                const hasHiddenTension = phaseLabel === 'textural';
                if (inLowZone && !hasHiddenTension) {
                    aborted = true;
                    abortReason =
                        `Acoustic Reality veto (Zone: ${zoneLabel}, Phase: ${phaseLabel})` +
                            ` — heavy effect "${candidate.effectName ?? candidate.effect}" cannot fire in low energy`;
                }
            }
            else {
                const energyTooLow = ctx.titanState.rawEnergy < 0.35;
                // 🩸 WAVE 7543: Raised from -0.5 to 1.0 — heavy effects need statistical significance.
                const zTooLow = ctx.currentZScore < 1.0;
                if (energyTooLow || zTooLow) {
                    aborted = true;
                    abortReason =
                        `Fallback energy veto (E=${ctx.titanState.rawEnergy.toFixed(2)}` +
                            `${energyTooLow ? ' < 0.35' : ''}` +
                            `${zTooLow ? ` OR Z=${ctx.currentZScore.toFixed(2)} < 1.0` : ''})` +
                            ` — heavy effect "${candidate.effectName ?? candidate.effect}" suppressed`;
                }
            }
        }
        // ── HEAVY EPICNESS FLOOR + RE-ROUTE ──
        if (!aborted && registryEntry && !registryEntry.simMeta.isDivineCandidate && isHeavyEffect) {
            const HEAVY_EPICNESS_FLOOR = Math.max(0.25, ctx.rmsAverage10s * 0.35);
            // 🩸 WAVE 7543: HEAVY Z-SCORE FLOOR — heavy effects require statistical significance.
            // A heavy effect fired by the Sovereign Clock must have Z >= 1.0 (notable).
            // Z < 1.0 means the energy is barely above the rolling mean — this is a VERSE,
            // not a drop. Vocal/autotune transients can produce RMS spikes that Cassandra
            // misinterprets as buildup_starting, but the Z-score reveals the truth: the
            // energy is not statistically unusual.
            const SOVEREIGN_HEAVY_MIN_Z = 1.0;
            const heavyZBlocked = ctx.currentZScore < SOVEREIGN_HEAVY_MIN_Z;
            if (v3EpicnessNow < HEAVY_EPICNESS_FLOOR || heavyZBlocked) {
                const vibeArsenal = getDynamicEffectRegistry().getEffectsForVibe(ctx.titanState.vibeId ?? '');
                const lighterCandidates = vibeArsenal.filter(e => !e.simMeta.isDivineCandidate &&
                    !e.simMeta.isHeavyCandidate &&
                    (e.dna.aggression ?? 0) <= 0.70 &&
                    (!e.organismId || e.organismStatus !== 'alive'));
                if (lighterCandidates.length > 0) {
                    const sorted = lighterCandidates.sort((a, b) => (b.dna.aggression ?? 0) - (a.dna.aggression ?? 0));
                    for (const light of sorted) {
                        if (!ctx.effectHistory.some(h => h.type === light.id && (ctx.now - h.timestamp) < 8000)) {
                            reroutedEffectId = light.id;
                            break;
                        }
                    }
                    if (!reroutedEffectId)
                        reroutedEffectId = sorted[0].id;
                    heavyRerouted = true;
                    console.log(`[Sovereign Clock 🔄] HEAVY RE-ROUTE: "${candidate.effectName ?? candidate.effect}" → "${effectDisplayName(reroutedEffectId)}"` +
                        ` | epicness=${v3EpicnessNow.toFixed(3)} < floor=${HEAVY_EPICNESS_FLOOR.toFixed(3)}` +
                        `${heavyZBlocked ? ` OR Z=${ctx.currentZScore.toFixed(2)}σ < ${SOVEREIGN_HEAVY_MIN_Z}` : ''}` +
                        ` (rms10s=${ctx.rmsAverage10s.toFixed(2)})` +
                        ` — autotune/vocal transient: prediction preserved, effect downgraded`);
                }
                else {
                    aborted = true;
                    abortReason =
                        `HEAVY FLOOR: epicness=${v3EpicnessNow.toFixed(3)} < floor=${HEAVY_EPICNESS_FLOOR.toFixed(3)}` +
                            `${heavyZBlocked ? ` OR Z=${ctx.currentZScore.toFixed(2)}σ < ${SOVEREIGN_HEAVY_MIN_Z}` : ''}` +
                            ` (rms10s=${ctx.rmsAverage10s.toFixed(2)})` +
                            ` — heavy effect "${candidate.effectName ?? candidate.effect}" suppressed` +
                            ` (no lighter candidates available)`;
                }
            }
        }
        // ── DIVINE GATE + RE-ROUTE ──
        if (!aborted && registryEntry?.simMeta.isDivineCandidate) {
            const energyTooLow = ctx.titanState.rawEnergy < 0.50;
            const divineZoneVeto = ars
                ? (ars.zone.label === 'silence' || ars.zone.label === 'valley')
                    && ars.phase.phase !== 'textural'
                : false;
            const divinePeakPassed = v3EpicnessNow > V3_EPSILON_DIVINE;
            const divineSustainedPassed = v3EpicnessNow > SOVEREIGN_DIVINE_EPICNESS && ctx.rmsAverage10s > SOVEREIGN_DIVINE_RMS_FLOOR;
            const divineZPassed = ctx.currentZScore >= SOVEREIGN_DIVINE_MIN_Z;
            const divineEpicnessBlocked = (!divinePeakPassed && !divineSustainedPassed) || !divineZPassed;
            // 🩸 WAVE 7543: Bass gate already checked in isHeavyEffect block above,
            // but we include it in the divine gate log for diagnostic completeness.
            if (divineEpicnessBlocked || energyTooLow || divineZoneVeto) {
                const vibeArsenalDivine = getDynamicEffectRegistry().getEffectsForVibe(ctx.titanState.vibeId ?? '');
                const lighterCandidatesDivine = vibeArsenalDivine.filter(e => !e.simMeta.isDivineCandidate &&
                    !e.simMeta.isHeavyCandidate &&
                    (e.dna.aggression ?? 0) <= 0.70 &&
                    (!e.organismId || e.organismStatus !== 'alive'));
                if (lighterCandidatesDivine.length > 0) {
                    const sortedDivine = lighterCandidatesDivine.sort((a, b) => (b.dna.aggression ?? 0) - (a.dna.aggression ?? 0));
                    for (const light of sortedDivine) {
                        if (!ctx.effectHistory.some(h => h.type === light.id && (ctx.now - h.timestamp) < 8000)) {
                            reroutedEffectId = light.id;
                            break;
                        }
                    }
                    if (!reroutedEffectId)
                        reroutedEffectId = sortedDivine[0].id;
                    heavyRerouted = true;
                    console.log(`[Sovereign Clock 🔄] DIVINE RE-ROUTE: "${candidate.effectName ?? candidate.effect}" → "${effectDisplayName(reroutedEffectId)}"` +
                        ` | epicness=${v3EpicnessNow.toFixed(3)} (peak>${V3_EPSILON_DIVINE.toFixed(2)}? ${divinePeakPassed}; sustained>${SOVEREIGN_DIVINE_EPICNESS}+rms>${SOVEREIGN_DIVINE_RMS_FLOOR.toFixed(2)}? ${divineSustainedPassed})` +
                        ` Z=${ctx.currentZScore.toFixed(2)}σ ≥ ${SOVEREIGN_DIVINE_MIN_Z}? ${divineZPassed}` +
                        ` — divine gate blocked, prediction preserved, effect downgraded`);
                }
                else {
                    aborted = true;
                    abortReason =
                        `DIVINE ABORT: V3 epicness=${v3EpicnessNow.toFixed(3)}` +
                            ` (peak>${V3_EPSILON_DIVINE.toFixed(2)}? ${divinePeakPassed}; sustained>${SOVEREIGN_DIVINE_EPICNESS}+rms>${SOVEREIGN_DIVINE_RMS_FLOOR.toFixed(2)}? ${divineSustainedPassed})` +
                            ` Z=${ctx.currentZScore.toFixed(2)}σ ≥ ${SOVEREIGN_DIVINE_MIN_Z}? ${divineZPassed}` +
                            `${energyTooLow ? ` OR energy=${ctx.titanState.rawEnergy.toFixed(2)} < 0.50` : ''}` +
                            `${divineZoneVeto ? ` OR ARS zone=${ars.zone.label}` : ''}` +
                            ` → buffer cleared, divine effect suppressed (no lighter candidates)`;
                }
            }
        }
        // ── PRESSURE VETO ──
        if (!aborted && registryEntry) {
            const pr = registryEntry.pressureRange;
            if (!(pr.min === 0 && pr.max === 0)) {
                const currentPressure = ctx.titanState.rawEnergy;
                if (currentPressure < pr.min || currentPressure > pr.max) {
                    aborted = true;
                    abortReason =
                        `Pressure veto (Pressure=${currentPressure.toFixed(2)} outside allowed range [${pr.min}, ${pr.max}])`;
                }
            }
        }
        // ── UNIVERSAL EPICNESS FLOOR (DYNAMIC) ──
        const sovereignRms10s = ctx.rmsAverage10s;
        const SOVEREIGN_EPICNESS_ABSOLUTE_FLOOR = Math.max(0.02, sovereignRms10s * 0.08);
        const SOVEREIGN_EPICNESS_FLOOR = Math.max(0.05, sovereignRms10s * 0.12);
        const SOVEREIGN_ENERGY_FLOOR = 0.40;
        if (!aborted) {
            if (v3EpicnessNow < SOVEREIGN_EPICNESS_ABSOLUTE_FLOOR) {
                aborted = true;
                abortReason =
                    `Universal epicness absolute floor (epicness=${v3EpicnessNow.toFixed(3)} < ${SOVEREIGN_EPICNESS_ABSOLUTE_FLOOR.toFixed(3)} rms10s=${sovereignRms10s.toFixed(2)})` +
                        ` — liquid cognition denies any acoustic justification`;
            }
            else if (v3EpicnessNow < SOVEREIGN_EPICNESS_FLOOR && ctx.titanState.rawEnergy < SOVEREIGN_ENERGY_FLOOR) {
                aborted = true;
                abortReason =
                    `Universal epicness floor (epicness=${v3EpicnessNow.toFixed(3)} < ${SOVEREIGN_EPICNESS_FLOOR.toFixed(3)}` +
                        ` AND energy=${ctx.titanState.rawEnergy.toFixed(2)} < ${SOVEREIGN_ENERGY_FLOOR})` +
                        ` — no acoustic justification for Sovereign Clock fire`;
            }
        }
        if (aborted) {
            return {
                action: 'abort',
                candidate: null,
                reroutedEffectId: null,
                reason: abortReason,
                trigger,
            };
        }
        // ── FIRE ──
        return {
            action: 'fire',
            candidate,
            reroutedEffectId: heavyRerouted ? reroutedEffectId : null,
            reason: null,
            trigger,
        };
    }
}
