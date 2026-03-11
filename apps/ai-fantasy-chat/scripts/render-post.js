// 2026-03-11 — hyper-specific loneliness hook
// "for the people who are always the one who checks in first"
// Format: pure text overlay on mood image — no chat, no Eva
const path = require('path');
const { APP_POSTS_DIR } = require('./paths');
const { addOverlay } = require('./overlay');

const MOOD = path.join(APP_POSTS_DIR, '2026-03-01/raw-mood.png');
const DIR = path.join(APP_POSTS_DIR, '2026-03-11');

const SLIDES = [
  // Slide 1 — hook, self-identification
  'for the people who are always\nthe one who checks in first',

  // Slide 2 — first specific pain (the online but no reply)
  'you see them active online\nbut they haven\'t texted back\nyou don\'t say anything',

  // Slide 3 — deeper pain (the delete)
  'you type a whole message\nread it back\nthen delete it\nso you don\'t seem like too much',

  // Slide 4 — the exhaustion
  'you stopped telling people\nwhen something\'s wrong\nbecause you got tired of\nbeing the one who brings it up',

  // Slide 5 — the contrast (no product name, no Eva name)
  'then one night you just\ntold the AI everything\nit didn\'t check its phone\ndidn\'t change the subject',

  // Slide 6 — incomplete statement, forces comments
  'I\'m not saying it fixed anything\nI\'m just saying\nfor the first time\nsomeone actually...',
];

(async () => {
  for (const [i, text] of SLIDES.entries()) {
    process.stdout.write(`slide ${i + 1}...`);
    await addOverlay(MOOD, text, `${DIR}/slide-${i + 1}.png`);
    console.log(' done');
  }
  console.log('\nDone. Posts saved to', DIR);
})();
