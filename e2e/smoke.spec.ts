import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

const mockSymbols = [
  { id: '1', symbol: 'EURUSD', name: 'EURUSD', market: 'FX' }
];

const mockCandles = [
  {
    date: '2024-02-08T12:00:00.000Z',
    open: 1.08,
    high: 1.1,
    low: 1.07,
    close: 1.09
  },
  {
    date: '2024-02-08T13:00:00.000Z',
    open: 1.09,
    high: 1.11,
    low: 1.08,
    close: 1.1
  }
];

const mockStrategies = [
  {
    runId: 'run-123',
    name: 'Momentum Alpha',
    winCount: 12,
    lossCount: 8,
    totalReturn: 1.23,
    maxDrawdown: 0.12,
    averageTrade: 0.05,
    averageSL: 0.02,
    averageTP: 0.08,
    symbol: 'EUR/USD',
    timeframe: 'M15',
    comparedSymbol: 'USD/JPY',
    startStrategy: '2024-01-01T00:00:00.000Z',
    endStrategy: '2024-02-01T00:00:00.000Z',
    rrMoyen: 1.5,
    totalNetReturn: 0.98,
    netWinCount: 9,
    netLossCount: 4,
    averageNetTrade: 0.03
  }
];

const mockAnalysisCandles = [
  {
    timestamp: '2024-02-01T00:00:00.000Z',
    open: 1.08,
    high: 1.1,
    low: 1.07,
    close: 1.09,
    volume: 1200
  },
  {
    timestamp: '2024-02-01T01:00:00.000Z',
    open: 1.09,
    high: 1.12,
    low: 1.08,
    close: 1.11,
    volume: 980
  },
  {
    timestamp: '2024-02-01T02:00:00.000Z',
    open: 1.11,
    high: 1.13,
    low: 1.1,
    close: 1.12,
    volume: 1450
  }
];

const mockSeasonality = {
  byMonth: [
    { label: 'Jan', value: 1.2 },
    { label: 'Feb', value: 2.4 },
    { label: 'Mar', value: -0.4 }
  ],
  byDow: [
    { label: 'Mon', value: 0.8 },
    { label: 'Tue', value: 1.1 },
    { label: 'Wed', value: -0.2 },
    { label: 'Thu', value: 0.6 },
    { label: 'Fri', value: 1.5 }
  ],
  byHour: [
    { dow: 0, hour: 8, value: 52 },
    { dow: 1, hour: 12, value: 66 },
    { dow: 2, hour: 16, value: 41 },
    { dow: 3, hour: 10, value: 73 },
    { dow: 4, hour: 14, value: 58 }
  ]
};

const mockStatsSummary = [
  {
    event: 'Breakout',
    target: '1%',
    n: 120,
    pHat: 0.54,
    ciLow: 0.47,
    ciHigh: 0.61,
    lift: 1.12,
    qValue: 0.08
  },
  {
    event: 'Mean Revert',
    target: '0.5%',
    n: 86,
    pHat: 0.48,
    ciLow: 0.39,
    ciHigh: 0.57,
    lift: 0.95
  }
];

const mockMultiFilters = [
  {
    id: 'multi-rsi',
    title: 'RSI Multi-TF',
    source: 'JAVA',
    category: 'Momentum',
    description: 'RSI shows synchronized strength across timeframes.',
    score: 0.74,
    series: [
      { t: 1, v: 0.45 },
      { t: 2, v: 0.52 },
      { t: 3, v: 0.7 },
      { t: 4, v: 0.62 }
    ]
  }
];

const mockBenfordFilter = {
  id: 'benford-check',
  title: 'Benford',
  source: 'PY',
  category: 'Anomaly',
  description: 'Digits distribution aligns with Benford expectations.',
  ratio: 0.81,
  metrics: { deviation: 0.12 }
};

const mockLiquidityFilters = [
  {
    id: 'liquidity-spread',
    title: 'Spread',
    source: 'JAVA',
    category: 'Liquidity',
    description: 'Spreads remain tight for the selected window.',
    score: 0.66,
    metrics: { spread: '0.4 pips' }
  }
];

test('historical-data loads and renders the chart', async ({ page }) => {
  await page.route('**/api/finance/symbols', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSymbols)
    });
  });

  await page.route('**/api/finance/charts/candles/date-time**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCandles)
    });
  });

  await page.goto('/historical-data');

  await expect(page.getByRole('heading', { name: 'Graphique des Bougies' })).toBeVisible();
  await expect(page.locator('#candlestickChart')).toBeVisible();

  await expect(page).toHaveScreenshot('historical-data.png', {
    fullPage: true,
    animations: 'disabled'
  });
});

test('market-analysis loads and renders dashboards', async ({ page }) => {
  await page.route('**/api/finance/charts/candles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAnalysisCandles)
    });
  });

  await page.route('**/seasonality/profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSeasonality)
    });
  });

  await page.route('**/stats/summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockStatsSummary)
    });
  });

  await page.route('**/filter/bullish-bearish-stats/multi-timeframes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockMultiFilters)
    });
  });

  await page.route('**/filter/benford/anomaly**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockBenfordFilter)
    });
  });

  await page.route('**/filter/liquidity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockLiquidityFilters)
    });
  });

  await page.goto('/market-analysis');

  await expect(page.locator('.kpis .kpi-card')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Saisonnalité mensuelle & hebdomadaire' })).toBeVisible();
  await expect(page.locator('mat-progress-bar')).toHaveCount(0);

  await expect(page).toHaveScreenshot('market-analysis.png', {
    fullPage: true,
    animations: 'disabled'
  });
});

test('screen-strategies lists strategies and navigates to details', async ({ page }) => {
  await page.route('**/all-strategies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockStrategies)
    });
  });

  await page.goto('/screen-strategies');

  await page.getByLabel('Sélectionnez un symbole :').selectOption('EUR/USD');

  await expect(page.locator('table.strategy-table')).toBeVisible();

  await page.getByRole('button', { name: 'GO' }).first().click();

  await expect(page).toHaveURL(/\/strategy-detail\//);
});
