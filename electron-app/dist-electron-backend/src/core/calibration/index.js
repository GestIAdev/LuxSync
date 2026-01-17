/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║           SELENE LAB - CALIBRATION MODULE INDEX               ║
 * ║                                                               ║
 * ║  WAVE 670.5 - THE TRUTH EXTRACTOR                             ║
 * ║                                                               ║
 * ║  "Numbers don't lie. But algorithms can mislead."             ║
 * ║  This module reveals the mathematical truth.                  ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * EXPORTS:
 * - SignalGenerator: Creates deterministic synthetic audio signals
 * - CalibrationRunner: Feeds signals through the brain
 * - CalibrationReport: Formats results for human consumption
 * - SeleneBrainAdapter: Connects synthetic signals to real brain
 */
// Signal Generator
export { SignalGenerator, } from './SignalGenerator';
// Calibration Runner
export { CalibrationRunner, } from './CalibrationRunner';
// Report Formatters
export { formatReportAsMarkdown, formatReportAsJSON, formatReportAsSummary, generateEnergyGraph, } from './CalibrationReport';
// Brain Adapter
export { SeleneBrainAdapter, } from './SeleneBrainAdapter';
