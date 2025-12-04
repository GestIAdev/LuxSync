"use strict";
const electron = require("electron");
const api = {
  // ============================================
  // APP
  // ============================================
  getVersion: () => electron.ipcRenderer.invoke("app:getVersion"),
  // ============================================
  // DMX
  // ============================================
  dmx: {
    getStatus: () => electron.ipcRenderer.invoke("dmx:getStatus"),
    sendValues: (values) => electron.ipcRenderer.invoke("dmx:send", values),
    onUpdate: (callback) => {
      electron.ipcRenderer.on("dmx:update", (_, values) => callback(values));
    }
  },
  // ============================================
  // AUDIO
  // ============================================
  audio: {
    getDevices: () => electron.ipcRenderer.invoke("audio:getDevices"),
    onBeat: (callback) => {
      electron.ipcRenderer.on("audio:beat", (_, data) => callback(data));
    },
    onSpectrum: (callback) => {
      electron.ipcRenderer.on("audio:spectrum", (_, spectrum) => callback(spectrum));
    }
  },
  // ============================================
  // SELENE
  // ============================================
  selene: {
    onDecision: (callback) => {
      electron.ipcRenderer.on("selene:decision", (_, decision) => callback(decision));
    },
    onMoodChange: (callback) => {
      electron.ipcRenderer.on("selene:mood", (_, mood) => callback(mood));
    },
    setMode: (mode) => {
      electron.ipcRenderer.invoke("selene:setMode", mode);
    }
  },
  // ============================================
  // CONTROLS
  // ============================================
  controls: {
    setPalette: (paletteId) => electron.ipcRenderer.invoke("controls:setPalette", paletteId),
    triggerEffect: (effectId) => electron.ipcRenderer.invoke("controls:triggerEffect", effectId),
    setBlackout: (active) => electron.ipcRenderer.invoke("controls:setBlackout", active),
    setMovement: (params) => electron.ipcRenderer.invoke("controls:setMovement", params)
  }
};
const luxApi = {
  // === CONTROL ===
  /** Iniciar el motor Selene */
  start: () => electron.ipcRenderer.invoke("lux:start"),
  /** Detener el motor Selene */
  stop: () => electron.ipcRenderer.invoke("lux:stop"),
  /** Cambiar paleta de colores - Acepta IDs canónicos del ColorEngine */
  setPalette: (paletteId) => electron.ipcRenderer.invoke("lux:set-palette", paletteId),
  /** Configurar movimiento */
  setMovement: (config) => electron.ipcRenderer.invoke("lux:set-movement", config),
  /** Disparar un efecto */
  triggerEffect: (effectName, params, duration) => electron.ipcRenderer.invoke("lux:trigger-effect", { effectName, params, duration }),
  /** Cancelar efecto */
  cancelEffect: (effectId) => electron.ipcRenderer.invoke("lux:cancel-effect", effectId),
  /** Cancelar todos los efectos */
  cancelAllEffects: () => electron.ipcRenderer.invoke("lux:cancel-all-effects"),
  /** Simular frame de audio */
  audioFrame: (metrics) => electron.ipcRenderer.invoke("lux:audio-frame", metrics),
  /** Obtener estado actual */
  getState: () => electron.ipcRenderer.invoke("lux:get-state"),
  // === EVENTOS ===
  /** Suscribirse a actualizaciones de estado (30fps) */
  onStateUpdate: (callback) => {
    const handler = (_, state) => callback(state);
    electron.ipcRenderer.on("lux:state-update", handler);
    return () => {
      electron.ipcRenderer.removeListener("lux:state-update", handler);
    };
  },
  /** Suscribirse a cambios de paleta */
  onPaletteChange: (callback) => {
    const handler = (_, id) => callback(id);
    electron.ipcRenderer.on("lux:palette-change", handler);
    return () => electron.ipcRenderer.removeListener("lux:palette-change", handler);
  },
  /** Suscribirse a eventos de efectos */
  onEffectTriggered: (callback) => {
    const handler = (_, data) => callback(data.name, data.id);
    electron.ipcRenderer.on("lux:effect-triggered", handler);
    return () => electron.ipcRenderer.removeListener("lux:effect-triggered", handler);
  },
  // ============================================
  // WAVE 9.5: FIXTURES
  // ============================================
  /** Escanear carpeta de fixtures */
  scanFixtures: (customPath) => electron.ipcRenderer.invoke("lux:scan-fixtures", customPath),
  /** Obtener biblioteca de fixtures */
  getFixtureLibrary: () => electron.ipcRenderer.invoke("lux:get-fixture-library"),
  /** Obtener fixtures patcheados */
  getPatchedFixtures: () => electron.ipcRenderer.invoke("lux:get-patched-fixtures"),
  /** Añadir fixture al patch */
  patchFixture: (fixtureId, dmxAddress, universe) => electron.ipcRenderer.invoke("lux:patch-fixture", { fixtureId, dmxAddress, universe }),
  /** Eliminar fixture del patch */
  unpatchFixture: (dmxAddress) => electron.ipcRenderer.invoke("lux:unpatch-fixture", dmxAddress),
  /** Limpiar todo el patch */
  clearPatch: () => electron.ipcRenderer.invoke("lux:clear-patch"),
  // ============================================
  // WAVE 9.5: CONFIG
  // ============================================
  /** Obtener configuración */
  getConfig: () => electron.ipcRenderer.invoke("lux:get-config"),
  /** Guardar configuración */
  saveConfig: (config) => electron.ipcRenderer.invoke("lux:save-config", config),
  /** Resetear configuración */
  resetConfig: () => electron.ipcRenderer.invoke("lux:reset-config")
};
electron.contextBridge.exposeInMainWorld("luxsync", api);
electron.contextBridge.exposeInMainWorld("lux", luxApi);
