// ══════════════ UPGRADE LINK ══════════════
(function setUpgradeLink() {
  var link = document.getElementById('upgradeLink');
  if (!link) return;
  var ua = navigator.userAgent;
  var url;
  if (/iPad|iPhone|iPod/.test(ua)) {
    url = 'https://ansteyapps.com/rewrite/';
  } else if (/Android/.test(ua)) {
    url = 'https://ansteyapps.com/rewrite/';
  } else if (/Silk|Kindle/.test(ua)) {
    url = 'https://ansteyapps.com/rewrite/';
  } else {
    url = 'https://ansteyapps.com/rewrite/';
  }
  link.href = url;
  link.target = '_blank';
})();

// ══════════════ LITE SENTENCE TRACKING ══════════════
var liteSentenceCount = parseInt(localStorage.getItem('rewriteLite_sentenceCount') || '0');

function getLiteSentenceSample(index) {
  var lang = currentLang || 'en';
  var samples = LITE_SENTENCE_SAMPLES[lang] || LITE_SENTENCE_SAMPLES.en;
  return samples[index] || samples[0];
}

// ══════════════ BENCHMARK BANDS ══════════════
const SCORE_BANDS = {
  green: 80,   // ≥80% strong
  amber: 50    // 50–79% developing
                // <50% early stage
};

// ══════════════ STATE ══════════════
let currentLang = 'en';
let currentType = '';
let currentDifficulty = 'easy';
const difficultyPerType = { letters: 'easy', numbers: 'easy', words: 'easy', sentences: 'easy' };
let sessionExercises = [];
let currentIndex = 0;
let scores = [];
let isDrawing = false;
let hasStrokes = false;
let strokes = [];
let currentStroke = [];
let startTime = 0;
let drawCtx = null;
let guideCtx = null;
let settings = { sessionLength: 8, penWidth: 5, sounds: false };

// ══════════════ IndexedDB with fallback ══════════════
let db;
let usingFallback = false;

// In-memory fallback store for when IndexedDB is blocked
const memStore = { sessions: [], settings: {} };

function openDB() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('ReWriteLiteDB', 2);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = () => { usingFallback = true; showStorageWarning(); resolve(null); };
      // Some browsers fire neither callback — timeout fallback
      setTimeout(() => { if (!db && !usingFallback) { usingFallback = true; showStorageWarning(); resolve(null); } }, 2000);
    } catch (e) {
      usingFallback = true;
      showStorageWarning();
      resolve(null);
    }
  });
}

function showStorageWarning() {
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#b45309;color:#fff;padding:10px 16px;font-size:13px;text-align:center';
  banner.textContent = 'Storage unavailable (private browsing?). Progress will not be saved between sessions.';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 8000);
}

function saveSession(sessionData) {
  if (usingFallback) { memStore.sessions.push({ ...sessionData, id: Date.now() }); return Promise.resolve(); }
  return new Promise((resolve) => {
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').add(sessionData);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function getAllSessions() {
  if (usingFallback) return Promise.resolve([...memStore.sessions]);
  return new Promise((resolve) => {
    const tx = db.transaction('sessions', 'readonly');
    const req = tx.objectStore('sessions').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

function clearAllSessions() {
  if (usingFallback) { memStore.sessions = []; return Promise.resolve(); }
  return new Promise((resolve) => {
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function saveSetting(key, value) {
  settings[key] = (typeof value === 'object' || typeof value === 'boolean') ? value : (isNaN(Number(value)) ? value : Number(value));
  if (usingFallback) { memStore.settings[key] = settings[key]; return; }
  try {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value: settings[key] });
  } catch(e) { /* silent */ }
}

function loadSettings() {
  if (usingFallback) {
    Object.entries(memStore.settings).forEach(([k, v]) => { settings[k] = v; });
    applySettings();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const tx = db.transaction('settings', 'readonly');
    const req = tx.objectStore('settings').getAll();
    req.onsuccess = () => {
      (req.result || []).forEach(s => { settings[s.key] = s.value; });
      applySettings();
      resolve();
    };
    req.onerror = () => { applySettings(); resolve(); };
  });
}

function applySettings() {
  document.getElementById('settingSessionLength').value = settings.sessionLength || 8;
  document.getElementById('settingPenWidth').value = settings.penWidth || 5;
  const soundsEl = document.getElementById('settingSounds');
  if (settings.sounds) soundsEl.classList.add('on');
  else soundsEl.classList.remove('on');

  // Restore difficulty preferences
  if (settings.difficultyPerType && typeof settings.difficultyPerType === 'object') {
    Object.assign(difficultyPerType, settings.difficultyPerType);
    // Update toggle UI to reflect saved state
    document.querySelectorAll('.diff-btn').forEach(btn => {
      const type = btn.getAttribute('onclick')?.match(/setDifficulty\('(\w+)'/)?.[1];
      const diff = btn.getAttribute('data-diff');
      if (type && diff) {
        if (difficultyPerType[type] === diff) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });
  }
}

function toggleSounds() {
  settings.sounds = !settings.sounds;
  saveSetting('sounds', settings.sounds);
  applySettings();
}

// ══════════════ EXERCISE DATA HELPERS ══════════════

// Merge function to get exercises for current language
function getExercises() {
  const langData = EXERCISES_LANG[currentLang];
  if (!langData) return EXERCISES_BASE;
  return {
    letters: langData.letters || EXERCISES_BASE.letters,
    numbers: EXERCISES_BASE.numbers, // numbers are universal
    words: langData.words || EXERCISES_BASE.words,
    sentences: langData.sentences || EXERCISES_BASE.sentences
  };
}

function getHints() {
  const lh = HINTS_LANG[currentLang];
  if (!lh) return HINTS_BASE;
  return { ...HINTS_BASE, ...lh };
}

// ══════════════ LANGUAGE ══════════════

function setLanguage(lang) {
  currentLang = lang;
  document.getElementById('langSelect').value = lang;
  document.getElementById('langOverlay').classList.add('hidden');
  saveSetting('language', lang);
  applyLanguage();
}

function applyLanguage() {
  // RTL support for Arabic
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  const s = STRINGS[currentLang] || STRINGS.en;
  const ids = ['headerSubtitle','exercisesTitle','exercisesSubtitle','exLettersTitle','exLettersDesc',
    'exNumbersTitle','exNumbersDesc','exWordsTitle','exWordsDesc','exSentencesTitle','exSentencesDesc',
    'tipText','tracePrompt','clearBtn','submitBtn','exitBtn','progressTitle','exportBtn',
    'aboutTitle','settingsTitle','tabExercises','tabProgress','tabAbout','tabSettings'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && s[id]) el.textContent = s[id];
  });
  const disc = document.getElementById('disclaimer');
  if (disc && s.disclaimer) disc.innerHTML = s.disclaimer;
  const aboutDisc = document.getElementById('aboutDisclaimer');
  if (aboutDisc) aboutDisc.innerHTML = s.disclaimer || STRINGS.en.disclaimer;
}

// ══════════════ TAB NAVIGATION ══════════════
function switchTab(btn) {
  // Hide exercise screen if showing
  document.getElementById('exerciseActive').style.display = 'none';
  document.getElementById('sessionSummary').style.display = 'none';

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const target = btn.dataset.tab;
  document.getElementById(target).classList.add('active');
  btn.classList.add('active');
  if (target === 'panelProgress') refreshProgress();
}

// ══════════════ UPGRADE PROMPT ══════════════
function showUpgradePrompt() {
  const overlay = document.getElementById('upgradeOverlay');
  overlay.style.display = 'flex';
  // Apply current language to overlay text
  var s = STRINGS[currentLang] || STRINGS.en;
  var els = overlay.querySelectorAll('[data-i18n]');
  els.forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (s[key]) el.textContent = s[key];
  });
}

// ══════════════ EXERCISE ENGINE ══════════════
function setDifficulty(type, diff, btn) {
  difficultyPerType[type] = diff;
  saveSetting('difficultyPerType', JSON.parse(JSON.stringify(difficultyPerType)));
  const group = btn.closest('.difficulty-toggle');
  group.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function startExerciseType(type) {
  // Guard: numbers are locked in Lite
  if (type === 'numbers') {
    showUpgradePrompt();
    return;
  }
  if (type === 'sentences') {
    if (liteSentenceCount >= 3) {
      showUpgradePrompt();
      return;
    }
    currentType = 'sentences';
    currentDifficulty = 'easy';
    sessionExercises = [getLiteSentenceSample(liteSentenceCount)];
    currentIndex = 0;
    scores = [];
    liteSentenceCount++;
    localStorage.setItem('rewriteLite_sentenceCount', String(liteSentenceCount));
    showExerciseScreen();
    return;
  }
  currentType = type;
  currentDifficulty = difficultyPerType[type] || 'easy';
  const ex = getExercises();
  const pool = ex[type][currentDifficulty] || ex[type].easy;
  const len = settings.sessionLength || 8;
  sessionExercises = shuffle([...pool]).slice(0, Math.min(len, pool.length));
  currentIndex = 0;
  scores = [];
  showExerciseScreen();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function showExerciseScreen() {
  // Hide panels, show exercise
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('sessionSummary').style.display = 'none';
  const screen = document.getElementById('exerciseActive');
  screen.style.display = 'block';
  screen.classList.add('active');

  loadExercise();
}

function loadExercise() {
  const s = STRINGS[currentLang] || STRINGS.en;
  const exercise = sessionExercises[currentIndex];
  const total = sessionExercises.length;

  document.getElementById('exerciseCounter').textContent = `${currentIndex + 1} / ${total}`;
  document.getElementById('exerciseType').textContent = currentType.charAt(0).toUpperCase() + currentType.slice(1);
  document.getElementById('progressFill').style.width = `${(currentIndex / total) * 100}%`;

  // Target display
  const targetEl = document.getElementById('targetChar');
  targetEl.textContent = exercise;
  const isCJKLang = currentLang === 'ja' || currentLang === 'ko' || currentLang === 'zh';
  const isSentence = currentType === 'sentences';
  const isWord = currentType === 'words';
  // CJK characters need slightly larger display in the target preview
  targetEl.style.fontSize = isSentence ? (isCJKLang ? '16px' : '18px') : isWord ? (isCJKLang ? '28px' : '32px') : (isCJKLang ? '44px' : '48px');

  document.getElementById('targetHint').textContent = getHints()[currentType] || '';
  document.getElementById('tracePrompt').textContent = s.tracePrompt || 'Trace this carefully:';

  // Reset canvas
  setupCanvas(exercise);
  document.getElementById('scoreFeedback').style.display = 'none';
  document.getElementById('drawingControls').style.display = 'block';
  document.getElementById('submitBtn').disabled = true;
  const hint = document.getElementById('canvasHint');
  hint.style.opacity = '1';
  // Auto-hide hint after 3 seconds so it doesn't interfere with drawing
  clearTimeout(hint._hideTimer);
  hint._hideTimer = setTimeout(() => { hint.style.opacity = '0'; }, 3000);
  hasStrokes = false;
  strokes = [];
  startTime = Date.now();
}

// Offscreen canvas for character-only scoring (no ruled lines)
let charCanvas = null;
let charCtx = null;

function setupCanvas(text) {
  const container = document.getElementById('canvasContainer');
  const guideC = document.getElementById('guideCanvas');
  const drawC = document.getElementById('drawCanvas');

  // Match canvas to container size × devicePixelRatio for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const cssW = rect.width || 360;
  const cssH = Math.round(cssW * 0.4); // 2.5:1 aspect ratio
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);

  guideC.width = w; guideC.height = h;
  drawC.width = w; drawC.height = h;
  guideC.style.width = cssW + 'px'; guideC.style.height = cssH + 'px';
  drawC.style.width = cssW + 'px'; drawC.style.height = cssH + 'px';

  // Guide canvas (visual: ruled lines + character)
  guideCtx = guideC.getContext('2d');
  guideCtx.clearRect(0, 0, w, h);
  guideCtx.scale(dpr, dpr); // scale so we draw in CSS pixels

  // Dark mode canvas background
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDarkMode) {
    guideCtx.fillStyle = '#2a2e2a';
    guideCtx.fillRect(0, 0, cssW, cssH);
  }

  // All drawing below uses CSS pixel coordinates (dpr scaling handled above)
  // Ruled lines (visual only — not used for scoring)
  guideCtx.strokeStyle = isDarkMode ? 'rgba(90, 170, 122, 0.2)' : 'rgba(58, 122, 90, 0.15)';
  guideCtx.lineWidth = 1;
  [0, cssH * 0.33, cssH * 0.66, cssH - 1].forEach(y => {
    guideCtx.beginPath(); guideCtx.moveTo(0, y); guideCtx.lineTo(cssW, y); guideCtx.stroke();
  });
  guideCtx.strokeStyle = isDarkMode ? 'rgba(90, 170, 122, 0.4)' : 'rgba(58, 122, 90, 0.35)';
  guideCtx.lineWidth = 2;
  guideCtx.beginPath(); guideCtx.moveTo(0, cssH * 0.75); guideCtx.lineTo(cssW, cssH * 0.75); guideCtx.stroke();

  // Guide text — CJK-aware font and sizing
  const isCJK = currentLang === 'ja' || currentLang === 'ko' || currentLang === 'zh';
  const isSentence = currentType === 'sentences';
  const isWord = currentType === 'words';
  const charWidthFactor = isCJK ? (isSentence ? 0.85 : isWord ? 0.95 : 1.0) : (isSentence ? 0.55 : isWord ? 0.65 : 1.0);
  const maxHeightFactor = isCJK ? (isSentence ? 0.35 : isWord ? 0.5 : 0.6) : (isSentence ? 0.3 : isWord ? 0.45 : 0.55);
  const fontSize = isSentence || isWord ? Math.min(cssH * maxHeightFactor, cssW / (text.length * charWidthFactor)) : cssH * maxHeightFactor;
  const isArabic = currentLang === 'ar';
  const isDevanagari = currentLang === 'hi';
  const fontStack = isCJK
    ? `${Math.round(fontSize)}px 'Hiragino Sans', 'Noto Sans CJK', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Malgun Gothic', 'Yu Gothic', 'Meiryo', sans-serif`
    : isArabic
    ? `${Math.round(fontSize)}px 'Geeza Pro', 'Noto Sans Arabic', 'Simplified Arabic', 'Tahoma', sans-serif`
    : isDevanagari
    ? `${Math.round(fontSize)}px 'Noto Sans Devanagari', 'Mangal', 'Nirmala UI', 'Devanagari Sangam MN', sans-serif`
    : `${Math.round(fontSize)}px 'Segoe UI', 'SF Pro Display', -apple-system, sans-serif`;
  guideCtx.font = fontStack;
  guideCtx.textAlign = 'center';
  if (isArabic) guideCtx.direction = 'rtl';
  else guideCtx.direction = 'ltr';
  const guideCharColor = isDarkMode ? 'rgba(90, 170, 122, 0.35)' : 'rgba(58, 122, 90, 0.2)';
  if (isCJK || isArabic || isDevanagari) {
    guideCtx.textBaseline = 'middle';
    guideCtx.fillStyle = guideCharColor;
    guideCtx.fillText(text, cssW / 2, cssH * 0.55);
  } else {
    guideCtx.textBaseline = 'alphabetic';
    guideCtx.fillStyle = guideCharColor;
    guideCtx.fillText(text, cssW / 2, cssH * 0.75);
  }

  // Offscreen canvas: character ONLY (no ruled lines) for accurate scoring
  charCanvas = document.createElement('canvas');
  charCanvas.width = w; charCanvas.height = h;
  charCtx = charCanvas.getContext('2d');
  charCtx.scale(dpr, dpr);
  charCtx.font = fontStack;
  charCtx.textAlign = 'center';
  if (isArabic) charCtx.direction = 'rtl';
  else charCtx.direction = 'ltr';
  charCtx.fillStyle = 'rgba(58, 122, 90, 0.8)'; // stronger alpha for scoring
  if (isCJK || isArabic || isDevanagari) {
    charCtx.textBaseline = 'middle';
    charCtx.fillText(text, cssW / 2, cssH * 0.55);
  } else {
    charCtx.textBaseline = 'alphabetic';
    charCtx.fillText(text, cssW / 2, cssH * 0.75);
  }

  // Draw canvas
  drawCtx = drawC.getContext('2d');
  drawCtx.clearRect(0, 0, w, h);
  drawCtx.scale(dpr, dpr);
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawCtx.lineWidth = settings.penWidth || 5;
  drawCtx.strokeStyle = isDarkMode ? '#6abf8a' : '#2a6a4a';

  // Store dpr and cssW/cssH on canvas for coordinate transforms
  drawC._dpr = dpr; drawC._cssW = cssW; drawC._cssH = cssH;

  // Events
  drawC.onmousedown = drawC.ontouchstart = startDraw;
  drawC.onmousemove = drawC.ontouchmove = draw;
  drawC.onmouseup = drawC.onmouseleave = drawC.ontouchend = endDraw;
}

function getPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  // Return CSS pixel coordinates (context is already scaled by dpr)
  if (e.touches) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function startDraw(e) {
  e.preventDefault();
  const canvas = document.getElementById('drawCanvas');
  const pos = getPos(e, canvas);
  isDrawing = true;
  hasStrokes = true;
  currentStroke = [pos];
  drawCtx.beginPath();
  drawCtx.moveTo(pos.x, pos.y);
  document.getElementById('submitBtn').disabled = false;
  document.getElementById('canvasHint').style.opacity = '0';
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const canvas = document.getElementById('drawCanvas');
  const pos = getPos(e, canvas);
  currentStroke.push(pos);
  drawCtx.lineTo(pos.x, pos.y);
  drawCtx.stroke();
}

function endDraw() {
  if (!isDrawing) return;
  isDrawing = false;
  if (currentStroke.length > 1) strokes.push([...currentStroke]);
  currentStroke = [];
}

function clearCanvas() {
  const canvas = document.getElementById('drawCanvas');
  const dpr = canvas._dpr || 1;
  drawCtx.save();
  drawCtx.setTransform(1, 0, 0, 1, 0, 0);
  drawCtx.clearRect(0, 0, canvas.width, canvas.height);
  drawCtx.restore();
  strokes = [];
  hasStrokes = false;
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('canvasHint').style.opacity = '1';
}

// ══════════════ SCORING ══════════════
function submitAttempt() {
  if (!hasStrokes) return;
  const score = calculateScore();
  const timeTaken = Math.round((Date.now() - startTime) / 1000);
  scores.push({ score, time: timeTaken, exercise: sessionExercises[currentIndex], type: currentType });

  // Show feedback
  showScoreFeedback(score);
}

function calculateScore() {
  const w = charCanvas.width;
  const h = charCanvas.height;
  const charData = charCtx.getImageData(0, 0, w, h).data;
  drawCtx.save();
  drawCtx.setTransform(1, 0, 0, 1, 0, 0);
  const drawData = drawCtx.getImageData(0, 0, w, h).data;
  drawCtx.restore();

  // === SHAPE-BASED SCORING ===
  // Instead of penalising positional offset, we normalise both the guide
  // and the drawing to the same bounding box, then compare shapes.
  // This means a correctly-formed letter written anywhere on the canvas
  // scores high, even if it's not perfectly centred on the guide.

  // 1. Find bounding boxes
  function getBBox(data, w, h, threshold) {
    let minX=w, minY=h, maxX=0, maxY=0, count=0;
    for (let y=0; y<h; y++) {
      for (let x=0; x<w; x++) {
        if (data[(y*w+x)*4+3] > threshold) {
          if (x<minX) minX=x; if (x>maxX) maxX=x;
          if (y<minY) minY=y; if (y>maxY) maxY=y;
          count++;
        }
      }
    }
    return {minX, minY, maxX, maxY, count, w: maxX-minX+1, h: maxY-minY+1};
  }

  const guideBB = getBBox(charData, w, h, 30);
  let drawBB = getBBox(drawData, w, h, 15);

  if (guideBB.count === 0 || drawBB.count === 0) return 5;

  // Remove outlier stray marks before normalising
  // Find centroid of drawn pixels, exclude pixels far from the main cluster
  let cx=0, cy=0, drawPts=[];
  for (let y=0; y<h; y++) {
    for (let x=0; x<w; x++) {
      if (drawData[(y*w+x)*4+3] > 15) { cx+=x; cy+=y; drawPts.push({x,y}); }
    }
  }
  if (drawPts.length > 10) {
    cx /= drawPts.length; cy /= drawPts.length;
    // Calculate standard deviation of distances from centroid
    let sumDist2 = 0;
    for (const p of drawPts) sumDist2 += (p.x-cx)*(p.x-cx) + (p.y-cy)*(p.y-cy);
    const stdDist = Math.sqrt(sumDist2 / drawPts.length);
    const cutoff = stdDist * 2.5; // exclude pixels beyond 2.5 std devs
    // Recompute bounding box excluding outliers
    let minX=w, minY=h, maxX=0, maxY=0, kept=0;
    for (const p of drawPts) {
      const d = Math.sqrt((p.x-cx)*(p.x-cx) + (p.y-cy)*(p.y-cy));
      if (d <= cutoff) {
        if (p.x<minX) minX=p.x; if (p.x>maxX) maxX=p.x;
        if (p.y<minY) minY=p.y; if (p.y>maxY) maxY=p.y;
        kept++;
      }
    }
    if (kept > drawPts.length * 0.5) {
      drawBB = {minX, minY, maxX, maxY, count:kept, w:maxX-minX+1, h:maxY-minY+1};
    }
  }

  // 2. Render both into normalised 80x80 canvases
  const NS = 80; // normalised size
  const normGuide = document.createElement('canvas');
  normGuide.width = NS; normGuide.height = NS;
  const ngCtx = normGuide.getContext('2d');
  ngCtx.drawImage(charCanvas, guideBB.minX, guideBB.minY, guideBB.w, guideBB.h, 0, 0, NS, NS);
  const ngData = ngCtx.getImageData(0, 0, NS, NS).data;

  const normDraw = document.createElement('canvas');
  normDraw.width = NS; normDraw.height = NS;
  const ndCtx = normDraw.getContext('2d');
  ndCtx.drawImage(drawCanvas, drawBB.minX, drawBB.minY, drawBB.w, drawBB.h, 0, 0, NS, NS);
  const ndData = ndCtx.getImageData(0, 0, NS, NS).data;

  // 3. Compare normalised shapes using distance field
  const RADIUS = 6;
  const dist = new Float32Array(NS * NS).fill(RADIUS + 1);
  for (let i = 0; i < ngData.length; i += 4) {
    if (ngData[i + 3] > 30) dist[i >> 2] = 0;
  }
  for (let y = 0; y < NS; y++) {
    for (let x = 0; x < NS; x++) {
      const i = y * NS + x;
      if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1);
      if (y > 0) dist[i] = Math.min(dist[i], dist[(y - 1) * NS + x] + 1);
    }
  }
  for (let y = NS - 1; y >= 0; y--) {
    for (let x = NS - 1; x >= 0; x--) {
      const i = y * NS + x;
      if (x < NS - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
      if (y < NS - 1) dist[i] = Math.min(dist[i], dist[(y + 1) * NS + x] + 1);
    }
  }

  // Score drawn pixels on normalised canvas
  let totalCredit = 0, drawnPx = 0, guidePx = 0, coveredPx = 0;
  for (let i = 0; i < NS * NS; i++) {
    if (ndData[i * 4 + 3] > 15) {
      drawnPx++;
      const d = dist[i];
      if (d <= 0) totalCredit += 1.0;
      else if (d <= RADIUS) totalCredit += 1.0 - (d / RADIUS) * 0.7;
    }
    if (ngData[i * 4 + 3] > 30) {
      guidePx++;
      if (ndData[i * 4 + 3] > 15) coveredPx++;
    }
  }

  const precision = drawnPx > 0 ? totalCredit / drawnPx : 0;
  const recall = guidePx > 0 ? coveredPx / guidePx : 0;

  // Ink ratio penalty — scribbles produce far more ink than the guide
  const inkRatio = guidePx > 0 ? drawnPx / guidePx : 0;
  const inkPenalty = inkRatio > 2.5 ? Math.max(0, 1 - (inkRatio - 2.5) * 0.15) : 1;

  // Precision-heavy shape matching
  const shapeMatch = Math.min((precision * 0.6 + recall * 0.4) * inkPenalty, 1);

  // 4. Aspect ratio similarity bonus — did they get the proportions right?
  const guideAR = guideBB.w / Math.max(guideBB.h, 1);
  const drawAR = drawBB.w / Math.max(drawBB.h, 1);
  const arDiff = Math.abs(guideAR - drawAR) / Math.max(guideAR, drawAR);
  const arBonus = Math.max(0, 1 - arDiff * 2); // 1.0 if same ratio, 0 if very different

  // 5. Smoothness
  let totalVar = 0, pts = 0;
  for (const s of strokes) {
    for (let i = 1; i < s.length - 1; i++) {
      const a1 = Math.atan2(s[i].y - s[i-1].y, s[i].x - s[i-1].x);
      const a2 = Math.atan2(s[i+1].y - s[i].y, s[i+1].x - s[i].x);
      totalVar += Math.min(Math.abs(a2 - a1), Math.PI);
      pts++;
    }
  }
  const smoothness = pts > 0 ? Math.max(0, 1 - (totalVar / pts) / (Math.PI * 0.5)) : 0.5;

  // Final score: 55% shape match, 20% aspect ratio, 25% smoothness
  let score = (shapeMatch * 0.55 + arBonus * 0.20 + smoothness * 0.25) * 100;
  if (hasStrokes && strokes.length > 0) score = Math.max(score, 5);
  return Math.min(100, Math.round(score));
}

function showScoreFeedback(score) {
  const s = STRINGS[currentLang] || STRINGS.en;
  document.getElementById('drawingControls').style.display = 'none';
  document.getElementById('scoreFeedback').style.display = 'block';

  // Ring animation
  const offset = 314.16 - (score / 100) * 314.16;
  const ring = document.getElementById('scoreRing');
  ring.style.stroke = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--text3)';
  setTimeout(() => { ring.style.strokeDashoffset = offset; }, 50);

  // Show band label in the ring instead of percentage
  let bandLabel;
  if (score >= 80) bandLabel = '★★★';
  else if (score >= 60) bandLabel = '★★';
  else if (score >= 40) bandLabel = '★';
  else bandLabel = '·';
  document.getElementById('scoreValue').textContent = bandLabel;

  // Label + message
  let label, msg;
  if (score >= 80) { label = s.excellent; msg = s.excellentMsg; }
  else if (score >= 60) { label = s.good; msg = s.goodMsg; }
  else if (score >= 40) { label = s.improving; msg = s.improvingMsg; }
  else { label = s.early; msg = s.earlyMsg; }
  document.getElementById('scoreLabel').textContent = label;
  document.getElementById('scoreMessage').textContent = msg;

  // Benchmark
  const benchDiv = document.getElementById('benchmarkDisplay');
  const band = score >= SCORE_BANDS.green ? 'green' : score >= SCORE_BANDS.amber ? 'amber' : 'grey';
  const bandName = score >= SCORE_BANDS.green ? 'Strong' : score >= SCORE_BANDS.amber ? 'Developing' : 'Early stage';
  benchDiv.innerHTML = `<div class="benchmark" style="justify-content:center"><div class="benchmark-dot bench-${band}"></div> ${bandName}</div>`;

  // Next/Finish button
  const isLast = currentIndex + 1 >= sessionExercises.length;
  const nextBtnEl = document.getElementById('nextBtn');
  nextBtnEl.textContent = isLast ? (s.finishBtn || 'Finish Session ✓') : (s.nextBtn || 'Next Exercise →');
}

function nextExercise() {
  // Reset ring
  document.getElementById('scoreRing').style.strokeDashoffset = '314.16';

  if (currentIndex + 1 >= sessionExercises.length) {
    endSession();
  } else {
    currentIndex++;
    loadExercise();
  }
}

async function endSession() {
  const total = scores.length;
  const avg = total > 0 ? Math.round(scores.reduce((a, b) => a + b.score, 0) / total) : 0;
  const best = total > 0 ? Math.max(...scores.map(s => s.score)) : 0;

  // Save to IndexedDB
  await saveSession({
    date: new Date().toISOString(),
    type: currentType,
    exercises: scores,
    averageScore: avg,
    bestScore: best,
    count: total
  });

  showSessionSummary(avg, best, total);
}

function showSessionSummary(avg, best, total) {
  const s = STRINGS[currentLang] || STRINGS.en;
  document.getElementById('exerciseActive').style.display = 'none';
  const summary = document.getElementById('sessionSummary');
  summary.style.display = 'block';

  document.getElementById('summaryTitle').textContent = s.summaryTitle || 'Session Complete';
  document.getElementById('summarySubtitle').textContent = s.summarySubtitle || 'Great work';
  let summaryBand = avg >= 80 ? '★★★' : avg >= 60 ? '★★' : avg >= 40 ? '★' : '·';
  document.getElementById('summaryScore').textContent = summaryBand;
  document.getElementById('sumExCount').textContent = total;
  let bestBand = best >= 80 ? 'Strong' : best >= 50 ? 'Developing' : 'Early';
  document.getElementById('sumBest').textContent = bestBand;

  // Ring
  const offset = 314.16 - (avg / 100) * 314.16;
  setTimeout(() => { document.getElementById('summaryRing').style.strokeDashoffset = offset; }, 100);

  // Breakdown
  const bd = document.getElementById('summaryBreakdown');
  let html = '<p style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Exercise Breakdown</p>';
  scores.forEach((s, i) => {
    const color = s.score >= 80 ? 'var(--success)' : s.score >= 50 ? 'var(--warning)' : 'var(--text3)';
    html += `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="width:22px;height:22px;border-radius:50%;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text3);flex-shrink:0">${i+1}</span>
      <span style="flex:1;font-size:13px;font-weight:500">${s.exercise}</span>
      <span style="font-weight:700;font-size:14px;color:${color}">${s.score}%</span>
    </div>`;
  });
  bd.innerHTML = html;

  // Encouragement
  const enc = avg >= 80 ? (STRINGS[currentLang]?.sumEncHigh || s.sumEncHigh) :
              avg >= 60 ? (STRINGS[currentLang]?.sumEncMid || s.sumEncMid) :
              avg >= 40 ? (STRINGS[currentLang]?.sumEncLow || s.sumEncLow) :
              (STRINGS[currentLang]?.sumEncEarly || s.sumEncEarly);
  document.getElementById('summaryEncouragement').textContent = enc;
}

function exitExercise() {
  document.getElementById('exerciseActive').style.display = 'none';
  document.getElementById('sessionSummary').style.display = 'none';
  // Reset ring offsets
  document.getElementById('scoreRing').style.strokeDashoffset = '314.16';
  document.getElementById('summaryRing').style.strokeDashoffset = '314.16';
  // Show exercises tab
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panelExercises').classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="panelExercises"]').classList.add('active');
}

// ══════════════ PROGRESS ══════════════
async function refreshProgress() {
  const sessions = await getAllSessions();

  // Stats
  const total = sessions.length;
  const totalEx = sessions.reduce((a, s) => a + (s.count || 0), 0);
  const allScores = sessions.map(s => s.averageScore || 0);
  const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  const best = allScores.length > 0 ? Math.max(...allScores) : 0;

  document.getElementById('statSessions').textContent = total;
  document.getElementById('statExercises').textContent = totalEx;
  document.getElementById('statAvgScore').textContent = avg >= 80 ? 'Strong' : avg >= 50 ? 'Developing' : 'Early';
  document.getElementById('statBestScore').textContent = best >= 80 ? 'Strong' : best >= 50 ? 'Developing' : 'Early';

  // Per-exercise breakdown
  const byType = {};
  sessions.forEach(s => {
    const t = s.type || 'letters';
    if (!byType[t]) byType[t] = { scores: [], count: 0 };
    (s.exercises || []).forEach(ex => { byType[t].scores.push(ex.score); byType[t].count++; });
  });

  const peDiv = document.getElementById('perExerciseBreakdown');
  const colours = { letters: '#3a7a5a', numbers: '#3a5a9a', words: '#8a6a3a', sentences: '#7a3a7a' };
  const icons = { letters: 'Aa', numbers: '12', words: 'cat', sentences: '...' };
  const bgColours = { letters: '#e8f5ec', numbers: '#e8f0fa', words: '#faf0e8', sentences: '#f5e8f5' };
  let peHtml = '';
  for (const [type, data] of Object.entries(byType)) {
    const avgS = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
    const bestS = Math.max(...data.scores);
    const band = avgS >= 80 ? 'var(--success)' : avgS >= 50 ? 'var(--warning)' : 'var(--text3)';
    peHtml += `<div class="exercise-stat-row">
      <div class="exercise-stat-icon" style="background:${bgColours[type]||'#eee'};color:${colours[type]||'#666'}">${icons[type]||'?'}</div>
      <div class="exercise-stat-info">
        <div class="exercise-stat-name">${type.charAt(0).toUpperCase()+type.slice(1)}</div>
        <div class="exercise-stat-detail">${data.count} exercises · Avg ${avgS}% · Best ${bestS}%</div>
        <div class="bar-container"><div class="bar-fill" style="width:${avgS}%;background:${band}"></div></div>
      </div>
    </div>`;
  }
  peDiv.innerHTML = peHtml || '<p style="font-size:12px;color:var(--text3);padding:8px 0">No exercises recorded yet.</p>';

  // Trend chart
  renderTrendChart(sessions);

  // Session log
  const logDiv = document.getElementById('sessionLog');
  if (sessions.length === 0) {
    logDiv.innerHTML = '<p style="font-size:12px;color:var(--text3);padding:8px 0">No sessions yet — start your first one from the Exercises tab.</p>';
  } else {
    let logHtml = '';
    [...sessions].reverse().slice(0, 20).forEach(s => {
      const d = new Date(s.date);
      const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const color = s.averageScore >= 80 ? 'var(--success)' : s.averageScore >= 50 ? 'var(--warning)' : 'var(--text3)';
      logHtml += `<div class="session-row">
        <div>
          <div style="font-weight:600">${(s.type||'letters').charAt(0).toUpperCase()+(s.type||'letters').slice(1)}</div>
          <div class="session-meta">${dateStr} · ${s.count||0} exercises</div>
        </div>
        <div class="session-score" style="color:${color}">${s.averageScore||0}%</div>
      </div>`;
    });
    logDiv.innerHTML = logHtml;
  }
}

function exportForTherapist() {
  window.print();
}

function renderTrendChart(sessions) {
  const canvas = document.getElementById('trendChart');
  const container = canvas.parentElement;
  const chartCard = document.getElementById('trendChartCard');
  if (sessions.length < 2) {
    chartCard.style.display = '';
    const ctx2 = canvas.getContext('2d');
    ctx2.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('trendChartHelp').textContent = (STRINGS[currentLang] || {}).trendEmpty || 'Complete at least two sessions to see your progress trend.';
    return;
  }
  chartCard.style.display = '';
  document.getElementById('trendChartHelp').textContent = (STRINGS[currentLang] || {}).trendHelp || 'Average score per session over time';

  const dpr = window.devicePixelRatio || 1;
  const cssW = container.clientWidth;
  const cssH = container.clientHeight || 180;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const data = sessions.map(s => s.averageScore || 0);
  const labels = sessions.map(s => {
    const d = new Date(s.date);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });
  const maxPts = Math.min(data.length, 30);
  const pts = data.slice(-maxPts);
  const lbls = labels.slice(-maxPts);

  const padL = 36, padR = 12, padT = 12, padB = 28;
  const chartW = cssW - padL - padR;
  const chartH = cssH - padT - padB;

  ctx.clearRect(0, 0, cssW, cssH);

  // Y-axis gridlines
  ctx.strokeStyle = 'rgba(58,122,90,0.1)';
  ctx.lineWidth = 1;
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#999';
  ctx.textAlign = 'right';
  [0, 25, 50, 75, 100].forEach(v => {
    const y = padT + chartH - (v / 100) * chartH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(cssW - padR, y); ctx.stroke();
    ctx.fillText(v === 80 ? 'Strong' : v === 50 ? 'Developing' : '', padL - 4, y + 3);
  });

  // Benchmark reference lines: 80% (Strong) and 50% (Developing)
  ctx.setLineDash([4, 4]);
  // 80% line — green
  ctx.strokeStyle = 'rgba(58,122,90,0.45)';
  ctx.lineWidth = 1.5;
  const y80 = padT + chartH - (80 / 100) * chartH;
  ctx.beginPath(); ctx.moveTo(padL, y80); ctx.lineTo(cssW - padR, y80); ctx.stroke();
  ctx.font = '9px sans-serif'; ctx.fillStyle = 'rgba(58,122,90,0.6)'; ctx.textAlign = 'left';
  ctx.fillText('Strong', cssW - padR - 32, y80 - 4);
  // 50% line — amber
  ctx.strokeStyle = 'rgba(180,83,9,0.4)';
  const y50 = padT + chartH - (50 / 100) * chartH;
  ctx.beginPath(); ctx.moveTo(padL, y50); ctx.lineTo(cssW - padR, y50); ctx.stroke();
  ctx.fillStyle = 'rgba(180,83,9,0.55)';
  ctx.fillText('Developing', cssW - padR - 54, y50 - 4);
  ctx.setLineDash([]);

  // Data line
  if (pts.length > 1) {
    const step = chartW / (pts.length - 1);
    ctx.strokeStyle = '#3a7a5a';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((v, i) => {
      const x = padL + i * step;
      const y = padT + chartH - (v / 100) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under line
    ctx.lineTo(padL + (pts.length - 1) * step, padT + chartH);
    ctx.lineTo(padL, padT + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, 'rgba(58,122,90,0.15)');
    grad.addColorStop(1, 'rgba(58,122,90,0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Dots
    pts.forEach((v, i) => {
      const x = padL + i * step;
      const y = padT + chartH - (v / 100) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = v >= 80 ? '#3a7a5a' : v >= 50 ? '#b45309' : '#999';
      ctx.fill();
    });

    // X labels (max ~8)
    ctx.fillStyle = '#999';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(pts.length / 8));
    pts.forEach((_, i) => {
      if (i % labelStep === 0 || i === pts.length - 1) {
        ctx.fillText(lbls[i], padL + i * step, cssH - 4);
      }
    });
  }
}

function confirmReset() {
  if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
    clearAllSessions().then(() => refreshProgress());
  }
}

// ══════════════ DARK MODE ══════════════
const MOON_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const SUN_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

function applyDarkMode(isDark) {
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  // Swap icon: moon = dark mode off, sun = dark mode on
  const toggle = document.getElementById('themeToggle');
  toggle.innerHTML = isDark ? SUN_SVG : MOON_SVG;
  // Update theme-color meta tag
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', isDark ? '#2d6147' : '#3a7a5a');
}

function toggleDarkMode() {
  const isDark = !document.documentElement.hasAttribute('data-theme') || document.documentElement.getAttribute('data-theme') !== 'dark';
  applyDarkMode(isDark);
  saveSetting('darkMode', isDark);
  // Redraw canvas if active
  const activeEx = document.getElementById('exerciseActive');
  if (activeEx && activeEx.style.display !== 'none' && sessionExercises[currentIndex]) {
    setupCanvas(sessionExercises[currentIndex]);
    // Redraw existing strokes
    const drawC = document.getElementById('drawCanvas');
    if (drawCtx && strokes.length > 0) {
      strokes.forEach(stroke => {
        if (stroke.length < 2) return;
        drawCtx.beginPath();
        drawCtx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) drawCtx.lineTo(stroke[i].x, stroke[i].y);
        drawCtx.stroke();
      });
    }
  }
}

document.getElementById('themeToggle').addEventListener('click', toggleDarkMode);

// ══════════════ INIT ══════════════
async function init() {
  await openDB();
  await loadSettings();

  // Dark mode — apply before language so there's no flash
  if (settings.darkMode === true) {
    applyDarkMode(true);
  }

  // Language
  if (settings.language) {
    currentLang = settings.language;
    document.getElementById('langSelect').value = currentLang;
    document.getElementById('langOverlay').classList.add('hidden');
    applyLanguage();
  }

  // Lang select in header
  document.getElementById('langSelect').onchange = function() {
    setLanguage(this.value);
  };

  // Register service worker for offline caching
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    // Listen for SW updates and auto-refresh
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'SW_UPDATED') location.reload();
    });
  }

  // Close upgrade overlay when clicking outside the card
  document.getElementById('upgradeOverlay').addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
  });
}

init();
