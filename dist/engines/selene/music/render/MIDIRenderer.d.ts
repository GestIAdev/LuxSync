/**
 * 🎸 MIDI RENDERER
 */
import { MIDINote } from '../core/interfaces.js';
import { SongStructure } from '../structure/SongStructure.js';
export declare class MIDIRenderer {
    private readonly PPQ;
    private random;
    constructor(seed?: number);
    /**
     * Set seed for deterministic random generation
     */
    setSeed(seed: number): void;
    render(notes: MIDINote[], structure: SongStructure): Buffer;
    renderMultiTrack(tracks: Map<string, MIDINote[]>, structure: SongStructure, style: any): Buffer;
    quantize(notes: MIDINote[], resolution?: number): MIDINote[];
    private createTrack;
    private createTempoTrack;
    private secondsToTicks;
    private pitchToMidiNote;
    private getProgramForLayer;
    private encodeToBuffer;
    private encodeTrack;
    private encodeVLQ;
    private encodeEvent;
    /**
     * Analyze MIDI structure for debugging
     */
    private analyzeMIDIStructure;
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
//# sourceMappingURL=MIDIRenderer.d.ts.map