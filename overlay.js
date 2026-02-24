const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

// Helper: draw a rounded rectangle path
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Slide 1 & 6: text overlay on top of a mood image
async function addOverlay(imagePath, text, outputPath) {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const wordCount = text.split(/\s+/).length;
  let fontSizePercent;
  if (wordCount <= 5)       fontSizePercent = 0.075;
  else if (wordCount <= 12) fontSizePercent = 0.065;
  else                      fontSizePercent = 0.050;

  const fontSize = Math.round(img.width * fontSizePercent);
  const outlineWidth = Math.round(fontSize * 0.15);
  const maxWidth = img.width * 0.75;
  const lineHeight = fontSize * 1.3;

  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const lines = [];
  const manualLines = text.split('\n');
  for (const ml of manualLines) {
    const words = ml.trim().split(/\s+/);
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  const totalHeight = lines.length * lineHeight;
  const startY = (img.height * 0.28) - (totalHeight / 2);
  const x = img.width / 2;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + (i * lineHeight);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = outlineWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(lines[i], x, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(lines[i], x, y);
  }

  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
}

// Slides 2-5: rendered chat screenshot UI
async function renderChatSlide(messages, characterName, outputPath) {
  const W = 1024, H = 1536;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Dark background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0D0D16');
  bg.addColorStop(1, '#090912');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Header bar
  const headerH = 190;
  ctx.fillStyle = '#131320';
  ctx.fillRect(0, 0, W, headerH);

  // Header bottom border
  ctx.fillStyle = '#25253A';
  ctx.fillRect(0, headerH - 2, W, 2);

  // Back arrow
  ctx.font = 'bold 54px Arial';
  ctx.fillStyle = '#4A9EFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u2190', 44, headerH / 2 - 10);

  // Character name
  ctx.font = 'bold 58px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(characterName, W / 2, headerH / 2 - 16);

  // Online status dot + text
  const dotX = W / 2 - 70;
  const dotY = headerH / 2 + 34;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#34C759';
  ctx.fill();

  ctx.font = '36px Arial';
  ctx.fillStyle = '#34C759';
  ctx.textAlign = 'left';
  ctx.fillText('Online', dotX + 20, headerH / 2 + 24);

  // Chat area layout
  const msgFontSize = 46;
  const lineH = msgFontSize * 1.45;
  const padX = 38;
  const padY = 30;
  const bubbleRadius = 28;
  const maxBubbleW = W * 0.72;
  const sideMargin = 50;
  const msgGap = 48;

  ctx.font = `${msgFontSize}px Arial`;
  ctx.textBaseline = 'top';

  let y = headerH + 72;

  for (const msg of messages) {
    const isUser = msg.role === 'user';

    // Wrap text into lines
    const words = msg.text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxBubbleW - padX * 2) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);

    const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const bubbleW = Math.min(maxBubbleW, maxLineW + padX * 2);
    const bubbleH = lines.length * lineH + padY * 2;
    const bubbleX = isUser ? W - sideMargin - bubbleW : sideMargin;

    // Bubble shadow (subtle depth)
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;

    // Bubble background
    ctx.fillStyle = isUser ? '#0A7CFF' : '#1E1E2E';
    roundedRect(ctx, bubbleX, y, bubbleW, bubbleH, bubbleRadius);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Message text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bubbleX + padX, y + padY + i * lineH);
    }

    y += bubbleH + msgGap;
  }

  // Subtle app watermark at very bottom
  ctx.font = '28px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('AI Chat Fantasy', W / 2, H - 44);

  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
}

module.exports = { addOverlay, renderChatSlide };
