/**
 * 🎸 STRUCTURE ENGINE
 * Genera estructura de canción adaptada a duración y estilo
 */
import { SongStructure } from './SongStructure.js';
import { StylePreset } from '../style/StylePreset.js';
export declare class StructureEngine {
    /**
     * Generar estructura completa - REFACTORIZADO CON FIBONACCI
     * Usa calculateSectionDurations para duraciones variables dinámicas
     */
    generateStructure(targetDuration: number, style: StylePreset, seed: number, modeConfig: any): SongStructure;
    /**
     * Seleccionar forma musical según duración
     */
    private selectForm;
    private calculateSectionDurations;
    /**
     * Asignar perfil musical a sección
     */
    private assignProfile;
    /**
     * Generar secuencia Fibonacci
     */
    private generateFibonacci;
    /**
     * Generar transiciones entre secciones
     */
    private generateTransitions;
}
//# sourceMappingURL=StructureEngine.d.ts.map