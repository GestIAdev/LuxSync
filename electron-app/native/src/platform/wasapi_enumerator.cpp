// WAVE 3402: WASAPI Device Enumerator + Hot-Plug Detection
//
// Uses IMMDeviceEnumerator for listing audio input devices
// and IMMNotificationClient for hot-plug / unplug events.
//
// Detects: physical mics, loopback devices (VB-Cable, BlackHole),
// USB audio interfaces, ASIO Class Compliant devices.

#ifdef _WIN32

#include "../common.h"

#include <windows.h>
#include <mmdeviceapi.h>
#include <functiondiscoverykeys_devpkey.h>
#include <endpointvolume.h>

#include <string>
#include <vector>
#include <mutex>
#include <atomic>

namespace luxsync {

// Wide string → UTF-8
static std::string WideToUtf8(const wchar_t* wide) {
    if (!wide) return "";
    int len = WideCharToMultiByte(CP_UTF8, 0, wide, -1, nullptr, 0, nullptr, nullptr);
    if (len <= 0) return "";
    std::string result(len - 1, '\0');
    WideCharToMultiByte(CP_UTF8, 0, wide, -1, &result[0], len, nullptr, nullptr);
    return result;
}

// IMMNotificationClient implementation for hot-plug events
class DeviceNotificationClient : public IMMNotificationClient {
public:
    explicit DeviceNotificationClient(DeviceChangeCallback cb)
        : m_callback(std::move(cb)), m_refCount(1) {}

    // IUnknown
    ULONG STDMETHODCALLTYPE AddRef() override {
        return InterlockedIncrement(&m_refCount);
    }

    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = InterlockedDecrement(&m_refCount);
        if (count == 0) delete this;
        return count;
    }

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppvObject) override {
        if (riid == __uuidof(IUnknown) || riid == __uuidof(IMMNotificationClient)) {
            *ppvObject = static_cast<IMMNotificationClient*>(this);
            AddRef();
            return S_OK;
        }
        *ppvObject = nullptr;
        return E_NOINTERFACE;
    }

    // IMMNotificationClient — we care about add/remove/state change
    HRESULT STDMETHODCALLTYPE OnDeviceStateChanged(LPCWSTR, DWORD) override {
        fireCallback();
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE OnDeviceAdded(LPCWSTR) override {
        fireCallback();
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE OnDeviceRemoved(LPCWSTR) override {
        fireCallback();
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE OnDefaultDeviceChanged(EDataFlow, ERole, LPCWSTR) override {
        fireCallback();
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE OnPropertyValueChanged(LPCWSTR, const PROPERTYKEY) override {
        // Ignore property changes — not relevant for device topology
        return S_OK;
    }

private:
    void fireCallback() {
        if (m_callback) m_callback();
    }

    DeviceChangeCallback m_callback;
    LONG m_refCount;
};


class WasapiDeviceEnumerator : public IDeviceEnumerator {
public:
    WasapiDeviceEnumerator() {
        CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        CoCreateInstance(
            __uuidof(MMDeviceEnumerator), nullptr,
            CLSCTX_ALL, __uuidof(IMMDeviceEnumerator),
            reinterpret_cast<void**>(&m_pEnumerator)
        );
    }

    ~WasapiDeviceEnumerator() override {
        stopWatching();
        if (m_pEnumerator) m_pEnumerator->Release();
        CoUninitialize();
    }

    std::vector<AudioDeviceInfo> enumerate() override {
        std::vector<AudioDeviceInfo> result;
        if (!m_pEnumerator) return result;

        // Enumerate both capture and render (for loopback) devices
        enumerateFlow(eCapture, result, false);
        enumerateFlow(eRender, result, true); // render devices = loopback capable

        return result;
    }

    void watchChanges(DeviceChangeCallback callback) override {
        stopWatching(); // Remove previous watcher

        m_notificationClient = new DeviceNotificationClient(std::move(callback));
        if (m_pEnumerator) {
            m_pEnumerator->RegisterEndpointNotificationCallback(m_notificationClient);
        }
    }

    void stopWatching() override {
        if (m_notificationClient && m_pEnumerator) {
            m_pEnumerator->UnregisterEndpointNotificationCallback(m_notificationClient);
            m_notificationClient->Release();
            m_notificationClient = nullptr;
        }
    }

private:
    void enumerateFlow(EDataFlow flow, std::vector<AudioDeviceInfo>& out, bool isLoopback) {
        IMMDeviceCollection* pCollection = nullptr;
        HRESULT hr = m_pEnumerator->EnumAudioEndpoints(
            flow, DEVICE_STATE_ACTIVE, &pCollection
        );
        if (FAILED(hr) || !pCollection) return;

        UINT count = 0;
        pCollection->GetCount(&count);

        // Get default device ID for this flow
        std::wstring defaultId;
        {
            IMMDevice* pDefault = nullptr;
            if (SUCCEEDED(m_pEnumerator->GetDefaultAudioEndpoint(flow, eConsole, &pDefault))) {
                LPWSTR id = nullptr;
                pDefault->GetId(&id);
                if (id) {
                    defaultId = id;
                    CoTaskMemFree(id);
                }
                pDefault->Release();
            }
        }

        for (UINT i = 0; i < count; i++) {
            IMMDevice* pDevice = nullptr;
            hr = pCollection->Item(i, &pDevice);
            if (FAILED(hr) || !pDevice) continue;

            AudioDeviceInfo info = {};
            info.isLoopback = isLoopback;
            info.driver = "wasapi";

            // Get device ID
            LPWSTR deviceId = nullptr;
            pDevice->GetId(&deviceId);
            if (deviceId) {
                info.id = WideToUtf8(deviceId);
                info.isDefault = (std::wstring(deviceId) == defaultId);
                CoTaskMemFree(deviceId);
            }

            // Get device name from property store
            IPropertyStore* pProps = nullptr;
            hr = pDevice->OpenPropertyStore(STGM_READ, &pProps);
            if (SUCCEEDED(hr) && pProps) {
                PROPVARIANT varName;
                PropVariantInit(&varName);
                hr = pProps->GetValue(PKEY_Device_FriendlyName, &varName);
                if (SUCCEEDED(hr) && varName.vt == VT_LPWSTR) {
                    info.name = WideToUtf8(varName.pwszVal);
                }
                PropVariantClear(&varName);
                pProps->Release();
            }

            // Try to get format info
            IAudioClient* pAudioClient = nullptr;
            hr = pDevice->Activate(
                __uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                reinterpret_cast<void**>(&pAudioClient)
            );
            if (SUCCEEDED(hr) && pAudioClient) {
                WAVEFORMATEX* pMixFormat = nullptr;
                hr = pAudioClient->GetMixFormat(&pMixFormat);
                if (SUCCEEDED(hr) && pMixFormat) {
                    info.sampleRate = pMixFormat->nSamplesPerSec;
                    info.channels = pMixFormat->nChannels;
                    CoTaskMemFree(pMixFormat);
                }

                // Check exclusive mode support
                WAVEFORMATEXTENSIBLE wfx = {};
                wfx.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
                wfx.Format.nChannels = 1;
                wfx.Format.nSamplesPerSec = 44100;
                wfx.Format.wBitsPerSample = 32;
                wfx.Format.nBlockAlign = 4;
                wfx.Format.nAvgBytesPerSec = 44100 * 4;
                wfx.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
                wfx.Samples.wValidBitsPerSample = 32;
                wfx.dwChannelMask = SPEAKER_FRONT_CENTER;
                wfx.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;

                WAVEFORMATEX* pClosest = nullptr;
                hr = pAudioClient->IsFormatSupported(
                    AUDCLNT_SHAREMODE_EXCLUSIVE,
                    reinterpret_cast<WAVEFORMATEX*>(&wfx),
                    &pClosest
                );
                info.isExclusiveCapable = (hr == S_OK);
                if (pClosest) CoTaskMemFree(pClosest);

                // Probe common sample rates
                const int commonRates[] = {44100, 48000, 88200, 96000, 176400, 192000};
                for (int rate : commonRates) {
                    wfx.Format.nSamplesPerSec = rate;
                    wfx.Format.nAvgBytesPerSec = rate * 4;
                    WAVEFORMATEX* pC = nullptr;
                    hr = pAudioClient->IsFormatSupported(
                        AUDCLNT_SHAREMODE_EXCLUSIVE,
                        reinterpret_cast<WAVEFORMATEX*>(&wfx),
                        &pC
                    );
                    if (hr == S_OK) {
                        info.sampleRates.push_back(rate);
                    }
                    if (pC) CoTaskMemFree(pC);
                }

                pAudioClient->Release();
            }

            // Detect loopback by name heuristics (VB-Cable, BlackHole, Virtual Cable)
            auto nameContains = [&](const char* substr) {
                return info.name.find(substr) != std::string::npos;
            };
            if (nameContains("VB-") || nameContains("CABLE") ||
                nameContains("BlackHole") || nameContains("Virtual") ||
                nameContains("Voicemeeter")) {
                info.isLoopback = true;
            }

            out.push_back(std::move(info));
            pDevice->Release();
        }

        pCollection->Release();
    }

    IMMDeviceEnumerator* m_pEnumerator = nullptr;
    DeviceNotificationClient* m_notificationClient = nullptr;
};

// Factory implementation
std::unique_ptr<IDeviceEnumerator> createDeviceEnumerator() {
    return std::make_unique<WasapiDeviceEnumerator>();
}

} // namespace luxsync

#endif // _WIN32
