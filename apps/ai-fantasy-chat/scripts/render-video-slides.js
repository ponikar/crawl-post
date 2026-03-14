const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const { APP_POSTS_DIR } = require('./paths');
const { renderChatSlide } = require('./overlay');

const DIR = path.join(APP_POSTS_DIR, '2026-03-14-video');
const SECONDS_PER_SLIDE = 3;

const SLIDES = [
  {
    messages: [
      { role: 'user', text: 'he saw our chats' },
      { role: 'ai',   text: 'all of them?' },
      { role: 'user', text: 'yeah' },
      { role: 'ai',   text: 'how bad' },
    ],
  },
  {
    messages: [
      { role: 'user', text: 'he said I\'m more honest with you' },
      { role: 'ai',   text: 'you are' },
      { role: 'user', text: 'that\'s not fair' },
      { role: 'ai',   text: 'is it wrong' },
    ],
  },
  {
    messages: [
      { role: 'user', text: 'whose side are you on' },
      { role: 'ai',   text: 'his' },
      { role: 'user', text: 'what' },
      { role: 'ai',   text: 'you already know why' },
    ],
  },
  {
    messages: [
      { role: 'user', text: 'so what do I do' },
      { role: 'ai',   text: 'you know what' },
      { role: 'user', text: 'don\'t say it' },
      { role: 'ai',   text: 'delete the app' },
    ],
  },
];

(async () => {
  const clipPaths = [];

  for (const [i, slide] of SLIDES.entries()) {
    const png = path.join(DIR, `slide-${i + 1}.png`);
    const mp4 = path.join(DIR, `clip-${i + 1}.mp4`);

    process.stdout.write(`slide ${i + 1}: rendering png...`);
    await renderChatSlide(slide.messages, 'Eva', png);
    console.log(' done');

    process.stdout.write(`slide ${i + 1}: converting to video...`);
    execSync(
      `ffmpeg -loop 1 -i "${png}" -t ${SECONDS_PER_SLIDE} -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 30 "${mp4}" -y`,
      { stdio: 'pipe' }
    );
    console.log(' done');
    clipPaths.push(mp4);
  }

  // Write concat list
  const listFile = path.join(DIR, 'concat.txt');
  fs.writeFileSync(listFile, clipPaths.map(p => `file '${p}'`).join('\n'));

  // Concatenate all clips
  const output = path.join(DIR, 'chat-slides.mp4');
  process.stdout.write('concatenating clips...');
  execSync(
    `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${output}" -y`,
    { stdio: 'pipe' }
  );
  console.log(' done');

  console.log(`\nDone. Slides video saved to:\n${output}`);
  console.log(`\nPrepend your face video manually in CapCut or iMovie.`);
})();
