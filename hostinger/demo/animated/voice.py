"""Make the voiceover and the timeline for video.html.

  python voice.py <piper-binary> <voice.onnx>

Reads script.json, speaks every line with Piper (a free, offline voice),
then writes:
  voice/voiceover.wav  - the full voice track, lines placed at their times
  timeline.js          - window.TL = {...}: when each scene and line starts
"""
import json, subprocess, sys, wave, os

HERE = os.path.dirname(os.path.abspath(__file__))
PIPER, MODEL = sys.argv[1], sys.argv[2]
LENGTH = 1.06          # >1 = slower, calmer speech
GAP = 0.9              # silence between lines (s)
LEAD = 1.3             # time a new scene's title is shown before the voice starts
TAIL = 1.2             # pause after a scene's last line

os.makedirs(os.path.join(HERE, 'voice'), exist_ok=True)
data = json.load(open(os.path.join(HERE, 'script.json')))

def speak(text, name):
    path = os.path.join(HERE, 'voice', name + '.wav')
    subprocess.run([PIPER, '-m', MODEL, '-f', path, '--length-scale', str(LENGTH),
                    '--sentence-silence', '0.45'], input=text.encode(), check=True, capture_output=True)
    with wave.open(path) as w:
        return path, w.getnframes() / w.getframerate()

clips = []                                    # (path, start)
t = 0.0
p, d = speak(data['intro']['say'], 'intro')
clips.append((p, 1.2)); intro_end = 1.2 + d + 1.2
t = intro_end
scenes = []
for i, sc in enumerate(data['scenes']):
    start = t; lines = []; vt = start + LEAD
    for k, ln in enumerate(sc['lines']):
        p, d = speak(ln['say'], f's{i:02d}_{k}')
        clips.append((p, vt))
        lines.append(dict(shot=ln['shot'], focus=ln['focus'], tap=ln['tap'], cap=ln['cap'], t0=vt, t1=vt + d))
        vt += d + GAP
    end = lines[-1]['t1'] + TAIL
    scenes.append(dict(title=sc['title'], start=start, end=end, lines=lines))
    t = end
p, d = speak(data['outro']['say'], 'outro')
outro_start = t; clips.append((p, outro_start + 1.4))
total = outro_start + 1.4 + d + 2.5

tl = dict(introEnd=intro_end, outroStart=outro_start, total=total, scenes=scenes)
open(os.path.join(HERE, 'timeline.js'), 'w').write('window.TL = ' + json.dumps(tl, indent=1) + ';\n')

# place every clip at its time on one track
inputs, filters = [], []
for n, (path, st) in enumerate(clips):
    inputs += ['-i', path]
    ms = int(round(st * 1000))
    filters.append(f'[{n}:a]aresample=48000,adelay={ms}|{ms}[a{n}]')
mix = ''.join(f'[a{n}]' for n in range(len(clips)))
filters.append(f'{mix}amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{total:.3f},'
               'highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=10:release=200,'
               'loudnorm=I=-16:TP=-1.5:LRA=11[out]')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filters),
                '-map', '[out]', '-ar', '48000', '-ac', '1', os.path.join(HERE, 'voice', 'voiceover.wav')], check=True)
print(f'{len(clips)} lines, total {total:.1f}s')
