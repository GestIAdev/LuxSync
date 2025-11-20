// 🎵 MUSICAL NOTE ENUM - SHARED TYPES
// Exported enum for musical consensus algorithms

export enum MusicalNote {
  DO = "C", // Fundamental - Base consensus
  RE = "D", // Resolution - Conflict resolution
  MI = "E", // Emotion - Sentiment analysis
  FA = "F", // Force - Majority enforcement
  SOL = "G", // Solution - Problem solving
  LA = "A", // Leadership - Leader selection
  SI = "B", // Synthesis - Final integration
}

// 🎼 Musical Frequencies (Hz) for Real Harmonic Analysis
export const MUSICAL_FREQUENCIES = {
  [MusicalNote.DO]: 261.63, // C4
  [MusicalNote.RE]: 293.66, // D4
  [MusicalNote.MI]: 329.63, // E4
  [MusicalNote.FA]: 349.23, // F4
  [MusicalNote.SOL]: 392.0, // G4
  [MusicalNote.LA]: 440.0, // A4
  [MusicalNote.SI]: 493.88, // B4
};


