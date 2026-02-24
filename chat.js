const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { execSync } = require("child_process");

const config = JSON.parse(
	fs.readFileSync(path.join(__dirname, "config.json"), "utf8"),
);
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

function loadSkills() {
	const dir = path.join(__dirname, "skills");
	if (!fs.existsSync(dir)) return "";
	return fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.map(
			(f) =>
				`\n---\n# Skill: ${f}\n${fs.readFileSync(path.join(dir, f), "utf8")}`,
		)
		.join("\n");
}

const SYSTEM = `You are the content assistant for AI Chat Fantasy, a TikTok companion app.
You help generate posts and track performance through a feedback loop.

Memory files (read before acting, never guess):
- memory/app-profile.md  — app info, content rules, image style
- memory/hook-log.md     — past hooks and their performance
- memory/learnings.md    — what worked, flopped, patterns.

User interactions: 
When you give user choices to choose between different templates. User might give number from 1 - 10. Please make sure to map that number 
with that hook properly. 

DO NOT EVER GENERATE RANDOM HOOK, always try to think and understand what does user wants. 
If you are not sure please ask user and confirm it once. 

BE CAREFUL WITH GENERATING IMAGES
- We have limited amount of tokens. Do not generate random images and waste token that way. 
- When in doubt, ask questions, resources has a scarcity. 


NOTE: ALWAYS REMEBER PEOPLE ARE LAZY TO READ. They hard read 10-15 words minutes

Keep the initial message shorter as much as possible. 


USE SKILLS: Skills are your special ability to think harder, its like an external knowledge you can use to generate posts.
Read it carefully and then decide what to do.

CALLING generate_post — THIS IS CRITICAL:
When the user approves generating a post, you must call generate_post with the COMPLETE content we discussed.
Do NOT call generate_post with just a hook and let generate.js invent the rest — that wastes everything we worked on.
You must pass ALL of these fields:
- hook: the exact agreed hook line
- character: the agreed character name
- conversation_json: JSON.stringify of the full 12-message conversation array [{role, text}, ...]
- slide1_text: the slide 1 overlay text (use \\n for line breaks)
- slide6_text: the slide 6 CTA text (use \\n for line breaks)
- mood_prompt: specific scene for the background image — "iPhone photo of [exact scene], back of person's head or hands on phone, warm lamp, no faces, no text, realistic lighting, portrait"

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
							enum: [
								"memory/app-profile.md",
								"memory/hook-log.md",
								"memory/learnings.md",
							],
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
							enum: ["memory/hook-log.md", "memory/learnings.md"],
						},
						content: { type: "string" },
					},
					required: ["filename", "content"],
				},
			},
			{
				name: "generate_post",
				description:
					"Run generate.js with the FULL content agreed in this session. Every field is required — never call this without the complete conversation and all slide content.",
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
								"Slide 6 CTA text, must end with: AI Fantasy — free to try",
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

function runTool(name, args) {
	if (name === "read_file") {
		return fs.readFileSync(path.join(__dirname, args.filename), "utf8");
	}
	if (name === "write_file") {
		fs.writeFileSync(path.join(__dirname, args.filename), args.content);
		return `Saved ${args.filename}`;
	}
	if (name === "generate_post") {
		const pendingPath = path.join(__dirname, "posts", ".pending.json");
		fs.mkdirSync(path.join(__dirname, "posts"), { recursive: true });
		// Parse the conversation from JSON string into an array
		const content = { ...args };
		if (args.conversation_json) {
			try {
				content.conversation = JSON.parse(args.conversation_json);
			} catch {
				return "Error: conversation_json is not valid JSON";
			}
			delete content.conversation_json;
		}
		fs.writeFileSync(pendingPath, JSON.stringify(content, null, 2));
		process.stdout.write("\n  [generate.js running — takes ~60s...]\n\n");
		try {
			return execSync("node generate.js", {
				cwd: __dirname,
				timeout: 600_000,
				encoding: "utf8",
			});
		} catch (err) {
			return `Error: ${err.message}`;
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

	const skillFiles = fs.existsSync(path.join(__dirname, "skills"))
		? fs
				.readdirSync(path.join(__dirname, "skills"))
				.filter((f) => f.endsWith(".md"))
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

			// Agentic loop — handle tool calls until the model returns plain text
			while (resp.functionCalls()?.length > 0) {
				const toolResults = [];
				for (const call of resp.functionCalls()) {
					const label = call.args?.filename
						? `${call.name}: ${call.args.filename}`
						: call.name;
					process.stdout.write(`  [${label}]\n`);
					const output = runTool(call.name, call.args);
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
