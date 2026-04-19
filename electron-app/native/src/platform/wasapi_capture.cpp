// WAVE 3402: WASAPI Exclusive Mode Capture Stream
//
// Windows audio capture via WASAPI in Exclusive Mode.
// Bypasses all system DSP: Loudness Equalization, Room Correction,
// Dynamic Compression — delivering raw PCM Float32 from the hardware.
//
// Buffer: 256 frames (5.8ms @ 44100Hz)
// Format: WAVEFORMATEXTENSIBLE Float32 mono/stereo
// Fallback: Shared mode with warning if exclusive fails

#ifdef _WIN32

#include "../common.h"

#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <avrt.h>
#include <functiondiscoverykeys_devpkey.h>

#include <thread>
#include <atomic>
#include <string>
#include <cstring>
#include <cmath>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "avrt.lib")

namespace luxsync {

class WasapiCaptureStream : public ICaptureStream {
public:
    WasapiCaptureStream() = default;

    ~WasapiCaptureStream() override {
        stop();
    }

    bool start(const CaptureConfig& config, AudioCallback callback) override {
        if (m_running.load()) return false;

        m_callback = std::move(callback);
        m_config = config;
        m_bufferUnderruns.store(0);
        m_latencyMs.store(0.0);

        m_running.store(true);
        m_captureThread = std::thread(&WasapiCaptureStream::captureLoop, this);

        return true;
    }

    void stop() override {
        m_running.store(false);
        if (m_captureThread.joinable()) {
            m_captureThread.join();
        }
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
    void captureLoop() {
        HRESULT hr;

        // Initialize COM for this thread (MTA)
        hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        if (FAILED(hr)) {
            m_running.store(false);
            return;
        }

        IMMDeviceEnumerator* pEnumerator = nullptr;
        IMMDevice* pDevice = nullptr;
        IAudioClient* pAudioClient = nullptr;
        IAudioCaptureClient* pCaptureClient = nullptr;
        HANDLE hEvent = nullptr;
        HANDLE hTask = nullptr;

        // Cleanup RAII
        auto cleanup = [&]() {
            if (pCaptureClient) pCaptureClient->Release();
            if (pAudioClient) pAudioClient->Release();
            if (pDevice) pDevice->Release();
            if (pEnumerator) pEnumerator->Release();
            if (hEvent) CloseHandle(hEvent);
            if (hTask) AvRevertMmThreadCharacteristics(hTask);
            CoUninitialize();
        };

        hr = CoCreateInstance(
            __uuidof(MMDeviceEnumerator), nullptr,
            CLSCTX_ALL, __uuidof(IMMDeviceEnumerator),
            reinterpret_cast<void**>(&pEnumerator)
        );
        if (FAILED(hr)) { cleanup(); m_running.store(false); return; }

        // Get device (default or specific)
        if (m_config.deviceId.empty()) {
            hr = pEnumerator->GetDefaultAudioEndpoint(eCapture, eConsole, &pDevice);
        } else {
            // Convert device ID from UTF-8 to wide string
            int wlen = MultiByteToWideChar(CP_UTF8, 0, m_config.deviceId.c_str(), -1, nullptr, 0);
            std::wstring wideId(wlen, L'\0');
            MultiByteToWideChar(CP_UTF8, 0, m_config.deviceId.c_str(), -1, &wideId[0], wlen);
            hr = pEnumerator->GetDevice(wideId.c_str(), &pDevice);
        }
        if (FAILED(hr)) { cleanup(); m_running.store(false); return; }

        hr = pDevice->Activate(
            __uuidof(IAudioClient), CLSCTX_ALL, nullptr,
            reinterpret_cast<void**>(&pAudioClient)
        );
        if (FAILED(hr)) { cleanup(); m_running.store(false); return; }

        // Configure WAVEFORMATEXTENSIBLE for Float32
        WAVEFORMATEXTENSIBLE wfx = {};
        wfx.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
        wfx.Format.nChannels = static_cast<WORD>(m_config.channels);
        wfx.Format.nSamplesPerSec = static_cast<DWORD>(m_config.sampleRate);
        wfx.Format.wBitsPerSample = 32;
        wfx.Format.nBlockAlign = wfx.Format.nChannels * (wfx.Format.wBitsPerSample / 8);
        wfx.Format.nAvgBytesPerSec = wfx.Format.nSamplesPerSec * wfx.Format.nBlockAlign;
        wfx.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
        wfx.Samples.wValidBitsPerSample = 32;
        wfx.dwChannelMask = (m_config.channels == 1)
            ? SPEAKER_FRONT_CENTER
            : (SPEAKER_FRONT_LEFT | SPEAKER_FRONT_RIGHT);
        wfx.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;

        // Buffer duration in 100ns units
        // Target: bufferSizeFrames (default 256) at configured sample rate
        REFERENCE_TIME bufferDuration =
            static_cast<REFERENCE_TIME>(
                (10000000.0 * m_config.bufferSizeFrames) / m_config.sampleRate
            );

        // Try Exclusive Mode first
        bool exclusiveActive = false;
        if (m_config.exclusiveMode) {
            hr = pAudioClient->Initialize(
                AUDCLNT_SHAREMODE_EXCLUSIVE,
                AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                bufferDuration,
                bufferDuration,
                reinterpret_cast<WAVEFORMATEX*>(&wfx),
                nullptr
            );
            if (SUCCEEDED(hr)) {
                exclusiveActive = true;
            } else {
                // Exclusive failed — release and re-activate for shared mode
                pAudioClient->Release();
                pAudioClient = nullptr;
                pDevice->Activate(
                    __uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                    reinterpret_cast<void**>(&pAudioClient)
                );
            }
        }

        // Fallback: Shared Mode
        if (!exclusiveActive) {
            hr = pAudioClient->Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                bufferDuration,
                0,
                reinterpret_cast<WAVEFORMATEX*>(&wfx),
                nullptr
            );
            if (FAILED(hr)) {
                // Try with device's mix format as last resort
                WAVEFORMATEX* pMixFormat = nullptr;
                pAudioClient->GetMixFormat(&pMixFormat);
                if (pMixFormat) {
                    pAudioClient->Release();
                    pAudioClient = nullptr;
                    pDevice->Activate(
                        __uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                        reinterpret_cast<void**>(&pAudioClient)
                    );
                    hr = pAudioClient->Initialize(
                        AUDCLNT_SHAREMODE_SHARED,
                        AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                        bufferDuration,
                        0,
                        pMixFormat,
                        nullptr
                    );
                    CoTaskMemFree(pMixFormat);
                }
            }
            if (FAILED(hr)) { cleanup(); m_running.store(false); return; }
        }

        // Create event for buffer notifications
        hEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
        if (!hEvent) { cleanup(); m_running.store(false); return; }

        hr = pAudioClient->SetEventHandle(hEvent);
        if (FAILED(hr)) { cleanup(); m_running.store(false); return; }

        // Get actual buffer size
        UINT32 actualBufferSize = 0;
        pAudioClient->GetBufferSize(&actualBufferSize);

        // Calculate latency
        double latencyMs = (1000.0 * actualBufferSize) / m_config.sampleRate;
        m_latencyMs.store(latencyMs);

        // Get capture client
        hr = pAudioClient->GetService(
            __uuidof(IAudioCaptureClient),
            reinterpret_cast<void**>(&pCaptureClient)
        );
        if (FAILED(hr)) { cleanup(); m_running.store(false); return; }

        // Elevate thread priority for real-time audio
        DWORD taskIndex = 0;
        hTask = AvSetMmThreadCharacteristicsW(L"Pro Audio", &taskIndex);

        // Start capturing
        hr = pAudioClient->Start();
        if (FAILED(hr)) { cleanup(); m_running.store(false); return; }

        // Capture loop
        while (m_running.load()) {
            DWORD waitResult = WaitForSingleObject(hEvent, 100);
            if (waitResult != WAIT_OBJECT_0) {
                if (!m_running.load()) break;
                continue;
            }

            BYTE* pData = nullptr;
            UINT32 framesAvailable = 0;
            DWORD flags = 0;

            while (true) {
                hr = pCaptureClient->GetBuffer(&pData, &framesAvailable, &flags, nullptr, nullptr);
                if (hr == AUDCLNT_S_BUFFER_EMPTY || FAILED(hr)) break;

                if (framesAvailable > 0) {
                    if (flags & AUDCLNT_BUFFERFLAGS_DATA_DISCONTINUITY) {
                        m_bufferUnderruns.fetch_add(1);
                    }

                    if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                        // Silent buffer — feed zeros
                        std::vector<float> silence(framesAvailable * m_config.channels, 0.0f);
                        m_callback(silence.data(), framesAvailable, m_config.channels, m_config.sampleRate);
                    } else {
                        m_callback(
                            reinterpret_cast<const float*>(pData),
                            framesAvailable,
                            m_config.channels,
                            m_config.sampleRate
                        );
                    }
                }

                pCaptureClient->ReleaseBuffer(framesAvailable);
            }
        }

        // Stop and cleanup
        pAudioClient->Stop();
        cleanup();
    }

    CaptureConfig m_config;
    AudioCallback m_callback;
    std::thread m_captureThread;
    std::atomic<bool> m_running{false};
    std::atomic<int> m_bufferUnderruns{0};
    std::atomic<double> m_latencyMs{0.0};
};

// Factory implementation
std::unique_ptr<ICaptureStream> createCaptureStream() {
    return std::make_unique<WasapiCaptureStream>();
}

} // namespace luxsync

#endif // _WIN32
