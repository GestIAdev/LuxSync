/**
 * 🎸 SCALE UTILS
 * Escalas y modos musicales
 */
import { ModalScale } from '../core/interfaces.js';
/**
 * Obtener notas de escala
 */
export declare function getScaleNotes(root: number, scale: ModalScale): number[];
/**
 * Obtener grado de escala
 */
export declare function getScaleDegree(root: number, scale: ModalScale, degree: number): number;
/**
 * Verificar si nota pertenece a escala
 */
export declare function isInScale(pitch: number, root: number, scale: ModalScale): boolean;
//# sourceMappingURL=ScaleUtils.d.ts.map