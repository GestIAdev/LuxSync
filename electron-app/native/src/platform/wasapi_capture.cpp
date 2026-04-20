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
#include <chrono>
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
            fprintf(stderr, "[WASAPI] CoInitializeEx failed: hr=0x%08X\n", (unsigned)hr);
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
        if (FAILED(hr)) { fprintf(stderr, "[WASAPI] CoCreateInstance(MMDeviceEnumerator) failed: hr=0x%08X\n", (unsigned)hr); cleanup(); m_running.store(false); return; }

        // Get device (default or specific)
        // WAVE 3406: loopback mode taps an eRender endpoint — open as eRender.
        // Standard capture opens as eCapture.
        EDataFlow deviceFlow = m_config.loopbackMode ? eRender : eCapture;
        if (m_config.deviceId.empty()) {
            hr = pEnumerator->GetDefaultAudioEndpoint(deviceFlow, eConsole, &pDevice);
        } else {
            // Convert device ID from UTF-8 to wide string
            int wlen = MultiByteToWideChar(CP_UTF8, 0, m_config.deviceId.c_str(), -1, nullptr, 0);
            std::wstring wideId(wlen, L'\0');
            MultiByteToWideChar(CP_UTF8, 0, m_config.deviceId.c_str(), -1, &wideId[0], wlen);
            hr = pEnumerator->GetDevice(wideId.c_str(), &pDevice);
        }
        if (FAILED(hr)) {
            if (m_config.deviceId.empty()) {
                fprintf(stderr, "[WASAPI] GetDefaultAudioEndpoint failed: hr=0x%08X\n", (unsigned)hr);
            } else {
                fprintf(stderr, "[WASAPI] GetDevice('%s') failed: hr=0x%08X\n", m_config.deviceId.c_str(), (unsigned)hr);
            }
            cleanup(); m_running.store(false); return;
        }

        hr = pDevice->Activate(
            __uuidof(IAudioClient), CLSCTX_ALL, nullptr,
            reinterpret_cast<void**>(&pAudioClient)
        );
        if (FAILED(hr)) { fprintf(stderr, "[WASAPI] pDevice->Activate(IAudioClient) failed: hr=0x%08X\n", (unsigned)hr); cleanup(); m_running.store(false); return; }

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
        // WAVE 3406: AUDCLNT_STREAMFLAGS_LOOPBACK is incompatible with exclusive
        // mode — Windows returns AUDCLNT_E_UNSUPPORTED_FORMAT immediately.
        // Force shared mode when loopback is requested.
        bool exclusiveActive = false;
        if (m_config.exclusiveMode && !m_config.loopbackMode) {
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
                fprintf(stderr, "[WASAPI] Exclusive mode initialized @ %dHz %dch\n", m_config.sampleRate, m_config.channels);
            } else {
                fprintf(stderr, "[WASAPI] Exclusive mode failed (hr=0x%08X), falling back to shared\n", (unsigned)hr);
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
        // WAVE 3404: Force Float32 output with auto-convert flags.
        // AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM tells Windows to accept any PCM
        // format we request and convert from the device's internal mix format.
        // AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY adds high-quality SRC.
        // This guarantees the buffer we receive is always Float32, regardless
        // of how the user configured the device in Windows Sound Control Panel.
        if (!exclusiveActive) {
            // Build explicit Float32 format at device's native sample rate.
            // We query GetMixFormat only to honour the device's native rate
            // (avoids an extra SRC stage), but we override the subformat to
            // IEEE_FLOAT and request our channel count. Windows does the rest.
            WAVEFORMATEX* pMixFmt = nullptr;
            pAudioClient->GetMixFormat(&pMixFmt);
            DWORD nativeSampleRate = pMixFmt
                ? pMixFmt->nSamplesPerSec
                : static_cast<DWORD>(m_config.sampleRate);
            if (pMixFmt) CoTaskMemFree(pMixFmt);

            WAVEFORMATEXTENSIBLE wfxShared = {};
            wfxShared.Format.wFormatTag      = WAVE_FORMAT_EXTENSIBLE;
            wfxShared.Format.nChannels       = static_cast<WORD>(m_config.channels);
            wfxShared.Format.nSamplesPerSec  = nativeSampleRate;
            wfxShared.Format.wBitsPerSample  = 32;
            wfxShared.Format.nBlockAlign     = wfxShared.Format.nChannels * 4;
            wfxShared.Format.nAvgBytesPerSec = nativeSampleRate * wfxShared.Format.nBlockAlign;
            wfxShared.Format.cbSize          = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
            wfxShared.Samples.wValidBitsPerSample = 32;
            wfxShared.dwChannelMask = (m_config.channels == 1)
                ? SPEAKER_FRONT_CENTER
                : (SPEAKER_FRONT_LEFT | SPEAKER_FRONT_RIGHT);
            wfxShared.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;

            hr = pAudioClient->Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_EVENTCALLBACK
                    | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM
                    | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY
                    // WAVE 3406: inject LOOPBACK flag to tap render output
                    | (m_config.loopbackMode ? AUDCLNT_STREAMFLAGS_LOOPBACK : 0u),
                bufferDuration,
                0,
                reinterpret_cast<WAVEFORMATEX*>(&wfxShared),
                nullptr
            );
            if (FAILED(hr)) {
                fprintf(stderr, "[WASAPI] Shared+Float32+AutoConvert failed (hr=0x%08X), retrying with mix format\n", (unsigned)hr);
                // Last resort: honour whatever format the device wants.
                // We'll detect non-float in the capture loop and convert manually.
                WAVEFORMATEX* pFallbackFmt = nullptr;
                pAudioClient->GetMixFormat(&pFallbackFmt);
                if (pFallbackFmt) {
                    pAudioClient->Release();
                    pAudioClient = nullptr;
                    pDevice->Activate(
                        __uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                        reinterpret_cast<void**>(&pAudioClient)
                    );
                    hr = pAudioClient->Initialize(
                        AUDCLNT_SHAREMODE_SHARED,
                        AUDCLNT_STREAMFLAGS_EVENTCALLBACK
                            | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM
                            | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY
                            | (m_config.loopbackMode ? AUDCLNT_STREAMFLAGS_LOOPBACK : 0u),
                        bufferDuration,
                        0,
                        pFallbackFmt,
                        nullptr
                    );
                    // Remember if mix format is integer so the loop can convert
                    m_sharedModeIsInt16 = (pFallbackFmt->wBitsPerSample == 16
                        && pFallbackFmt->wFormatTag != WAVE_FORMAT_IEEE_FLOAT);
                    CoTaskMemFree(pFallbackFmt);
                }
            }
            if (FAILED(hr)) { fprintf(stderr, "[WASAPI] Shared mode Initialize failed (all formats exhausted): hr=0x%08X\n", (unsigned)hr); cleanup(); m_running.store(false); return; }
        }

        // Create event for buffer notifications
        hEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
        if (!hEvent) { fprintf(stderr, "[WASAPI] CreateEvent failed: GetLastError=%lu\n", GetLastError()); cleanup(); m_running.store(false); return; }

        hr = pAudioClient->SetEventHandle(hEvent);
        if (FAILED(hr)) { fprintf(stderr, "[WASAPI] SetEventHandle failed: hr=0x%08X\n", (unsigned)hr); cleanup(); m_running.store(false); return; }

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
        if (FAILED(hr)) { fprintf(stderr, "[WASAPI] GetService(IAudioCaptureClient) failed: hr=0x%08X\n", (unsigned)hr); cleanup(); m_running.store(false); return; }

        // Elevate thread priority for real-time audio
        DWORD taskIndex = 0;
        hTask = AvSetMmThreadCharacteristicsW(L"Pro Audio", &taskIndex);

        // WAVE 3410 ANOMALÍA 1: COLD START WAKE-UP
        //
        // WASAPI Loopback (AUDCLNT_STREAMFLAGS_LOOPBACK) over an eRender endpoint
        // only delivers real PCM samples when the render graph is ACTIVE — i.e.,
        // some application is currently streaming audio to that endpoint.
        //
        // When LuxSync starts cold and no other app has activated the render
        // endpoint yet (VB-Cable "CABLE Input"), Windows keeps the endpoint in
        // low-power idle.  The loopback capture starts, GetBuffer() returns
        // AUDCLNT_BUFFERFLAGS_SILENT on every callback, and the SharedRingBuffer
        // receives only zeros.  The user then clicks MIC → getUserMedia() forces
        // the Windows audio subsystem to fully activate, which as a side effect
        // wakes the render graph → VIRTUAL WIRE now works.
        //
        // FIX: Before starting the real capture, open a SECOND IAudioClient on
        // the SAME render endpoint and feed it one buffer of silence.  This
        // forces Windows to activate the render graph (WASAPI session registers
        // the device), after which AUDCLNT_STREAMFLAGS_LOOPBACK receives real
        // PCM data from the very first captured buffer.
        //
        // The dummy render client is immediately stopped and released before
        // the real loopback capture begins — it leaves NO audible artifact.
        if (m_config.loopbackMode) {
            IAudioClient*        pWakeClient  = nullptr;
            IAudioRenderClient*  pWakeRender  = nullptr;

            HRESULT hrWake = pDevice->Activate(
                __uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                reinterpret_cast<void**>(&pWakeClient));

            if (SUCCEEDED(hrWake)) {
                WAVEFORMATEX* pWakeFmt = nullptr;
                pWakeClient->GetMixFormat(&pWakeFmt);

                if (pWakeFmt) {
                    // 100ms buffer — plenty of time for the render graph to wake
                    REFERENCE_TIME wakeBufferDuration =
                        static_cast<REFERENCE_TIME>(0.1 * 10000000.0); // 100ms in 100ns units

                    hrWake = pWakeClient->Initialize(
                        AUDCLNT_SHAREMODE_SHARED,
                        0,                      // No event callback — polling is fine here
                        wakeBufferDuration,
                        0,
                        pWakeFmt,
                        nullptr);

                    if (SUCCEEDED(hrWake)) {
                        UINT32 wakeBufferSize = 0;
                        pWakeClient->GetBufferSize(&wakeBufferSize);

                        hrWake = pWakeClient->GetService(
                            __uuidof(IAudioRenderClient),
                            reinterpret_cast<void**>(&pWakeRender));

                        if (SUCCEEDED(hrWake) && wakeBufferSize > 0) {
                            BYTE* pWakeData = nullptr;
                            hrWake = pWakeRender->GetBuffer(wakeBufferSize, &pWakeData);
                            if (SUCCEEDED(hrWake)) {
                                // Write silence — fills the render endpoint buffer with zeros
                                // so the Windows audio engine registers the active session
                                memset(pWakeData, 0,
                                    wakeBufferSize * pWakeFmt->nBlockAlign);
                                pWakeRender->ReleaseBuffer(wakeBufferSize,
                                    AUDCLNT_BUFFERFLAGS_SILENT);
                            }
                            pWakeClient->Start();
                            // 50ms is enough for the render graph to transition to active
                            std::this_thread::sleep_for(std::chrono::milliseconds(50));
                            pWakeClient->Stop();
                            fprintf(stderr, "[WASAPI] WAVE 3410: Cold-start wake-up rendered (loopback endpoint activated)\n");
                        }
                    }
                    CoTaskMemFree(pWakeFmt);
                }
            }

            if (pWakeRender) pWakeRender->Release();
            if (pWakeClient) pWakeClient->Release();
        }

        fprintf(stderr, "[WASAPI] Starting capture: device='%s' %dHz %dch buf=%d exclusive=%d loopback=%d latency=%.2fms\n",
            m_config.deviceId.empty() ? "(default)" : m_config.deviceId.c_str(),
            m_config.sampleRate, m_config.channels, m_config.bufferSizeFrames,
            m_config.exclusiveMode, m_config.loopbackMode, m_latencyMs.load());

        // Start capturing
        hr = pAudioClient->Start();
        if (FAILED(hr)) { fprintf(stderr, "[WASAPI] pAudioClient->Start() failed: hr=0x%08X\n", (unsigned)hr); cleanup(); m_running.store(false); return; }

        fprintf(stderr, "[WASAPI] Capture loop running\n");

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
                    } else if (m_sharedModeIsInt16) {
                        // Last-resort fallback: mix format was int16, convert manually.
                        // This path is only taken when AUTOCONVERTPCM negotiation failed
                        // and we were forced to accept the device's raw int16 format.
                        const int16_t* pInt16 = reinterpret_cast<const int16_t*>(pData);
                        int totalSamples = static_cast<int>(framesAvailable) * m_config.channels;
                        std::vector<float> converted(totalSamples);
                        constexpr float kScale = 1.0f / 32768.0f;
                        for (int i = 0; i < totalSamples; ++i) {
                            converted[i] = pInt16[i] * kScale;
                        }
                        m_callback(converted.data(), framesAvailable, m_config.channels, m_config.sampleRate);
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
    // True only when AUTOCONVERTPCM negotiation failed and we accepted a raw
    // int16 mix format — the capture loop will convert manually in that case.
    bool m_sharedModeIsInt16 = false;
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
