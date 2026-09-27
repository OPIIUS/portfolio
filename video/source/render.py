import json, sys, os, subprocess, threading, http.server, functools, time
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
FPS=int(os.environ.get("FPS","30")); ONLY=os.environ.get("ONLY")  # ONLY="t1,t2,..." -> stills
dur=json.load(open(f"{HERE}/vo/durations.json")); vo={k:{"d":dur[k],"text":t} for k,t in json.load(open(f"{HERE}/vo.json"))}
# captions show the brand as written
for k in vo: vo[k]["text"]=vo[k]["text"].replace("Opius","OPIIUS")
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=f"{HERE}/site",**k)
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8765),Q); threading.Thread(target=srv.serve_forever,daemon=True).start()
os.makedirs(f"{HERE}/frames",exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    ctx=b.new_context(viewport={"width":1920,"height":1080},device_scale_factor=1)
    pg=ctx.new_page(); pg.on("console", lambda m: print("CONSOLE", m.text, flush=True))
    pg.clock.install()
    pg.goto("http://127.0.0.1:8765/stage.html"); pg.wait_for_load_state("networkidle")
    pg.evaluate("document.fonts.ready"); pg.frames[1].evaluate("document.fonts.ready")
    pg.evaluate("vo=>init(vo)", vo)
    total=pg.evaluate("TOTAL"); print("total",total, flush=True)
    stills=[float(x) for x in ONLY.split(",")] if ONLY else None
    n=int(total*FPS)+1; step=1000/FPS; last=0
    for i in range(n):
        t=i/FPS
        pg.clock.run_for(int(round(step)))
        pg.evaluate(f"render({t})")
        if stills is None:
            pg.screenshot(path=f"{HERE}/frames/f{i:05d}.jpg",type="jpeg",quality=94)
            if i%300==0: print(i,"/",n,flush=True)
        elif any(abs(t-s)<0.5/FPS for s in stills):
            pass
            pg.screenshot(path=f"{HERE}/frames/still_{t:06.2f}.png")
    b.close()
srv.shutdown()
