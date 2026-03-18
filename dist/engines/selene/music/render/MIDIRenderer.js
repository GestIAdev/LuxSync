/**
 * 🎸 MIDI RENDERER
 */
// @ts-ignore - midi-writer-js is CommonJS, needs default import
import MidiWriterJS from 'midi-writer-js';
import { SeededRandom } from '../utils/SeededRandom.js';
// Extract classes from MidiWriterJS (CommonJS module)
const MidiWriter = MidiWriterJS;
export class MIDIRenderer {
    PPQ = 128; // Pulses Per Quarter Note (midi-writer-js default)
    random;
    constructor(seed) {
        this.random = new SeededRandom(seed || 12345);
    }
    /**
     * Set seed for deterministic random generation
     */
    setSeed(seed) {
        this.random = new SeededRandom(seed);
    }
    render(notes, structure) {
        console.log('🎵 [MIDIRenderer] Starting render with', notes.length, 'notes');
        console.log('🔍 [MIDIRenderer] PPQ:', this.PPQ);
        const tempo = structure.globalTempo || 120;
        console.log('🔍 [MIDIRenderer] Tempo:', tempo, 'BPM');
        const track = this.createTrack(notes, 'Melody', 0, 0, tempo);
        const tempoTrack = this.createTempoTrack(tempo);
        const writer = new MidiWriter.Writer([tempoTrack, track]);
        console.log('🔍 [MIDIRenderer] Writer created with default PPQ (128)');
        const midiData = writer.buildFile();
        // Log raw midi-writer-js output
        console.log('🔍 [MIDIRenderer] midi-writer-js output:', JSON.stringify({
            type: midiData.constructor.name,
            length: midiData.length,
            isUint8Array: midiData instanceof Uint8Array,
            isBuffer: Buffer.isBuffer(midiData),
            first32bytes: Array.from(midiData.slice(0, 32)).map((b) => b.toString(16).padStart(2, '0')).join(' ')
        }));
        // Convert to Buffer properly - buildFile() returns Uint8Array
        let buffer = Buffer.isBuffer(midiData)
            ? midiData
            : Buffer.from(midiData);
        // Fix duplicate EoT if present (remove trailing duplicate End of Track marker)
        if (buffer.length >= 8 && buffer.slice(-8).toString('hex') === '00ff2f0000ff2f00') {
            buffer = buffer.slice(0, -4); // remove last 00 FF 2F 00
            console.log('🔧 [MIDIRenderer] Removed duplicate EoT from MIDI buffer');
        }
        // Deep structure analysis
        this.analyzeMIDIStructure(buffer);
        // Validate MIDI header
        if (buffer.length < 14 || buffer[0] !== 0x4D || buffer[1] !== 0x54 || buffer[2] !== 0x68 || buffer[3] !== 0x64) {
            console.error('❌ Invalid MIDI buffer generated:', JSON.stringify({
                length: buffer.length,
                header: buffer.slice(0, 4).toString('hex')
            }));
            throw new Error('Generated invalid MIDI buffer - missing MThd header');
        }
        return buffer;
    }
    renderMultiTrack(tracks, structure, style) {
        const midiTracks = [];
        const tempo = structure.globalTempo || 120;
        const tempoTrack = this.createTempoTrack(tempo);
        midiTracks.push(tempoTrack);
        let currentMelodicChannel = 0; // Contador solo para canales no-percusión (0-8, 10-15)
        console.log(`[MIDI RENDERER DEBUG] Processing ${tracks.size} layers for Style ${style.id}`);
        for (const [layerName, notes] of Array.from(tracks.entries())) {
            let targetChannel;
            // 🔧 FASE 3.10 (Contrato Definitivo): layerName ya es simple lowercase (sin ::)
            // layerName = "melody", "harmony", "bass", "pad", "rhythm"
            const trackType = layerName.toLowerCase();
            // LÓGICA DE CANAL:
            if (trackType === 'rhythm') {
                targetChannel = 9; // Fuerza canal 9 para ritmo
            }
            else {
                targetChannel = currentMelodicChannel;
                currentMelodicChannel++;
                // Salta el canal 9 si llegamos a él
                if (currentMelodicChannel === 9) {
                    currentMelodicChannel = 10;
                }
                // Resetea si superamos el 15 (aunque improbable con pocas capas)
                if (currentMelodicChannel > 15) {
                    currentMelodicChannel = 0;
                }
            }
            console.log(`[MIDI RENDERER DEBUG] Layer: ${layerName}, Notes: ${notes.length}, Target Channel: ${targetChannel}`); // Log actualizado
            const program = this.getProgramForLayer(trackType, style.id);
            // Asegúrate de pasar el 'targetChannel' correcto a createTrack
            const midiTrack = this.createTrack(notes, layerName, targetChannel, program, tempo);
            midiTracks.push(midiTrack);
        }
        console.log(`🔧 [MIDIRenderer] Total tracks to write: ${midiTracks.length} (1 tempo + ${tracks.size} music)`);
        const writer = new MidiWriter.Writer(midiTracks);
        const midiData = writer.buildFile();
        // Convert to Buffer properly - buildFile() returns Uint8Array
        let buffer = Buffer.isBuffer(midiData)
            ? midiData
            : Buffer.from(midiData);
        // Fix duplicate EoT if present (remove trailing duplicate End of Track marker)
        if (buffer.length >= 8 && buffer.slice(-8).toString('hex') === '00ff2f0000ff2f00') {
            buffer = buffer.slice(0, -4); // remove last 00 FF 2F 00
            console.log('🔧 [MIDIRenderer] Removed duplicate EoT from MIDI buffer');
        }
        // Validate MIDI header
        if (buffer.length < 14 || buffer[0] !== 0x4D || buffer[1] !== 0x54 || buffer[2] !== 0x68 || buffer[3] !== 0x64) {
            console.error('❌ Invalid MIDI buffer generated:', JSON.stringify({
                length: buffer.length,
                header: buffer.slice(0, 4).toString('hex')
            }));
            throw new Error('Generated invalid MIDI buffer - missing MThd header');
        }
        return buffer;
    }
    quantize(notes, resolution = 16) {
        return notes.map(note => ({
            ...note,
            startTime: Math.round(note.startTime * resolution) / resolution,
            duration: Math.round(note.duration * resolution) / resolution
        }));
    }
    createTrack(notes, layerName, channel, program, tempo = 120) {
        const track = new MidiWriter.Track();
        console.log(`🔍 [MIDIRenderer] createTrack for "${layerName}" - Tempo: ${tempo}, Channel: ${channel}, Notes: ${notes.length}`);
        // 🔧 FASE 3.12: DIAGNÓSTICO - Comentar TrackNameEvent para ver si causa tracks fantasma
        // HIPÓTESIS: @tonejs/midi está parseando el TrackNameEvent como un track separado
        // Si eliminarlo soluciona el problema, usaremos otro método para nombrar tracks
        // track.addEvent(new MidiWriter.TrackNameEvent({ text: layerName }))
        console.log(`📝 [MIDIRenderer] Track name "${layerName}" SKIPPED (testing phantom tracks bug)`);
        // Program Change al principio (tick 0 implícito para channels melódicos)
        if (channel !== 9) {
            track.addEvent(new MidiWriter.ProgramChangeEvent({ program: program, channel: channel }));
            console.log(`🎼 [MIDIRenderer] Program ${program} assigned to channel ${channel}`);
        }
        // Sort notes by start time
        const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);
        // Log first 5 and last 5 notes for debugging
        console.log('🔍 [MIDIRenderer] First 5 notes (seconds):');
        sortedNotes.slice(0, 5).forEach((note, idx) => {
            console.log(`  [${idx}] pitch=${note.pitch}, startTime=${note.startTime.toFixed(3)}s, duration=${note.duration.toFixed(3)}s, velocity=${note.velocity}`);
        });
        if (sortedNotes.length > 5) {
            console.log('🔍 [MIDIRenderer] Last 5 notes (seconds):');
            sortedNotes.slice(-5).forEach((note, idx) => {
                console.log(`  [${sortedNotes.length - 5 + idx}] pitch=${note.pitch}, startTime=${note.startTime.toFixed(3)}s, duration=${note.duration.toFixed(3)}s, velocity=${note.velocity}`);
            });
        }
        let notesAdded = 0;
        for (const note of sortedNotes) {
            // Calcular tiempo de inicio absoluto y duración en ticks
            const noteStartTicks = this.secondsToTicks(note.startTime, tempo, true); // humanize timing
            let durationTicks = this.secondsToTicks(note.duration, tempo, false); // NO humanize duration
            // 🔥 FASE 5.3 (SCHERZO QUIRÚRGICO): GUARDIA ANTI-NEGATIVOS
            // Prevenir RangeError de Tone.js por valores corruptos de punto flotante
            if (!Number.isFinite(durationTicks) || durationTicks < 0) {
                console.warn(`⚠️  [MIDIRenderer] CORRECTING invalid durationTicks: ${durationTicks} → 1 (note at ${note.startTime}s)`);
                durationTicks = 1; // Mínimo 1 tick (prevenir crash)
            }
            if (!Number.isFinite(noteStartTicks) || noteStartTicks < 0) {
                console.warn(`⚠️  [MIDIRenderer] CORRECTING invalid noteStartTicks: ${noteStartTicks} → 0 (note pitch ${note.pitch})`);
            }
            // Log detailed calculation for first 3 notes
            if (notesAdded < 3) {
                console.log(`🔍 [MIDIRenderer] Note ${notesAdded}:`);
                console.log(`   Input: startTime=${note.startTime}s, duration=${note.duration}s, tempo=${tempo}`);
                console.log(`   Calculated: noteStartTicks=${noteStartTicks}, durationTicks=${durationTicks}`);
                console.log(`   Formula: ticks = seconds * (tempo / 60) * PPQ = seconds * (${tempo} / 60) * ${this.PPQ}`);
                console.log(`   Check: ${note.startTime} * ${tempo / 60} * ${this.PPQ} = ${note.startTime * (tempo / 60) * this.PPQ}`);
            }
            // CRITICAL FIX: Pass pitch as NUMBER, not string
            // midi-writer-js accepts raw MIDI pitch values (0-127)
            // Backend already generates correct pitches (e.g., 60 = C4)
            // String conversion was causing octave re-interpretation bugs
            const midiNote = new MidiWriter.NoteEvent({
                pitch: note.pitch, // ← RAW PITCH NUMBER (e.g., 60 for C4)
                duration: `T${durationTicks}`,
                tick: noteStartTicks,
                velocity: note.velocity,
                channel: channel
            });
            // Log NoteEvent params for first 3 notes
            if (notesAdded < 3) {
                console.log(`   NoteEvent params:`, JSON.stringify({
                    pitch: note.pitch, // ← Log RAW number
                    pitchName: this.pitchToMidiNote(note.pitch), // ← Human-readable for debugging
                    duration: `T${durationTicks}`,
                    tick: noteStartTicks,
                    velocity: note.velocity,
                    channel: channel
                }));
            }
            track.addEvent(midiNote);
            notesAdded++;
        }
        console.log(`✅ [MIDIRenderer] Added ${notesAdded} notes to track "${layerName}"`);
        return track;
    }
    createTempoTrack(tempo) {
        const track = new MidiWriter.Track();
        // TempoEvent requires {bpm: number} object, not just number
        track.addEvent(new MidiWriter.TempoEvent({ bpm: tempo }));
        return track;
    }
    secondsToTicks(seconds, tempo = 120, humanize = true) {
        const ticksPerSecond = (this.PPQ * tempo) / 60;
        let result = seconds * ticksPerSecond;
        // NUEVO: Humanization (±2% timing variation)
        if (humanize && this.random.next() < 0.8) { // 80% of notes get humanized
            const humanizationAmount = 0.02; // ±2%
            const variation = (this.random.next() * 2 - 1) * humanizationAmount;
            result *= (1 + variation);
        }
        return Math.round(result);
    }
    pitchToMidiNote(pitch) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(pitch / 12) - 1; // MIDI standard: pitch 60 = C4 (Middle C)
        const noteIndex = pitch % 12;
        return [noteNames[noteIndex] + octave];
    }
    getProgramForLayer(layerName, styleId = 'default') {
        // Style-specific instrument palettes
        const stylePalettes = {
            'cyberpunk-ambient': {
                'melody': 81, // Lead 1 (square wave)
                'harmony': 89, // Pad 2 (warm)
                'bass': 39, // Synth Bass 2
                'pad': 92, // Pad 5 (bowed)
                'rhythm': 0 // Channel 9 = drums (no program change needed)
            },
            'indie-game-loop': {
                'melody': 11, // Vibraphone
                'harmony': 4, // Electric Piano 1
                'bass': 34, // Electric Bass (pick)
                'pad': 95, // Pad 8 (sweep)
                'rhythm': 0
            },
            'lofi-minimalist': {
                'melody': 1, // Bright Acoustic Piano
                'harmony': 7, // Harpsichord
                'bass': 33, // Acoustic Bass
                'pad': 88, // Pad 1 (new age)
                'rhythm': 0
            },
            'epic-orchestral': {
                'melody': 40, // Violin
                'harmony': 48, // String Ensemble 1
                'bass': 43, // Contrabass
                'pad': 52, // Choir Aahs
                'rhythm': 47 // Timpani (when not channel 9)
            },
            'glitch-experimental': {
                'melody': 80, // Lead 1 (square)
                'harmony': 98, // FX 3 (crystal)
                'bass': 38, // Synth Bass 1
                'pad': 99, // FX 4 (atmosphere)
                'rhythm': 0
            }
        };
        // Fallback palette
        const defaultPalette = {
            'melody': 0, // Acoustic Grand Piano
            'harmony': 0, // Acoustic Grand Piano
            'bass': 32, // Acoustic Bass
            'pad': 89, // Pad 2 (warm)
            'rhythm': 0
        };
        const palette = stylePalettes[styleId] || defaultPalette;
        return palette[layerName.toLowerCase()] || 0;
    }
    // Additional private methods for manual encoding if needed
    encodeToBuffer(data) {
        return Buffer.from(data);
    }
    encodeTrack(events) {
        // Placeholder for manual MIDI encoding
        // Would implement delta-time encoding, event encoding, etc.
        throw new Error('Manual encoding not implemented - using midi-writer-js');
    }
    encodeVLQ(value) {
        // Variable Length Quantity encoding for MIDI
        const bytes = [];
        let v = value;
        do {
            let byte = v & 0x7F;
            v >>= 7;
            if (v > 0)
                byte |= 0x80;
            bytes.push(byte);
        } while (v > 0);
        return new Uint8Array(bytes);
    }
    encodeEvent(event) {
        // Placeholder for event encoding
        throw new Error('Event encoding not implemented - using midi-writer-js');
    }
    /**
     * Analyze MIDI structure for debugging
     */
    analyzeMIDIStructure(buffer) {
        console.log('🔬 [MIDIRenderer] Deep MIDI Structure Analysis:');
        console.log('═'.repeat(80));
        let offset = 0;
        // Parse MThd chunk
        if (buffer.length >= 14) {
            const mthd = buffer.slice(0, 4).toString('ascii');
            const headerLength = buffer.readUInt32BE(4);
            const format = buffer.readUInt16BE(8);
            const numTracks = buffer.readUInt16BE(10);
            const timeDivision = buffer.readUInt16BE(12);
            console.log('📋 MThd Header Chunk:');
            console.log('  Identifier:', mthd, `(${buffer.slice(0, 4).toString('hex')})`);
            console.log('  Header Length:', headerLength, 'bytes');
            console.log('  Format:', format, '(0=single track, 1=multi track, 2=multi song)');
            console.log('  Number of Tracks:', numTracks);
            console.log('  Time Division:', timeDivision, 'ticks per quarter note');
            offset = 14;
        }
        // Parse MTrk chunks
        let trackNum = 0;
        while (offset < buffer.length - 8) {
            const chunkId = buffer.slice(offset, offset + 4).toString('ascii');
            if (chunkId === 'MTrk') {
                const trackLength = buffer.readUInt32BE(offset + 4);
                console.log(`\n🎼 MTrk Track ${trackNum} Chunk:`);
                console.log('  Offset:', offset);
                console.log('  Identifier:', chunkId, `(${buffer.slice(offset, offset + 4).toString('hex')})`);
                console.log('  Track Length:', trackLength, 'bytes');
                const trackStart = offset + 8;
                const trackEnd = trackStart + trackLength;
                if (trackEnd <= buffer.length) {
                    // Show first 32 bytes of track data
                    const trackPreview = buffer.slice(trackStart, Math.min(trackStart + 32, trackEnd));
                    console.log('  First bytes:', Array.from(trackPreview).map(b => b.toString(16).padStart(2, '0')).join(' '));
                    // Show last 16 bytes of track data (should contain End of Track FF 2F 00)
                    const trackSuffix = buffer.slice(Math.max(trackStart, trackEnd - 16), trackEnd);
                    console.log('  Last bytes:', Array.from(trackSuffix).map(b => b.toString(16).padStart(2, '0')).join(' '));
                    // Check for End of Track marker
                    const hasEoT = trackSuffix.includes(0xFF) &&
                        trackSuffix.includes(0x2F) &&
                        trackSuffix.includes(0x00);
                    console.log('  Has End of Track (FF 2F 00):', hasEoT ? '✅' : '❌');
                    offset = trackEnd;
                }
                else {
                    console.log('  ⚠️ Track length exceeds buffer!');
                    break;
                }
                trackNum++;
            }
            else {
                console.log(`\n⚠️ Unknown chunk at offset ${offset}: ${chunkId}`);
                break;
            }
        }
        console.log('\n' + '═'.repeat(80));
        console.log('✅ Structure analysis complete');
    }
}
/**
 * GENERAL MIDI INSTRUMENT MAP (REFERENCE)
 *
 * PIANO:
 * 0 = Acoustic Grand Piano
 * 1 = Bright Acoustic Piano
 * 2 = Electric Grand Piano
 * 3 = Honky-tonk Piano
 * 4 = Electric Piano 1 (Rhodes)
 * 5 = Electric Piano 2 (Chorus)
 * 6 = Harpsichord
 * 7 = Clavi
 *
 * CHROMATIC PERCUSSION:
 * 8 = Celesta
 * 9 = Glockenspiel
 * 10 = Music Box
 * 11 = Vibraphone
 * 12 = Marimba
 * 13 = Xylophone
 * 14 = Tubular Bells
 * 15 = Dulcimer
 *
 * ORGAN:
 * 16 = Drawbar Organ
 * 17 = Percussive Organ
 * 18 = Rock Organ
 * 19 = Church Organ
 * 20 = Reed Organ
 * 21 = Accordion
 * 22 = Harmonica
 * 23 = Tango Accordion
 *
 * GUITAR:
 * 24 = Acoustic Guitar (nylon)
 * 25 = Acoustic Guitar (steel)
 * 26 = Electric Guitar (jazz)
 * 27 = Electric Guitar (clean)
 * 28 = Electric Guitar (muted)
 * 29 = Overdriven Guitar
 * 30 = Distortion Guitar
 * 31 = Guitar Harmonics
 *
 * BASS:
 * 32 = Acoustic Bass
 * 33 = Electric Bass (finger)
 * 34 = Electric Bass (pick)
 * 35 = Fretless Bass
 * 36 = Slap Bass 1
 * 37 = Slap Bass 2
 * 38 = Synth Bass 1
 * 39 = Synth Bass 2
 *
 * STRINGS:
 * 40 = Violin
 * 41 = Viola
 * 42 = Cello
 * 43 = Contrabass
 * 44 = Tremolo Strings
 * 45 = Pizzicato Strings
 * 46 = Orchestral Harp
 * 47 = Timpani
 *
 * ENSEMBLE:
 * 48 = String Ensemble 1
 * 49 = String Ensemble 2
 * 50 = Synth Strings 1
 * 51 = Synth Strings 2
 * 52 = Choir Aahs
 * 53 = Voice Oohs
 * 54 = Synth Voice
 * 55 = Orchestra Hit
 *
 * BRASS:
 * 56 = Trumpet
 * 57 = Trombone
 * 58 = Tuba
 * 59 = Muted Trumpet
 * 60 = French Horn
 * 61 = Brass Section
 * 62 = Synth Brass 1
 * 63 = Synth Brass 2
 *
 * REED:
 * 64 = Soprano Sax
 * 65 = Alto Sax
 * 66 = Tenor Sax
 * 67 = Baritone Sax
 * 68 = Oboe
 * 69 = English Horn
 * 70 = Bassoon
 * 71 = Clarinet
 *
 * PIPE:
 * 72 = Piccolo
 * 73 = Flute
 * 74 = Recorder
 * 75 = Pan Flute
 * 76 = Blown Bottle
 * 77 = Shakuhachi
 * 78 = Whistle
 * 79 = Ocarina
 *
 * SYNTH LEAD:
 * 80 = Lead 1 (square)
 * 81 = Lead 2 (sawtooth)
 * 82 = Lead 3 (calliope)
 * 83 = Lead 4 (chiff)
 * 84 = Lead 5 (charang)
 * 85 = Lead 6 (voice)
 * 86 = Lead 7 (fifths)
 * 87 = Lead 8 (bass + lead)
 *
 * SYNTH PAD:
 * 88 = Pad 1 (new age)
 * 89 = Pad 2 (warm)
 * 90 = Pad 3 (polysynth)
 * 91 = Pad 4 (choir)
 * 92 = Pad 5 (bowed)
 * 93 = Pad 6 (metallic)
 * 94 = Pad 7 (halo)
 * 95 = Pad 8 (sweep)
 *
 * SYNTH EFFECTS:
 * 96 = FX 1 (rain)
 * 97 = FX 2 (soundtrack)
 * 98 = FX 3 (crystal)
 * 99 = FX 4 (atmosphere)
 * 100 = FX 5 (brightness)
 * 101 = FX 6 (goblins)
 * 102 = FX 7 (echoes)
 * 103 = FX 8 (sci-fi)
 *
 * ETHNIC:
 * 104 = Sitar
 * 105 = Banjo
 * 106 = Shamisen
 * 107 = Koto
 * 108 = Kalimba
 * 109 = Bag pipe
 * 110 = Fiddle
 * 111 = Shanai
 *
 * PERCUSSIVE:
 * 112 = Tinkle Bell
 * 113 = Agogo
 * 114 = Steel Drums
 * 115 = Woodblock
 * 116 = Taiko Drum
 * 117 = Melodic Tom
 * 118 = Synth Drum
 * 119 = Reverse Cymbal
 *
 * SOUND EFFECTS:
 * 120 = Guitar Fret Noise
 * 121 = Breath Noise
 * 122 = Seashore
 * 123 = Bird Tweet
 * 124 = Telephone Ring
 * 125 = Helicopter
 * 126 = Applause
 * 127 = Gunshot
 */
//# sourceMappingURL=MIDIRenderer.js.map