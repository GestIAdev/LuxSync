// WAVE 3402: JACK Device Enumerator (Linux)
//
// Lists available JACK ports as audio sources.
// JACK doesn't have a traditional device model — instead it exposes
// ports that can be connected. Physical capture ports represent
// hardware inputs.

#ifdef __linux__

#include "../common.h"

#include <jack/jack.h>

#include <vector>
#include <string>

namespace luxsync {

class JackDeviceEnumerator : public IDeviceEnumerator {
public:
    JackDeviceEnumerator() = default;
    ~JackDeviceEnumerator() override { stopWatching(); }

    std::vector<AudioDeviceInfo> enumerate() override {
        std::vector<AudioDeviceInfo> result;

        // Open a temporary client to query ports
        jack_status_t status;
        jack_client_t* client = jack_client_open(
            "luxsync_enum", JackNoStartServer, &status
        );
        if (!client) return result;

        int sampleRate = static_cast<int>(jack_get_sample_rate(client));

        // Get all physical output ports (these are capture sources from hardware)
        const char** ports = jack_get_ports(
            client, nullptr, JACK_DEFAULT_AUDIO_TYPE,
            JackPortIsPhysical | JackPortIsOutput
        );

        if (ports) {
            for (int i = 0; ports[i] != nullptr; i++) {
                AudioDeviceInfo info = {};
                info.id = ports[i]; // Full JACK port name as ID
                info.name = ports[i];
                info.sampleRate = sampleRate;
                info.channels = 1; // JACK ports are always mono
                info.isDefault = (i == 0);
                info.isLoopback = false;
                info.isExclusiveCapable = false; // JACK is fundamentally shared
                info.driver = "jack";
                info.sampleRates.push_back(sampleRate); // JACK runs at fixed rate

                result.push_back(std::move(info));
            }
            jack_free(ports);
        }

        // Also enumerate non-physical ports (virtual/software sources)
        const char** virtualPorts = jack_get_ports(
            client, nullptr, JACK_DEFAULT_AUDIO_TYPE,
            JackPortIsOutput // All output ports, not just physical
        );

        if (virtualPorts) {
            for (int i = 0; virtualPorts[i] != nullptr; i++) {
                // Skip if already listed as physical
                std::string portName = virtualPorts[i];
                bool alreadyListed = false;
                for (const auto& existing : result) {
                    if (existing.id == portName) {
                        alreadyListed = true;
                        break;
                    }
                }
                if (alreadyListed) continue;

                // Skip our own ports
                if (portName.find("luxsync") != std::string::npos) continue;

                AudioDeviceInfo info = {};
                info.id = portName;
                info.name = portName;
                info.sampleRate = sampleRate;
                info.channels = 1;
                info.isDefault = false;
                info.isLoopback = true; // Non-physical = virtual/loopback
                info.isExclusiveCapable = false;
                info.driver = "jack";
                info.sampleRates.push_back(sampleRate);

                result.push_back(std::move(info));
            }
            jack_free(virtualPorts);
        }

        jack_client_close(client);
        return result;
    }

    void watchChanges(DeviceChangeCallback callback) override {
        stopWatching();
        m_callback = std::move(callback);

        // Open persistent client for port registration monitoring
        jack_status_t status;
        m_watchClient = jack_client_open(
            "luxsync_watch", JackNoStartServer, &status
        );
        if (!m_watchClient) return;

        jack_set_port_registration_callback(
            m_watchClient,
            JackDeviceEnumerator::portRegistrationCallback,
            this
        );

        jack_activate(m_watchClient);
        m_watching = true;
    }

    void stopWatching() override {
        if (!m_watching) return;
        if (m_watchClient) {
            jack_deactivate(m_watchClient);
            jack_client_close(m_watchClient);
            m_watchClient = nullptr;
        }
        m_watching = false;
    }

private:
    static void portRegistrationCallback(jack_port_id_t, int, void* arg) {
        auto* self = static_cast<JackDeviceEnumerator*>(arg);
        if (self->m_callback) self->m_callback();
    }

    DeviceChangeCallback m_callback;
    jack_client_t* m_watchClient = nullptr;
    bool m_watching = false;
};

// Factory implementation
std::unique_ptr<IDeviceEnumerator> createDeviceEnumerator() {
    return std::make_unique<JackDeviceEnumerator>();
}

} // namespace luxsync

#endif // __linux__
