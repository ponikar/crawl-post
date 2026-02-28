const { Canvas, loadImage } = require('skia-canvas');
const { Resvg } = require('@resvg/resvg-js');
const fs   = require('fs');
const path = require('path');

// ─── Lucide icon helper ────────────────────────────────────────────────────

async function lucideIcon(name, size, color) {
  const file = path.join(__dirname, 'node_modules/lucide-static/icons', `${name}.svg`);
  const svg  = fs.readFileSync(file, 'utf8').replace(/currentColor/g, color);
  const png  = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  return loadImage(png);
}

// ─── Rounded rectangle path ────────────────────────────────────────────────

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

// ─── iMessage bubble tail ──────────────────────────────────────────────────

function drawBubbleTail(ctx, bx, by, bw, bh, isUser) {
  const color = isUser ? '#007AFF' : '#E9E9EA';
  const tw = 16, th = 26;
  ctx.save();

  if (isUser) {
    const ox = bx + bw, oy = by + bh;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ox - 8, oy - 2);
    ctx.bezierCurveTo(ox + 2,      oy + 1,        ox + tw,     oy + th * 0.35, ox + tw - 2, oy + th);
    ctx.bezierCurveTo(ox + tw - 7, oy + th * 0.65, ox + 2,     oy + th * 0.2,  ox - 3,      oy - 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(ox, oy + 3);
    ctx.bezierCurveTo(ox + 7,  oy + th * 0.28, ox + 12, oy + th * 0.58, ox + tw - 2, oy + th);
    ctx.bezierCurveTo(ox + 8,  oy + th * 0.72, ox + 3,  oy + th * 0.38, ox - 2,      oy + 5);
    ctx.fill();
  } else {
    const ox = bx, oy = by + bh;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ox + 8, oy - 2);
    ctx.bezierCurveTo(ox - 2,      oy + 1,        ox - tw,     oy + th * 0.35, ox - tw + 2, oy + th);
    ctx.bezierCurveTo(ox - tw + 7, oy + th * 0.65, ox - 2,     oy + th * 0.2,  ox + 3,      oy - 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(ox, oy + 3);
    ctx.bezierCurveTo(ox - 7,  oy + th * 0.28, ox - 12, oy + th * 0.58, ox - tw + 2, oy + th);
    ctx.bezierCurveTo(ox - 8,  oy + th * 0.72, ox - 3,  oy + th * 0.38, ox + 2,      oy + 5);
    ctx.fill();
  }

  ctx.restore();
}

// ─── Slide 1 & 6: mood image + text overlay ───────────────────────────────

async function addOverlay(imagePath, text, outputPath) {
  const img    = await loadImage(imagePath);
  const canvas = new Canvas(img.width, img.height);
  const ctx    = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const wordCount = text.split(/\s+/).length;
  const fontSizePercent =
    wordCount <= 5  ? 0.075 :
    wordCount <= 12 ? 0.065 : 0.050;

  const fontSize    = Math.round(img.width * fontSizePercent);
  const outlineWidth = Math.round(fontSize * 0.15);
  const maxWidth    = img.width * 0.75;
  const lineHeight  = fontSize * 1.3;

  ctx.font         = `bold ${fontSize}px Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  const lines = [];
  for (const ml of text.split('\n')) {
    let current = '';
    for (const word of ml.trim().split(/\s+/)) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) { current = test; }
      else { if (current) lines.push(current); current = word; }
    }
    if (current) lines.push(current);
  }

  const startY = (img.height * 0.28) - (lines.length * lineHeight / 2);
  const x      = img.width / 2;
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    ctx.strokeStyle = '#000000'; ctx.lineWidth = outlineWidth; ctx.lineJoin = 'round';
    ctx.strokeText(lines[i], x, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(lines[i], x, y);
  }

  fs.writeFileSync(outputPath, await canvas.toBuffer('png'));
}

// ─── Slides 2–5: iMessage chat UI ─────────────────────────────────────────

async function renderChatSlide(messages, characterName, outputPath) {
  // ── Pre-load all Lucide icons in parallel ──────────────────────────────
  const [
    iSignal, iWifi, iBattery,
    iChevron, iVideo, iPhone,
    iPlusCircle, iMic,
  ] = await Promise.all([
    lucideIcon('signal',       32, '#1C1C1E'),
    lucideIcon('wifi',         30, '#1C1C1E'),
    lucideIcon('battery-full', 44, '#34C759'),
    lucideIcon('chevron-left', 36, '#007AFF'),
    lucideIcon('video',        40, '#007AFF'),
    lucideIcon('phone',        36, '#007AFF'),
    lucideIcon('plus-circle',  54, '#007AFF'),
    lucideIcon('mic',          46, '#007AFF'),
  ]);

  const W = 1024, H = 1536;
  const canvas = new Canvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── White background ───────────────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // ── Status bar (96px) ──────────────────────────────────────────────────
  const statusH = 96;
  const statusMidY = statusH / 2;

  ctx.font         = 'bold 44px Helvetica Neue, Arial';
  ctx.fillStyle    = '#1C1C1E';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('9:41', 46, statusMidY);

  const batW = 44, batH = 26;
  const wifiSz = 30;
  const sigW = 32, sigH = 26;
  const rMarginSB = 20;

  const batX = W - rMarginSB - batW;
  ctx.drawImage(iBattery,  batX,                              statusMidY - batH / 2,  batW,  batH);
  ctx.drawImage(iWifi,     batX - 10 - wifiSz,                statusMidY - wifiSz / 2, wifiSz, wifiSz);
  ctx.drawImage(iSignal,   batX - 10 - wifiSz - 10 - sigW,    statusMidY - sigH / 2,  sigW,  sigH);

  // ── Navigation bar (172px) ─────────────────────────────────────────────
  const navH  = 172;
  const navY  = statusH;

  ctx.fillStyle = '#C6C6C8';
  ctx.fillRect(0, navY + navH - 1, W, 1);

  const avatarR  = 42;
  const avatarCX = W / 2;
  const avatarCY = navY + 6 + avatarR;
  const nameY    = avatarCY + avatarR + 8;
  const subtitleY = nameY + 36 + 4;

  ctx.drawImage(iChevron, 14, avatarCY - 18, 36, 36);
  ctx.font         = '40px Helvetica Neue, Arial';
  ctx.fillStyle    = '#007AFF';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Back', 55, avatarCY);

  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = '#8E8E93';
  ctx.fill();
  ctx.font         = 'bold 38px Helvetica Neue, Arial';
  ctx.fillStyle    = '#FFFFFF';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(characterName[0].toUpperCase(), avatarCX, avatarCY);

  ctx.font         = 'bold 34px Helvetica Neue, Arial';
  ctx.fillStyle    = '#1C1C1E';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(characterName, avatarCX, nameY);

  ctx.font      = '26px Helvetica Neue, Arial';
  ctx.fillStyle = '#8E8E93';
  ctx.fillText('iMessage', avatarCX, subtitleY);

  const rMarginNav = 20;
  ctx.drawImage(iVideo,  W - rMarginNav - 40,           avatarCY - 20, 40, 40);
  ctx.drawImage(iPhone,  W - rMarginNav - 40 - 12 - 36, avatarCY - 18, 36, 36);

  // ── Chat messages ──────────────────────────────────────────────────────
  const msgFont    = 43;
  const lineH      = msgFont * 1.52;
  const padX       = 32, padY = 24;
  const bubbleR    = 44;
  const maxBubbleW = W * 0.70;
  const rMarginMsg = 28;
  const lMarginMsg = 28;
  const gapSame    = 10;
  const gapSwitch  = 30;

  ctx.font         = `${msgFont}px Helvetica Neue, Arial`;
  ctx.textBaseline = 'top';

  let y = navY + navH + 36;

  for (let mi = 0; mi < messages.length; mi++) {
    const msg         = messages[mi];
    const isUser      = msg.role === 'user';
    const isLastGroup = !messages[mi + 1] || messages[mi + 1].role !== msg.role;

    // Word wrap
    const words = msg.text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxBubbleW - padX * 2) { line = test; }
      else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line);

    const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const bubbleW  = Math.min(maxBubbleW, maxLineW + padX * 2);
    const bubbleH  = lines.length * lineH + padY * 2;
    const bubbleX  = isUser ? W - rMarginMsg - bubbleW : lMarginMsg;

    ctx.fillStyle = isUser ? '#007AFF' : '#E9E9EA';
    roundedRect(ctx, bubbleX, y, bubbleW, bubbleH, bubbleR);
    ctx.fill();

    if (isLastGroup) drawBubbleTail(ctx, bubbleX, y, bubbleW, bubbleH, isUser);

    ctx.fillStyle = isUser ? '#FFFFFF' : '#1C1C1E';
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bubbleX + padX, y + padY + i * lineH);
    }

    if (mi === messages.length - 1 && isUser) {
      ctx.font         = '28px Helvetica Neue, Arial';
      ctx.fillStyle    = '#8E8E93';
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('Delivered', W - rMarginMsg, y + bubbleH + 8);
    }

    y += bubbleH + (isLastGroup ? gapSwitch + 20 : gapSame);

    ctx.font         = `${msgFont}px Helvetica Neue, Arial`;
    ctx.textBaseline = 'top';
  }

  // ── Input bar ─────────────────────────────────────────────────────────
  const inputH = 120;
  const inputY = H - inputH;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, inputY, W, inputH);
  ctx.fillStyle = '#C6C6C8';
  ctx.fillRect(0, inputY, W, 1);

  const btnCY = inputY + inputH / 2;

  ctx.drawImage(iPlusCircle, 14, btnCY - 27, 54, 54);

  const fX = 80, fY = inputY + 18, fW = W - 174, fH = inputH - 36;
  roundedRect(ctx, fX, fY, fW, fH, fH / 2);
  ctx.strokeStyle = '#C6C6C8';
  ctx.lineWidth   = 2;
  ctx.stroke();
  ctx.font         = '34px Helvetica Neue, Arial';
  ctx.fillStyle    = '#C7C7CC';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('iMessage', fX + 28, btnCY);

  ctx.drawImage(iMic, W - 14 - 46, btnCY - 23, 46, 46);

  fs.writeFileSync(outputPath, await canvas.toBuffer('png'));
}

module.exports = { addOverlay, renderChatSlide };
