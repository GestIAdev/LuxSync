// WAVE 3402: CoreAudio Device Enumerator (macOS)
//
// Lists audio input devices via CoreAudio property system.
// Detects BlackHole, Soundflower, and other virtual audio devices as loopback.
// Monitors device topology changes via AudioObjectAddPropertyListener.

#ifdef __APPLE__

#include "../common.h"

#include <CoreAudio/CoreAudio.h>
#include <CoreFoundation/CoreFoundation.h>

#include <vector>
#include <string>
#include <mutex>

namespace luxsync {

// CFString → UTF-8 std::string
static std::string CFStringToUtf8(CFStringRef cfStr) {
    if (!cfStr) return "";
    CFIndex len = CFStringGetLength(cfStr);
    CFIndex maxSize = CFStringGetMaximumSizeForEncoding(len, kCFStringEncodingUTF8) + 1;
    std::string result(maxSize, '\0');
    if (CFStringGetCString(cfStr, &result[0], maxSize, kCFStringEncodingUTF8)) {
        result.resize(std::strlen(result.c_str()));
        return result;
    }
    return "";
}

class CoreAudioDeviceEnumerator : public IDeviceEnumerator {
public:
    CoreAudioDeviceEnumerator() = default;

    ~CoreAudioDeviceEnumerator() override {
        stopWatching();
    }

    std::vector<AudioDeviceInfo> enumerate() override {
        std::vector<AudioDeviceInfo> result;

        // Get all audio devices
        AudioObjectPropertyAddress devicesAddr = {
            kAudioHardwarePropertyDevices,
            kAudioObjectPropertyScopeGlobal,
            kAudioObjectPropertyElementMain
        };

        UInt32 dataSize = 0;
        OSStatus status = AudioObjectGetPropertyDataSize(
            kAudioObjectSystemObject, &devicesAddr, 0, nullptr, &dataSize
        );
        if (status != noErr || dataSize == 0) return result;

        int deviceCount = dataSize / sizeof(AudioDeviceID);
        std::vector<AudioDeviceID> deviceIds(deviceCount);
        status = AudioObjectGetPropertyData(
            kAudioObjectSystemObject, &devicesAddr, 0, nullptr, &dataSize, deviceIds.data()
        );
        if (status != noErr) return result;

        // Get default input device ID
        AudioDeviceID defaultInputId = 0;
        {
            AudioObjectPropertyAddress defaultAddr = {
                kAudioHardwarePropertyDefaultInputDevice,
                kAudioObjectPropertyScopeGlobal,
                kAudioObjectPropertyElementMain
            };
            UInt32 idSize = sizeof(AudioDeviceID);
            AudioObjectGetPropertyData(
                kAudioObjectSystemObject, &defaultAddr, 0, nullptr, &idSize, &defaultInputId
            );
        }

        for (AudioDeviceID devId : deviceIds) {
            // Check if device has input channels
            AudioObjectPropertyAddress streamsAddr = {
                kAudioDevicePropertyStreamConfiguration,
                kAudioObjectPropertyScopeInput,
                kAudioObjectPropertyElementMain
            };

            UInt32 streamSize = 0;
            status = AudioObjectGetPropertyDataSize(devId, &streamsAddr, 0, nullptr, &streamSize);
            if (status != noErr || streamSize == 0) continue;

            std::vector<uint8_t> streamBuf(streamSize);
            auto* bufferList = reinterpret_cast<AudioBufferList*>(streamBuf.data());
            status = AudioObjectGetPropertyData(
                devId, &streamsAddr, 0, nullptr, &streamSize, bufferList
            );
            if (status != noErr) continue;

            // Count input channels
            int totalInputChannels = 0;
            for (UInt32 b = 0; b < bufferList->mNumberBuffers; b++) {
                totalInputChannels += bufferList->mBuffers[b].mNumberChannels;
            }
            if (totalInputChannels == 0) continue; // No input channels — skip

            AudioDeviceInfo info = {};
            info.id = std::to_string(devId);
            info.channels = totalInputChannels;
            info.isDefault = (devId == defaultInputId);
            info.driver = "coreaudio";

            // Get device name
            AudioObjectPropertyAddress nameAddr = {
                kAudioObjectPropertyName,
                kAudioObjectPropertyScopeGlobal,
                kAudioObjectPropertyElementMain
            };
            CFStringRef cfName = nullptr;
            UInt32 nameSize = sizeof(CFStringRef);
            status = AudioObjectGetPropertyData(devId, &nameAddr, 0, nullptr, &nameSize, &cfName);
            if (status == noErr && cfName) {
                info.name = CFStringToUtf8(cfName);
                CFRelease(cfName);
            }

            // Get nominal sample rate
            AudioObjectPropertyAddress rateAddr = {
                kAudioDevicePropertyNominalSampleRate,
                kAudioObjectPropertyScopeInput,
                kAudioObjectPropertyElementMain
            };
            Float64 nominalRate = 0;
            UInt32 rateSize = sizeof(Float64);
            status = AudioObjectGetPropertyData(devId, &rateAddr, 0, nullptr, &rateSize, &nominalRate);
            if (status == noErr) {
                info.sampleRate = static_cast<int>(nominalRate);
            }

            // Get available sample rates
            AudioObjectPropertyAddress rangesAddr = {
                kAudioDevicePropertyAvailableNominalSampleRates,
                kAudioObjectPropertyScopeInput,
                kAudioObjectPropertyElementMain
            };
            UInt32 rangesSize = 0;
            status = AudioObjectGetPropertyDataSize(devId, &rangesAddr, 0, nullptr, &rangesSize);
            if (status == noErr && rangesSize > 0) {
                int rangeCount = rangesSize / sizeof(AudioValueRange);
                std::vector<AudioValueRange> ranges(rangeCount);
                status = AudioObjectGetPropertyData(
                    devId, &rangesAddr, 0, nullptr, &rangesSize, ranges.data()
                );
                if (status == noErr) {
                    const int commonRates[] = {44100, 48000, 88200, 96000, 176400, 192000};
                    for (int rate : commonRates) {
                        for (const auto& range : ranges) {
                            if (rate >= range.mMinimum && rate <= range.mMaximum) {
                                info.sampleRates.push_back(rate);
                                break;
                            }
                        }
                    }
                }
            }

            // Check hog mode capability (exclusive mode)
            AudioObjectPropertyAddress hogAddr = {
                kAudioDevicePropertyHogMode,
                kAudioObjectPropertyScopeInput,
                kAudioObjectPropertyElementMain
            };
            Boolean hogSettable = false;
            info.isExclusiveCapable = AudioObjectIsPropertySettable(
                devId, &hogAddr, &hogSettable
            ) == noErr && hogSettable;

            // Detect loopback by name
            auto nameContains = [&](const char* substr) {
                return info.name.find(substr) != std::string::npos;
            };
            info.isLoopback = nameContains("BlackHole") ||
                              nameContains("Soundflower") ||
                              nameContains("Loopback") ||
                              nameContains("Virtual") ||
                              nameContains("VB-");

            result.push_back(std::move(info));
        }

        return result;
    }

    void watchChanges(DeviceChangeCallback callback) override {
        stopWatching();

        m_callback = std::move(callback);

        AudioObjectPropertyAddress devicesAddr = {
            kAudioHardwarePropertyDevices,
            kAudioObjectPropertyScopeGlobal,
            kAudioObjectPropertyElementMain
        };
        AudioObjectAddPropertyListener(
            kAudioObjectSystemObject, &devicesAddr,
            CoreAudioDeviceEnumerator::deviceChangeListener, this
        );
        m_watching = true;
    }

    void stopWatching() override {
        if (!m_watching) return;

        AudioObjectPropertyAddress devicesAddr = {
            kAudioHardwarePropertyDevices,
            kAudioObjectPropertyScopeGlobal,
            kAudioObjectPropertyElementMain
        };
        AudioObjectRemovePropertyListener(
            kAudioObjectSystemObject, &devicesAddr,
            CoreAudioDeviceEnumerator::deviceChangeListener, this
        );
        m_watching = false;
    }

private:
    static OSStatus deviceChangeListener(
        AudioObjectID /* inObjectID */,
        UInt32 /* inNumberAddresses */,
        const AudioObjectPropertyAddress* /* inAddresses */,
        void* inClientData
    ) {
        auto* self = static_cast<CoreAudioDeviceEnumerator*>(inClientData);
        if (self->m_callback) self->m_callback();
        return noErr;
    }

    DeviceChangeCallback m_callback;
    bool m_watching = false;
};

// Factory implementation
std::unique_ptr<IDeviceEnumerator> createDeviceEnumerator() {
    return std::make_unique<CoreAudioDeviceEnumerator>();
}

} // namespace luxsync

#endif // __APPLE__
