/**
 * 🎵 MELODY ENGINE
 * Motor de melodía para generar líneas melódicas
 */
import { MIDINote } from '../core/interfaces.js';
import { MelodicContour } from '../core/types.js';
import { Section } from '../structure/SongStructure.js';
export type MotifTransformation = 'retrograde' | 'inversion' | 'augmentation' | 'diminution' | 'transposition' | 'rhythmDisplacement' | 'fragmentation';
export interface MelodyOptions {
    seed: number;
    section: Section;
    key: number;
    mode: string;
    complexity: number;
    contour: MelodicContour;
    range: {
        min: number;
        max: number;
    };
}
/**
 * 🎸 FRENTE #5.2: Resultado de generación melódica con instrumentKey dinámico
 */
export interface MelodyResult {
    notes: MIDINote[];
    instrumentKey: string;
}
/**
 * Motor de melodía principal
 */
export declare class MelodyEngine {
    private random;
    constructor(seed?: number);
    /**
     * Generar melodía completa con selección dinámica de instrumento
     * 🎸 FRENTE #5.2: SELECCIÓN DINÁMICA (Cerebro)
     *
     * ARQUITECTURA:
     * - Devuelve { notes, instrumentKey } (no solo notas)
     * - instrumentKey seleccionado basado en section.type + intensity
     *
     * IMPROVISACIÓN:
     * - chorus + intensity > 0.8 → synth-lead/pulse-buzz-lead (láser cyberpunk)
     * - intro/outro atmospheric → vocal-chops/angelicalvoice (etéreo)
     * - verse/pre-chorus moderado → electric-piano/MED (suave, orgánico)
     * - bridge/buildup → synth-lead/pulse-buzz-lead (drama, tensión)
     *
     * @param options Opciones de generación
     * @returns { notes, instrumentKey }
     */
    generateMelody(options: MelodyOptions): MelodyResult;
    /**
     * 🎨 IMPROVISACIÓN: Selección de instrumento basada en section.type + intensity
     *
     * Estrategia (Cyberpunk-Ambient):
     * - HIGH INTENSITY (chorus, climax): synth-lead/pulse-buzz-lead (láser cortante)
     * - ATMOSPHERIC (intro, outro): vocal-chops/angelicalvoice (etéreo, espacial)
     * - MODERATE (verse, pre-chorus): electric-piano/MED (orgánico, suave)
     * - TENSION (bridge, buildup): synth-lead/pulse-buzz-lead (drama)
     */
    private selectInstrument;
    /**
     * Generar motivo melódico base
     * ✅ BUG #25 FIX RADICAL (ARQUITECTO-33A): FRASES CANTABLES
     * - Escalas restrictivas (pentatónicas para cyberpunk)
     * - Saltos máximos de 5 semitonos (4ta justa)
     * - Motivos de 3-4 notas (memor

ables)
     */
    private generateMotif;
    /**
     * 🎨 FRENTE #5.5: Obtener escala DIATÓNICA completa (7 notas)
     * Usado en chorus/bridge para crear tensión y drama
     */
    private getDiatonicScale;
    /**
     * 🔥 ARQUITECTO-33A: Escalas RESTRICTIVAS (pentatónicas y blues)
     * Solo 5 notas por escala (vs 7 notas en escalas mayores/menores)
     * Resultado: Saltos más pequeños, frases más cantables
     */
    private getRestrictiveScale;
    /**
     * Obtener duración basada en secuencia Fibonacci
     * 🔧 CIRUGÍA P0: Mapeo robusto de sectionType → durationPool
     */
    private getFibonacciDuration;
    /**
     * 🔧 CIRUGÍA P0: Normalizar sectionType a un durationPool válido
     * Mapea cualquier SectionType a uno de los 4 pools disponibles
     */
    private normalizeSectionContext;
    /**
     * Calculate dynamic velocity based on melodic contour
     * Higher notes = louder (natural tendency)
     * Creates musical phrasing
     */
    private calculateDynamicVelocity;
    /**
     * Aplicar transformaciones al motivo
     */
    private applyTransformations;
    /**
     * Desarrollo del motivo en frase completa
     * ✅ BUG #25 FIX RADICAL (ARQUITECTO-33A): MOTIVOS REPETIDOS + SWING
     * - Repite motivo base 70% del tiempo (coherencia)
     * - Solo transforma 30% del tiempo (variación sutil)
     * - Añade swing timing (off-beats desplazados 8-12ms)
     */
    private developPhrase;
    /**
     * Transformar motivo para repetición
     * ✅ BUG #25 FIX RADICAL (ARQUITECTO-33A): TRANSFORMACIONES SUTILES
     * Solo usa transposition (±2-5 semitonos) para variación orgánica
     * NO usa retrograde/inversion (demasiado abstracto para melodías cantables)
     */
    private transformMotifForRepetition;
    /**
     * Aplicar transformación específica al motivo
     */
    applyMotifTransformation(motif: MIDINote[], transformation: MotifTransformation): MIDINote[];
    /**
     * Retrograde: invertir orden de notas
     */
    private applyRetrograde;
    /**
     * Inversion: invertir intervalos
     */
    private applyInversion;
    /**
     * Augmentation: alargar duraciones
     */
    private applyAugmentation;
    /**
     * Diminution: acortar duraciones
     */
    private applyDiminution;
    /**
     * Transposition: transponer por semitonos
     */
    private applyTransposition;
    /**
     * Rhythm displacement: desplazar ritmos
     */
    private applyRhythmDisplacement;
    /**
     * Fragmentation: dividir notas en fragmentos
     */
    private applyFragmentation;
    /**
     * Aplicar contorno melódico
     */
    private applyContour;
    /**
     * Calcular shift de octava según contorno
     */
    private calculateContourShift;
}
//# sourceMappingURL=MelodyEngine.d.ts.map