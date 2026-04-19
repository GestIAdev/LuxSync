{
  "targets": [
    {
      "target_name": "luxsync_audio",
      "sources": [
        "src/luxsync_audio.cpp",
        "src/device_enumerator.cpp",
        "src/capture_stream.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_VERSION=8",
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        ["OS=='win'", {
          "sources": [
            "src/platform/wasapi_capture.cpp",
            "src/platform/wasapi_enumerator.cpp"
          ],
          "libraries": [
            "-lole32",
            "-lmmdevapi",
            "-lavrt"
          ],
          "defines": [
            "LUXSYNC_PLATFORM_WINDOWS"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": ["/std:c++17"],
              "ExceptionHandling": 1
            }
          }
        }],
        ["OS=='mac'", {
          "sources": [
            "src/platform/coreaudio_capture.cpp",
            "src/platform/coreaudio_enumerator.cpp"
          ],
          "link_settings": {
            "libraries": [
              "-framework CoreAudio",
              "-framework AudioToolbox",
              "-framework CoreFoundation"
            ]
          },
          "defines": [
            "LUXSYNC_PLATFORM_MACOS"
          ],
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "MACOSX_DEPLOYMENT_TARGET": "11.0"
          }
        }],
        ["OS=='linux'", {
          "sources": [
            "src/platform/jack_capture.cpp",
            "src/platform/jack_enumerator.cpp"
          ],
          "libraries": [
            "-ljack"
          ],
          "defines": [
            "LUXSYNC_PLATFORM_LINUX"
          ],
          "cflags_cc": ["-std=c++17"]
        }]
      ]
    }
  ]
}
