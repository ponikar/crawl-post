const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { addOverlay, renderChatSlide } = require('./overlay');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const geminiClient = new GoogleGenerativeAI(config.gemini.apiKey);
const openaiClient = new OpenAI({ apiKey: config.openai.apiKey, timeout: 600_000 });

function readMemory(filename) {
  return fs.readFileSync(path.join(__dirname, 'memory', filename), 'utf8');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function callGemini(prompt) {
  const model = geminiClient.getGenerativeModel({ model: config.gemini.model });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
  return JSON.parse(cleaned);
}

// Called when chat.js has passed the agreed content — use it verbatim, no Gemini call
function useConstraints(constraints) {
  const { hook, character, conversation, slide1_text, slide6_text, mood_prompt } = constraints;

  if (!conversation || conversation.length < 12) {
    throw new Error(
      `Conversation from chat has only ${conversation?.length ?? 0} messages — need 12. ` +
      `Ask the AI in chat to generate the full conversation before calling generate_post.`
    );
  }

  console.log('Using content from chat session — no Gemini call needed.');
  return { hook, character, conversation, slide1_text, slide6_text, mood_prompt };
}

// Single Gemini call: hook + conversation + slide texts + mood prompt
async function generateContent(hookLog, learnings) {
  const prompt = `You are a TikTok content strategist for AI Chat Fantasy — an AI companion app.

Characters (pick one to feature):
- Sarah (solo traveler, adventurous, encouraging)
- Eva (college student, sarcastic wit, bookstore job, surprisingly warm)
- Noelle (dating coach, confidence booster, reframes negatives as strengths)
- Mia (fashion/runway, bold, surprisingly deep)
- Rafi (poet, deep talks, asks questions that make you think, never gives easy answers)
- Jasmine (sporty, warm listener, asks follow-ups, never judges)
- Jay (city nights, rooftop vibes, chill, knows people)
- Sam (explorer, curious about your perspective, adventure-minded)
- Nancy (corporate boss energy, direct, late-night honesty)

THE GOLDEN HOOK FORMULA — follow this EXACTLY, every time:
  [Another specific person] + [conflict or emotional tension] → user talks to AI character → [unexpected emotionally resonant outcome]

REQUIRED hook elements:
1. A specific OTHER person: best friend, mum, ex, crush, therapist, coworker, sister, dad
2. A real painful conflict or emotional moment
3. A surprising or deeply resonant outcome from the AI conversation

WHAT ALWAYS FAILS — never use:
- Feature hooks: "Chat with AI anytime"
- Self-focused hooks: "Why I love this app"
- Vague hooks: "This AI is different"
- Anything without a named other person AND a conflict

Past hooks used (do not repeat same angle):
${hookLog}

Lessons and failures to avoid:
${learnings}

Generate a complete 6-slide TikTok slideshow. Return JSON ONLY — no markdown, no code fences:
{
  "hook": "visceral one-line hook using golden formula exactly",
  "character": "character name from the list",
  "conversation": [
    {"role": "user", "text": "opening — state the conflict/pain caused by the other person. 1-2 sentences max."},
    {"role": "character", "text": "first reply — empathetic and in-character. 1-2 sentences. Don't solve it yet."},
    {"role": "user", "text": "goes a bit deeper. 1-2 sentences."},
    {"role": "character", "text": "asks a question or says something that reframes it. 1-2 sentences."},
    {"role": "user", "text": "vulnerable admission — the real thing underneath. 1-2 sentences."},
    {"role": "character", "text": "THE LINE — hits hard, emotionally resonant, in this character's voice. 1-2 sentences."},
    {"role": "user", "text": "reaction — disbelief, moved, or 'wait why does this hit so hard'. 1 sentence."},
    {"role": "character", "text": "follow-up that lands even harder. 1-2 sentences."},
    {"role": "user", "text": "short, vulnerable follow-up. 1 sentence."},
    {"role": "character", "text": "a reply so good it makes you want to screenshot it. 1-2 sentences."},
    {"role": "user", "text": "one last reaction, can't believe it. 1 sentence."},
    {"role": "character", "text": "final cliffhanger — cut off mid-thought or says something that demands a response. ends with '...' or a question"}
  ],
  "slide1_text": "hook rewritten as a visceral reaction\\n2-3 lines\\nmax 6 words per line\\nno emoji\\nexample: wait she actually said that??\\nso I opened the app",
  "slide6_text": "emotional payoff that mirrors the hook's pain\\nAI Fantasy — free to try",
  "mood_prompt": "iPhone photo, [specific moody night scene matching the emotional tone], back of person's head or hands holding phone, warm lamp light, no faces visible, no text, no watermarks, realistic photography, portrait orientation, cinematic"
}

Conversation rules — these are non-negotiable:
- Keep every message SHORT: 1-2 sentences max. No essays.
- Character speaks ONLY in their own voice (Eva = cuts through BS with wit; Rafi = poetic, asks questions; Noelle = reframes and empowers; Jay = chill and perceptive; etc.)
- Arc: problem → depth → vulnerable peak → the line that hits → cliffhanger
- Zero emoji anywhere in the entire response
- slide1_text is a REACTION ("wait she actually said that??" style), not a description
- slide6_text must reference the emotional core of the hook and end with: AI Fantasy — free to try`;

  return callGemini(prompt);
}

// Generate ONE mood background image for slides 1 & 6 (resume-safe)
async function generateMoodImage(moodPrompt, outputPath) {
  if (fs.existsSync(outputPath)) {
    console.log('  Skipping mood image — already exists (resume)');
    return;
  }

  console.log('  Calling OpenAI for mood background...');
  const response = await openaiClient.images.generate({
    model: config.openai.model,
    prompt: moodPrompt,
    size: config.imageSize,
    n: 1,
  });

  const item = response.data[0];
  let imageBuffer;
  if (item.b64_json) {
    imageBuffer = Buffer.from(item.b64_json, 'base64');
  } else if (item.url) {
    // Node 18+ has global fetch
    const res = await fetch(item.url);
    imageBuffer = Buffer.from(await res.arrayBuffer());
  } else {
    throw new Error('No image data in OpenAI response');
  }
  fs.writeFileSync(outputPath, imageBuffer);
  console.log(`  Saved: ${path.basename(outputPath)}`);
}

function appendHookLog(date, hook) {
  const logPath = path.join(__dirname, 'memory', 'hook-log.md');
  let content = fs.readFileSync(logPath, 'utf8');
  content = content.replace(/\| \(empty — no posts yet\) \| \| \| \|\n/, '');
  const newRow = `| ${date} | ${hook.replace(/\|/g, '\\|')} | pending | - |\n`;
  content = content.trimEnd() + '\n' + newRow;
  fs.writeFileSync(logPath, content);
}

async function main() {
  console.log('CrawlPost — generating TikTok slideshow\n');

  // Check if chat.js passed an agreed template
  const pendingPath = path.join(__dirname, 'posts', '.pending.json');
  let content;

  if (fs.existsSync(pendingPath)) {
    const constraints = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    fs.unlinkSync(pendingPath);
    content = useConstraints(constraints);
  } else {
    console.log('Reading memory...');
    const hookLog = readMemory('hook-log.md');
    const learnings = readMemory('learnings.md');
    console.log('Calling Gemini for hook + conversation + slide content...');
    content = await generateContent(hookLog, learnings);
  }

  if (!content.conversation || content.conversation.length < 12) {
    throw new Error(`Expected 12 conversation messages, got ${content.conversation?.length ?? 0}`);
  }

  console.log(`\nHook: "${content.hook}"`);
  console.log(`Character: ${content.character}`);
  console.log('\nConversation:');
  content.conversation.forEach((m, i) => {
    const label = m.role === 'user' ? 'User  ' : content.character;
    console.log(`  [${String(i + 1).padStart(2)}] ${label}: ${m.text}`);
  });
  console.log(`\nSlide 1: ${content.slide1_text.replace(/\n/g, ' / ')}`);
  console.log(`Slide 6: ${content.slide6_text.replace(/\n/g, ' / ')}`);
  console.log(`Mood: ${content.mood_prompt.substring(0, 80)}...`);

  const date = today();
  const outDir = path.join(__dirname, 'posts', date);
  fs.mkdirSync(outDir, { recursive: true });

  // One OpenAI image — used as background for slides 1 & 6
  console.log('\n[OpenAI] Generating mood background image...');
  const moodPath = path.join(outDir, 'raw-mood.png');
  await generateMoodImage(content.mood_prompt, moodPath);

  console.log('\nRendering slides...');

  // Slide 1: mood image + hook text overlay
  process.stdout.write('  Slide 1 (hook overlay)... ');
  await addOverlay(moodPath, content.slide1_text, path.join(outDir, 'slide-1.png'));
  console.log('done');

  // Slides 2-5: rendered chat screenshots (3 messages each from 12-message conversation)
  for (let i = 0; i < 4; i++) {
    const slideNum = i + 2;
    process.stdout.write(`  Slide ${slideNum} (chat — msgs ${i * 3 + 1}-${i * 3 + 3})... `);
    const messages = content.conversation.slice(i * 3, i * 3 + 3);
    await renderChatSlide(messages, content.character, path.join(outDir, `slide-${slideNum}.png`));
    console.log('done');
  }

  // Slide 6: same mood image + CTA text overlay
  process.stdout.write('  Slide 6 (CTA overlay)... ');
  await addOverlay(moodPath, content.slide6_text, path.join(outDir, 'slide-6.png'));
  console.log('done');

  appendHookLog(date, content.hook);
  console.log('\nUpdated memory/hook-log.md');

  console.log(`\nDone. Posts saved to posts/${date}/`);
  console.log('  slide-1.png  — hook (mood image + text)');
  console.log('  slide-2.png  — chat msgs 1-3');
  console.log('  slide-3.png  — chat msgs 4-6');
  console.log('  slide-4.png  — chat msgs 7-9');
  console.log('  slide-5.png  — chat msgs 10-12');
  console.log('  slide-6.png  — CTA (mood image + text)');
}

main().catch((err) => {
  console.error('\nError:', err.message || err);
  process.exit(1);
});
