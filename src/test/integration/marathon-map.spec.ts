/**
 * Integration tests for HistoryMapCard
 *
 * The fixture (test-fixtures/marathon-map.html) mounts the real
 * `<history-map-card>` custom element and injects mock `hass` data
 * that contains the full London Marathon 2025 GPS trace as history.
 *
 * What is verified here:
 *  • The component initialises and renders a Leaflet map inside its shadow DOM
 *  • The card title, legend, play/pause button, and timeline slider are visible
 *  • The marathon route polyline is drawn in Leaflet's SVG overlay layer
 *  • A pixel-accurate visual regression screenshot of the whole card
 *
 * Visual snapshot baseline
 * ────────────────────────
 *  First run / intentional layout change:
 *    npx playwright test --update-snapshots
 *  Normal CI run:
 *    npm run test:integration
 */

import { test, expect, Page } from '@playwright/test';

const FIXTURE_URL = 'http://127.0.0.1:3737/test-fixtures/marathon-map.html';

// ── Page setup helper ────────────────────────────────────────────────────────

/**
 * Open the fixture, allow CartoCDN tile requests so the real London map is
 * visible in screenshots, then wait until:
 *  1. The fixture script has finished (`window.__cardReady`)
 *  2. The Leaflet container is painted inside the component's shadow DOM
 *  3. The timeline slider has received track-points from the mocked history
 *  4. The network has gone idle (tiles loaded / timed-out)
 */
async function setupPage(page: Page): Promise<void> {
  await page.goto(FIXTURE_URL);

  // Component script finished wiring hass
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__cardReady === true,
    { timeout: 15_000 }
  );

  // Leaflet container inside the shadow DOM is visible
  // (Playwright automatically pierces shadow boundaries in locators)
  await page.locator('.leaflet-container').waitFor({ state: 'visible', timeout: 10_000 });

  // History has been fetched and timeline track-points loaded
  await page.waitForFunction(() => {
    const host = document.querySelector('history-map-card');
    const slider = host?.shadowRoot?.querySelector<HTMLInputElement>('.timeline-slider');
    return slider ? parseInt(slider.max, 10) > 0 : false;
  }, { timeout: 10_000 });

  // Wait for tiles and other network activity to finish, then a short settle
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {/* tiles may still be loading – proceed */});
  await page.waitForTimeout(800);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('HistoryMapCard – London Marathon integration', () => {

  // ── Card structure ─────────────────────────────────────────────────────────

  test('card title "London Marathon 2025" is visible', async ({ page }) => {
    await setupPage(page);
    // .card-header lives in the shadow DOM; Playwright pierces automatically
    await expect(page.locator('.card-header')).toContainText('London Marathon 2025');
  });

  test('Leaflet map container is rendered inside the component', async ({ page }) => {
    await setupPage(page);
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('map div has non-zero dimensions', async ({ page }) => {
    await setupPage(page);
    const box = await page.locator('#map').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  // ── Timeline controls ──────────────────────────────────────────────────────

  test('play/pause button is visible', async ({ page }) => {
    await setupPage(page);
    await expect(page.locator('.play-pause-btn')).toBeVisible();
  });

  test('timeline slider is visible and has track-points loaded', async ({ page }) => {
    await setupPage(page);
    const slider = page.locator('.timeline-slider');
    await expect(slider).toBeVisible();

    const max = await slider.getAttribute('max');
    expect(parseInt(max ?? '0', 10)).toBeGreaterThan(0);
  });

  test('timeline start/end labels are populated', async ({ page }) => {
    await setupPage(page);

    const startLbl = page.locator('#lbl-start');
    const endLbl   = page.locator('#lbl-end');

    // Labels contain formatted date-time strings (non-empty after history loads)
    const startText = await startLbl.textContent();
    const endText   = await endLbl.textContent();
    expect(startText?.trim().length).toBeGreaterThan(0);
    expect(endText?.trim().length).toBeGreaterThan(0);
  });

  // ── Legend ─────────────────────────────────────────────────────────────────

  test('legend shows the "Runner" entity label', async ({ page }) => {
    await setupPage(page);
    await expect(page.locator('.legend')).toContainText('Runner');
  });

  // ── Route drawing ──────────────────────────────────────────────────────────

  test('marathon route polyline is drawn in the Leaflet SVG overlay', async ({ page }) => {
    await setupPage(page);

    // At least one SVG path exists in the overlay (history dashed line)
    const paths = page.locator('.leaflet-overlay-pane path');
    await expect(paths.first()).toBeVisible();

    // The combined SVG path length should be substantial (42 km across London)
    const totalSvgLength: number = await page.evaluate(() => {
      const host = document.querySelector('history-map-card');
      const paths = host?.shadowRoot
        ?.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path') ?? [];
      let total = 0;
      paths.forEach(p => { total += p.getTotalLength?.() ?? 0; });
      return total;
    });
    expect(totalSvgLength).toBeGreaterThan(500);
  });

  test('zoom controls are present', async ({ page }) => {
    await setupPage(page);
    await expect(page.locator('.leaflet-control-zoom-in')).toBeVisible();
    await expect(page.locator('.leaflet-control-zoom-out')).toBeVisible();
  });

  // ── Visual regression ──────────────────────────────────────────────────────

  /**
   * Pixel-accurate snapshot of the full HistoryMapCard component.
   *
   * Shows: Leaflet map with London Marathon 2025 route (light-blue tile background),
   *        marathon route polyline + live marker at The Mall finish,
   *        legend ("Runner"), timeline bar with play button and slider.
   *
   * Reference stored at:
   *   src/test/integration/__screenshots__/…/history-map-card-marathon-chromium.png
   */
  test('visual regression – full HistoryMapCard with marathon route', async ({ page }) => {
    await setupPage(page);

    const cardEl = page.locator('history-map-card');
    await expect(cardEl).toHaveScreenshot('history-map-card-marathon.png');
  });
});

