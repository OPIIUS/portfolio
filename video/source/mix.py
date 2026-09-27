import json, numpy as np, soundfile as sf
SR=48000; tl=json.load(open("timeline.json")); TOT=tl["TOTAL"]+0.2; N=int(TOT*SR)
rng=np.random.default_rng(7); t=np.arange(N)/SR
def midi(m): return 440*2**((m-69)/12)
def onepole(x,fc):
    a=np.exp(-2*np.pi*fc/SR); y=np.empty_like(x); s=0.0
    # vectorized via lfilter-like loop in chunks (scipy-free)
    from itertools import accumulate
    for i in range(len(x)): s=a*s+(1-a)*x[i]; y[i]=s
    return y
# --- pad: chords every 4s (BPM 90 feel), soft harmonics, stereo detune
prog=[[50,57,62,66,69,76],[47,54,62,66,69,74],[43,55,59,62,66,71],[45,52,57,61,64,71]]  # Dmaj9, Bm11, Gmaj7(9), A6/9
CH=4.0; padL=np.zeros(N); padR=np.zeros(N)
for ci in range(int(TOT/CH)+2):
    notes=prog[ci%4]; st=ci*CH; a=int(max(0,st-1.2)*SR); b=min(N,int((st+CH+1.6)*SR))
    if a>=N: break
    tt=np.arange(b-a)/SR; L=len(tt); env=np.minimum(1,tt/1.4)*np.minimum(1,(L/SR-tt)/1.6)
    for n in notes:
        f=midi(n)
        for d,arr in ((-0.12,padL),(0.12,padR)):
            ff=f*2**(d/1200*10)
            w=np.sin(2*np.pi*ff*tt)+0.28*np.sin(2*np.pi*2*ff*tt+1)+0.1*np.sin(2*np.pi*3*ff*tt+2)
            arr[a:b]+=w*env*(0.055 if n>52 else 0.08)
# sub bass root
bass=np.zeros(N)
for ci in range(int(TOT/CH)+1):
    st=int(ci*CH*SR); en=min(N,int((ci+1)*CH*SR)); tt=np.arange(en-st)/SR
    if st>=N: break
    f=midi(prog[ci%4][0]-12); env=np.minimum(1,tt/0.3)*np.exp(-tt*0.35)
    bass[st:en]+=np.sin(2*np.pi*f*tt)*env*0.16
# pluck arpeggio 8th notes at 90bpm (0.333s), from pain scene until outcome end
arp=np.zeros(N); step=60/90/2
arp_start=7.6; arp_end=tl["S"][-1]["start"]+6
k=0; tt0=arp_start
while tt0<arp_end:
    ci=int(tt0/CH); notes=prog[ci%4]; pat=[3,4,5,4,2,4,5,3]; n=notes[pat[k%8]]+12
    s=int(tt0*SR); L=int(0.9*SR); e=min(N,s+L); tt=np.arange(e-s)/SR; f=midi(n)
    arp[s:e]+=(np.sin(2*np.pi*f*tt)+0.2*np.sin(2*np.pi*2*f*tt))*np.exp(-tt*6)*0.05*(0.8+0.2*(k%2==0))
    k+=1; tt0+=step
# fade arp in/out
arp*=np.clip((t-arp_start)/3,0,1)*np.clip((arp_end-t)/2,0,1)
mL=padL+bass+arp*0.9; mR=padR+bass+arp*1.1
# simple stereo delay/reverb on music
def delay(x,sec,g):
    d=int(sec*SR); y=x.copy(); y[d:]+=x[:-d]*g; return y
mL=delay(delay(mL,0.29,0.28),0.53,0.18); mR=delay(delay(mR,0.37,0.28),0.61,0.18)
# --- voice
vo=np.zeros(N); vmask=np.zeros(N)
for s in tl["S"]:
    x,_=sf.read(f"vo48/{s['key']}.wav"); a=int(s["vo"]*SR); b=min(N,a+len(x)); vo[a:b]+=x[:b-a]; vmask[a:b]=1
# duck envelope: smooth mask
from numpy.lib.stride_tricks import sliding_window_view
k=int(0.35*SR); c=np.concatenate([[0],np.cumsum(vmask)]); sm=np.zeros(N)
lo=np.clip(np.arange(N)-k,0,N); hi=np.clip(np.arange(N)+k,0,N); sm=(c[hi]-c[lo])/(hi-lo+1e-9)
duck=10**((-1*(1-sm)*0 - sm*9)/20)   # -9 dB under voice
mfade=np.clip(t/1.5,0,1)*np.clip((TOT-t)/2.5,0,1)
mL*=duck*mfade*0.5; mR*=duck*mfade*0.5
# --- clicks + whooshes
fx=np.zeros(N)
for ct in tl["CLK"]:
    s=int(ct*SR); L=int(0.03*SR); tt=np.arange(L)/SR
    fx[s:s+L]+=(np.sin(2*np.pi*2400*tt)*0.5+rng.standard_normal(L)*0.3)*np.exp(-tt*260)*0.22
noise=rng.standard_normal(N)
for s in tl["S"][1:]:
    c0=s["start"]; a=int((c0-0.7)*SR); b=int((c0+0.4)*SR); tt=np.arange(b-a)/SR; L=tt[-1]
    env=np.sin(np.pi*np.clip(tt/L,0,1))**3
    nz=noise[a:b]; nz=np.convolve(nz,np.ones(40)/40,"same")  # soft lowpass
    fx[a:b]+=nz*env*0.12
np.save("music_rms.npy",np.array([0]))
out=np.stack([mL+vo*0.95+fx, mR+vo*0.95+fx],1)
out/=np.max(np.abs(out))*1.12
sf.write("mix.wav",out,SR); print("ok",out.shape[0]/SR)
