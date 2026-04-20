// WAVE 3401: OMNI-INPUT MATRIX -- Core Type Contracts
// Defines every interface that the Omni-Input Matrix depends on.
// No implementation here -- pure types and enums.
// ============================================
// CONSTANTS
// ============================================
export const OMNI_CONSTANTS = {
    RING_SIZE: 8192, // 2x FFT_SIZE (4096)
    RING_BUFFER_BYTES: 33796, // 16 header + 32768 data + 12 padding
    METADATA_SLOTS: 4, // writeHead, readHead, sampleRate, channelCount
    METADATA_BYTES: 16, // 4 Int32 slots
    DATA_BYTES: 32768, // 8192 * 4 (Float32)
    DEFAULT_SAMPLE_RATE: 44100,
    DEFAULT_CHANNELS: 1,
    FFT_SIZE: 4096,
    CROSSFADE_FADE_OUT_MS: 60,
    CROSSFADE_GAP_MS: 40,
    CROSSFADE_FADE_IN_MS: 100,
    SILENCE_TIMEOUT_MS: 3000,
    OSC_LISTEN_PORT: 9000,
    OSC_PUBLISH_PORT: 9001,
    OSC_MAX_RATE: 100,
};
// Metadata header slot indices
export const META = {
    WRITE_HEAD: 0,
    READ_HEAD: 1,
    SAMPLE_RATE: 2,
    CHANNEL_COUNT: 3,
};
