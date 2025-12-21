/**
 * 🎛️ CONTEXT ENGINE INDEX
 * 
 * Exporta el sistema de Vibes (Bounded Contexts).
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
