/**
 * 🔬 FXTParser.ts - WAVE 10.5: Parser de Fixtures Profesional
 *
 * Ingeniería inversa de archivos .fxt (FreeStyler)
 * con detección heurística avanzada de tipo de fixture.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTRATEGIA DE DETECCIÓN:
 * 1. Análisis de canales (Pan, Tilt, Pan16bit = Moving Head)
 * 2. Diccionario de modelos conocidos (LB230N = Beam = Moving)
 * 3. Heurística por cantidad de canales (>10 = sospechoso de Moving)
 * 4. Fallback por nombre de archivo
 * ─────────────────────────────────────────────────────────────────────────────
 */
import * as fs from 'fs';
import * as path from 'path';
// ─────────────────────────────────────────────────────────────────────────────
// DICCIONARIOS DE DETECCIÓN
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 🎯 MODELOS CONOCIDOS
 * Mapeo de nombres de modelo a tipo de fixture
 */
const KNOWN_MODELS = {
    // Beam Moving Heads
    'lb230': 'moving_head',
    'lb230n': 'moving_head',
    'beam 230': 'moving_head',
    'beam 2r': 'moving_head',
    '5r beamer': 'moving_head',
    'sharpy': 'moving_head',
    'intimidator': 'moving_head',
    'vizi spot': 'moving_head',
    'quantum pro': 'moving_head',
    'neo 250': 'moving_head',
    // Wash Moving Heads
    'wash led': 'wash',
    'led wash': 'wash',
    'quantum wash': 'wash',
    // PARs
    'par tec': 'par',
    'par led': 'par',
    'par 64': 'par',
    'mega par': 'par',
    'slim par': 'par',
    'flat par': 'par',
    'juillet': 'par', // Tu fixture Juillet 2011
    // Strobes
    'strobe': 'strobe',
    'beukystrobe': 'strobe',
    'atomic': 'strobe',
    // Lasers
    'laser': 'laser',
};
/**
 * 🔤 SINÓNIMOS DE CANALES
 * Diferentes nombres para el mismo tipo de canal
 */
const CHANNEL_SYNONYMS = {
    // MOVIMIENTO - Pan
    'pan': 'pan',
    'pan coarse': 'pan',
    'horizontal': 'pan',
    'x-axis': 'pan',
    'x axis': 'pan',
    'pancoarse': 'pan',
    // MOVIMIENTO - Pan Fine
    'pan fine': 'pan_fine',
    'pan16bit': 'pan_fine',
    'panfine': 'pan_fine',
    'pan 16bit': 'pan_fine',
    'pan 16-bit': 'pan_fine',
    // MOVIMIENTO - Tilt
    'tilt': 'tilt',
    'tilt coarse': 'tilt',
    'vertical': 'tilt',
    'y-axis': 'tilt',
    'y axis': 'tilt',
    'tiltcoarse': 'tilt',
    // MOVIMIENTO - Tilt Fine
    'tilt fine': 'tilt_fine',
    'tilt16bit': 'tilt_fine',
    'tiltfine': 'tilt_fine',
    'tilt 16bit': 'tilt_fine',
    'tilt 16-bit': 'tilt_fine',
    // DIMMER
    'dimmer': 'dimmer',
    'dim': 'dimmer',
    'master': 'dimmer',
    'master dimmer': 'dimmer',
    'intensity': 'dimmer',
    'brightness': 'dimmer',
    'lamp': 'dimmer',
    // DIMMER Fine
    'dimmer fine': 'dimmer_fine',
    'dim fine': 'dimmer_fine',
    // COLORES RGB
    'red': 'red',
    'r': 'red',
    'rojo': 'red',
    'green': 'green',
    'g': 'green',
    'verde': 'green',
    'blue': 'blue',
    'b': 'blue',
    'azul': 'blue',
    'white': 'white',
    'w': 'white',
    'ww': 'white',
    'cw': 'white',
    'warm white': 'white',
    'cool white': 'white',
    'blanco': 'white',
    'amber': 'amber',
    'a': 'amber',
    'ambar': 'amber',
    'uv': 'uv',
    'ultraviolet': 'uv',
    // COLOR WHEEL
    'color': 'color_wheel',
    'color1': 'color_wheel',
    'color2': 'color_wheel',
    'color wheel': 'color_wheel',
    'colour': 'color_wheel',
    'colour wheel': 'color_wheel',
    // GOBOS
    'gobo': 'gobo',
    'gobo1': 'gobo',
    'gobo2': 'gobo',
    'gobo wheel': 'gobo',
    'gobo select': 'gobo',
    'gobo rot': 'gobo_rotation',
    'gobo rotation': 'gobo_rotation',
    'gobo spin': 'gobo_rotation',
    'goborot': 'gobo_rotation',
    // STROBE/SHUTTER
    'strobe': 'strobe',
    'stroboscope': 'strobe',
    'flash': 'strobe',
    'shutter': 'shutter',
    'blackout': 'shutter',
    // PRISM
    'prism': 'prism',
    'prisma': 'prism',
    'prism rot': 'prism_rotation',
    'prismrot': 'prism_rotation',
    'prism rotation': 'prism_rotation',
    // ÓPTICA
    'focus': 'focus',
    'foco': 'focus',
    'zoom': 'zoom',
    'iris': 'iris',
    // VELOCIDAD/CONTROL
    'speed': 'speed',
    'pan/tilt speed': 'speed',
    'movement speed': 'speed',
    'macro': 'macro',
    'macros': 'macro',
    'effect': 'macro',
    'effects': 'macro',
    'control': 'control',
    'reset': 'control',
    'lamp control': 'control',
};
// ─────────────────────────────────────────────────────────────────────────────
// PARSER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export class FXTParser {
    constructor(debug = false) {
        this.libraryPath = ''; // WAVE 387: Configurable library path
        this.debug = debug;
    }
    // WAVE 387: Library path management
    setLibraryPath(path) {
        this.libraryPath = path;
        if (this.debug) {
            console.log(`[FXTParser] 📁 Library path set to: ${path}`);
        }
    }
    getLibraryPath() {
        return this.libraryPath;
    }
    /**
     * 📂 Parsea un archivo .fxt completo
     */
    parseFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return this.parseContent(content, filePath);
        }
        catch (err) {
            console.error(`[FXTParser] ❌ Error parsing ${filePath}:`, err);
            return null;
        }
    }
    /**
     * 📝 Parsea el contenido de un archivo .fxt
     */
    parseContent(content, filePath) {
        const lines = content.split(/\r?\n/);
        // Extraer información básica
        const manufacturer = lines[0]?.trim() || 'Unknown';
        const fileBaseName = path.basename(filePath, '.fxt');
        // 🔬 WAVE 10.5: El nombre del archivo es la fuente más confiable
        // Los .fxt tienen estructuras muy variadas, pero el nombre de archivo
        // suele ser descriptivo (ej: "5R Beamer Stream.fxt", "LB230N.fxt")
        let name = fileBaseName.trim();
        // Intentar buscar nombre interno solo si el archivo se llama genérico
        if (name.toLowerCase().includes('untitled') || name.length < 3) {
            // Buscar en las primeras líneas (después de Comments:)
            for (let i = 3; i < Math.min(lines.length, 10); i++) {
                const line = lines[i]?.trim();
                if (line &&
                    line.length > 2 &&
                    !line.match(/^\d+$/) &&
                    !line.includes('"') &&
                    !line.includes('.') &&
                    !line.includes('\\') &&
                    !line.includes('/') &&
                    !line.toLowerCase().includes('by ') &&
                    !line.toLowerCase().includes('channel') &&
                    !line.toLowerCase().includes('comments')) {
                    name = line;
                    break;
                }
            }
        }
        // Buscar cantidad de canales
        let channelCount = 0;
        for (let i = 0; i < Math.min(lines.length, 20); i++) {
            const line = lines[i]?.trim();
            if (/^\d+$/.test(line)) {
                const num = parseInt(line);
                if (num > 0 && num <= 64) { // Límite razonable para canales
                    channelCount = num;
                    break;
                }
            }
        }
        // Extraer nombres de canales (buscar sección de canales)
        const channels = this.extractChannels(lines);
        // Detectar tipo de fixture
        const detection = this.detectFixtureType(name, fileBaseName, channels, channelCount);
        // Generar ID único
        const id = fileBaseName.replace(/\s+/g, '_').toLowerCase();
        // WAVE 385: Trust empirical data over header metadata
        // Math.max ensures we report actual channel count found, not just header value
        const actualChannelCount = Math.max(channelCount, channels.length) || 1;
        const result = {
            id,
            name,
            manufacturer,
            channelCount: actualChannelCount,
            type: detection.type,
            filePath,
            channels,
            confidence: detection.confidence,
            detectionMethod: detection.method,
            hasMovementChannels: channels.some(c => c.type === 'pan' || c.type === 'tilt'),
            has16bitMovement: channels.some(c => c.type === 'pan_fine' || c.type === 'tilt_fine'),
            hasColorMixing: channels.some(c => ['red', 'green', 'blue'].includes(c.type)),
            hasColorWheel: channels.some(c => c.type === 'color_wheel'),
        };
        if (this.debug) {
            console.log(`[FXTParser] 🔬 Parsed: ${name}`);
            console.log(`  Type: ${result.type} (${result.confidence.toFixed(2)} conf, ${result.detectionMethod})`);
            console.log(`  Channels: ${result.channelCount}`);
            console.log(`  Movement: ${result.hasMovementChannels} (16bit: ${result.has16bitMovement})`);
            console.log(`  Color: RGB=${result.hasColorMixing}, Wheel=${result.hasColorWheel}`);
        }
        return result;
    }
    /**
     * 🔍 Extrae los nombres de canales del archivo .fxt
     */
    extractChannels(lines) {
        const channels = [];
        const seenChannelNames = new Set();
        // Los nombres de canales en .fxt están típicamente después de las imágenes
        // Son líneas con nombres cortos sin extensiones de archivo
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]?.trim();
            // Saltar líneas vacías, números, rutas de archivos, comillas
            if (!line ||
                /^\d+$/.test(line) ||
                line.includes('.gif') ||
                line.includes('.bmp') ||
                line.includes('.png') ||
                line.includes('.jpg') ||
                line.includes('\\') ||
                line.includes('/') ||
                line.startsWith('"') ||
                line.startsWith('-') ||
                line === 'Comments:' ||
                line === 'Sliders' ||
                line === 'Macros') {
                continue;
            }
            // Buscar nombres de canales conocidos
            const channelType = this.identifyChannel(line);
            // WAVE 385.5: NO descartar canales unknown - son datos REALES
            // Si parece un nombre de canal (no es path, no es número), lo guardamos
            if (!seenChannelNames.has(line.toLowerCase())) {
                seenChannelNames.add(line.toLowerCase());
                channels.push({
                    index: channels.length,
                    name: line, // Guardamos el nombre original siempre
                    type: channelType, // Puede ser 'unknown', no importa - datos > filtro
                    is16bit: channelType.includes('fine') || line.toLowerCase().includes('16bit'),
                });
            }
        }
        return channels;
    }
    /**
     * 🏷️ Identifica el tipo de un canal por su nombre
     */
    identifyChannel(name) {
        const normalized = name.toLowerCase().trim();
        // Buscar coincidencia exacta primero
        if (CHANNEL_SYNONYMS[normalized]) {
            return CHANNEL_SYNONYMS[normalized];
        }
        // Buscar coincidencia parcial
        for (const [synonym, type] of Object.entries(CHANNEL_SYNONYMS)) {
            if (normalized.includes(synonym) || synonym.includes(normalized)) {
                return type;
            }
        }
        return 'unknown';
    }
    /**
     * 🎯 DETECCIÓN INTELIGENTE DE TIPO
     * Usa múltiples métodos en orden de confianza
     */
    detectFixtureType(name, fileName, channels, channelCount) {
        const nameLower = name.toLowerCase();
        const fileNameLower = fileName.toLowerCase();
        // ─────────────────────────────────────────────────────────────────────────
        // MÉTODO 1: Detección por CANALES (mayor confianza)
        // ─────────────────────────────────────────────────────────────────────────
        const hasPan = channels.some(c => c.type === 'pan' || c.type === 'pan_fine');
        const hasTilt = channels.some(c => c.type === 'tilt' || c.type === 'tilt_fine');
        const hasColorMix = channels.some(c => ['red', 'green', 'blue'].includes(c.type));
        const hasStrobe = channels.some(c => c.type === 'strobe');
        const hasGobo = channels.some(c => c.type === 'gobo' || c.type === 'gobo_rotation');
        const hasColorWheel = channels.some(c => c.type === 'color_wheel');
        const hasPrism = channels.some(c => c.type === 'prism' || c.type === 'prism_rotation');
        const hasZoom = channels.some(c => c.type === 'zoom');
        const hasFocus = channels.some(c => c.type === 'focus');
        // MOVING HEAD: Tiene Pan Y Tilt
        if (hasPan && hasTilt) {
            // Determinar si es Wash o Spot/Beam
            if (hasGobo || hasPrism) {
                return { type: 'moving_head', confidence: 0.98, method: 'channels' };
            }
            if (hasColorMix && !hasColorWheel) {
                return { type: 'wash', confidence: 0.95, method: 'channels' };
            }
            return { type: 'moving_head', confidence: 0.95, method: 'channels' };
        }
        // STROBE: Canal strobe prominente, sin movimiento
        if (hasStrobe && !hasPan && !hasTilt && channelCount <= 4) {
            return { type: 'strobe', confidence: 0.90, method: 'channels' };
        }
        // PAR: Solo RGB sin movimiento
        if (hasColorMix && !hasPan && !hasTilt && !hasGobo) {
            return { type: 'par', confidence: 0.90, method: 'channels' };
        }
        // ─────────────────────────────────────────────────────────────────────────
        // MÉTODO 2: Detección por MODELO CONOCIDO
        // ─────────────────────────────────────────────────────────────────────────
        for (const [model, type] of Object.entries(KNOWN_MODELS)) {
            if (nameLower.includes(model) || fileNameLower.includes(model)) {
                return { type, confidence: 0.85, method: 'model' };
            }
        }
        // ─────────────────────────────────────────────────────────────────────────
        // MÉTODO 3: Heurística por CANTIDAD de canales
        // ─────────────────────────────────────────────────────────────────────────
        // Moving heads típicamente tienen 10+ canales
        if (channelCount >= 14 && (hasGobo || hasColorWheel || hasPrism || hasFocus)) {
            return { type: 'moving_head', confidence: 0.70, method: 'heuristic' };
        }
        // PAR típicamente tiene 3-8 canales
        if (channelCount >= 3 && channelCount <= 8 && hasColorMix) {
            return { type: 'par', confidence: 0.65, method: 'heuristic' };
        }
        // Strobe: muy pocos canales
        if (channelCount <= 3) {
            return { type: 'strobe', confidence: 0.50, method: 'heuristic' };
        }
        // ─────────────────────────────────────────────────────────────────────────
        // MÉTODO 4: Fallback por NOMBRE (menor confianza)
        // ─────────────────────────────────────────────────────────────────────────
        const combined = `${nameLower} ${fileNameLower}`;
        if (combined.includes('moving') || combined.includes('beam') || combined.includes('spot')) {
            return { type: 'moving_head', confidence: 0.60, method: 'name' };
        }
        if (combined.includes('wash')) {
            return { type: 'wash', confidence: 0.60, method: 'name' };
        }
        if (combined.includes('par') || combined.includes('led')) {
            return { type: 'par', confidence: 0.55, method: 'name' };
        }
        if (combined.includes('strobe') || combined.includes('flash')) {
            return { type: 'strobe', confidence: 0.60, method: 'name' };
        }
        if (combined.includes('laser')) {
            return { type: 'laser', confidence: 0.60, method: 'name' };
        }
        // ─────────────────────────────────────────────────────────────────────────
        // FALLBACK: Genérico
        // ─────────────────────────────────────────────────────────────────────────
        return { type: 'generic', confidence: 0.30, method: 'name' };
    }
    /**
     * 📂 Escanea una carpeta y parsea todos los .fxt y .json
     * WAVE 255: Added .json support for custom fixture definitions
     */
    scanFolder(folderPath) {
        const fixtures = [];
        if (!fs.existsSync(folderPath)) {
            console.warn(`[FXTParser] ⚠️ Folder not found: ${folderPath}`);
            return fixtures;
        }
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
            const lowerFile = file.toLowerCase();
            if (lowerFile.endsWith('.fxt')) {
                const fullPath = path.join(folderPath, file);
                const fixture = this.parseFile(fullPath);
                if (fixture) {
                    fixtures.push(fixture);
                }
            }
            else if (lowerFile.endsWith('.json')) {
                // WAVE 255: Support JSON fixture definitions
                const fullPath = path.join(folderPath, file);
                try {
                    const jsonContent = fs.readFileSync(fullPath, 'utf-8');
                    const jsonFixture = JSON.parse(jsonContent);
                    // Detect type from name or explicit type field
                    let fixtureType = 'generic';
                    if (jsonFixture.type) {
                        fixtureType = jsonFixture.type;
                    }
                    else {
                        const nameLower = (jsonFixture.name || file).toLowerCase();
                        for (const [model, type] of Object.entries(KNOWN_MODELS)) {
                            if (nameLower.includes(model)) {
                                fixtureType = type;
                                break;
                            }
                        }
                    }
                    const fixture = {
                        id: jsonFixture.id || `json-${file.replace('.json', '')}`,
                        name: jsonFixture.name || file.replace('.json', ''),
                        manufacturer: jsonFixture.manufacturer || 'Unknown',
                        channelCount: jsonFixture.channelCount || jsonFixture.channels?.length || 1,
                        type: fixtureType,
                        filePath: fullPath,
                        channels: jsonFixture.channels || [],
                        confidence: 0.9,
                        detectionMethod: 'manual',
                        hasMovementChannels: jsonFixture.hasMovementChannels || false,
                        has16bitMovement: jsonFixture.has16bitMovement || false,
                        hasColorMixing: jsonFixture.hasColorMixing || true,
                        hasColorWheel: jsonFixture.hasColorWheel || false,
                        // WAVE 389.6: Include physics and capabilities
                        physics: jsonFixture.physics,
                        capabilities: jsonFixture.capabilities,
                    };
                    fixtures.push(fixture);
                    if (this.debug) {
                        console.log(`[FXTParser] 📄 Parsed JSON: ${fixture.name} (${fixture.channelCount} ch)`);
                    }
                }
                catch (err) {
                    console.warn(`[FXTParser] ⚠️ Failed to parse JSON: ${file}`, err);
                }
            }
        }
        // Log resumen
        const movingCount = fixtures.filter(f => f.type === 'moving_head' || f.type === 'wash').length;
        const parCount = fixtures.filter(f => f.type === 'par').length;
        const strobeCount = fixtures.filter(f => f.type === 'strobe').length;
        const otherCount = fixtures.length - movingCount - parCount - strobeCount;
        console.log(`[FXTParser] 📊 Scan complete:`);
        console.log(`  Total: ${fixtures.length} fixtures`);
        console.log(`  Moving Heads/Wash: ${movingCount}`);
        console.log(`  PARs: ${parCount}`);
        console.log(`  Strobes: ${strobeCount}`);
        console.log(`  Other: ${otherCount}`);
        return fixtures;
    }
}
// 🧹 WAVE 671.5: Debug OFF - silences startup spam (easily re-enable if needed)
// Exportar instancia singleton para uso directo
export const fxtParser = new FXTParser(false); // Debug OFF
