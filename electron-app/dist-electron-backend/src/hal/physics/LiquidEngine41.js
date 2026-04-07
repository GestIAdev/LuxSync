/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: LiquidEngine41 — Motor 4.1 (Setup compacto)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hereda toda la matemática de LiquidEngineBase.
 * Compacta las 7 zonas en 4 + strobe para rigs pequeños, con dos estrategias:
 *
 * ── 'default' ────────────────────────────────────────────────────────────
 *   frontPar  = max(subBass, kick)          — Océano + Francotirador
 *   backPar   = max(snare, highMid)         — Látigo + Sintetizadores
 *   moverL    = envTreble                   — Melodías
 *   moverR    = envVocal                    — Voces
 *
 * ── 'strict-split' (Metrónomo/Lienzo — Techno industrial) ─────────────
 *   frontPar  = envKick                     — Solo el Metrónomo
 *   backPar   = envSnare                    — Solo el Látigo
 *   moverL    = max(subBass, highMid, treble) — Lienzo L: muro atmosférico
 *   moverR    = max(subBass, highMid, vocal)  — Lienzo R: muro + aire vocal
 *
 * @module hal/physics/LiquidEngine41
 * @version WAVE 2439 — METRÓNOMO/LIENZO
 */
import { LiquidEngineBase } from './LiquidEngineBase';
import { TECHNO_PROFILE } from './profiles/techno';
export class LiquidEngine41 extends LiquidEngineBase {
    constructor(profile = TECHNO_PROFILE) {
        super(profile, '4.1');
    }
    routeZones(frame) {
        const { frontLeft, frontRight, backLeft, backRight, moverLeft, moverRight, strobeActive, strobeIntensity, acidMode, noiseMode, isKickEdge, } = frame;
        let frontPar;
        let backPar;
        let outMoverL;
        let outMoverR;
        if (this.profile.layout41Strategy === 'strict-split') {
            // ── METRÓNOMO / LIENZO (WAVE 2455) ───────────────────────────────────
            //
            // PARs: ritmo puro y separado.
            //   Front = solo Kick      → El Metrónomo. Parpadea con el bombo.
            //   Back  = solo Snare     → El Látigo. Percusión aguda.
            //
            // MOVERS: roles espectrales exclusivos para generar contraste real.
            //   Mover L (El Melodista)  = moverLeft  de la base (WAVE 911: highMid+treble)
            //   Mover R (El Terminator) = moverRight de la base (WAVE 911: treble puro)
            //
            // sB (envSubBass) y hMid (envHighMid) EXCLUIDOS del max() de los movers.
            // Antes estaban incluidos y el hMid capeado a 0.850 (AGC) no dejaba bajar nunca.
            // Ahora los PARs absorben el grave continuo. Los movers solo reaccionan a agudos.
            //
            frontPar = frontRight; // envKick
            backPar = backRight; // envSnare
            outMoverL = moverLeft; // highMid*0.70 + treble*0.30 → gate(0.28)+boost(7.0)
            outMoverR = moverRight; // treble puro → gate(0.18)+boost(9.0)
        }
        else {
            // ── DEFAULT (legacy) ─────────────────────────────────────────────────
            frontPar = Math.max(frontLeft, frontRight);
            backPar = Math.max(backLeft, backRight);
            outMoverL = moverLeft;
            outMoverR = moverRight;
        }
        // ── [LAB-DATA] front/back — Comentado (WAVE 2440.3). Útil para calibrar PARs.
        // if (this.profile.id === 'techno-industrial') {
        //   const f = (n: number) => n.toFixed(3)
        //   const fi = (n: number) => (isFinite(n) && n > 0 ? Math.round(n) : 0).toString().padStart(4, ' ')
        //   console.log(
        //     `[LAB-DATA] cent:${fi(frame.spectralCentroid)} | ` +
        //     `isK:${frame.isKick ? 1 : 0} bass:${f(frame.bands.bass)} | ` +
        //     `trbD:${f(frame.rawTrebleDelta)} hmD:${f(frame.rawHighMidDelta)} midD:${f(frame.rawMidDelta)} harsh:${f(frame.harshness)} | ` +
        //     `oF:${f(frontPar)} oB:${f(backPar)}`
        //   )
        // }
        return {
            frontLeftIntensity: frontPar,
            frontRightIntensity: frontPar,
            backLeftIntensity: backPar,
            backRightIntensity: backPar,
            moverLeftIntensity: outMoverL,
            moverRightIntensity: outMoverR,
            strobeActive,
            strobeIntensity,
            // Legacy compat
            frontParIntensity: frontPar,
            backParIntensity: backPar,
            moverIntensityL: outMoverL,
            moverIntensityR: outMoverR,
            moverIntensity: Math.max(outMoverL, outMoverR),
            moverActive: outMoverL > 0.1 || outMoverR > 0.1,
            physicsApplied: 'liquid-stereo',
            acidMode,
            noiseMode,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON — Default TECHNO_PROFILE
// ═══════════════════════════════════════════════════════════════════════════
export const liquidEngine41 = new LiquidEngine41();
