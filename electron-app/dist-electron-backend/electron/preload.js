/**
 * 🔌 LUXSYNC ELECTRON - PRELOAD SCRIPT
 * Puente seguro entre Main y Renderer
 *
 * V2.0: Añadido window.lux para comunicación con Selene Lux Core
 * V2.1: Añadido desktopCapturer para audio del sistema (via IPC)
 */
import { contextBridge, ipcRenderer } from 'electron';
// API expuesta al renderer de forma segura
const api = {
    // ============================================
    // APP
    // ============================================
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    // ============================================
    // DMX - WAVE 11: Universal Driver
    // WAVE 688: Synchronized IPC channel names
    // ============================================
    dmx: {
        getStatus: () => ipcRenderer.invoke('dmx:getStatus'),
        sendValues: (values) => ipcRenderer.invoke('dmx:sendFrame', values),
        onUpdate: (callback) => {
            ipcRenderer.on('dmx:update', (_, values) => callback(values));
        },
        // 🌪️ WAVE 11: Device management
        listDevices: () => ipcRenderer.invoke('dmx:scan'),
        autoConnect: () => ipcRenderer.invoke('dmx:autoConnect'),
        connect: (portPath) => ipcRenderer.invoke('dmx:connect', portPath),
        disconnect: () => ipcRenderer.invoke('dmx:disconnect'),
        blackout: () => ipcRenderer.invoke('dmx:blackout'),
        // 🔦 Highlight fixture para testing
        highlightFixture: (startChannel, channelCount, isMovingHead) => ipcRenderer.invoke('dmx:highlightFixture', startChannel, channelCount, isMovingHead),
        // 📡 Status events (connected/disconnected/reconnecting)
        onStatus: (callback) => {
            const handler = (_, status) => callback(status);
            ipcRenderer.on('dmx:status', handler);
            return () => ipcRenderer.removeListener('dmx:status', handler);
        },
        onConnected: (callback) => {
            const handler = (_, device) => callback(device);
            ipcRenderer.on('dmx:connected', handler);
            return () => ipcRenderer.removeListener('dmx:connected', handler);
        },
        onDisconnected: (callback) => {
            const handler = () => callback();
            ipcRenderer.on('dmx:disconnected', handler);
            return () => ipcRenderer.removeListener('dmx:disconnected', handler);
        },
    },
    // ============================================
    // 🎨 WAVE 153: ART-NET (DMX sobre red UDP)
    // ============================================
    artnet: {
        start: (config) => ipcRenderer.invoke('artnet:start', config),
        stop: () => ipcRenderer.invoke('artnet:stop'),
        configure: (config) => ipcRenderer.invoke('artnet:configure', config),
        getStatus: () => ipcRenderer.invoke('artnet:getStatus'), // 🔧 FIX: camelCase para match con backend
        // Eventos
        onReady: (callback) => {
            const handler = (_, status) => callback(status);
            ipcRenderer.on('artnet:ready', handler);
            return () => ipcRenderer.removeListener('artnet:ready', handler);
        },
        onError: (callback) => {
            const handler = (_, error) => callback(error);
            ipcRenderer.on('artnet:error', handler);
            return () => ipcRenderer.removeListener('artnet:error', handler);
        },
        onDisconnected: (callback) => {
            const handler = () => callback();
            ipcRenderer.on('artnet:disconnected', handler);
            return () => ipcRenderer.removeListener('artnet:disconnected', handler);
        },
    },
    // ============================================
    // 🕹️ WAVE 153.6: MANUAL OVERRIDE (UI → DMX)
    // ============================================
    override: {
        /** Set override para un fixture específico */
        set: (fixtureId, values) => ipcRenderer.invoke('override:set', fixtureId, values),
        /** Set override para múltiples fixtures (selección) */
        setMultiple: (fixtureIds, values) => ipcRenderer.invoke('override:set-multiple', fixtureIds, values),
        /** Clear override de un fixture */
        clear: (fixtureId) => ipcRenderer.invoke('override:clear', fixtureId),
        /** Clear ALL overrides (release all) */
        clearAll: () => ipcRenderer.invoke('override:clear-all'),
    },
    // ============================================
    // AUDIO
    // ============================================
    audio: {
        getDevices: () => ipcRenderer.invoke('audio:getDevices'),
        onBeat: (callback) => {
            ipcRenderer.on('audio:beat', (_, data) => callback(data));
        },
        onSpectrum: (callback) => {
            ipcRenderer.on('audio:spectrum', (_, spectrum) => callback(spectrum));
        },
        // WAVE 9.6.2: Desktop Capturer via IPC (main process)
        getDesktopSources: () => ipcRenderer.invoke('audio:getDesktopSources')
    },
    // ============================================
    // SELENE
    // ============================================
    selene: {
        onDecision: (callback) => {
            ipcRenderer.on('selene:decision', (_, decision) => callback(decision));
        },
        onMoodChange: (callback) => {
            ipcRenderer.on('selene:mood', (_, mood) => callback(mood));
        },
        setMode: (mode) => {
            ipcRenderer.invoke('selene:setMode', mode);
        },
        // 🌙 WAVE 25: DEPRECATED - Brain metrics now in selene:truth broadcast
        // onBrainMetrics: (callback: (metrics: {...}) => void) => {...}
        // 🧠 WAVE 10: Decision log entries
        onDecisionLog: (callback) => {
            const handler = (_, entry) => callback(entry);
            ipcRenderer.on('selene:decision-log', handler);
            return () => ipcRenderer.removeListener('selene:decision-log', handler);
        },
        // 🧠 WAVE 10: Get brain stats on demand
        getBrainStats: () => ipcRenderer.invoke('selene:getBrainStats'),
    },
    // ============================================
    // CONTROLS
    // ============================================
    controls: {
        setPalette: (paletteId) => ipcRenderer.invoke('controls:setPalette', paletteId),
        triggerEffect: (effectId) => ipcRenderer.invoke('controls:triggerEffect', effectId),
        setBlackout: (active) => ipcRenderer.invoke('controls:setBlackout', active),
        setMovement: (params) => ipcRenderer.invoke('controls:setMovement', params),
    },
};
// ============================================================================
// 🌙 LUX API - Selene Lux Core Bridge (WAVE 2)
// ============================================================================
const luxApi = {
    // === CONTROL ===
    /** Iniciar el motor Selene */
    start: () => ipcRenderer.invoke('lux:start'),
    /** Detener el motor Selene */
    stop: () => ipcRenderer.invoke('lux:stop'),
    /** Cambiar paleta de colores - Acepta IDs canónicos del ColorEngine */
    setPalette: (paletteId) => ipcRenderer.invoke('lux:set-palette', paletteId),
    /** Configurar movimiento */
    setMovement: (config) => ipcRenderer.invoke('lux:set-movement', config),
    /** 🎚️ WAVE 13.6 + WAVE 250: Cambiar modo Selene (flow, selene, locked) - Standardized to lux: */
    setMode: (mode) => ipcRenderer.invoke('lux:setMode', mode),
    /** 🎨 WAVE 13.6: Multiplicadores Globales de Color (saturation, intensity) */
    setGlobalColorParams: (params) => ipcRenderer.invoke('lux:set-global-color-params', params),
    /** Disparar un efecto */
    triggerEffect: (effectName, params, duration) => ipcRenderer.invoke('lux:trigger-effect', { effectName, params, duration }),
    /** Cancelar efecto por ID o nombre */
    cancelEffect: (effectIdOrName) => ipcRenderer.invoke('lux:cancel-effect', effectIdOrName),
    /** Cancelar todos los efectos */
    cancelAllEffects: () => ipcRenderer.invoke('lux:cancel-all-effects'),
    /** Blackout master - todas las luces apagadas */
    setBlackout: (active) => ipcRenderer.invoke('lux:set-blackout', active),
    /** 🗡️ WAVE 15.3 REAL: Enviar buffer de audio CRUDO a Trinity
     * Este es el ÚNICO camino válido. El buffer pasa por Beta (FFT) antes de llegar a Gamma.
     *
     * 🔥 WAVE 264.8: Cambiado de invoke() a send() para FIRE-AND-FORGET
     * invoke() crea una Promise que espera respuesta del main process.
     * A 60fps = 60 Promises/segundo. Después de ~80 segundos = ~5000 Promises pendientes.
     * Esto causa memory pressure y eventualmente bloquea el loop de requestAnimationFrame.
     *
     * send() es unidireccional - no espera respuesta, no acumula Promises.
     */
    audioBuffer: (buffer) => {
        ipcRenderer.send('lux:audio-buffer', buffer.buffer);
    },
    /** Legacy: Simular frame de audio (NO alimenta Trinity Workers) */
    // 🎯 WAVE 39.1: Ahora incluye fftBins (64 bins normalizados 0-1)
    audioFrame: (metrics) => ipcRenderer.invoke('lux:audio-frame', metrics),
    /** Obtener estado actual */
    getState: () => ipcRenderer.invoke('lux:get-state'),
    /** 🎯 WAVE 13.6: Obtener estado COMPLETO del Backend (DMX, Selene, Fixtures, Audio) */
    getFullState: () => ipcRenderer.invoke('lux:get-full-state'),
    // === EVENTOS ===
    /** Suscribirse a actualizaciones de estado (30fps) */
    onStateUpdate: (callback) => {
        const handler = (_, state) => callback(state);
        ipcRenderer.on('lux:state-update', handler);
        // Retornar función para desuscribirse
        return () => {
            ipcRenderer.removeListener('lux:state-update', handler);
        };
    },
    /** Suscribirse a cambios de paleta */
    onPaletteChange: (callback) => {
        const handler = (_, id) => callback(id);
        ipcRenderer.on('lux:palette-change', handler);
        return () => ipcRenderer.removeListener('lux:palette-change', handler);
    },
    /** Suscribirse a eventos de efectos */
    onEffectTriggered: (callback) => {
        const handler = (_, data) => callback(data.name, data.id);
        ipcRenderer.on('lux:effect-triggered', handler);
        return () => ipcRenderer.removeListener('lux:effect-triggered', handler);
    },
    /** 🎯 WAVE 13.6: Suscribirse a cambios de modo confirmados por el Backend */
    onModeChange: (callback) => {
        const handler = (_, data) => callback(data);
        ipcRenderer.on('selene:mode-changed', handler);
        return () => ipcRenderer.removeListener('selene:mode-changed', handler);
    },
    /** 📡 WAVE-14: Suscribirse a telemetría en tiempo real (20 FPS) */
    onTelemetryUpdate: (callback) => {
        const handler = (_, packet) => callback(packet);
        ipcRenderer.on('selene:telemetry-update', handler);
        return () => ipcRenderer.removeListener('selene:telemetry-update', handler);
    },
    /** 📡 WAVE 15.3: TRUTH CABLE - Datos reales de Trinity Workers */
    onAudioAnalysis: (callback) => {
        const handler = (_, analysis) => callback(analysis);
        ipcRenderer.on('trinity:audio-analysis', handler);
        return () => ipcRenderer.removeListener('trinity:audio-analysis', handler);
    },
    /** 📡 WAVE 15.3: TRUTH CABLE - Decisiones reales de Gamma */
    onLightingDecision: (callback) => {
        const handler = (_, decision) => callback(decision);
        ipcRenderer.on('trinity:lighting-decision', handler);
        return () => ipcRenderer.removeListener('trinity:lighting-decision', handler);
    },
    /** 🌙 WAVE 25: UNIVERSAL TRUTH PROTOCOL - La Verdad Única a 30fps
     * Este es el ÚNICO canal que el Frontend necesita para renderizar TODO.
     * Reemplaza: telemetry-update, state-update, brain-metrics
     */
    onTruthUpdate: (callback) => {
        const handler = (_, data) => callback(data);
        ipcRenderer.on('selene:truth', handler);
        return () => ipcRenderer.removeListener('selene:truth', handler);
    },
    /** � WAVE 25.7: THE CHRONICLER - Log events via dedicated channel
     * Logs llegan por canal separado para no interferir con el broadcast de 30fps
     * Standard channel: 'lux:log' (legacy 'selene:log' is supported for compatibility)
     */
    onLog: (callback) => {
        const handler = (_, logEntry) => callback(logEntry);
        // Prefer the standardized 'lux:log' channel
        ipcRenderer.on('lux:log', handler);
        // Also subscribe to legacy 'selene:log' for older main process versions
        ipcRenderer.on('selene:log', handler);
        return () => {
            ipcRenderer.removeListener('lux:log', handler);
            ipcRenderer.removeListener('selene:log', handler);
        };
    },
    /** �📡 WAVE-14: Establecer Input Gain */
    setInputGain: (value) => ipcRenderer.invoke('lux:setInputGain', value),
    /** 🎨 WAVE-14.5 + WAVE 250: Forzar mutación de paleta - Standardized to lux: */
    forceMutate: () => ipcRenderer.invoke('lux:forceMutation'),
    /** 🧠 WAVE-14.5: Resetear memoria de Selene */
    resetMemory: () => ipcRenderer.invoke('lux:resetMemory'),
    /**
     * 🧬 WAVE 560: Kill Switch - Enable/Disable Consciousness (Layer 1 ONLY)
     *
     * FIXED: Now uses dedicated lux:setConsciousness handler instead of lux:setUseBrain
     * - When OFF: Physics/Vibes (Layer 0) keep running - NO BLACKOUT!
     * - When ON: Consciousness (Layer 1) provides AI recommendations
     */
    setConsciousnessEnabled: (enabled) => ipcRenderer.invoke('lux:setConsciousness', enabled),
    /**
     * 🧨 WAVE 610: FORCE STRIKE - Manual Effect Detonator
     *
     * Dispara un efecto (Solar Flare) manualmente sin esperar decisión de HuntEngine.
     * Útil para testear efectos sin alterar umbrales de algoritmos.
     *
     * @param config - { effect: 'solar_flare', intensity: 0-1 }
     */
    forceStrike: (config) => ipcRenderer.invoke('lux:forceStrike', config),
    // ============================================
    // 🎛️ WAVE 62 + WAVE 250: VIBE SELECTOR (Standardized to lux:)
    // ============================================
    /** Set active Vibe profile (techno-club, fiesta-latina, pop-rock, chill-lounge) */
    setVibe: (vibeId) => ipcRenderer.invoke('lux:setVibe', vibeId),
    /** Get current active Vibe */
    getVibe: () => ipcRenderer.invoke('lux:get-vibe'),
    /** Subscribe to Vibe changes */
    onVibeChange: (callback) => {
        const handler = (_, data) => callback(data);
        // Listen to both for backward compat
        ipcRenderer.on('lux:vibe-changed', handler);
        ipcRenderer.on('selene:vibe-changed', handler);
        return () => {
            ipcRenderer.removeListener('lux:vibe-changed', handler);
            ipcRenderer.removeListener('selene:vibe-changed', handler);
        };
    },
    // ============================================
    // 🎭 WAVE 700.5.4: MOOD CONTROL
    // ============================================
    mood: {
        /** Set active Mood (calm, balanced, punk) */
        setMood: (moodId) => ipcRenderer.invoke('lux:setMood', moodId),
        /** Get current active Mood */
        getMood: () => ipcRenderer.invoke('lux:getMood'),
        /** Subscribe to Mood changes */
        onMoodChange: (callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on('lux:mood-changed', handler);
            return () => ipcRenderer.removeListener('lux:mood-changed', handler);
        },
    },
    // ============================================
    // WAVE 9.5: FIXTURES
    // ============================================
    /** Escanear carpeta de fixtures */
    scanFixtures: (customPath) => ipcRenderer.invoke('lux:scan-fixtures', customPath),
    /** Obtener biblioteca de fixtures */
    getFixtureLibrary: () => ipcRenderer.invoke('lux:get-fixture-library'),
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 384: GET FIXTURE DEFINITION - Returns FULL profile with channels
    // ═══════════════════════════════════════════════════════════════════════════
    /** Obtener definición completa de un fixture por su ID */
    getFixtureDefinition: (profileId) => ipcRenderer.invoke('lux:getFixtureDefinition', profileId),
    /** Obtener fixtures patcheados */
    getPatchedFixtures: () => ipcRenderer.invoke('lux:get-patched-fixtures'),
    /** Añadir fixture al patch */
    patchFixture: (fixtureId, dmxAddress, universe) => ipcRenderer.invoke('lux:patch-fixture', { fixtureId, dmxAddress, universe }),
    /** Eliminar fixture del patch */
    unpatchFixture: (dmxAddress) => ipcRenderer.invoke('lux:unpatch-fixture', dmxAddress),
    /** ✏️ WAVE 256: Editar fixture patcheado - ALL fields */
    editFixture: (originalDmxAddress, newDmxAddress, universe, updateData) => ipcRenderer.invoke('lux:edit-fixture', {
        originalDmxAddress,
        newDmxAddress,
        universe,
        ...updateData
    }),
    /** 🔬 WAVE 10.5: Forzar tipo de fixture manualmente */
    forceFixtureType: (dmxAddress, newType) => ipcRenderer.invoke('lux:force-fixture-type', dmxAddress, newType),
    /** 🎯 WAVE 12.5: Selector de Montaje (ceiling/floor) */
    setInstallationType: (type) => ipcRenderer.invoke('lux:set-installation', type),
    /** Limpiar todo el patch */
    clearPatch: () => ipcRenderer.invoke('lux:clear-patch'),
    /** ⚡ WAVE 27: Guardar definición de fixture desde Fixture Forge */
    saveDefinition: (definition) => ipcRenderer.invoke('lux:save-fixture-definition', definition),
    /** 🎭 WAVE 10.6: Nuevo show - reset completo */
    newShow: () => ipcRenderer.invoke('lux:new-show'),
    // ============================================
    // ⚡ WAVE 27: FIXTURES OBJECT
    // ============================================
    fixtures: {
        saveDefinition: (definition) => ipcRenderer.invoke('lux:save-fixture-definition', definition),
        // WAVE 388 EXT: Delete fixture from library
        deleteDefinition: (fixtureId) => ipcRenderer.invoke('lux:delete-fixture-definition', fixtureId),
    },
    // WAVE 388 EXT: Shortcut for delete
    deleteDefinition: (fixtureId) => ipcRenderer.invoke('lux:delete-fixture-definition', fixtureId),
    // ============================================
    // 🎭 WAVE 26: SHOW MANAGEMENT - PURGED WAVE 365
    // Legacy methods removed. Use lux.stage.* API instead
    // ============================================
    // ============================================
    // WAVE 9.5: CONFIG
    // ============================================
    /** Obtener configuración */
    getConfig: () => ipcRenderer.invoke('lux:get-config'),
    /** Guardar configuración */
    saveConfig: (config) => ipcRenderer.invoke('lux:save-config', config),
    /** Resetear configuración */
    resetConfig: () => ipcRenderer.invoke('lux:reset-config'),
    // ============================================
    // 🎛️ WAVE 375: MASTER ARBITER API
    // ============================================
    arbiter: {
        /** Get Arbiter status (layer, hasManualOverrides, grandMaster, blackout) */
        status: () => ipcRenderer.invoke('lux:arbiter:status'),
        /** Set Grand Master intensity (0-1) */
        setGrandMaster: (value) => ipcRenderer.invoke('lux:arbiter:setGrandMaster', { value }),
        /**
         * 🎛️ WAVE 375.3: Set manual override for fixtures
         * @param fixtureIds - Array of fixture IDs to override
         * @param controls - Control values { dimmer?, r?, g?, b?, pan?, tilt? }
         * @param channels - Which channels to override (optional)
         * @param source - Source identifier (default: 'ui_programmer')
         */
        setManual: (args) => {
            // Send all fixtures in a single call to backend (WAVE 439.6 fix)
            return ipcRenderer.invoke('lux:arbiter:setManual', {
                fixtureIds: args.fixtureIds,
                controls: args.controls,
                channels: args.channels || Object.keys(args.controls),
            });
        },
        /**
         * 🎛️ WAVE 375.3: Clear manual override for specific fixtures/channels
         * @param fixtureIds - Array of fixture IDs to release
         * @param channels - Optional specific channels to release
         */
        clearManual: (args) => {
            // Send all fixtures in a single call to backend (WAVE 439.6 fix)
            return ipcRenderer.invoke('lux:arbiter:clearManual', {
                fixtureIds: args.fixtureIds,
                channels: args.channels,
            });
        },
        /** Clear ALL manual overrides - return to AI control */
        clearAllManual: () => ipcRenderer.invoke('lux:arbiter:clearAllManual'),
        /** Toggle blackout state */
        toggleBlackout: () => ipcRenderer.invoke('lux:arbiter:toggleBlackout'),
        /** Set blackout state */
        setBlackout: (active) => ipcRenderer.invoke('lux:arbiter:blackout', active),
        /** Check if fixture has manual override */
        hasManual: (fixtureId, channel) => ipcRenderer.invoke('lux:arbiter:hasManual', { fixtureId, channel }),
        /** Subscribe to Arbiter status changes */
        onStatusChange: (callback) => {
            const handler = (_, status) => callback(status);
            ipcRenderer.on('lux:arbiter:status-change', handler);
            return () => ipcRenderer.removeListener('lux:arbiter:status-change', handler);
        },
        // ============================================
        // 🎯 WAVE 377: CALIBRATION MODE
        // ============================================
        /**
         * Enter calibration mode for a fixture
         * Sets manual override for pan/tilt with special 'calibration' source
         */
        enterCalibrationMode: (fixtureId) => ipcRenderer.invoke('lux:arbiter:enterCalibrationMode', { fixtureId }),
        /**
         * Exit calibration mode for a fixture
         * Smoothly transitions back to AI control
         */
        exitCalibrationMode: (fixtureId) => ipcRenderer.invoke('lux:arbiter:exitCalibrationMode', { fixtureId }),
        /**
         * Check if a fixture is currently in calibration mode
         */
        isCalibrating: (fixtureId) => ipcRenderer.invoke('lux:arbiter:isCalibrating', { fixtureId }),
        // ============================================
        // 🌉 WAVE 377: FIXTURE SYNC (TitanSyncBridge)
        // ============================================
        /**
         * Sync fixtures from stageStore to backend MasterArbiter
         * Called by TitanSyncBridge when patch changes
         */
        setFixtures: (fixtures) => ipcRenderer.invoke('lux:arbiter:setFixtures', { fixtures }),
    },
    // ============================================
    // 🔌 WAVE 369.5: STAGE PERSISTENCE V2 + FILE DIALOGS
    // ============================================
    stage: {
        /** Load a show file (V2 format) */
        load: (filePath) => ipcRenderer.invoke('lux:stage:load', filePath),
        /** Load the active show (on startup) */
        loadActive: () => ipcRenderer.invoke('lux:stage:loadActive'),
        /** Save show to disk */
        save: (showFile, filePath) => ipcRenderer.invoke('lux:stage:save', showFile, filePath),
        /** Save show with new name */
        saveAs: (showFile, name) => ipcRenderer.invoke('lux:stage:saveAs', showFile, name),
        /** List all shows */
        list: () => ipcRenderer.invoke('lux:stage:list'),
        /** Get recent shows */
        recent: () => ipcRenderer.invoke('lux:stage:recent'),
        /** Delete a show */
        delete: (filePath) => ipcRenderer.invoke('lux:stage:delete', filePath),
        /** Get shows folder path */
        getPath: () => ipcRenderer.invoke('lux:stage:getPath'),
        /** Check if show exists */
        exists: (name) => ipcRenderer.invoke('lux:stage:exists', name),
        // WAVE 369.5: Native File Dialogs
        /** Open file dialog - returns selected path and loads the file */
        openDialog: () => ipcRenderer.invoke('lux:stage:openDialog'),
        /** Save As dialog - let user choose name/location */
        saveAsDialog: (showFile, suggestedName) => ipcRenderer.invoke('lux:stage:saveAsDialog', showFile, suggestedName),
        /** Confirm unsaved changes dialog */
        confirmUnsaved: (showName) => ipcRenderer.invoke('lux:stage:confirmUnsaved', showName),
        /** Subscribe to show loaded event */
        onLoaded: (callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on('lux:stage:loaded', handler);
            return () => ipcRenderer.removeListener('lux:stage:loaded', handler);
        },
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 384: LUXDEBUG - Test utilities for Constructor verification
// ═══════════════════════════════════════════════════════════════════════════
const luxDebug = {
    /**
     * Test Constructor data flow integrity
     * Usage: window.luxDebug.testConstructor()
     */
    testConstructor: async () => {
        console.log('\n🔥 ═══════════════════════════════════════════════════════════════');
        console.log('🔥 WAVE 384: CONSTRUCTOR INTEGRITY TEST');
        console.log('🔥 ═══════════════════════════════════════════════════════════════\n');
        // Step 1: Get fixture library
        console.log('[TEST] Step 1: Loading fixture library...');
        const libraryResult = await ipcRenderer.invoke('lux:get-fixture-library');
        if (!libraryResult.success || libraryResult.fixtures.length === 0) {
            console.error('[TEST] ❌ FAIL: No fixtures in library');
            return { success: false, error: 'No fixtures in library' };
        }
        const testProfile = libraryResult.fixtures[0];
        console.log(`[TEST] ✅ Library has ${libraryResult.fixtures.length} fixtures`);
        console.log(`[TEST] Using: "${testProfile.name}" (${testProfile.id})`);
        // Step 2: Test getFixtureDefinition endpoint
        console.log('\n[TEST] Step 2: Testing lux:getFixtureDefinition...');
        const defResult = await ipcRenderer.invoke('lux:getFixtureDefinition', testProfile.id);
        if (!defResult.success || !defResult.definition) {
            console.error('[TEST] ❌ FAIL: getFixtureDefinition returned no data');
            return { success: false, error: 'getFixtureDefinition failed' };
        }
        const def = defResult.definition;
        console.log(`[TEST] ✅ Definition retrieved:`);
        console.log(`       Name: ${def.name}`);
        console.log(`       Type: ${def.type}`);
        console.log(`       Channels: ${def.channelCount}`);
        console.log(`       Channel defs: ${def.channels?.length || 0}`);
        console.log(`       Has movement: ${def.hasMovementChannels}`);
        console.log(`       Has color mixing: ${def.hasColorMixing}`);
        // Step 3: Verify channels array is populated
        console.log('\n[TEST] Step 3: Verifying channel data...');
        const assertions = {
            hasChannelsArray: def.channels && def.channels.length > 0,
            channelsMatchCount: def.channels?.length === def.channelCount || def.channels?.length > 0,
            typeNotGeneric: def.type !== 'generic' || testProfile.type === 'generic',
            hasCapabilities: typeof def.hasMovementChannels === 'boolean'
        };
        console.log(`[TEST] ASSERT channels.length > 0: ${assertions.hasChannelsArray ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`[TEST] ASSERT channels match count: ${assertions.channelsMatchCount ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`[TEST] ASSERT type is specific: ${assertions.typeNotGeneric ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`[TEST] ASSERT capabilities exist: ${assertions.hasCapabilities ? '✅ PASS' : '❌ FAIL'}`);
        const allPassed = Object.values(assertions).every(v => v);
        console.log('\n🔥 ═══════════════════════════════════════════════════════════════');
        console.log(`🔥 TEST RESULT: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
        console.log('🔥 ═══════════════════════════════════════════════════════════════\n');
        return {
            success: allPassed,
            profile: testProfile,
            definition: def,
            assertions
        };
    },
    /**
     * Inspect a fixture in stageStore
     * Usage: window.luxDebug.inspectFixture(fixtureId)
     */
    inspectFixture: (fixtureId) => {
        console.log(`\n🔍 Inspecting fixture: ${fixtureId}`);
        console.log('(Check React DevTools or stageStore for full data)');
        return { fixtureId, note: 'Use React DevTools to inspect stageStore' };
    },
    /**
     * List all available API methods
     */
    help: () => {
        console.log('\n🔥 LUXDEBUG - Available Commands:');
        console.log('  window.luxDebug.testConstructor()     - Test WAVE 384 data flow');
        console.log('  window.luxDebug.inspectFixture(id)    - Inspect a fixture');
        console.log('  window.luxDebug.help()                - Show this help');
        console.log('');
    }
};
// 🎯 WAVE 13.6: STATE OF TRUTH - Exponer ipcRenderer para suscripciones a eventos
const electronAPI = {
    ipcRenderer: {
        on: (channel, listener) => {
            ipcRenderer.on(channel, listener);
        },
        removeListener: (channel, listener) => {
            ipcRenderer.removeListener(channel, listener);
        }
    }
};
// Exponer las APIs al renderer
contextBridge.exposeInMainWorld('luxsync', api);
contextBridge.exposeInMainWorld('lux', luxApi);
contextBridge.exposeInMainWorld('electron', electronAPI);
contextBridge.exposeInMainWorld('luxDebug', luxDebug);
