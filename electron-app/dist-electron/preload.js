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
electron.contextBridge.exposeInMainWorld("luxsync", api);
