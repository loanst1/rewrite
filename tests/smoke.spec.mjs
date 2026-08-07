/**
 * ReWrite smoke test — regression coverage for the stability fixes shipped
 * after the v1.0.27 audit (storage fallback, touch handling, double-finish
 * guards). Run with:
 *
 *   npx playwright test tests/smoke.spec.mjs
 *
 * The suite serves www/ itself on http://localhost:8791 (set REWRITE_URL to
 * point it at another origin instead). The app entry is /app.html —
 * /index.html is only a splash that redirects.
 *
 * Each test seeds a realistic activated state (IndexedDB settings + a few
 * past sessions, English language) and drives the exact user journeys that
 * the audit flagged as highest risk. Add cases here whenever a customer
 * reports a new class of bug.
 */
import { test, expect } from '@playwright/test';
import http from 'node:http';
import path from 'node:path';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = 8791;
const BASE = process.env.REWRITE_URL || `http://localhost:${PORT}`;
const WWW = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');

// iPad-landscape-shaped viewport with touch — matches the tablets the app is
// used on, and lets the multi-touch test construct real Touch/TouchEvent
// objects. Mouse input still works for the drawing journeys.
test.use({
  viewport: { width: 1180, height: 820 },
  hasTouch: true,
  // On CI containers where the registry browser build isn't installed, point
  // REWRITE_CHROMIUM at a chrome binary; otherwise Playwright's own install
  // is used.
  launchOptions: process.env.REWRITE_CHROMIUM
    ? { executablePath: process.env.REWRITE_CHROMIUM }
    : {},
});

// ── Tiny static server for www/ (skipped when REWRITE_URL is set) ──
let server;
test.beforeAll(async () => {
  if (process.env.REWRITE_URL) return;
  const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
    '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.json': 'application/json', '.txt': 'text/plain',
  };
  server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let fp = path.normalize(path.join(WWW, urlPath === '/' ? 'index.html' : urlPath));
      if (!fp.startsWith(WWW)) { res.writeHead(403); res.end(); return; }
      if (statSync(fp).isDirectory()) fp = path.join(fp, 'index.html');
      statSync(fp);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      createReadStream(fp).pipe(res);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', (e) => {
      // Another worker already serves www/ on this port — reuse it.
      if (e.code === 'EADDRINUSE') { server = null; resolve(); } else reject(e);
    });
    server.listen(PORT, resolve);
  });
});
test.afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
});

// Collect page errors on every test — every journey asserts errs is empty.
function trackErrors(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return errs;
}

// Shared setup: seed a realistic activated state — English already chosen,
// default session length, and three past Letters/Words sessions so Progress
// has real content — then reload so the app boots straight to home.
async function seedActivatedApp(page) {
  await page.goto(`${BASE}/app.html`, { waitUntil: 'load' });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('ReWriteDB', 2);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = (e) => {
      const d = e.target.result;
      const tx = d.transaction(['settings', 'sessions'], 'readwrite');
      const st = tx.objectStore('settings');
      st.put({ key: 'language', value: 'en' });
      st.put({ key: 'sessionLength', value: 8 });
      const ss = tx.objectStore('sessions');
      ['letters', 'words', 'letters'].forEach((type, i) => {
        ss.add({
          date: new Date(Date.now() - (3 - i) * 86400000).toISOString(),
          type,
          exercises: [
            { score: 55 + i * 5, time: 12, exercise: 'a', type },
            { score: 60 + i * 5, time: 14, exercise: 'b', type },
          ],
          averageScore: 58 + i * 5, bestScore: 60 + i * 5, count: 2,
        });
      });
      tx.oncomplete = () => { d.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }));
  await page.goto(`${BASE}/app.html`, { waitUntil: 'load' });
  // Activated app boots straight past the language picker to home
  await expect(page.locator('#langOverlay')).toBeHidden();
  await expect(page.locator('#panelExercises')).toBeVisible();
}

// Drive a real mouse stroke across the drawing canvas (stays well inside the
// bounds — leaving the canvas fires mouseleave, which ends the stroke).
async function drawStroke(page, canvasSel = '#drawCanvas') {
  const box = await page.locator(canvasSel).boundingBox();
  const x0 = box.x + box.width * 0.30;
  const y0 = box.y + box.height * 0.55;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(
      x0 + (box.width * 0.4 * i) / 10,
      y0 + Math.sin(i / 2) * box.height * 0.18,
      { steps: 2 },
    );
  }
  await page.mouse.up();
}

// Count inked pixels on a canvas — lets assertions stay on behaviour (did a
// stroke land / not land) rather than on internal stroke arrays.
function inkCount(page, canvasSel) {
  return page.evaluate((sel) => {
    const c = document.querySelector(sel);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  }, canvasSel);
}

test('boot — app reaches home with all 17 language buttons and 0 page errors', async ({ page }) => {
  const errs = trackErrors(page);

  // Cold boot, nothing seeded: the language picker must offer every language
  await page.goto(`${BASE}/app.html`, { waitUntil: 'load' });
  await expect(page.locator('#langOverlay')).toBeVisible();
  await expect(page.locator('#langOverlay .lang-btn')).toHaveCount(17);

  // Choosing English lands on the Exercises home with all 7 practice cards
  await page.locator('#langOverlay .lang-btn').first().click();
  await expect(page.locator('#langOverlay')).toBeHidden();
  await expect(page.locator('#panelExercises')).toBeVisible();
  await expect(page.locator('#panelExercises .exercise-card')).toHaveCount(7);

  expect(errs).toEqual([]);
});

test('navigation — every exercise screen and tab opens and returns home with 0 page errors', async ({ page }) => {
  const errs = trackErrors(page);
  await seedActivatedApp(page);

  // The six session-based exercise types all open the exercise screen and
  // the sticky Back button returns to the Exercises home.
  for (const type of ['letters', 'numbers', 'words', 'bigpractice', 'wordbuilder', 'sentences']) {
    await page.locator(`.exercise-card[onclick="startExerciseType('${type}')"]`).click();
    await expect(page.locator('#exerciseActive')).toBeVisible();
    await page.locator('#exitBtnTop').click();
    await expect(page.locator('#exerciseActive')).toBeHidden();
    await expect(page.locator('#panelExercises')).toBeVisible();
  }

  // My Practice has its own screen + back button
  await page.locator(`.exercise-card[onclick="openMyPractice()"]`).click();
  await expect(page.locator('#myPracticeScreen')).toBeVisible();
  await page.locator('#mpBackBtn').click();
  await expect(page.locator('#myPracticeScreen')).toBeHidden();

  // All four tabs activate their panel and Exercises comes back
  for (const tab of ['panelProgress', 'panelAbout', 'panelSettings', 'panelExercises']) {
    await page.locator(`.tab-btn[data-tab="${tab}"]`).click();
    await expect(page.locator(`#${tab}`)).toBeVisible();
  }

  expect(errs).toEqual([]);
});

test('drawing — Letters session: mouse stroke enables Submit, score shows, Next advances', async ({ page }) => {
  const errs = trackErrors(page);
  await seedActivatedApp(page);

  await page.locator(`.exercise-card[onclick="startExerciseType('letters')"]`).click();
  await expect(page.locator('#exerciseActive')).toBeVisible();
  await expect(page.locator('#exerciseCounter')).toHaveText('1 / 8');
  await expect(page.locator('#submitBtn')).toBeDisabled();

  // Draw a stroke — real ink must land on the canvas and enable Submit
  await drawStroke(page);
  expect(await inkCount(page, '#drawCanvas')).toBeGreaterThan(0);
  await expect(page.locator('#submitBtn')).toBeEnabled();

  // Submit scores the attempt
  await page.locator('#submitBtn').click();
  await expect(page.locator('#scoreFeedback')).toBeVisible();
  await expect(page.locator('#scoreValue')).toHaveText(/^\d+%$/);

  // Next moves to exercise 2 with a fresh canvas
  await page.locator('#nextBtn').click();
  await expect(page.locator('#scoreFeedback')).toBeHidden();
  await expect(page.locator('#exerciseCounter')).toHaveText('2 / 8');
  expect(await inkCount(page, '#drawCanvas')).toBe(0);

  expect(errs).toEqual([]);
});

test('IDB unavailable — app still boots, warns, and a session completes on the memory fallback', async ({ page }) => {
  const errs = trackErrors(page);

  // Simulate Safari/private-browsing style storage refusal: indexedDB.open
  // throws synchronously before the app's own scripts run.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        return { open() { throw new DOMException('The user denied permission', 'InvalidStateError'); } };
      },
    });
  });

  await page.goto(`${BASE}/app.html`, { waitUntil: 'load' });

  // Fallback engaged: the app warns but still reaches the language picker
  await expect(page.getByText('Storage unavailable')).toBeVisible();
  await expect(page.locator('#langOverlay')).toBeVisible();
  await page.locator('#langOverlay .lang-btn').first().click();
  await expect(page.locator('#panelExercises')).toBeVisible();

  // A one-exercise session must run to completion on the memory store
  await page.evaluate(() => saveSetting('sessionLength', 1));
  await page.locator(`.exercise-card[onclick="startExerciseType('letters')"]`).click();
  await expect(page.locator('#exerciseActive')).toBeVisible();
  await drawStroke(page);
  await page.locator('#submitBtn').click();
  await expect(page.locator('#scoreFeedback')).toBeVisible();
  await page.locator('#nextBtn').click(); // last exercise → Finish Session

  // Summary appears and the session is visible to Progress via the fallback
  await expect(page.locator('#sessionSummary')).toBeVisible();
  await expect(page.locator('#sumExCount')).toHaveText('1');
  await page.locator('#sumBackBtn').click();
  await page.locator('.tab-btn[data-tab="panelProgress"]').click();
  await expect(page.locator('#panelProgress')).toBeVisible();

  expect(errs).toEqual([]);
});

test('multi-touch — a second finger cannot restart, corrupt, or continue the stroke', async ({ page }) => {
  const errs = trackErrors(page);
  await seedActivatedApp(page);

  await page.locator(`.exercise-card[onclick="startExerciseType('letters')"]`).click();
  await expect(page.locator('#exerciseActive')).toBeVisible();

  // Overlapping sequence: touchstart A → draw → touchstart B (palm) →
  // touchmove B → touchend A. The stroke belongs to finger A throughout.
  await page.evaluate(() => {
    const c = document.getElementById('drawCanvas');
    const r = c.getBoundingClientRect();
    const T = (id, fx, fy) => new Touch({
      identifier: id, target: c,
      clientX: r.left + r.width * fx, clientY: r.top + r.height * fy,
    });
    const fire = (type, touches, changed) => c.dispatchEvent(new TouchEvent(type, {
      touches, changedTouches: changed, targetTouches: touches,
      bubbles: true, cancelable: true,
    }));
    const a1 = T(1, 0.3, 0.4), a2 = T(1, 0.5, 0.6), b1 = T(2, 0.7, 0.3), b2 = T(2, 0.8, 0.5);
    fire('touchstart', [a1], [a1]);        // finger A starts the stroke
    fire('touchmove', [a2], [a2]);         // A draws
    fire('touchstart', [a2, b1], [b1]);    // palm lands — must be ignored
    fire('touchmove', [a2, b2], [b2]);     // palm moves — must not draw
    fire('touchend', [b2], [a2]);          // A lifts → stroke ends
  });

  // The A-stroke committed: Submit is armed and ink landed
  await expect(page.locator('#submitBtn')).toBeEnabled();
  const inkAfterA = await inkCount(page, '#drawCanvas');
  expect(inkAfterA).toBeGreaterThan(0);

  // B is still down but the stroke has ended — moving B must add no ink
  await page.evaluate(() => {
    const c = document.getElementById('drawCanvas');
    const r = c.getBoundingClientRect();
    const b3 = new Touch({ identifier: 2, target: c, clientX: r.left + r.width * 0.85, clientY: r.top + r.height * 0.7 });
    c.dispatchEvent(new TouchEvent('touchmove', { touches: [b3], changedTouches: [b3], targetTouches: [b3], bubbles: true, cancelable: true }));
    c.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [b3], targetTouches: [], bubbles: true, cancelable: true }));
  });
  expect(await inkCount(page, '#drawCanvas')).toBe(inkAfterA);

  // State stayed consistent: a fresh finger starts a brand-new stroke
  await page.evaluate(() => {
    const c = document.getElementById('drawCanvas');
    const r = c.getBoundingClientRect();
    const T = (id, fx, fy) => new Touch({ identifier: id, target: c, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy });
    const fire = (type, touches, changed) => c.dispatchEvent(new TouchEvent(type, { touches, changedTouches: changed, targetTouches: touches, bubbles: true, cancelable: true }));
    const c1 = T(3, 0.2, 0.7), c2 = T(3, 0.45, 0.8);
    fire('touchstart', [c1], [c1]);
    fire('touchmove', [c2], [c2]);
    fire('touchend', [], [c2]);
  });
  expect(await inkCount(page, '#drawCanvas')).toBeGreaterThan(inkAfterA);

  expect(errs).toEqual([]);
});

test('rapid double-click on Next advances exactly one exercise', async ({ page }) => {
  const errs = trackErrors(page);
  await seedActivatedApp(page);

  await page.locator(`.exercise-card[onclick="startExerciseType('letters')"]`).click();
  await expect(page.locator('#exerciseActive')).toBeVisible();
  await drawStroke(page);
  await page.locator('#submitBtn').click();
  await expect(page.locator('#scoreFeedback')).toBeVisible();

  // Tremor double-tap: two clicks in the same tick. The re-entry guard must
  // swallow the second — advancing to exercise 2, never 3.
  await page.evaluate(() => {
    const btn = document.getElementById('nextBtn');
    btn.click();
    btn.click();
  });
  await expect(page.locator('#exerciseCounter')).toHaveText('2 / 8');
  await expect(page.locator('#scoreFeedback')).toBeHidden();
  await expect(page.locator('#sessionSummary')).toBeHidden();

  expect(errs).toEqual([]);
});
