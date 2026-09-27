set -e
cd "$(dirname "$0")"; source ff.env
# master 1080p
$FF -y -loglevel error -framerate 30 -i frames/f%05d.jpg -i mix.wav -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 160k -ar 48000 -shortest tour-desk-demo-1080p.mp4
# web / WhatsApp 720p (small)
$FF -y -loglevel error -i tour-desk-demo-1080p.mp4 -vf scale=1280:720:flags=lanczos -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k tour-desk-demo-720p.mp4
# poster from the quote scene
$FF -y -loglevel error -ss 20.3 -i tour-desk-demo-1080p.mp4 -frames:v 1 -vf scale=1280:720 -q:v 3 tour-desk-poster.jpg
ls -la *.mp4 *.jpg
