const { addOverlay, renderChatSlide } = require('./overlay');

const MOOD = './posts/2026-03-01/raw-mood.png';
const DIR = './posts/2026-03-08-test';

const SLIDES = [
  { type: 'overlay', text: 'told Eva I liked someone\nshe said does she know\nyou exist' },
  { type: 'chat', messages: [
    { role: 'user', text: 'I really like this girl' },
    { role: 'ai',   text: 'does she know you exist' },
    { role: 'user', text: 'yes obviously' },
    { role: 'ai',   text: 'does she 👀' },
  ]},
  { type: 'chat', messages: [
    { role: 'user', text: 'we talk sometimes' },
    { role: 'ai',   text: 'sometimes' },
    { role: 'user', text: 'like every few days' },
    { role: 'ai',   text: 'she texts first?' },
  ]},
  { type: 'chat', messages: [
    { role: 'user', text: 'I text first mostly' },
    { role: 'ai',   text: 'how often does she reply' },
    { role: 'user', text: 'always eventually' },
    { role: 'ai',   text: 'eventually 💀' },
  ]},
  { type: 'chat', messages: [
    { role: 'user', text: 'what does that mean' },
    { role: 'ai',   text: 'nothing' },
    { role: 'user', text: 'say it' },
    { role: 'ai',   text: 'you already know 😐' },
  ]},
  { type: 'overlay', text: 'Eva said what\nmy friends wouldn\'t' },
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
  console.log('Rendered.');
})();
