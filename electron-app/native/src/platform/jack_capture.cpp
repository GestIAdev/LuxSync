// WAVE 3402: JACK Capture Stream (Linux)
//
// Uses JACK Audio Connection Kit for Linux audio capture.
// JACK provides professional-grade low-latency audio with
// direct hardware access via ALSA backend.
//
// Format: Float32 (JACK native)
// Latency: Defined by JACK server settings

#ifdef __linux__

#include "../common.h"

#include <jack/jack.h>

#include <atomic>
#include <string>
#include <cstring>
#include <vector>

namespace luxsync {

class JackCaptureStream : public ICaptureStream {
public:
    JackCaptureStream() = default;

    ~JackCaptureStream() override {
        stop();
    }

    bool start(const CaptureConfig& config, AudioCallback callback) override {
        if (m_running.load()) return false;

        m_callback = std::move(callback);
        m_config = config;
        m_bufferUnderruns.store(0);
        m_latencyMs.store(0.0);

        // Open JACK client
        jack_status_t status;
        m_client = jack_client_open("luxsync", JackNoStartServer, &status);
        if (!m_client) return false;

        // Register input port
        m_inputPort = jack_port_register(
            m_client, "input",
            JACK_DEFAULT_AUDIO_TYPE,
            JackPortIsInput, 0
        );
        if (!m_inputPort) {
            jack_client_close(m_client);
            m_client = nullptr;
            return false;
        }

        // Set process callback
        jack_set_process_callback(m_client, JackCaptureStream::processCallback, this);

        // Set xrun callback for buffer underrun tracking
        jack_set_xrun_callback(m_client, JackCaptureStream::xrunCallback, this);

        // Get buffer size for latency calculation
        jack_nframes_t bufferSize = jack_get_buffer_size(m_client);
        jack_nframes_t sampleRate = jack_get_sample_rate(m_client);
        m_jackSampleRate = static_cast<int>(sampleRate);
        m_latencyMs.store((1000.0 * bufferSize) / sampleRate);

        // Activate client
        if (jack_activate(m_client) != 0) {
            jack_port_unregister(m_client, m_inputPort);
            jack_client_close(m_client);
            m_client = nullptr;
            m_inputPort = nullptr;
            return false;
        }

        // Auto-connect to specified device or first physical capture port
        if (!config.deviceId.empty()) {
            jack_connect(m_client, config.deviceId.c_str(), jack_port_name(m_inputPort));
        } else {
            const char** ports = jack_get_ports(
                m_client, nullptr, JACK_DEFAULT_AUDIO_TYPE,
                JackPortIsPhysical | JackPortIsOutput
            );
            if (ports && ports[0]) {
                jack_connect(m_client, ports[0], jack_port_name(m_inputPort));
            }
            if (ports) jack_free(ports);
        }

        m_running.store(true);
        return true;
    }

    void stop() override {
        if (!m_running.load()) return;
        m_running.store(false);

        if (m_client) {
            jack_deactivate(m_client);
            if (m_inputPort) {
                jack_port_unregister(m_client, m_inputPort);
                m_inputPort = nullptr;
            }
            jack_client_close(m_client);
            m_client = nullptr;
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
    // JACK process callback — runs on real-time audio thread
    static int processCallback(jack_nframes_t nframes, void* arg) {
        auto* self = static_cast<JackCaptureStream*>(arg);
        if (!self->m_running.load()) return 0;

        auto* buffer = static_cast<const float*>(
            jack_port_get_buffer(self->m_inputPort, nframes)
        );

        if (buffer) {
            self->m_callback(
                buffer,
                static_cast<int>(nframes),
                1, // JACK ports are mono
                self->m_jackSampleRate
            );
        }

        return 0;
    }

    static int xrunCallback(void* arg) {
        auto* self = static_cast<JackCaptureStream*>(arg);
        self->m_bufferUnderruns.fetch_add(1);
        return 0;
    }

    CaptureConfig m_config;
    AudioCallback m_callback;
    jack_client_t* m_client = nullptr;
    jack_port_t* m_inputPort = nullptr;
    int m_jackSampleRate = 44100;
    std::atomic<bool> m_running{false};
    std::atomic<int> m_bufferUnderruns{0};
    std::atomic<double> m_latencyMs{0.0};
};

// Factory implementation
std::unique_ptr<ICaptureStream> createCaptureStream() {
    return std::make_unique<JackCaptureStream>();
}

} // namespace luxsync

#endif // __linux__
