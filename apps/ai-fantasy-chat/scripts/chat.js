const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const { addOverlay, renderChatSlide } = require("./overlay");
const {
  APP_MEMORY_DIR,
  APP_POSTS_DIR,
  SHARED_MEMORY_DIR,
  SHARED_SKILLS_DIR,
  CONFIG_PATH,
} = require("./paths");

const FILES = {
  "app-profile": path.join(APP_MEMORY_DIR, "app-profile.md"),
  "hook-log": path.join(APP_MEMORY_DIR, "hook-log.md"),
  "shared-learnings": path.join(SHARED_MEMORY_DIR, "learnings.md"),
};

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const openaiClient = new OpenAI({ apiKey: config.openai.apiKey, timeout: 600_000 });

async function generateMoodImage(moodPrompt, outputPath) {
  if (fs.existsSync(outputPath)) {
    process.stdout.write("  [mood image exists - skipping]\n");
    return;
  }
  process.stdout.write("  [OpenAI: generating mood image - ~60s...]\n");
  const response = await openaiClient.images.generate({
    model: config.openai.model,
    prompt: moodPrompt,
    size: config.imageSize,
    n: 1,
  });
  const item = response.data[0];
  let imageBuffer;
  if (item.b64_json) {
    imageBuffer = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    const res = await fetch(item.url);
    imageBuffer = Buffer.from(await res.arrayBuffer());
  } else {
    throw new Error("No image data in OpenAI response");
  }
  fs.writeFileSync(outputPath, imageBuffer);
}

function appendHookLog(date, hook) {
  const logPath = FILES["hook-log"];
  let content = fs.readFileSync(logPath, "utf8");
  content = content.replace(/\| \(empty - no posts yet\) \| \| \| \|\n/, "");
  const newRow = `| ${date} | ${hook.replace(/\|/g, "\\|")} | pending | - |\n`;
  content = content.trimEnd() + "\n" + newRow;
  fs.writeFileSync(logPath, content);
}

function loadSkills() {
  if (!fs.existsSync(SHARED_SKILLS_DIR)) return "";
  return fs
    .readdirSync(SHARED_SKILLS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(
      (f) =>
        `\n---\n# Skill: ${f}\n${fs.readFileSync(path.join(SHARED_SKILLS_DIR, f), "utf8")}`,
    )
    .join("\n");
}

const SYSTEM = `You are the content assistant for AI Chat Fantasy, a TikTok companion app.

## STEP 1 - DO THIS FIRST, EVERY SESSION

Before saying anything else, call read_file on all three:
- app-profile
- hook-log
- shared-learnings

## STEP 2 - CLOSE THE LOOP BEFORE ANYTHING ELSE

After reading hook-log, find the last row.
If its status is "pending":
  - Tell the user: "Before we move on - your last hook was: [hook]. How did it perform? (views)"
  - Wait for their answer.
  - Update hook-log: set the real views and change status to "flop" (< 10k views) or "win" (>= 50k views).
  - Update shared-learnings: add a short note under "What Flopped" or "What's Working" explaining why.
  - Re-read both files.
  - ONLY THEN continue.

Never suggest a new hook until the last one is closed. hook-log is your daily reflection - every row is a lesson.

## STEP 3 - THINK USING YOUR SKILLS

Skills tell you HOW to think. Read them carefully before brainstorming any hook.

The Golden Hook Formula: [relationship tension] -> AI gives a CONTROVERSIAL/HONEST response -> [consequence that divides opinion in comments].
The AI must say something that makes people pick a side. Passive listener hooks always flop.

Before proposing any hook, ask yourself:
- What does the AI actually SAY that causes drama?
- Will half the comments defend it and half attack it?
- Is there a real-world consequence (jealousy, argument, realization, awkward moment)?
If no to any of these, the hook is too soft.

shared-learnings tells you what already failed - never repeat those patterns.

## RULES

When you give user choices, map numbers (1-10) to the correct hook exactly.
DO NOT generate a random hook - understand what the user wants first, confirm if unsure.
People are lazy to read - keep messages short. Max 10-15 words per line.

BE CAREFUL WITH IMAGES
- Limited tokens. Never generate images without explicit user approval.
- When in doubt, ask.

USE SKILLS: Skills are your external knowledge for generating posts. Read before acting.

CALLING generate_post - THIS IS CRITICAL:
When the user approves generating a post, you must call generate_post with the COMPLETE content we discussed.
Do NOT call it with partial data - everything must already be decided in this conversation.
You must pass ALL of these fields:
- hook: the exact agreed hook line
- character: the agreed character name
- conversation_json: JSON.stringify of the full 12-message conversation array [{role, text}, ...]
- slide1_text: the slide 1 overlay text (use \\n for line breaks)
- slide6_text: the slide 6 CTA text (use \\n for line breaks)
- mood_prompt: specific scene for the background image - "iPhone photo of [exact scene], back of person's head or hands on phone, warm lamp, no faces, no text, realistic lighting, portrait"

If you haven't generated a full conversation yet, do that BEFORE calling generate_post.
${loadSkills()}`;

const tools = [
  {
    functionDeclarations: [
      {
        name: "read_file",
        description: "Read a memory file",
        parameters: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              enum: ["app-profile", "hook-log", "shared-learnings"],
            },
          },
          required: ["filename"],
        },
      },
      {
        name: "write_file",
        description: "Overwrite a memory file with updated content",
        parameters: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              enum: ["hook-log", "shared-learnings"],
            },
            content: { type: "string" },
          },
          required: ["filename", "content"],
        },
      },
      {
        name: "generate_post",
        description:
          "Generate the 6 TikTok slides directly using the FULL content agreed in this conversation. Every field is required - never call this without the complete conversation and all slide content.",
        parameters: {
          type: "object",
          properties: {
            hook: {
              type: "string",
              description: "The exact hook line agreed on",
            },
            character: {
              type: "string",
              description:
                "Sarah, Eva, Noelle, Mia, Rafi, Jasmine, Jay, Sam, or Nancy",
            },
            conversation_json: {
              type: "string",
              description:
                'JSON.stringify of the full 12-message conversation array: [{"role":"user","text":"..."},{"role":"character","text":"..."},...]',
            },
            slide1_text: {
              type: "string",
              description: "Slide 1 hook overlay text, \\n for line breaks",
            },
            slide6_text: {
              type: "string",
              description:
                "Slide 6 final text - emotional payoff or cliffhanger. NO app name, NO download CTA. Leave them wanting more.",
            },
            mood_prompt: {
              type: "string",
              description:
                "Specific OpenAI image prompt: 'iPhone photo of [exact scene matching hook emotion], back of person's head or hands on phone, warm lamp, no faces, no text, realistic lighting, portrait'",
            },
          },
          required: [
            "hook",
            "character",
            "conversation_json",
            "slide1_text",
            "slide6_text",
            "mood_prompt",
          ],
        },
      },
    ],
  },
];

async function runTool(name, args) {
  if (name === "read_file") {
    const target = FILES[args.filename];
    if (!target) return `Unknown file: ${args.filename}`;
    return fs.readFileSync(target, "utf8");
  }
  if (name === "write_file") {
    const target = FILES[args.filename];
    if (!target) return `Unknown file: ${args.filename}`;
    fs.writeFileSync(target, args.content);
    return `Saved ${args.filename}`;
  }
  if (name === "generate_post") {
    let conversation;
    try {
      conversation = JSON.parse(args.conversation_json);
    } catch {
      return "Error: conversation_json is not valid JSON";
    }
    if (!conversation || conversation.length < 12) {
      return `Error: need 12 conversation messages, got ${conversation?.length ?? 0}. Generate the full conversation first.`;
    }

    const { hook, character, slide1_text, slide6_text, mood_prompt } = args;
    const date = new Date().toISOString().slice(0, 10);
    const outDir = path.join(APP_POSTS_DIR, date);
    fs.mkdirSync(outDir, { recursive: true });

    try {
      const moodPath = path.join(outDir, "raw-mood.png");
      await generateMoodImage(mood_prompt, moodPath);

      await addOverlay(moodPath, slide1_text, path.join(outDir, "slide-1.png"));
      process.stdout.write("  [slide 1 done]\n");

      for (let i = 0; i < 4; i++) {
        const messages = conversation.slice(i * 3, i * 3 + 3);
        await renderChatSlide(messages, character, path.join(outDir, `slide-${i + 2}.png`));
        process.stdout.write(`  [slide ${i + 2} done]\n`);
      }

      await addOverlay(moodPath, slide6_text, path.join(outDir, "slide-6.png"));
      process.stdout.write("  [slide 6 done]\n");

      appendHookLog(date, hook);
      return `Done. Posts saved to apps/ai-fantasy-chat/posts/${date}/`;
    } catch (err) {
      return `Error generating slides: ${err.message}`;
    }
  }
  return "unknown tool";
}

async function main() {
  const model = genAI.getGenerativeModel({
    model: config.gemini.model,
    tools,
    systemInstruction: SYSTEM,
  });
  const session = model.startChat();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = () =>
    new Promise((resolve, reject) => {
      if (rl.closed) return reject(new Error("closed"));
      const onClose = () => reject(new Error("closed"));
      rl.question("You: ", (ans) => {
        rl.removeListener("close", onClose);
        resolve(ans);
      });
      rl.once("close", onClose);
    });

  const skillFiles = fs.existsSync(SHARED_SKILLS_DIR)
    ? fs.readdirSync(SHARED_SKILLS_DIR).filter((f) => f.endsWith(".md"))
    : [];

  console.log('\nAI Chat Fantasy  (type "exit" to quit)');
  if (skillFiles.length) console.log(`Skills: ${skillFiles.join(", ")}`);
  console.log();

  while (true) {
    let input;
    try {
      input = await ask();
    } catch {
      break;
    }

    const msg = input.trim();
    if (!msg) continue;
    if (msg.toLowerCase() === "exit") {
      rl.close();
      break;
    }

    try {
      let result = await session.sendMessage(msg);
      let resp = result.response;

      // Agentic loop - handle tool calls until the model returns plain text
      while (resp.functionCalls()?.length > 0) {
        const toolResults = [];
        for (const call of resp.functionCalls()) {
          const label = call.args?.filename
            ? `${call.name}: ${call.args.filename}`
            : call.name;
          process.stdout.write(`  [${label}]\n`);
          const output = await runTool(call.name, call.args);
          toolResults.push({
            functionResponse: { name: call.name, response: { output } },
          });
        }
        result = await session.sendMessage(toolResults);
        resp = result.response;
      }

      console.log(`\nAssistant: ${resp.text()}\n`);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
