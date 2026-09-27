import json, soundfile as sf, sys
sys.path.insert(0,"../tts")
from kokoro_onnx import Kokoro
k = Kokoro("../tts/kokoro.onnx", "../tts/voices-v1.0.bin")
out={}
for key,text in json.load(open("vo.json")):
    s, sr = k.create(text, voice="af_heart", speed=0.98, lang="en-us")
    sf.write(f"vo/{key}.wav", s, sr); out[key]=len(s)/sr; print(key, round(len(s)/sr,2))
json.dump(out, open("vo/durations.json","w"))
