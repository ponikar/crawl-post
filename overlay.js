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

// ─── Reddit-style slides ───────────────────────────────────────────────────

const REDDIT = {
  bg:      '#1a1a1b',
  card:    '#272729',
  border:  '#343536',
  text:    '#d7dadc',
  muted:   '#818384',
  orange:  '#ff4500',
  upvoted: '#ff4500',
};

const AVATAR_COLORS = ['#ff4500', '#46d160', '#7193ff', '#ffd635'];

// Inline Reddit-style SVG icons
function rIcon(name, size, color) {
  const icons = {
    upvote:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" fill-rule="evenodd" clip-rule="evenodd" d="M11.4697 2.46967C11.7626 2.17678 12.2374 2.17678 12.5303 2.46967L20.0303 9.96967C20.3232 10.2626 20.3232 10.7374 20.0303 11.0303C19.7374 11.3232 19.2626 11.3232 18.9697 11.0303L12.75 4.81066V21C12.75 21.4142 12.4142 21.75 12 21.75C11.5858 21.75 11.25 21.4142 11.25 21V4.81066L5.03033 11.0303C4.73744 11.3232 4.26256 11.3232 3.96967 11.0303C3.67678 10.7374 3.67678 10.2626 3.96967 9.96967L11.4697 2.46967Z"/></svg>`,
    downvote: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M12 2.25C12.4142 2.25 12.75 2.58579 12.75 3L12.75 19.1893L18.9697 12.9697C19.2626 12.6768 19.7374 12.6768 20.0303 12.9697C20.3232 13.2626 20.3232 13.7374 20.0303 14.0303L12.5303 21.5303C12.2374 21.8232 11.7626 21.8232 11.4697 21.5303L3.96967 14.0303C3.67678 13.7374 3.67678 13.2626 3.96967 12.9697C4.26256 12.6768 4.73744 12.6768 5.03033 12.9697L11.25 19.1893L11.25 3C11.25 2.58579 11.5858 2.25 12 2.25Z"/></svg>`,
    comment:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M5.33691 21.7178C5.15732 21.7003 4.9793 21.6757 4.80365 21.6442C4.5396 21.597 4.3209 21.4123 4.23008 21.1599C4.13927 20.9075 4.19016 20.6258 4.36357 20.4211C4.76687 19.9451 5.05254 19.3685 5.17822 18.7349C5.20107 18.6196 5.15571 18.4182 4.92371 18.1923C3.2746 16.5871 2.25 14.4086 2.25 12C2.25 6.96934 6.67799 3 12 3C17.322 3 21.75 6.96934 21.75 12C21.75 17.0307 17.322 21 12 21C11.1668 21 10.3569 20.9034 9.58317 20.7213C8.54447 21.3731 7.3153 21.75 6 21.75C5.77647 21.75 5.55516 21.7391 5.33691 21.7178Z"/></svg>`,
    share:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M15.75 4.5a3 3 0 1 1 .825 2.066l-8.421 4.679a3.002 3.002 0 0 1 0 1.51l8.421 4.679a3 3 0 1 1-.729 1.31l-8.421-4.678a3 3 0 1 1 0-4.132l8.421-4.679a3 3 0 0 1-.096-.755z"/></svg>`,
    star:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"/></svg>`,
  };
  const svg = icons[name];
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  return loadImage(png);
}

async function renderRedditSlide(slide, outputPath) {
  const W = 1024, H = 1536;
  const PAD = 40;
  const statusH = 96;

  // pre-load icons
  const [iSignal, iWifi, iBattery, iArrowUp, iComment, iStar] = await Promise.all([
    lucideIcon('signal',       28, REDDIT.muted),
    lucideIcon('wifi',         28, REDDIT.muted),
    lucideIcon('battery-full', 36, REDDIT.text),
    rIcon('upvote',  32, REDDIT.upvoted),
    rIcon('comment', 32, REDDIT.muted),
    rIcon('star',    22, '#ffd635'),
  ]);

  // Snoo (Reddit alien) SVG rendered as image
  const snooSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="10" fill="#FF4500"/>
    <path fill="white" d="M16.67 10a1.46 1.46 0 0 0-2.47-1 7.12 7.12 0 0 0-3.85-1.23l.65-3.08 2.13.45a1 1 0 1 0 .14-.55l-2.38-.5a.27.27 0 0 0-.32.2l-.73 3.44a7.14 7.14 0 0 0-3.89 1.23 1.46 1.46 0 1 0-1.61 2.39 2.84 2.84 0 0 0 0 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.84 2.84 0 0 0 0-.44 1.46 1.46 0 0 0 .57-1.35zM8 11a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.55 2.65a3.44 3.44 0 0 1-2.55.85 3.44 3.44 0 0 1-2.55-.85.27.27 0 0 1 .38-.38 2.93 2.93 0 0 0 2.17.68 2.93 2.93 0 0 0 2.17-.68.27.27 0 0 1 .38.38zm-.13-1.65a1 1 0 1 1 1-1 1 1 0 0 1-1 1z"/>
  </svg>`;
  const iSnoo = await loadImage(new Resvg(snooSvg, { fitTo: { mode: 'width', value: 64 } }).render().asPng());

  const canvas = new Canvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── background ─────────────────────────────────────────────────────────────
  ctx.fillStyle = REDDIT.bg;
  ctx.fillRect(0, 0, W, H);

  // ── status bar ─────────────────────────────────────────────────────────────
  const sMid = statusH / 2;
  ctx.font = 'bold 40px Arial'; ctx.fillStyle = REDDIT.text;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('9:41', 40, sMid);
  ctx.drawImage(iBattery, W - 20 - 36, sMid - 13, 36, 26);
  ctx.drawImage(iWifi,    W - 20 - 36 - 10 - 28, sMid - 14, 28, 28);
  ctx.drawImage(iSignal,  W - 20 - 36 - 10 - 28 - 10 - 28, sMid - 14, 28, 28);

  if (slide.type === 'post') {
    // ── card ─────────────────────────────────────────────────────────────────
    const cMargin = 32, cPad = 40, cRadius = 20;
    const cX = cMargin, cY = statusH + 24;
    const cW = W - cMargin * 2;

    // measure content height first
    ctx.font = 'bold 52px Arial';
    const titleLines = wrapText(ctx, slide.title, cW - cPad * 2);
    ctx.font = '34px Arial';
    const bodyLines = slide.body ? wrapText(ctx, slide.body, cW - cPad * 2).slice(0, 6) : [];
    const cH = cPad               // top pad
      + 52 + 16                   // meta row height
      + (slide.flair ? 44 + 24 : 0)
      + titleLines.length * 68 + 20
      + bodyLines.length * 50 + 20
      + 40                        // divider + gap
      + 60                        // action bar
      + cPad;                     // bottom pad

    // draw card
    roundedRect(ctx, cX, cY, cW, cH, cRadius);
    ctx.fillStyle = REDDIT.card; ctx.fill();
    ctx.strokeStyle = REDDIT.border; ctx.lineWidth = 1; ctx.stroke();

    let y = cY + cPad;
    const cInnerX = cX + cPad;
    const cInnerW = cW - cPad * 2;

    // ── header row: avatar + meta left, Snoo right ──────────────────────────
    const avR = 26;
    ctx.beginPath();
    ctx.arc(cInnerX + avR, y + avR, avR, 0, Math.PI * 2);
    ctx.fillStyle = REDDIT.orange; ctx.fill();
    ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(slide.subreddit[0].toUpperCase(), cInnerX + avR, y + avR);

    const metaX = cInnerX + avR * 2 + 14;
    ctx.font = 'bold 30px Arial'; ctx.fillStyle = REDDIT.text;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`r/${slide.subreddit}`, metaX, y + 2);
    ctx.font = '24px Arial'; ctx.fillStyle = REDDIT.muted;
    ctx.fillText(`u/${slide.username}  •  ${slide.time} ago`, metaX, y + 38);

    // Snoo top right
    ctx.drawImage(iSnoo, cX + cW - cPad - 64, y, 64, 64);

    y += avR * 2 + 24;

    // ── flair ────────────────────────────────────────────────────────────────
    if (slide.flair) {
      ctx.font = 'bold 24px Arial';
      const fw = ctx.measureText(slide.flair).width + 28, fh = 40;
      roundedRect(ctx, cInnerX, y, fw, fh, fh / 2);
      ctx.fillStyle = REDDIT.orange; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(slide.flair, cInnerX + fw / 2, y + fh / 2);
      y += fh + 20;
    }

    // ── title ────────────────────────────────────────────────────────────────
    ctx.font = 'bold 52px Arial'; ctx.fillStyle = REDDIT.text;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (const line of titleLines) { ctx.fillText(line, cInnerX, y); y += 68; }
    y += 12;

    // ── body with fade ───────────────────────────────────────────────────────
    if (bodyLines.length) {
      const bodyStartY = y;
      const bodyH = bodyLines.length * 50;
      ctx.font = '34px Arial'; ctx.fillStyle = REDDIT.muted;
      for (const line of bodyLines) { ctx.fillText(line, cInnerX, y); y += 50; }

      // gradient fade over last 2 lines
      const fadeH = 100;
      const grad = ctx.createLinearGradient(0, bodyStartY + bodyH - fadeH, 0, bodyStartY + bodyH);
      grad.addColorStop(0, 'rgba(39,39,41,0)');
      grad.addColorStop(1, 'rgba(39,39,41,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(cInnerX, bodyStartY + bodyH - fadeH, cInnerW, fadeH);
      y += 8;
    }

    // ── divider ──────────────────────────────────────────────────────────────
    y += 20;
    ctx.fillStyle = REDDIT.border; ctx.fillRect(cX + 1, y, cW - 2, 1);
    y += 20;

    // ── action bar: flat icons + counts only ─────────────────────────────────
    const iconSz = 28, actionMid = y + 20;
    ctx.drawImage(iArrowUp, cInnerX, actionMid - iconSz / 2, iconSz, iconSz);
    ctx.font = 'bold 30px Arial'; ctx.fillStyle = REDDIT.upvoted;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(slide.upvotes, cInnerX + iconSz + 10, actionMid);

    const cmtX2 = cInnerX + iconSz + 10 + ctx.measureText(slide.upvotes).width + 36;
    ctx.drawImage(iComment, cmtX2, actionMid - iconSz / 2, iconSz, iconSz);
    ctx.fillStyle = REDDIT.muted;
    ctx.fillText(slide.commentCount, cmtX2 + iconSz + 10, actionMid);

    // ── swipe hint ───────────────────────────────────────────────────────────
    ctx.font = '28px Arial'; ctx.fillStyle = REDDIT.muted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('swipe for comments', W / 2, H - 48);

  } else {
    // ── comment slide ─────────────────────────────────────────────────────
    let y = statusH;

    // mini subreddit bar
    ctx.font = 'bold 28px Arial'; ctx.fillStyle = REDDIT.orange;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`r/${slide.subreddit}`, PAD, y + 38);
    ctx.fillStyle = REDDIT.border; ctx.fillRect(0, y + 72, W, 1);
    y += 80;

    const iconSz = 24, avR = 26, cardPad = 32;

    for (const [ci, comment] of slide.comments.entries()) {
      // pre-calculate card height before drawing anything
      ctx.font = '34px Arial';
      const textLines = wrapText(ctx, comment.text, W - 32 - cardPad * 2).slice(0, 7);
      const cardH = cardPad + avR * 2 + 20 + textLines.length * 52 + 20 + 48 + cardPad;

      // draw card background first
      roundedRect(ctx, 16, y, W - 32, cardH, 12);
      ctx.fillStyle = REDDIT.card; ctx.fill();

      let cy = y + cardPad;

      // avatar
      ctx.beginPath();
      ctx.arc(cardPad + avR, cy + avR, avR, 0, Math.PI * 2);
      ctx.fillStyle = AVATAR_COLORS[ci % 4]; ctx.fill();
      ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(comment.username[0].toUpperCase(), cardPad + avR, cy + avR);

      // username + time
      const uX = cardPad + avR * 2 + 14;
      ctx.font = 'bold 26px Arial'; ctx.fillStyle = REDDIT.text;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(comment.username, uX, cy + 2);
      ctx.font = '22px Arial'; ctx.fillStyle = REDDIT.muted;
      ctx.fillText(`${comment.time} ago`, uX, cy + 32);

      // award icon (no emoji)
      if (comment.award) {
        ctx.drawImage(iStar, W - 48 - iconSz, cy + avR - iconSz / 2, iconSz, iconSz);
      }

      cy += avR * 2 + 20;

      // comment text
      ctx.font = '34px Arial'; ctx.fillStyle = REDDIT.text;
      ctx.textBaseline = 'top';
      for (const line of textLines) {
        ctx.fillText(line, cardPad, cy); cy += 52;
      }
      cy += 20;

      // vote row
      ctx.drawImage(iArrowUp, cardPad, cy + (48 - iconSz) / 2, iconSz, iconSz);
      ctx.font = 'bold 26px Arial'; ctx.fillStyle = REDDIT.upvoted;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(comment.upvotes, cardPad + iconSz + 8, cy + 22);
      ctx.font = '24px Arial'; ctx.fillStyle = REDDIT.muted;
      const upW = ctx.measureText(comment.upvotes).width;
      ctx.fillText('Reply   Share', cardPad + iconSz + 8 + upW + 28, cy + 22);

      y += cardH + 16;
    }
  }

  fs.writeFileSync(outputPath, await canvas.toBuffer('png'));
}

function wrapText(ctx, text, maxW) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.trim().split(/\s+/);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxW) { line = test; }
      else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line);
  }
  return lines;
}

module.exports = { addOverlay, renderChatSlide, renderRedditSlide };
