/**
 * 💡 FIXTURE MANAGER
 * Gestiona todos los fixtures (luces) de la instalación
 *
 * - Carga definiciones de fixtures (.fxt)
 * - Mantiene estado de cada fixture
 * - Traduce decisiones abstractas a valores DMX concretos
 */
/**
 * 💡 FixtureManager
 */
export class FixtureManager {
    constructor() {
        this.fixtures = new Map();
        this.definitions = new Map();
        this.groups = new Map(); // group -> fixtureIds
        this.loadDefaultDefinitions();
    }
    /**
     * Cargar definiciones predeterminadas (fixtures genéricos)
     */
    loadDefaultDefinitions() {
        // Par LED RGB genérico
        this.definitions.set('generic-par-rgb', {
            name: 'Generic PAR RGB',
            manufacturer: 'Generic',
            type: 'par',
            channels: [
                { name: 'Dimmer', type: 'dimmer', defaultValue: 0 },
                { name: 'Red', type: 'red', defaultValue: 0 },
                { name: 'Green', type: 'green', defaultValue: 0 },
                { name: 'Blue', type: 'blue', defaultValue: 0 },
            ],
            modes: [{ name: '4ch', channelCount: 4 }],
        });
        // Par LED RGBW genérico
        this.definitions.set('generic-par-rgbw', {
            name: 'Generic PAR RGBW',
            manufacturer: 'Generic',
            type: 'par',
            channels: [
                { name: 'Dimmer', type: 'dimmer', defaultValue: 0 },
                { name: 'Red', type: 'red', defaultValue: 0 },
                { name: 'Green', type: 'green', defaultValue: 0 },
                { name: 'Blue', type: 'blue', defaultValue: 0 },
                { name: 'White', type: 'white', defaultValue: 0 },
            ],
            modes: [{ name: '5ch', channelCount: 5 }],
        });
        // Moving Head genérico
        this.definitions.set('generic-moving-head', {
            name: 'Generic Moving Head',
            manufacturer: 'Generic',
            type: 'moving_head',
            channels: [
                { name: 'Pan', type: 'pan', defaultValue: 127 },
                { name: 'Pan Fine', type: 'panFine', defaultValue: 0 },
                { name: 'Tilt', type: 'tilt', defaultValue: 127 },
                { name: 'Tilt Fine', type: 'tiltFine', defaultValue: 0 },
                { name: 'Speed', type: 'speed', defaultValue: 0 },
                { name: 'Dimmer', type: 'dimmer', defaultValue: 0 },
                { name: 'Strobe', type: 'strobe', defaultValue: 0 },
                { name: 'Red', type: 'red', defaultValue: 0 },
                { name: 'Green', type: 'green', defaultValue: 0 },
                { name: 'Blue', type: 'blue', defaultValue: 0 },
                { name: 'White', type: 'white', defaultValue: 0 },
                { name: 'Gobo', type: 'gobo', defaultValue: 0 },
                { name: 'Gobo Rotation', type: 'goboRotation', defaultValue: 0 },
                { name: 'Focus', type: 'focus', defaultValue: 127 },
                { name: 'Prism', type: 'prism', defaultValue: 0 },
            ],
            modes: [{ name: '15ch', channelCount: 15 }],
        });
        // Strobe genérico
        this.definitions.set('generic-strobe', {
            name: 'Generic Strobe',
            manufacturer: 'Generic',
            type: 'strobe',
            channels: [
                { name: 'Dimmer', type: 'dimmer', defaultValue: 0 },
                { name: 'Strobe', type: 'strobe', defaultValue: 0 },
            ],
            modes: [{ name: '2ch', channelCount: 2 }],
        });
    }
    /**
     * Agregar un fixture
     */
    addFixture(id, definitionId, universe, startChannel, group) {
        const definition = this.definitions.get(definitionId);
        if (!definition) {
            console.warn(`Definition not found: ${definitionId}`);
            return null;
        }
        const caps = this.detectCapabilities(definition);
        const fixture = {
            id,
            definition,
            universe,
            startChannel,
            state: {
                dimmer: 0,
                color: { r: 0, g: 0, b: 0 },
                white: 0,
                pan: 0.5,
                tilt: 0.5,
                gobo: 0,
                strobe: 0,
                // 🔍 WAVE 338.2: Optics defaults (neutral)
                zoom: 127, // Medio
                focus: 127, // Medio
                iris: 255, // Full open
                caps,
            },
            group,
        };
        this.fixtures.set(id, fixture);
        if (group) {
            if (!this.groups.has(group)) {
                this.groups.set(group, []);
            }
            this.groups.get(group).push(id);
        }
        return fixture;
    }
    detectCapabilities(def) {
        return {
            hasDimmer: def.channels.some(c => c.type === 'dimmer'),
            hasRGB: def.channels.some(c => c.type === 'red') &&
                def.channels.some(c => c.type === 'green') &&
                def.channels.some(c => c.type === 'blue'),
            hasWhite: def.channels.some(c => c.type === 'white'),
            hasPanTilt: def.channels.some(c => c.type === 'pan') &&
                def.channels.some(c => c.type === 'tilt'),
            hasGobo: def.channels.some(c => c.type === 'gobo'),
            hasStrobe: def.channels.some(c => c.type === 'strobe'),
            hasPrism: def.channels.some(c => c.type === 'prism'),
            hasZoom: def.channels.some(c => c.type === 'zoom'),
            // 🔍 WAVE 338.2: Optics detection
            hasFocus: def.channels.some(c => c.type === 'focus'),
            hasIris: def.channels.some(c => c.type === 'iris'),
        };
    }
    /**
     * Aplicar salida de ColorEngine
     */
    applyColor(fixtureId, color) {
        const fixture = this.fixtures.get(fixtureId);
        if (!fixture)
            return;
        fixture.state.dimmer = Math.round(color.intensity * 255);
        fixture.state.color = color.primary;
    }
    /**
     * Aplicar salida de MovementEngine
     */
    applyMovement(fixtureId, movement) {
        const fixture = this.fixtures.get(fixtureId);
        if (!fixture || !fixture.state.caps.hasPanTilt)
            return;
        fixture.state.pan = movement.pan;
        fixture.state.tilt = movement.tilt;
    }
    /**
     * 🔍 WAVE 338.2: Aplicar ópticas (zoom, focus, iris)
     * @param fixtureId - ID del fixture
     * @param optics - Configuración de ópticas { zoom: 0-255, focus: 0-255, iris?: 0-255 }
     */
    applyOptics(fixtureId, optics) {
        const fixture = this.fixtures.get(fixtureId);
        if (!fixture)
            return;
        const { caps } = fixture.state;
        if (caps.hasZoom) {
            fixture.state.zoom = Math.round(Math.max(0, Math.min(255, optics.zoom)));
        }
        if (caps.hasFocus) {
            fixture.state.focus = Math.round(Math.max(0, Math.min(255, optics.focus)));
        }
        if (caps.hasIris && optics.iris !== undefined) {
            fixture.state.iris = Math.round(Math.max(0, Math.min(255, optics.iris)));
        }
    }
    /**
     * 🔍 WAVE 338.2: Aplicar ópticas a todos los fixtures con capacidades ópticas
     * @param optics - Configuración de ópticas global
     */
    applyOpticsToAll(optics) {
        for (const [fixtureId, fixture] of this.fixtures) {
            const { caps } = fixture.state;
            if (caps.hasZoom || caps.hasFocus || caps.hasIris) {
                this.applyOptics(fixtureId, optics);
            }
        }
    }
    /**
     * Aplicar efectos
     */
    applyEffects(fixtureId, effects) {
        const fixture = this.fixtures.get(fixtureId);
        if (!fixture)
            return;
        if (fixture.state.caps.hasStrobe) {
            fixture.state.strobe = effects.strobe
                ? Math.round(effects.strobeSpeed * 255)
                : 0;
        }
        if (effects.blinder) {
            fixture.state.dimmer = 255;
        }
    }
    /**
     * Generar array de valores DMX para un fixture
     */
    getDMXValues(fixtureId) {
        const fixture = this.fixtures.get(fixtureId);
        if (!fixture)
            return [];
        const values = [];
        const s = fixture.state;
        for (const channel of fixture.definition.channels) {
            switch (channel.type) {
                case 'dimmer':
                    values.push(s.dimmer);
                    break;
                case 'red':
                    values.push(s.color.r);
                    break;
                case 'green':
                    values.push(s.color.g);
                    break;
                case 'blue':
                    values.push(s.color.b);
                    break;
                case 'white':
                    values.push(s.white);
                    break;
                case 'pan':
                    values.push(Math.round(s.pan * 255));
                    break;
                case 'panFine':
                    values.push(Math.round((s.pan * 255 % 1) * 255));
                    break;
                case 'tilt':
                    values.push(Math.round(s.tilt * 255));
                    break;
                case 'tiltFine':
                    values.push(Math.round((s.tilt * 255 % 1) * 255));
                    break;
                case 'strobe':
                    values.push(s.strobe);
                    break;
                case 'gobo':
                    values.push(s.gobo);
                    break;
                // 🔍 WAVE 338.2: Optics DMX output
                case 'zoom':
                    values.push(s.zoom);
                    break;
                case 'focus':
                    values.push(s.focus);
                    break;
                case 'iris':
                    values.push(s.iris);
                    break;
                default: values.push(channel.defaultValue);
            }
        }
        return values;
    }
    getAllFixtures() {
        return Array.from(this.fixtures.values());
    }
    getGroup(groupName) {
        const ids = this.groups.get(groupName) || [];
        return ids.map(id => this.fixtures.get(id)).filter(Boolean);
    }
    getState(fixtureId) {
        return this.fixtures.get(fixtureId)?.state ?? null;
    }
    registerDefinition(id, definition) {
        this.definitions.set(id, definition);
    }
    getAvailableDefinitions() {
        return Array.from(this.definitions.keys());
    }
    clear() {
        this.fixtures.clear();
        this.groups.clear();
    }
    getCount() {
        return this.fixtures.size;
    }
}
