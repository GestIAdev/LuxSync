/**
 * 🛠️ WAVE 16 UTILITIES
 * ══════════════════════════════════════════════════════════════════════════
 * Utilidades PRO para el procesamiento de audio en workers
 * 
 * - AdaptiveEnergyNormalizer: Rolling Peak 15s para auto-sensibilidad
 * - HysteresisTrigger: Schmitt triggers para efectos sin flicker
 * ══════════════════════════════════════════════════════════════════════════
 */

export {
  AdaptiveEnergyNormalizer,
  getEnergyNormalizer,
  resetEnergyNormalizer,
} from './AdaptiveEnergyNormalizer';

export {
  HysteresisTrigger,
  EffectTriggersManager,
  getEffectTriggers,
  resetEffectTriggers,
} from './HysteresisTrigger';
