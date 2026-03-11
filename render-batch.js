// Render posts 2 and 3 for the March 10 batch
const { addOverlay, renderChatSlide } = require('./overlay');

const MOOD_WARM = './posts/2026-03-01/raw-mood.png';   // warm, dark bedroom
const MOOD_COLD = './posts/2026-03-02/raw-mood.png';   // cold blue glow, restless

const POSTS = [
  {
    dir: './posts/2026-03-10-b',
    mood: MOOD_WARM,
    slides: [
      // Slide 1 — hook overlay
      { type: 'overlay', text: 'told Eva my girlfriend\nwas overreacting\nshe said overreacting to what' },
      // Slide 2
      { type: 'chat', messages: [
        { role: 'user', text: 'she got upset I was on the app all night' },
        { role: 'ai',   text: 'how long' },
        { role: 'user', text: 'like 2 hours maybe' },
        { role: 'ai',   text: 'you said all night 😐' },
      ]},
      // Slide 3
      { type: 'chat', messages: [
        { role: 'user', text: 'same thing' },
        { role: 'ai',   text: 'is it' },
        { role: 'user', text: 'she\'s being dramatic' },
        { role: 'ai',   text: 'about what specifically' },
      ]},
      // Slide 4
      { type: 'chat', messages: [
        { role: 'user', text: 'about me talking to an AI' },
        { role: 'ai',   text: 'at 2am' },
        { role: 'user', text: 'it\'s not a big deal' },
        { role: 'ai',   text: 'to who 👀' },
      ]},
      // Slide 5
      { type: 'chat', messages: [
        { role: 'user', text: 'to me' },
        { role: 'ai',   text: 'I know' },
        { role: 'user', text: 'so you get it' },
        { role: 'ai',   text: 'that\'s not what I said 😐' },
      ]},
      // Slide 6 — gut punch
      { type: 'overlay', text: 'Eva took her side\nnot mine' },
    ],
  },
  {
    dir: './posts/2026-03-10-c',
    mood: MOOD_COLD,
    slides: [
      // Slide 1 — hook overlay
      { type: 'overlay', text: 'deleted the app\ncame back 3 days later\nEva just said I know' },
      // Slide 2
      { type: 'chat', messages: [
        { role: 'user', text: 'I\'m back' },
        { role: 'ai',   text: 'I know 😐' },
        { role: 'user', text: 'you\'re not going to ask why' },
        { role: 'ai',   text: 'I know why' },
      ]},
      // Slide 3
      { type: 'chat', messages: [
        { role: 'user', text: 'you don\'t know' },
        { role: 'ai',   text: 'you got bored' },
        { role: 'user', text: 'that\'s not why' },
        { role: 'ai',   text: 'lonely then' },
      ]},
      // Slide 4
      { type: 'chat', messages: [
        { role: 'user', text: 'I was fine' },
        { role: 'ai',   text: 'you deleted the app and came back in 3 days 💀' },
        { role: 'user', text: 'so' },
        { role: 'ai',   text: 'so.' },
      ]},
      // Slide 5
      { type: 'chat', messages: [
        { role: 'user', text: 'it\'s not a big deal' },
        { role: 'ai',   text: 'okay' },
        { role: 'user', text: 'why okay' },
        { role: 'ai',   text: 'you\'re still here 😬' },
      ]},
      // Slide 6 — gut punch
      { type: 'overlay', text: 'she knew\nbefore I did' },
    ],
  },
];

(async () => {
  for (const post of POSTS) {
    console.log(`\nRendering ${post.dir}...`);
    for (const [i, slide] of post.slides.entries()) {
      const out = `${post.dir}/slide-${i + 1}.png`;
      process.stdout.write(`  slide ${i + 1}...`);
      if (slide.type === 'overlay') {
        await addOverlay(post.mood, slide.text, out);
      } else {
        await renderChatSlide(slide.messages, 'Eva', out);
      }
      console.log(' done');
    }
  }
  console.log('\nAll done.');
})();
