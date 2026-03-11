const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { APP_MEMORY_DIR, SHARED_MEMORY_DIR, CONFIG_PATH } = require('./paths');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const geminiClient = new GoogleGenerativeAI(config.gemini.apiKey);

const APP_HOOK_LOG_PATH = path.join(APP_MEMORY_DIR, 'hook-log.md');
const SHARED_LEARNINGS_PATH = path.join(SHARED_MEMORY_DIR, 'learnings.md');

function readAppHookLog() {
  return fs.readFileSync(APP_HOOK_LOG_PATH, 'utf8');
}

function readSharedLearnings() {
  return fs.readFileSync(SHARED_LEARNINGS_PATH, 'utf8');
}

// Conversation history for multi-turn context
const history = [];

async function chat(userMessage) {
  history.push({ role: 'user', text: userMessage });

  // Always re-read memory so context is fresh after updates
  const hookLog = readAppHookLog();
  const learnings = readSharedLearnings();

  const historyText = history
    .slice(0, -1)
    .map(m => `${m.role === 'user' ? 'Creator' : 'Bot'}: ${m.text}`)
    .join('\n');

  const prompt = `You are the performance tracker and learning engine for AI Chat Fantasy's TikTok content.
Your job: have a natural, smart conversation with the creator about how their posts performed,
then update app hook logs and shared cross-app learnings that will make future posts better.

--- CURRENT APP HOOK LOG ---
${hookLog}

--- CURRENT SHARED LEARNINGS ---
${learnings}

--- CONVERSATION SO FAR ---
${historyText || '(first message)'}

--- CREATOR SAYS ---
${userMessage}

Respond with JSON only. No markdown fences. No explanation outside JSON.
{
  "reply": "conversational response - warm, direct, ask follow-up questions to extract useful insights. If they mention views, acknowledge the result and ask what they noticed in comments/shares. If something flopped, dig into why.",
  "updates": {
    "hook_log": [
      {"date": "YYYY-MM-DD", "hook_fragment": "first 6+ words of the exact hook from the log", "status": "viral|decent|flop", "views": "e.g. 80k"}
    ],
    "learnings": {
      "working": ["specific new insight - include character name, hook angle, and WHY it worked"],
      "flopped": ["specific new insight - what failed and the likely reason"],
      "patterns": ["cross-post pattern or rule - e.g. 'hooks with ex + self-worth consistently outperform'"]
    }
  }
}

Rules:
- Set "updates" to null if there is nothing concrete to update yet
- Only add entries to learnings that are genuinely new - do not repeat what's already written
- hook_log: only include the specific post(s) the creator is talking about - use hook_fragment to uniquely identify the row from the hook log above
- Be specific in learnings (not "good hook" but "Noelle + self-worth + ex conflict = 80k, strong female 18-24 engagement")
- Ask ONE good follow-up question per turn to extract more signal`;

  const model = geminiClient.getGenerativeModel({ model: config.gemini.model });
  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: treat raw text as plain reply
    history.push({ role: 'assistant', text: raw.trim() });
    return { reply: raw.trim(), applied: [] };
  }

  history.push({ role: 'assistant', text: parsed.reply });

  const applied = applyUpdates(parsed.updates);
  return { reply: parsed.reply, applied };
}

function applyUpdates(updates) {
  if (!updates) return [];
  const applied = [];

  // --- Update app hook-log.md rows ---
  if (updates.hook_log && updates.hook_log.length > 0) {
    let content = fs.readFileSync(APP_HOOK_LOG_PATH, 'utf8');

    for (const update of updates.hook_log) {
      if (!update.date) continue;
      let changed = false;
      const fragment = (update.hook_fragment || '').toLowerCase().substring(0, 20);
      const newLines = content.split('\n').map(line => {
        if (!line.startsWith(`| ${update.date} |`)) return line;
        // If a hook_fragment was provided, only match the row that contains it
        if (fragment && !line.toLowerCase().includes(fragment)) return line;
        const parts = line.split('|');
        // parts: ['', ' date ', ' hook ', ' status ', ' views ', '']
        if (update.status && parts[3] !== undefined) parts[3] = ` ${update.status} `;
        if (update.views && parts[4] !== undefined) parts[4] = ` ${update.views} `;
        changed = true;
        return parts.join('|');
      });
      if (changed) {
        content = newLines.join('\n');
        applied.push(`hook-log.md [${update.date}]: status=${update.status || '-'}, views=${update.views || '-'}`);
      }
    }
    fs.writeFileSync(APP_HOOK_LOG_PATH, content);
  }

  // --- Update shared learnings.md sections ---
  if (updates.learnings) {
    let content = fs.readFileSync(SHARED_LEARNINGS_PATH, 'utf8');

    const sections = [
      { key: 'working',  header: "What's Working" },
      { key: 'flopped',  header: 'What Flopped'   },
      { key: 'patterns', header: 'Patterns'        },
    ];

    for (const { key, header } of sections) {
      const entries = updates.learnings[key];
      if (!entries || entries.length === 0) continue;
      for (const entry of entries) {
        if (!entry || content.includes(entry.substring(0, 40))) continue; // skip near-duplicates
        content = appendToSection(content, header, entry);
        applied.push(`learnings.md [${header}]: ${entry}`);
      }
    }

    fs.writeFileSync(SHARED_LEARNINGS_PATH, content);
  }

  return applied;
}

function appendToSection(content, sectionHeader, entry) {
  const lines = content.split('\n');
  const headerIdx = lines.findIndex(l => l.trim() === `## ${sectionHeader}`);
  if (headerIdx === -1) return content;

  let insertIdx = headerIdx + 1;
  if (insertIdx < lines.length && lines[insertIdx].trim() === '') insertIdx++;

  // Remove "(none yet)" placeholder if present
  if (insertIdx < lines.length && lines[insertIdx].trim() === '(none yet)') {
    lines.splice(insertIdx, 1);
  }

  lines.splice(insertIdx, 0, `- ${entry}`);
  return lines.join('\n');
}

function ask(rl, prompt) {
  return new Promise((resolve, reject) => {
    if (rl.closed) return reject(new Error('closed'));
    const onClose = () => reject(new Error('closed'));
    rl.question(prompt, (answer) => {
      rl.removeListener('close', onClose);
      resolve(answer);
    });
    rl.once('close', onClose);
  });
}

async function main() {
  const hookLog = readAppHookLog();

  console.log('\nAI Chat Fantasy - Feedback Bot');
  console.log('='.repeat(40));
  console.log('Tell me how your posts performed.');
  console.log('I\'ll update app hook-log.md and shared learnings.md automatically.');
  console.log('Type "exit" to quit.\n');

  // Show posts awaiting feedback
  const pendingRows = hookLog.split('\n').filter(l => l.includes('| pending |'));
  if (pendingRows.length > 0) {
    console.log('Posts waiting for feedback:');
    pendingRows.forEach(row => {
      const parts = row.split('|').map(p => p.trim());
      const date = parts[1] || '';
      const hook = (parts[2] || '').substring(0, 70);
      console.log(`  [${date}] "${hook}${parts[2]?.length > 70 ? '...' : ''}"`);
    });
    console.log('');
  } else {
    console.log('(No pending posts - run chat generation first)\n');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    let input;
    try {
      input = await ask(rl, 'You: ');
    } catch {
      break; // stdin closed (EOF or Ctrl+D)
    }
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      console.log('\nGoodbye.\n');
      rl.close();
      break;
    }

    try {
      const { reply, applied } = await chat(trimmed);

      console.log(`\nBot: ${reply}`);

      if (applied.length > 0) {
        console.log('\n  [Memory updated]');
        applied.forEach(a => console.log(`  + ${a}`));
      }

      console.log('');
    } catch (err) {
      if (err.message === 'closed') break;
      console.error('\nError:', err.message, '\n');
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
