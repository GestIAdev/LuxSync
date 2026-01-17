/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MOOD MODULE - PUBLIC EXPORTS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 700.1 - The Mood Switch
 * 
 * "A veces la solución más PUNK es la más simple: UN PUTO SWITCH."
 * 
 * @author PunkOpus
 * @wave 700.1
 */

// Types
export type { 
  MoodId, 
  MoodProfile, 
  MoodChangeEvent, 
  MoodChangeListener 
} from './types';

// Controller + Profiles
export { 
  MoodController, 
  MOOD_PROFILES 
} from './MoodController';
