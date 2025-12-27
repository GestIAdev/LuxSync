/**
 * 🎛️ CONTEXT ENGINE INDEX
 * 
 * Exporta el sistema de Vibes (Bounded Contexts).
 * 🏛️ WAVE 144: Añadidas las Color Constitutions
 */

// Manager
export { VibeManager, vibeManager } from './VibeManager';

// Presets
export {
  VIBE_TECHNO_CLUB,
  VIBE_FIESTA_LATINA,
  VIBE_POP_ROCK,
  VIBE_CHILL_LOUNGE,
  VIBE_REGISTRY,
  AVAILABLE_VIBES,
  DEFAULT_VIBE,
  getVibePreset,
  isValidVibeId,
} from './presets';

// 🏛️ WAVE 144: Color Constitutions
export {
  COLOR_CONSTITUTIONS,
  TECHNO_CONSTITUTION,
  LATINO_CONSTITUTION,
  ROCK_CONSTITUTION,
  CHILL_CONSTITUTION,
  IDLE_CONSTITUTION,
  getColorConstitution,
  isHueForbidden,
  applyElasticRotation,
} from './colorConstitutions';
