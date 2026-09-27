# Tour Desk demo film: source

Rebuilds `../tour-desk-demo.mp4` (1920×1080, 30 fps, ~104 s) from the live `demos/tour-desk.html`.

1. **Voice-over**: `vo.json` holds one line per scene. `gen_vo.py` renders them with the open Kokoro TTS model
   (`pip install kokoro-onnx soundfile`; voice `af_heart`; model files from the kokoro-onnx GitHub releases in `../tts/`).
2. **Picture**: put `stage.html`, a copy of `demos/tour-desk.html` and a local Inter font in a `site/` folder. `render.py`
   drives the stage with Playwright under a fake clock and screenshots every frame. `ONLY=3,20,50 FPS=10` renders test stills.
3. **Sound**: `mix.py` synthesises the music bed, clicks and swooshes, ducks the music under the voice and writes `mix.wav`.
4. **Encode**: `encode.sh` makes the 1080p master, a 720p copy for WhatsApp, and the poster frame.
