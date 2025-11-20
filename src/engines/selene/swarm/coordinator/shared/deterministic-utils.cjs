"use strict";
// 🎯 DETERMINISTIC RANDOM UTILITY - NO deterministicRandom()
// ⚡ Algoritmo procedural puro: Linear Congruential Generator (LCG)
// 🔒 Semilla fija para 100% determinismo
Object.defineProperty(exports, "__esModule", { value: true });
exports.deterministicRandom = deterministicRandom;
exports.deterministicInt = deterministicInt;
exports.deterministicBool = deterministicBool;
exports.resetDeterministicState = resetDeterministicState;
const DETERMINISTIC_SEED = 1728345600000; // Timestamp fijo para determinismo
let state = DETERMINISTIC_SEED;
const a = 1664525; // Multiplicador
const c = 1013904223; // Incremento
const m = 4294967296; // Módulo (2^32)
function deterministicRandom() {
    state = (a * state + c) % m;
    return state / m; // Retorna valor entre 0 y 1
}
// 🎨 Función para números enteros deterministas
function deterministicInt(min, max) {
    return Math.floor(deterministicRandom() * (max - min + 1)) + min;
}
// 🔮 Función para booleanos deterministas
function deterministicBool(probability = 0.5) {
    return deterministicRandom() < probability;
}
// 🎯 Reset del estado para pruebas consistentes
function resetDeterministicState() {
    state = DETERMINISTIC_SEED;
}
