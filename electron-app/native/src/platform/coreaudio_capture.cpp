// WAVE 3402: CoreAudio Capture Stream (macOS)
//
// Uses AudioUnit (AUHAL) for low-latency capture with optional Hog Mode
// for exclusive device access. Bypasses system effects when in exclusive mode.
//
// Hog Mode: AudioObjectSetPropertyData with kAudioDevicePropertyHogMode
// Format: Float32 linear PCM, native endian
// Buffer: 256 frames target

#ifdef __APPLE__

#include "../common.h"

#include <AudioToolbox/AudioToolbox.h>
#include <CoreAudio/CoreAudio.h>
#include <CoreFoundation/CoreFoundation.h>

#include <thread>
#include <atomic>
#include <vector>
#include <cstring>

namespace luxsync {

class CoreAudioCaptureStream : public ICaptureStream {
public:
    CoreAudioCaptureStream() = default;

    ~CoreAudioCaptureStream() override {
        stop();
    }

    bool start(const CaptureConfig& config, AudioCallback callback) override {
        if (m_running.load()) return false;

        m_callback = std::move(callback);
        m_config = config;
        m_bufferUnderruns.store(0);
        m_latencyMs.store(0.0);
        m_hogModePid = -1;

        // Find the device
        AudioDeviceID deviceId = 0;
        if (config.deviceId.empty()) {
            // Get default input device
            AudioObjectPropertyAddress addr = {
                kAudioHardwarePropertyDefaultInputDevice,
                kAudioObjectPropertyScopeGlobal,
                kAudioObjectPropertyElementMain
            };
            UInt32 size = sizeof(AudioDeviceID);
            OSStatus status = AudioObjectGetPropertyData(
                kAudioObjectSystemObject, &addr, 0, nullptr, &size, &deviceId
            );
            if (status != noErr) return false;
        } else {
            // Parse device ID string to AudioDeviceID
            deviceId = static_cast<AudioDeviceID>(std::stoul(config.deviceId));
        }

        m_deviceId = deviceId;

        // Try Hog Mode for exclusive access
        if (config.exclusiveMode) {
            AudioObjectPropertyAddress hogAddr = {
                kAudioDevicePropertyHogMode,
                kAudioObjectPropertyScopeInput,
                kAudioObjectPropertyElementMain
            };
            pid_t pid = getpid();
            UInt32 pidSize = sizeof(pid_t);
            OSStatus hogStatus = AudioObjectSetPropertyData(
                deviceId, &hogAddr, 0, nullptr, pidSize, &pid
            );
            if (hogStatus == noErr) {
                m_hogModePid = pid;
            }
            // Hog mode failure is non-fatal — continue in shared mode
        }

        // Set buffer size
        AudioObjectPropertyAddress bufAddr = {
            kAudioDevicePropertyBufferFrameSize,
            kAudioObjectPropertyScopeInput,
            kAudioObjectPropertyElementMain
        };
        UInt32 bufferFrames = static_cast<UInt32>(config.bufferSizeFrames);
        AudioObjectSetPropertyData(
            deviceId, &bufAddr, 0, nullptr, sizeof(UInt32), &bufferFrames
        );

        // Get actual buffer size for latency calculation
        UInt32 actualBufferSize = 0;
        UInt32 bufSizeBytes = sizeof(UInt32);
        AudioObjectGetPropertyData(deviceId, &bufAddr, 0, nullptr, &bufSizeBytes, &actualBufferSize);
        m_latencyMs.store((1000.0 * actualBufferSize) / config.sampleRate);

        // Create AudioUnit (AUHAL)
        AudioComponentDescription desc = {};
        desc.componentType = kAudioUnitType_Output;
        desc.componentSubType = kAudioUnitSubType_HALOutput;
        desc.componentManufacturer = kAudioUnitManufacturer_Apple;

        AudioComponent comp = AudioComponentFindNext(nullptr, &desc);
        if (!comp) { releaseHogMode(); return false; }

        OSStatus status = AudioComponentInstanceNew(comp, &m_audioUnit);
        if (status != noErr) { releaseHogMode(); return false; }

        // Enable input, disable output
        UInt32 enableIO = 1;
        AudioUnitSetProperty(m_audioUnit, kAudioOutputUnitProperty_EnableIO,
            kAudioUnitScope_Input, 1, &enableIO, sizeof(enableIO));
        enableIO = 0;
        AudioUnitSetProperty(m_audioUnit, kAudioOutputUnitProperty_EnableIO,
            kAudioUnitScope_Output, 0, &enableIO, sizeof(enableIO));

        // Set input device
        AudioUnitSetProperty(m_audioUnit, kAudioOutputUnitProperty_CurrentDevice,
            kAudioUnitScope_Global, 0, &deviceId, sizeof(AudioDeviceID));

        // Set stream format: Float32 linear PCM
        AudioStreamBasicDescription streamFormat = {};
        streamFormat.mSampleRate = config.sampleRate;
        streamFormat.mFormatID = kAudioFormatLinearPCM;
        streamFormat.mFormatFlags = kAudioFormatFlagIsFloat |
                                     kAudioFormatFlagIsPacked |
                                     kAudioFormatFlagIsNonInterleaved;
        streamFormat.mBitsPerChannel = 32;
        streamFormat.mChannelsPerFrame = config.channels;
        streamFormat.mFramesPerPacket = 1;
        streamFormat.mBytesPerFrame = sizeof(Float32);
        streamFormat.mBytesPerPacket = sizeof(Float32);

        AudioUnitSetProperty(m_audioUnit, kAudioUnitProperty_StreamFormat,
            kAudioUnitScope_Output, 1, &streamFormat, sizeof(streamFormat));

        // Set input callback
        AURenderCallbackStruct callbackStruct = {};
        callbackStruct.inputProc = CoreAudioCaptureStream::inputCallback;
        callbackStruct.inputProcRefCon = this;

        AudioUnitSetProperty(m_audioUnit, kAudioOutputUnitProperty_SetInputCallback,
            kAudioUnitScope_Global, 0, &callbackStruct, sizeof(callbackStruct));

        // Initialize and start
        status = AudioUnitInitialize(m_audioUnit);
        if (status != noErr) {
            AudioComponentInstanceDispose(m_audioUnit);
            m_audioUnit = nullptr;
            releaseHogMode();
            return false;
        }

        status = AudioOutputUnitStart(m_audioUnit);
        if (status != noErr) {
            AudioUnitUninitialize(m_audioUnit);
            AudioComponentInstanceDispose(m_audioUnit);
            m_audioUnit = nullptr;
            releaseHogMode();
            return false;
        }

        m_running.store(true);
        return true;
    }

    void stop() override {
        if (!m_running.load()) return;
        m_running.store(false);

        if (m_audioUnit) {
            AudioOutputUnitStop(m_audioUnit);
            AudioUnitUninitialize(m_audioUnit);
            AudioComponentInstanceDispose(m_audioUnit);
            m_audioUnit = nullptr;
        }

        releaseHogMode();
    }

    bool isRunning() const override {
        return m_running.load();
    }

    int getBufferUnderruns() const override {
        return m_bufferUnderruns.load();
    }

    double getLatencyMs() const override {
        return m_latencyMs.load();
    }

private:
    // AudioUnit input callback — runs on real-time audio thread
    static OSStatus inputCallback(
        void* inRefCon,
        AudioUnitRenderActionFlags* ioActionFlags,
        const AudioTimeStamp* inTimeStamp,
        UInt32 inBusNumber,
        UInt32 inNumberFrames,
        AudioBufferList* /* ioData — unused for input */
    ) {
        auto* self = static_cast<CoreAudioCaptureStream*>(inRefCon);
        if (!self->m_running.load()) return noErr;

        // Allocate buffer list for capture
        AudioBufferList bufferList;
        bufferList.mNumberBuffers = 1;
        bufferList.mBuffers[0].mNumberChannels = self->m_config.channels;
        bufferList.mBuffers[0].mDataByteSize = inNumberFrames * sizeof(Float32) * self->m_config.channels;

        std::vector<float> captureBuffer(inNumberFrames * self->m_config.channels);
        bufferList.mBuffers[0].mData = captureBuffer.data();

        OSStatus status = AudioUnitRender(
            self->m_audioUnit, ioActionFlags, inTimeStamp,
            inBusNumber, inNumberFrames, &bufferList
        );

        if (status != noErr) {
            self->m_bufferUnderruns.fetch_add(1);
            return status;
        }

        // Feed data to callback
        self->m_callback(
            captureBuffer.data(),
            static_cast<int>(inNumberFrames),
            self->m_config.channels,
            self->m_config.sampleRate
        );

        return noErr;
    }

    void releaseHogMode() {
        if (m_hogModePid >= 0) {
            AudioObjectPropertyAddress hogAddr = {
                kAudioDevicePropertyHogMode,
                kAudioObjectPropertyScopeInput,
                kAudioObjectPropertyElementMain
            };
            pid_t negative = -1;
            AudioObjectSetPropertyData(
                m_deviceId, &hogAddr, 0, nullptr, sizeof(pid_t), &negative
            );
            m_hogModePid = -1;
        }
    }

    CaptureConfig m_config;
    AudioCallback m_callback;
    AudioUnit m_audioUnit = nullptr;
    AudioDeviceID m_deviceId = 0;
    pid_t m_hogModePid = -1;
    std::atomic<bool> m_running{false};
    std::atomic<int> m_bufferUnderruns{0};
    std::atomic<double> m_latencyMs{0.0};
};

// Factory implementation
std::unique_ptr<ICaptureStream> createCaptureStream() {
    return std::make_unique<CoreAudioCaptureStream>();
}

} // namespace luxsync

#endif // __APPLE__
