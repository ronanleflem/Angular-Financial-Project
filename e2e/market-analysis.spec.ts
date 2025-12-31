import { test, expect } from '@playwright/test';

const mockCandles = [
  {
    timestamp: '2024-02-08T12:00:00.000Z',
    open: 1.08,
    high: 1.1,
    low: 1.07,
    close: 1.09,
    volume: 1200
  },
  {
    timestamp: '2024-02-08T13:00:00.000Z',
    open: 1.09,
    high: 1.12,
    low: 1.08,
    close: 1.11,
    volume: 1100
  },
  {
    timestamp: '2024-02-08T14:00:00.000Z',
    open: 1.11,
    high: 1.13,
    low: 1.1,
    close: 1.12,
    volume: 900
  }
];

const mockStats = [
  {
    event: 'k_consecutive=2',
    target: 'up_next',
    n: 1200,
    pHat: 0.56,
    ciLow: 0.53,
    ciHigh: 0.59,
    lift: 0.03,
    qValue: 0.08
  }
];

const mockMultiFilters = [
  {
    id: 'compression',
    title: 'Compression Range',
    source: 'JAVA',
    category: 'Volatilité',
    ratio: 0.22,
    metrics: { percentile: 12 }
  }
];

const mockBenford = {
  id: 'benford',
  title: 'Benford score',
  source: 'JAVA',
  category: 'Structure',
  score: 0.68,
  series: [
    { t: 1717526400000, v: 0.62 },
    { t: 1717612800000, v: 0.65 },
    { t: 1717699200000, v: 0.67 }
  ]
};

const mockLiquidity = [
  {
    id: 'liquidity-zones',
    title: 'Liquidity Zones',
    source: 'JAVA',
    category: 'Liquidity',
    metrics: { imbalanceScore: 0.44, clusters: 5 }
  }
];

test('market analysis shows charts, kpis, and mock snackbar', async ({ page }) => {
  await page.route('**/api/finance/charts/candles**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCandles)
    });
  });

  await page.route('**/seasonality/profiles**', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'mock error' })
    });
  });

  await page.route('**/stats/summary**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockStats)
    });
  });

  await page.route('**/filter/bullish-bearish-stats/multi-timeframes**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockMultiFilters)
    });
  });

  await page.route('**/filter/benford/anomaly**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockBenford)
    });
  });

  await page.route('**/filter/liquidity**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockLiquidity)
    });
  });

  await page.goto('/market-analysis');

  await expect(page.locator('.kpi-card')).toHaveCount(5);
  await expect(page.locator('.seasonality-charts canvas')).toHaveCount(2);
  await expect(page.locator('.heatmap-chart canvas')).toBeVisible();
  await expect(page.getByText('Saisonnalité alimenté avec les données mock.')).toBeVisible();
});
