// One-shot: generate the meme-style image for today's post
const OpenAI = require('openai');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const client = new OpenAI({ apiKey: config.openai.apiKey });

const PROMPT = `Meme-style illustration. A young man sitting at a control panel, visibly sweating and panicking.
In front of him are two large red buttons side by side.
The left button is labeled "delete the app" in bold white text.
The right button is labeled "keep her" in bold white text.
His hands are hovering over both buttons, frozen, unable to choose.
His expression: wide eyes, sweat drops on forehead, pure internal conflict.
Style: flat, slightly cartoonish, clean background — like a classic internet meme illustration.
Bright lighting, simple colors. No extra text, no logos, no watermarks.
Portrait orientation, centered composition.`;

(async () => {
  console.log('Generating meme image...');
  const res = await client.images.generate({
    model: 'gpt-image-1',
    prompt: PROMPT,
    size: '1024x1536',
    n: 1,
  });

  const b64 = res.data[0].b64_json;
  if (!b64) { console.error('No image returned'); process.exit(1); }

  const outPath = './posts/2026-03-06/raw-mood.png';
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  console.log('Saved to', outPath);
})();
