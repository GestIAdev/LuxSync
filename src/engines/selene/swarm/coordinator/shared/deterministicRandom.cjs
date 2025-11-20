"use strict";
// 🎯 DETERMINISTIC RANDOM RE-EXPORT MODULE
// ⚡ Re-exporta funciones deterministas desde deterministic-utils.js
// 🔒 Para compatibilidad con SeleneNuclearSwarm.js

const { deterministicRandom, deterministicInt, deterministicBool, resetDeterministicState } = require('./deterministic-utils.cjs');

module.exports = {
  deterministicRandom,
  deterministicInt,
  deterministicBool,
  resetDeterministicState
};