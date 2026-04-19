// WAVE 3402: LUXSYNC NATIVE AUDIO — Common Header
// Platform-agnostic types and interfaces for the native audio addon.

#ifndef LUXSYNC_AUDIO_COMMON_H
#define LUXSYNC_AUDIO_COMMON_H

#include <string>
#include <vector>
#include <cstdint>
#include <functional>
#include <atomic>
#include <memory>

namespace luxsync {

// ============================================
// AUDIO DEVICE INFO (mirrors OmniInputTypes.ts AudioDeviceInfo)
// ============================================

struct AudioDeviceInfo {
    std::string id;
    std::string name;
    int sampleRate;
    int channels;
    bool isDefault;
    bool isLoopback;            // true for VB-Cable, BlackHole, etc.
    bool isExclusiveCapable;    // true if exclusive/hog mode supported
    std::string driver;         // "wasapi" | "coreaudio" | "jack"
    std::vector<int> sampleRates; // supported sample rates
};

// ============================================
// CAPTURE CONFIG
// ============================================

struct CaptureConfig {
    std::string deviceId;
    int sampleRate;              // target: 44100
    int channels;                // target: 1 (mono mix)
    int bufferSizeFrames;        // target: 256 (5.8ms @ 44100)
    bool exclusiveMode;          // true = bypass OS mixer/loudness normalization
};

// ============================================
// CAPTURE CALLBACK (float PCM, interleaved if multi-channel)
// ============================================

using AudioCallback = std::function<void(const float* data, int frameCount, int channels, int sampleRate)>;
using DeviceChangeCallback = std::function<void()>;

// ============================================
// CAPTURE STREAM — Abstract base for platform implementations
// ============================================

class ICaptureStream {
public:
    virtual ~ICaptureStream() = default;

    virtual bool start(const CaptureConfig& config, AudioCallback callback) = 0;
    virtual void stop() = 0;
    virtual bool isRunning() const = 0;

    // Diagnostics
    virtual int getBufferUnderruns() const = 0;
    virtual double getLatencyMs() const = 0;
};

// ============================================
// DEVICE ENUMERATOR — Abstract base for platform implementations
// ============================================

class IDeviceEnumerator {
public:
    virtual ~IDeviceEnumerator() = default;

    virtual std::vector<AudioDeviceInfo> enumerate() = 0;
    virtual void watchChanges(DeviceChangeCallback callback) = 0;
    virtual void stopWatching() = 0;
};

// Factory functions (implemented per-platform)
std::unique_ptr<ICaptureStream> createCaptureStream();
std::unique_ptr<IDeviceEnumerator> createDeviceEnumerator();

} // namespace luxsync

#endif // LUXSYNC_AUDIO_COMMON_H
