{
  "schemaVersion": "2.0.0",
  "name": "tester.v2",
  "description": "",
  "createdAt": "2026-01-26T22:40:41.278Z",
  "modifiedAt": "2026-01-26T23:27:22.377Z",
  "createdWith": "1.0.0",
  "stage": {
    "width": 12,
    "depth": 8,
    "height": 5,
    "gridSize": 0.5
  },
  "visuals": {
    "showGrid": true,
    "showBeams": true,
    "showZoneLabels": true,
    "showFixtureNames": false,
    "backgroundColor": "#0a0a12"
  },
  "fixtures": [
    {
      "id": "fixture-1769467246367",
      "name": "EL 1140",
      "model": "EL 1140",
      "manufacturer": "Chino",
      "type": "moving-head",
      "address": 50,
      "universe": 0,
      "channelCount": 10,
      "profileId": "944226ff-e66f-48db-a318-7bda149c9438",
      "position": {
        "x": -4.525274958466757,
        "y": 3,
        "z": -2.7995707345941714
      },
      "rotation": {
        "pitch": -45,
        "yaw": 0,
        "roll": 0
      },
      "physics": {
        "motorType": "stepper-cheap",
        "maxAcceleration": 1500,
        "maxVelocity": 400,
        "safetyCap": true,
        "orientation": "floor",
        "invertPan": false,
        "invertTilt": false,
        "swapPanTilt": false,
        "homePosition": {
          "pan": 127,
          "tilt": 127
        },
        "tiltLimits": {
          "min": 0,
          "max": 241
        }
      },
      "zone": "ceiling-left",
      "enabled": true,
      "definitionPath": "C:\\Users\\Raulacate\\AppData\\Roaming\\luxsync-electron\\fixtures\\EL_1140.json",
      "channels": [
        {
          "index": 0,
          "name": "Pan",
          "type": "pan",
          "is16bit": false
        },
        {
          "index": 1,
          "name": "Tilt",
          "type": "tilt",
          "is16bit": false
        },
        {
          "index": 2,
          "name": "Speed",
          "type": "speed",
          "is16bit": false
        },
        {
          "index": 3,
          "name": "Dimmer",
          "type": "dimmer",
          "is16bit": false
        },
        {
          "index": 4,
          "name": "Shutter",
          "type": "shutter",
          "is16bit": false
        },
        {
          "index": 5,
          "name": "Color Wheel",
          "type": "color_wheel",
          "is16bit": false
        },
        {
          "index": 6,
          "name": "Gobo",
          "type": "gobo",
          "is16bit": false
        },
        {
          "index": 7,
          "name": "Prism",
          "type": "prism",
          "is16bit": false
        },
        {
          "index": 8,
          "name": "Focus",
          "type": "focus",
          "is16bit": false
        },
        {
          "index": 9,
          "type": "unknown",
          "is16bit": false
        }
      ],
      "capabilities": {
        "hasMovementChannels": true,
        "has16bitMovement": false,
        "hasColorMixing": false,
        "hasColorWheel": true
      }
    }
  ],
  "groups": [],
  "scenes": [],
  "dmx": {
    "driver": "virtual",
    "port": "",
    "universes": [
      0
    ],
    "frameRate": 40
  },
  "audio": {
    "source": "simulation",
    "sensitivity": 0.7,
    "inputGain": 1
  },
  "defaultVibe": "techno-club",
  "seleneMode": "idle"
}
