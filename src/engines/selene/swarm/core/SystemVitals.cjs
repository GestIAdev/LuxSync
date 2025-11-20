"use strict";
// 🔥 SYSTEM VITALS - MÉTRICAS REALES DEL SISTEMA
// 🎯 El Verso Libre - Arquitecto de Realidad Procedural
// ⚡ "La verdadera poesía nace de las métricas del sistema, no del caos aleatorio"
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemVitals = void 0;
var os = require("os");
var process = require("process");
// 🌟 SYSTEM VITALS IMPLEMENTATION
var SystemVitals = /** @class */ (function () {
    function SystemVitals() {
        this.metrics = null;
        this.vitalSigns = null;
        this.errorCount = 0;
        this.lastErrorTime = Date.now();
        this.collectionInterval = null;
        // Start automatic metrics collection
        this.startCollection();
    }
    SystemVitals.getInstance = function () {
        if (!SystemVitals.instance) {
            SystemVitals.instance = new SystemVitals();
        }
        return SystemVitals.instance;
    };
    // 🎯 COLLECT METRICS - RECOLECTAR MÉTRICAS REALES
    SystemVitals.prototype.collectMetrics = function () {
        var cpus = os.cpus();
        var totalMemory = os.totalmem();
        var freeMemory = os.freemem();
        var usedMemory = totalMemory - freeMemory;
        // CPU usage calculation (simplified)
        var totalIdle = 0;
        var totalTick = 0;
        cpus.forEach(function (cpu) {
            for (var type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        var idle = totalIdle / cpus.length;
        var total = totalTick / cpus.length;
        var cpuUsage = 1 - (idle / total);
        // Network connections (estimated via memory usage)
        var connections = Math.floor(usedMemory / (1024 * 1024 * 10)); // Rough estimate: 1 connection per 10MB
        // Error rate calculation
        var now = Date.now();
        var timeDiff = (now - this.lastErrorTime) / 1000 / 60; // minutes
        var errorRate = timeDiff > 0 ? this.errorCount / timeDiff : 0;
        this.metrics = {
            cpu: {
                usage: Math.max(0, Math.min(1, cpuUsage)),
                loadAverage: os.loadavg(),
                cores: cpus.length
            },
            memory: {
                used: usedMemory,
                total: totalMemory,
                usage: usedMemory / totalMemory,
                free: freeMemory
            },
            process: {
                uptime: process.uptime(),
                pid: process.pid,
                memoryUsage: process.memoryUsage()
            },
            network: {
                connections: Math.max(0, connections - 10), // Subtract base handles
                latency: this.calculateLatency()
            },
            errors: {
                count: this.errorCount,
                rate: errorRate
            },
            timestamp: now
        };
        return this.metrics;
    };
    // 🌡️ CALCULATE VITAL SIGNS - CALCULAR SIGNOS VITALES
    SystemVitals.prototype.calculateVitalSigns = function () {
        if (!this.metrics) {
            this.collectMetrics();
        }
        var m = this.metrics;
        var now = Date.now();
        // Health: combination of CPU, memory, and error rate
        var cpuHealth = 1 - m.cpu.usage;
        var memoryHealth = 1 - m.memory.usage;
        var errorHealth = Math.max(0, 1 - (m.errors.rate / 10)); // Penalize high error rates
        var health = (cpuHealth * 0.4 + memoryHealth * 0.4 + errorHealth * 0.2);
        // Stress: high CPU + high memory + high error rate
        var stress = Math.min(1, (m.cpu.usage + m.memory.usage + (m.errors.rate / 5)) / 3);
        // Harmony: balance between system components
        var cpuHarmony = 1 - Math.abs(m.cpu.usage - 0.5) * 2; // Prefer 50% CPU usage
        var memoryHarmony = 1 - Math.abs(m.memory.usage - 0.7) * 2; // Prefer 70% memory usage
        var harmony = (cpuHarmony + memoryHarmony) / 2;
        // Creativity: based on system stability and available resources
        var stability = 1 - stress;
        var resources = (m.memory.free / m.memory.total) + (1 - m.cpu.usage);
        var creativity = Math.min(1, (stability * 0.6 + resources * 0.4));
        this.vitalSigns = {
            health: Math.max(0, Math.min(1, health)),
            stress: Math.max(0, Math.min(1, stress)),
            harmony: Math.max(0, Math.min(1, harmony)),
            creativity: Math.max(0, Math.min(1, creativity)),
            timestamp: now
        };
        return this.vitalSigns;
    };
    // 📊 GET CURRENT METRICS - OBTENER MÉTRICAS ACTUALES
    SystemVitals.prototype.getCurrentMetrics = function () {
        return this.metrics || this.collectMetrics();
    };
    // 💓 GET CURRENT VITAL SIGNS - OBTENER SIGNOS VITALES ACTUALES
    SystemVitals.prototype.getCurrentVitalSigns = function () {
        return this.vitalSigns || this.calculateVitalSigns();
    };
    // 🚨 RECORD ERROR - REGISTRAR ERROR
    SystemVitals.prototype.recordError = function () {
        this.errorCount++;
        this.lastErrorTime = Date.now();
    };
    // 🔄 RESET ERROR COUNT - REINICIAR CONTEO DE ERRORES
    SystemVitals.prototype.resetErrorCount = function () {
        this.errorCount = 0;
        this.lastErrorTime = Date.now();
    };
    // 🎯 CALCULATE LATENCY - CALCULAR LATENCIA
    SystemVitals.prototype.calculateLatency = function () {
        var _a, _b, _c;
        // Simulate latency based on system load
        var baseLatency = 10; // 10ms base
        var cpuPenalty = ((_a = this.metrics) === null || _a === void 0 ? void 0 : _a.cpu.usage) || 0;
        var memoryPenalty = ((_b = this.metrics) === null || _b === void 0 ? void 0 : _b.memory.usage) || 0;
        var connectionPenalty = Math.max(0, (((_c = this.metrics) === null || _c === void 0 ? void 0 : _c.network.connections) || 0) - 100) * 0.1;
        return baseLatency + (cpuPenalty * 50) + (memoryPenalty * 30) + connectionPenalty;
    };
    // 🔄 START COLLECTION - INICIAR RECOLECCIÓN AUTOMÁTICA
    SystemVitals.prototype.startCollection = function () {
        var _this = this;
        // Collect metrics every 30 seconds
        this.collectionInterval = setInterval(function () {
            _this.collectMetrics();
            _this.calculateVitalSigns();
        }, 30000);
    };
    // 🛑 STOP COLLECTION - DETENER RECOLECCIÓN
    SystemVitals.prototype.stopCollection = function () {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }
    };
    return SystemVitals;
}());
exports.SystemVitals = SystemVitals;
