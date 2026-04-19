// WAVE 3402: LUXSYNC NATIVE AUDIO — N-API Entry Point
//
// Exposes 4 functions to Node.js:
//   enumerateDevices()                → AudioDeviceInfo[]
//   onDeviceChange(callback)          → void
//   startCapture(config, callback)    → captureHandle (number)
//   stopCapture(handle)               → void
//
// This is the bridge between C++ platform code and the TypeScript providers.
// All audio data flows: Platform API → C++ callback → N-API ThreadSafeFunction → JS callback

#include <napi.h>
#include "common.h"
#include <unordered_map>
#include <mutex>

namespace luxsync {

// ============================================
// GLOBALS
// ============================================

static std::unique_ptr<IDeviceEnumerator> g_enumerator;
static std::unordered_map<int, std::unique_ptr<ICaptureStream>> g_streams;
static Napi::ThreadSafeFunction g_deviceChangeTsfn;
static int g_nextHandle = 1;
static std::mutex g_streamsMutex;

// ============================================
// enumerateDevices() → AudioDeviceInfo[]
// ============================================

static Napi::Value EnumerateDevices(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!g_enumerator) {
        g_enumerator = createDeviceEnumerator();
    }

    auto devices = g_enumerator->enumerate();
    Napi::Array result = Napi::Array::New(env, devices.size());

    for (size_t i = 0; i < devices.size(); i++) {
        const auto& dev = devices[i];
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("id", dev.id);
        obj.Set("name", dev.name);
        obj.Set("sampleRate", dev.sampleRate);
        obj.Set("channels", dev.channels);
        obj.Set("isDefault", dev.isDefault);
        obj.Set("isLoopback", dev.isLoopback);
        obj.Set("isExclusiveCapable", dev.isExclusiveCapable);
        obj.Set("driver", dev.driver);

        Napi::Array rates = Napi::Array::New(env, dev.sampleRates.size());
        for (size_t j = 0; j < dev.sampleRates.size(); j++) {
            rates.Set(static_cast<uint32_t>(j), dev.sampleRates[j]);
        }
        obj.Set("sampleRates", rates);

        result.Set(static_cast<uint32_t>(i), obj);
    }

    return result;
}

// ============================================
// onDeviceChange(callback) → void
// ============================================

static Napi::Value OnDeviceChange(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Expected callback function").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Release previous TSFN if any
    if (g_deviceChangeTsfn) {
        g_deviceChangeTsfn.Release();
    }

    g_deviceChangeTsfn = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "luxsync_device_change",
        0,   // unlimited queue
        1    // 1 initial thread
    );

    if (!g_enumerator) {
        g_enumerator = createDeviceEnumerator();
    }

    g_enumerator->watchChanges([&]() {
        if (g_deviceChangeTsfn) {
            g_deviceChangeTsfn.NonBlockingCall();
        }
    });

    return env.Undefined();
}

// ============================================
// startCapture(config, callback) → handle
// ============================================

static Napi::Value StartCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsObject() || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Expected (config: Object, callback: Function)")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Parse config
    Napi::Object configObj = info[0].As<Napi::Object>();
    CaptureConfig config;
    config.deviceId = configObj.Has("deviceId")
        ? configObj.Get("deviceId").As<Napi::String>().Utf8Value() : "";
    config.sampleRate = configObj.Has("sampleRate")
        ? configObj.Get("sampleRate").As<Napi::Number>().Int32Value() : 44100;
    config.channels = configObj.Has("channels")
        ? configObj.Get("channels").As<Napi::Number>().Int32Value() : 1;
    config.bufferSizeFrames = configObj.Has("bufferSizeFrames")
        ? configObj.Get("bufferSizeFrames").As<Napi::Number>().Int32Value() : 256;
    config.exclusiveMode = configObj.Has("exclusiveMode")
        ? configObj.Get("exclusiveMode").As<Napi::Boolean>().Value() : true;

    // Create ThreadSafeFunction for audio callback
    auto tsfn = Napi::ThreadSafeFunction::New(
        env,
        info[1].As<Napi::Function>(),
        "luxsync_audio_data",
        2,   // max queue size (double buffer)
        1    // 1 initial thread
    );

    auto stream = createCaptureStream();
    int handle = g_nextHandle++;

    // Audio callback: runs on audio thread, marshals to JS via TSFN
    auto callback = [tsfn](const float* data, int frameCount, int channels, int sampleRate) mutable {
        // Copy data to heap — audio thread cannot block
        int totalSamples = frameCount * channels;
        auto dataCopy = std::make_shared<std::vector<float>>(data, data + totalSamples);
        int fc = frameCount;
        int ch = channels;
        int sr = sampleRate;

        tsfn.NonBlockingCall(
            [dataCopy, fc, ch, sr](Napi::Env env, Napi::Function jsCallback) {
                // Create Float32Array from captured data
                auto arrayBuffer = Napi::ArrayBuffer::New(
                    env,
                    const_cast<float*>(dataCopy->data()),
                    dataCopy->size() * sizeof(float)
                );
                auto float32Array = Napi::Float32Array::New(
                    env,
                    dataCopy->size(),
                    arrayBuffer,
                    0
                );

                jsCallback.Call({
                    float32Array,
                    Napi::Number::New(env, fc),
                    Napi::Number::New(env, ch),
                    Napi::Number::New(env, sr)
                });
            }
        );
    };

    bool started = stream->start(config, callback);
    if (!started) {
        tsfn.Release();
        Napi::Error::New(env, "Failed to start audio capture").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    {
        std::lock_guard<std::mutex> lock(g_streamsMutex);
        g_streams[handle] = std::move(stream);
    }

    return Napi::Number::New(env, handle);
}

// ============================================
// stopCapture(handle) → void
// ============================================

static Napi::Value StopCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle (number)").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int handle = info[0].As<Napi::Number>().Int32Value();

    {
        std::lock_guard<std::mutex> lock(g_streamsMutex);
        auto it = g_streams.find(handle);
        if (it != g_streams.end()) {
            it->second->stop();
            g_streams.erase(it);
        }
    }

    return env.Undefined();
}

// ============================================
// MODULE INIT
// ============================================

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("enumerateDevices", Napi::Function::New(env, EnumerateDevices));
    exports.Set("onDeviceChange", Napi::Function::New(env, OnDeviceChange));
    exports.Set("startCapture", Napi::Function::New(env, StartCapture));
    exports.Set("stopCapture", Napi::Function::New(env, StopCapture));
    return exports;
}

NODE_API_MODULE(luxsync_audio, Init)

} // namespace luxsync
