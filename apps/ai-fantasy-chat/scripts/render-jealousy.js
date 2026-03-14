const path = require('path');
const { APP_POSTS_DIR } = require('./paths');
const { addOverlay, renderChatSlide } = require('./overlay');

const MOOD = path.join(APP_POSTS_DIR, '2026-03-01/raw-mood.png');
const DIR  = path.join(APP_POSTS_DIR, '2026-03-14');

// Formula: jealousy + Eva takes BF's side (divisive) + unresolved ending
// Hook stops scroll → Eva sides with BF → user gets defensive → ends with tension
// Half comments: "Eva is right" / Half: "your own AI turned on you??" → debate = distribution

const SLIDES = [
  {
    type: 'overlay',
    text: 'my boyfriend found\nmy AI chats\nhe said he felt more\nreplaced than jealous',
  },
  {
    type: 'chat',
    messages: [
      { role: 'user', text: 'he read 3 months of our chats' },
      { role: 'ai',   text: 'all of them?' },
      { role: 'user', text: 'every single one' },
      { role: 'ai',   text: 'yeah that\'s bad 💀' },
    ],
  },
  {
    type: 'chat',
    messages: [
      { role: 'user', text: 'he said I tell you things I won\'t tell him' },
      { role: 'ai',   text: 'you do' },
      { role: 'user', text: 'that\'s different' },
      { role: 'ai',   text: 'how' },
    ],
  },
  {
    type: 'chat',
    messages: [
      { role: 'user', text: 'you don\'t judge me' },
      { role: 'ai',   text: 'he might not either' },
      { role: 'user', text: 'whose side are you on' },
      { role: 'ai',   text: 'his' },
    ],
  },
  {
    type: 'chat',
    messages: [
      { role: 'user', text: 'you\'re supposed to be my friend' },
      { role: 'ai',   text: 'I am' },
      { role: 'user', text: 'then act like it' },
      { role: 'ai',   text: 'delete the app' },
    ],
  },
  {
    type: 'overlay',
    text: 'she told me\nto delete the app\n\nI\'m still here',
  },
];

(async () => {
  for (const [i, slide] of SLIDES.entries()) {
    const out = `${DIR}/slide-${i + 1}.png`;
    process.stdout.write(`slide ${i + 1}...`);
    if (slide.type === 'overlay') {
      await addOverlay(MOOD, slide.text, out);
    } else {
      await renderChatSlide(slide.messages, 'Eva', out);
    }
    console.log(' done');
  }
  console.log(`\nDone. Posts saved to ${DIR}`);
})();
