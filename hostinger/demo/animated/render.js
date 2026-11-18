// Records video.html frame by frame into an MP4.
//   node render.js out.mp4            -> full video, 30 fps
//   node render.js --stills dir 4 9   -> PNG stills at the given seconds (for checking)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'video.html') + '?record');
  await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => i.onload = i.onerror = r))));
  await page.evaluate(() => document.fonts.ready);

  if (args[0] === '--stills') {
    const dir = args[1]; fs.mkdirSync(dir, { recursive: true });
    for (const s of args.slice(2)) {
      await page.evaluate(t => render(+t), s);
      await page.screenshot({ path: path.join(dir, `t${String(s).padStart(5, '0')}.png`) });
    }
    await browser.close(); return;
  }

  const out = args[0] || 'out.mp4', fps = 30;
  const total = await page.evaluate(() => TOTAL);
  const frames = Math.round(total * fps);
  // the voice track from voice.py is added when it exists
  const voice = path.join(__dirname, 'voice', 'voiceover.wav');
  const audio = fs.existsSync(voice) ? ['-i', voice, '-c:a', 'aac', '-b:a', '128k', '-shortest'] : [];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => render(t), f / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('done', out, total.toFixed(1) + 's');
})();
