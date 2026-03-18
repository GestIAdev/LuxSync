// 🎵 MUSICAL NOTE ENUM - SHARED TYPES
// Exported enum for musical consensus algorithms
export var MusicalNote;
(function (MusicalNote) {
    MusicalNote["DO"] = "C";
    MusicalNote["RE"] = "D";
    MusicalNote["MI"] = "E";
    MusicalNote["FA"] = "F";
    MusicalNote["SOL"] = "G";
    MusicalNote["LA"] = "A";
    MusicalNote["SI"] = "B";
})(MusicalNote || (MusicalNote = {}));
// 🎼 Musical Frequencies (Hz) for Real Harmonic Analysis
export const MUSICAL_FREQUENCIES = {
    [MusicalNote.DO]: 261.63, // C4
    [MusicalNote.RE]: 293.66, // D4
    [MusicalNote.MI]: 329.63, // E4
    [MusicalNote.FA]: 349.23, // F4
    [MusicalNote.SOL]: 392.0, // G4
    [MusicalNote.LA]: 440.0, // A4
    [MusicalNote.SI]: 493.88, // B4
};
//# sourceMappingURL=MusicalTypes.js.map