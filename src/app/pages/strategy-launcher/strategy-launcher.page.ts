import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
});

const SYMBOL_BASE_PRICE: Record<string, number> = {
  BTCUSD: 42000,
  ETHUSD: 2200,
  EURUSD: 1.08,
  AAPL: 185,
  SPY: 470,
  XAUUSD: 1950,
  NAS100: 15600
};

const TIMEFRAME_FACTOR: Record<string, number> = {
  '15m': 1.15,
  '1h': 1,
  '4h': 0.9,
  '1d': 0.8
};

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

const DOW_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30
};

type MetricTone = 'positive' | 'negative' | 'neutral';
type RunKey = 'dca' | 'backtests' | 'market-stats' | 'seasonality' | 'stress-tests';

interface StrategyMetric {
  label: string;
  value: string;
  tone?: MetricTone;
}

interface StrategyResult {
  runId: string;
  executedAt: Date;
  summary: string;
  status?: string;
  tags: string[];
  metrics: StrategyMetric[];
}

interface FilterParam {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

interface FilterOption {
  id: string;
  label: string;
  params: FilterParam[];
}

interface FilterRuleOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-strategy-launcher-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDividerModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatSelectModule
  ],
  templateUrl: './strategy-launcher.page.html',
  styleUrls: ['./strategy-launcher.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'strategy-launcher-page'
  }
})
export class StrategyLauncherPageComponent {
  private readonly fb = inject(FormBuilder);

  readonly runOptions: Array<{ key: RunKey; label: string; description: string }> = [
    { key: 'dca', label: 'DCA grid', description: 'Accumulation periodique' },
    { key: 'backtests', label: 'Backtests', description: 'Simulateur historique' },
    { key: 'market-stats', label: 'Market stats', description: 'KPIs et profils de marche' },
    { key: 'seasonality', label: 'Saisonnalite', description: 'Cycles et patterns temporels' },
    { key: 'stress-tests', label: 'Stress tests', description: 'Chocs et scenarios extremes' }
  ];

  readonly symbols = ['BTCUSD', 'ETHUSD', 'EURUSD', 'AAPL', 'SPY', 'XAUUSD'];
  readonly timeframes = ['15m', '1h', '4h', '1d'];
  readonly brokers = ['BINANCE', 'COINBASE', 'IBKR', 'FXCM'];

  readonly dcaFrequencies = [
    { value: 'weekly', label: 'Hebdo' },
    { value: 'biweekly', label: '2 semaines' },
    { value: 'monthly', label: 'Mensuel' }
  ];

  readonly signalTypes = ['ema_cross', 'ema_rsi', 'breakout_channel'];
  readonly dynamicSlModes = ['atr_trailing', 'fixed', 'hybrid'];
  readonly jitterDistributions = ['gaussian', 'uniform', 'laplace'];

  readonly backtestFilterOptions: FilterOption[] = [
    {
      id: 'volatility_guard',
      label: 'Volatility guard',
      params: [
        { key: 'window', label: 'Fenetre', type: 'number', min: 5, max: 200, step: 1 },
        { key: 'threshold', label: 'Seuil %', type: 'number', min: 1, max: 80, step: 0.5 }
      ]
    },
    {
      id: 'trend_regime',
      label: 'Trend regime',
      params: [
        { key: 'lookback', label: 'Lookback', type: 'number', min: 20, max: 400, step: 5 },
        { key: 'min_strength', label: 'Force min', type: 'number', min: 0, max: 100, step: 1 }
      ]
    },
    {
      id: 'liquidity_spread',
      label: 'Liquidity / spread',
      params: [
        { key: 'max_spread_bps', label: 'Spread max (bps)', type: 'number', min: 1, max: 50, step: 1 },
        { key: 'min_volume', label: 'Volume min', type: 'number', min: 1000, max: 1000000, step: 1000 }
      ]
    }
  ];

  readonly backtestRuleOptions: FilterRuleOption[] = [
    { id: 'momentum_alignment', label: 'Momentum alignment' },
    { id: 'drawdown_guard', label: 'Drawdown guard' },
    { id: 'macro_filter', label: 'Macro filter' }
  ];

  readonly backtestStrategies = ['Breakout', 'Mean Reversion', 'Momentum', 'MA Crossover'];
  readonly statsPacks = ['Volatility', 'Liquidity', 'Regime', 'Microstructure'];
  readonly seasonalityWindows = ['Monthly', 'Weekly', 'Day of Week', 'Intraday'];
  readonly seasonalityFilters = ['All', 'Bull', 'Bear'];
  readonly stressStrategies = ['Breakout v2', 'Trend Rider', 'Carry FX', 'Stat Arb'];
  readonly stressScenarios = ['2008 Crash', 'Covid 2020', 'Flash Crash 2010', 'Rates Shock 2022'];

  private readonly dcaDefaults = {
    symbol: 'BTCUSD',
    timeframe: '1h',
    frequency: 'weekly',
    amount: 200,
    startDate: new Date(2023, 0, 1),
    endDate: new Date(2024, 11, 31),
    feePct: 0.1,
    reinvestDividends: true,
    broker: 'BINANCE'
  } as const;

  private readonly backtestDefaults = {
    strategy: 'Mean Reversion',
    symbol: 'EURUSD',
    timeframe: '1h',
    startDate: new Date(2019, 0, 1),
    endDate: new Date(2024, 11, 31),
    capital: 10000,
    riskPct: 1.0,
    stopLoss: 2.0,
    takeProfit: 3.5,
    trailingStop: true,
    signalType: 'ema_cross',
    fast: 12,
    slow: 26,
    requireCrossing: true,
    atrWindow: 14,
    atrK: 2,
    rMult: 1.5,
    slippageBps: 5,
    feeBps: 2,
    dynamicSlEnabled: false,
    dynamicSlMode: 'atr_trailing',
    dynamicSlAtrMult: 1.3,
    tpslJitterEnabled: false,
    tpslJitterDist: 'gaussian',
    tpslJitterTpBps: 8,
    tpslJitterSlBps: 6,
    tpslJitterSeed: 42,
    filters: ['volatility_guard'],
    filterRules: ['momentum_alignment'],
    filterRuleMinScore: 60,
    filterRuleMinScorePct: 70,
    screeningEnabled: false,
    screenWindowStart: null as Date | null,
    screenWindowEnd: null as Date | null,
    screenMaxBars: 2500,
    screenMaxTrades: 200,
    screenMaxSeconds: 4,
    riskFreeRate: 2.0,
    filter_volatility_guard_window: 30,
    filter_volatility_guard_threshold: 22,
    filter_trend_regime_lookback: 120,
    filter_trend_regime_min_strength: 55,
    filter_liquidity_spread_max_spread_bps: 12,
    filter_liquidity_spread_min_volume: 20000,
    rule_momentum_alignment_mode: 'soft',
    rule_momentum_alignment_weight: 0.6,
    rule_drawdown_guard_mode: 'hard',
    rule_drawdown_guard_weight: 0.8,
    rule_macro_filter_mode: 'soft',
    rule_macro_filter_weight: 0.4
  } as const;

  private readonly statsDefaults = {
    symbol: 'BTCUSD',
    timeframe: '4h',
    lookback: 500,
    statsPack: 'Volatility',
    session: 'Full',
    includeWeekends: true
  } as const;

  private readonly seasonalityDefaults = {
    symbol: 'SPY',
    timeframe: '1d',
    window: 'Monthly',
    startYear: 2010,
    endYear: 2024,
    filter: 'All',
    normalize: true
  } as const;

  private readonly stressDefaults = {
    strategy: 'Breakout v2',
    symbol: 'SPY',
    timeframe: '1d',
    scenario: '2008 Crash',
    capital: 50000,
    leverage: 2,
    maxDdLimit: 25,
    mcPaths: 500
  } as const;

  readonly dcaForm = this.fb.group(
    {
      symbol: [this.dcaDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
      timeframe: [this.dcaDefaults.timeframe, Validators.required],
      frequency: [this.dcaDefaults.frequency, Validators.required],
      amount: [this.dcaDefaults.amount, [Validators.required, Validators.min(10)]],
      startDate: [this.dcaDefaults.startDate, Validators.required],
      endDate: [this.dcaDefaults.endDate, Validators.required],
      feePct: [this.dcaDefaults.feePct, [Validators.min(0)]],
      reinvestDividends: [this.dcaDefaults.reinvestDividends],
      broker: [this.dcaDefaults.broker]
    },
    { validators: dateRangeValidator('startDate', 'endDate') }
  );

  readonly backtestForm = this.fb.group(
    {
      strategy: [this.backtestDefaults.strategy, Validators.required],
      symbol: [this.backtestDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
      timeframe: [this.backtestDefaults.timeframe, Validators.required],
      startDate: [this.backtestDefaults.startDate, Validators.required],
      endDate: [this.backtestDefaults.endDate, Validators.required],
      capital: [this.backtestDefaults.capital, [Validators.required, Validators.min(1000)]],
      riskPct: [this.backtestDefaults.riskPct, [Validators.min(0.1)]],
      stopLoss: [this.backtestDefaults.stopLoss, [Validators.min(0.1)]],
      takeProfit: [this.backtestDefaults.takeProfit, [Validators.min(0.1)]],
      trailingStop: [this.backtestDefaults.trailingStop],
      signalType: [this.backtestDefaults.signalType, Validators.required],
      fast: [this.backtestDefaults.fast, [Validators.min(1)]],
      slow: [this.backtestDefaults.slow, [Validators.min(2)]],
      requireCrossing: [this.backtestDefaults.requireCrossing],
      atrWindow: [this.backtestDefaults.atrWindow, [Validators.min(2)]],
      atrK: [this.backtestDefaults.atrK, [Validators.min(0.1)]],
      rMult: [this.backtestDefaults.rMult, [Validators.min(0.1)]],
      slippageBps: [this.backtestDefaults.slippageBps, [Validators.min(0)]],
      feeBps: [this.backtestDefaults.feeBps, [Validators.min(0)]],
      dynamicSlEnabled: [this.backtestDefaults.dynamicSlEnabled],
      dynamicSlMode: [this.backtestDefaults.dynamicSlMode],
      dynamicSlAtrMult: [this.backtestDefaults.dynamicSlAtrMult, [Validators.min(0.1)]],
      tpslJitterEnabled: [this.backtestDefaults.tpslJitterEnabled],
      tpslJitterDist: [this.backtestDefaults.tpslJitterDist],
      tpslJitterTpBps: [this.backtestDefaults.tpslJitterTpBps, [Validators.min(0)]],
      tpslJitterSlBps: [this.backtestDefaults.tpslJitterSlBps, [Validators.min(0)]],
      tpslJitterSeed: [this.backtestDefaults.tpslJitterSeed, [Validators.min(0)]],
      filters: [this.backtestDefaults.filters],
      filterRules: [this.backtestDefaults.filterRules],
      filterRuleMinScore: [this.backtestDefaults.filterRuleMinScore, [Validators.min(0)]],
      filterRuleMinScorePct: [this.backtestDefaults.filterRuleMinScorePct, [Validators.min(0), Validators.max(100)]],
      screeningEnabled: [this.backtestDefaults.screeningEnabled],
      screenWindowStart: [this.backtestDefaults.screenWindowStart],
      screenWindowEnd: [this.backtestDefaults.screenWindowEnd],
      screenMaxBars: [this.backtestDefaults.screenMaxBars, [Validators.min(0)]],
      screenMaxTrades: [this.backtestDefaults.screenMaxTrades, [Validators.min(0)]],
      screenMaxSeconds: [this.backtestDefaults.screenMaxSeconds, [Validators.min(0)]],
      riskFreeRate: [this.backtestDefaults.riskFreeRate, [Validators.min(0), Validators.max(20)]],
      filter_volatility_guard_window: [this.backtestDefaults.filter_volatility_guard_window, [Validators.min(1)]],
      filter_volatility_guard_threshold: [this.backtestDefaults.filter_volatility_guard_threshold, [Validators.min(1)]],
      filter_trend_regime_lookback: [this.backtestDefaults.filter_trend_regime_lookback, [Validators.min(1)]],
      filter_trend_regime_min_strength: [this.backtestDefaults.filter_trend_regime_min_strength, [Validators.min(0), Validators.max(100)]],
      filter_liquidity_spread_max_spread_bps: [
        this.backtestDefaults.filter_liquidity_spread_max_spread_bps,
        [Validators.min(0)]
      ],
      filter_liquidity_spread_min_volume: [this.backtestDefaults.filter_liquidity_spread_min_volume, [Validators.min(0)]],
      rule_momentum_alignment_mode: [this.backtestDefaults.rule_momentum_alignment_mode],
      rule_momentum_alignment_weight: [this.backtestDefaults.rule_momentum_alignment_weight, [Validators.min(0), Validators.max(1)]],
      rule_drawdown_guard_mode: [this.backtestDefaults.rule_drawdown_guard_mode],
      rule_drawdown_guard_weight: [this.backtestDefaults.rule_drawdown_guard_weight, [Validators.min(0), Validators.max(1)]],
      rule_macro_filter_mode: [this.backtestDefaults.rule_macro_filter_mode],
      rule_macro_filter_weight: [this.backtestDefaults.rule_macro_filter_weight, [Validators.min(0), Validators.max(1)]]
    },
    { validators: dateRangeValidator('startDate', 'endDate') }
  );

  readonly marketStatsForm = this.fb.group({
    symbol: [this.statsDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
    timeframe: [this.statsDefaults.timeframe, Validators.required],
    lookback: [this.statsDefaults.lookback, [Validators.min(100), Validators.max(5000)]],
    statsPack: [this.statsDefaults.statsPack, Validators.required],
    session: [this.statsDefaults.session],
    includeWeekends: [this.statsDefaults.includeWeekends]
  });

  readonly seasonalityForm = this.fb.group({
    symbol: [this.seasonalityDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
    timeframe: [this.seasonalityDefaults.timeframe, Validators.required],
    window: [this.seasonalityDefaults.window, Validators.required],
    startYear: [this.seasonalityDefaults.startYear, [Validators.min(1990)]],
    endYear: [this.seasonalityDefaults.endYear, [Validators.max(new Date().getFullYear())]],
    filter: [this.seasonalityDefaults.filter],
    normalize: [this.seasonalityDefaults.normalize]
  });

  readonly stressForm = this.fb.group({
    strategy: [this.stressDefaults.strategy, Validators.required],
    symbol: [this.stressDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
    timeframe: [this.stressDefaults.timeframe, Validators.required],
    scenario: [this.stressDefaults.scenario, Validators.required],
    capital: [this.stressDefaults.capital, [Validators.min(1000)]],
    leverage: [this.stressDefaults.leverage, [Validators.min(1)]],
    maxDdLimit: [this.stressDefaults.maxDdLimit, [Validators.min(5)]],
    mcPaths: [this.stressDefaults.mcPaths, [Validators.min(100)]]
  });

  readonly dcaResult = signal<StrategyResult | null>(null);
  readonly backtestResult = signal<StrategyResult | null>(null);
  readonly marketStatsResult = signal<StrategyResult | null>(null);
  readonly seasonalityResult = signal<StrategyResult | null>(null);
  readonly stressResult = signal<StrategyResult | null>(null);

  readonly selectedRun = signal<RunKey>('dca');

  constructor() {
    this.runForSelection(this.selectedRun());
  }

  selectRun(key: RunKey): void {
    if (this.selectedRun() === key) {
      return;
    }
    this.selectedRun.set(key);
    this.runForSelection(key);
  }

  private runForSelection(key: RunKey): void {
    switch (key) {
      case 'dca':
        this.runDca();
        break;
      case 'backtests':
        this.runBacktest();
        break;
      case 'market-stats':
        this.runMarketStats();
        break;
      case 'seasonality':
        this.runSeasonality();
        break;
      case 'stress-tests':
        this.runStressTests();
        break;
      default:
        this.runDca();
    }
  }

  backtestSelectedFilters(): string[] {
    const value = this.backtestForm.get('filters')?.value as ReadonlyArray<string> | null | undefined;
    return value ? Array.from(value) : [];
  }

  backtestSelectedRules(): string[] {
    const value = this.backtestForm.get('filterRules')?.value as ReadonlyArray<string> | null | undefined;
    return value ? Array.from(value) : [];
  }

  backtestFilterParams(filterId: string): FilterParam[] {
    return this.backtestFilterOptions.find(option => option.id === filterId)?.params ?? [];
  }

  filterParamControlName(filterId: string, paramKey: string): string {
    return `filter_${filterId}_${paramKey}`;
  }

  ruleModeControlName(ruleId: string): string {
    return `rule_${ruleId}_mode`;
  }

  ruleWeightControlName(ruleId: string): string {
    return `rule_${ruleId}_weight`;
  }

  runDca(): void {
    if (this.dcaForm.invalid) {
      this.dcaForm.markAllAsTouched();
      return;
    }

    const value = this.dcaForm.getRawValue();
    const symbol = value.symbol ?? this.dcaDefaults.symbol;
    const timeframe = value.timeframe ?? this.dcaDefaults.timeframe;
    const frequency = value.frequency ?? this.dcaDefaults.frequency;
    const amount = Number(value.amount ?? this.dcaDefaults.amount);
    const startDate = value.startDate ?? this.dcaDefaults.startDate;
    const endDate = value.endDate ?? this.dcaDefaults.endDate;
    const feePct = Number(value.feePct ?? this.dcaDefaults.feePct);

    const orders = estimateOrders(startDate, endDate, frequency);
    const basePrice = symbolBasePrice(symbol);
    const seed = hashSeed(symbol, timeframe, frequency, startDate, endDate);
    const avgPrice = jitter(basePrice, seed, 0.06);
    const currentPrice = jitter(basePrice, seed + 9, 0.08);
    const invested = orders * amount;
    const feeCost = invested * (feePct / 100);
    const units = invested / avgPrice;
    const currentValue = units * currentPrice;
    const pnl = currentValue - invested - feeCost;
    const roi = invested > 0 ? (pnl / invested) * 100 : 0;

    this.dcaResult.set({
      runId: this.buildRunId('DCA'),
      executedAt: new Date(),
      summary: `${symbol} | ${timeframe} | ${frequencyLabel(frequency)} | ${orders} achats`,
      status: roi >= 0 ? 'OK' : 'Watch',
      tags: [symbol, timeframe, frequencyLabel(frequency), value.broker ?? this.dcaDefaults.broker],
      metrics: [
        { label: 'Investi total', value: formatCurrency(invested) },
        { label: 'Nb achats', value: `${orders}` },
        { label: 'Prix moyen', value: formatCurrency(avgPrice) },
        {
          label: 'P&L estime',
          value: formatCurrency(pnl),
          tone: pnl >= 0 ? 'positive' : 'negative'
        },
        {
          label: 'ROI estime',
          value: formatPercent(roi),
          tone: roi >= 0 ? 'positive' : 'negative'
        }
      ]
    });
  }

  resetDca(): void {
    this.dcaForm.reset(this.dcaDefaults);
    this.runDca();
  }

  runBacktest(): void {
    if (this.backtestForm.invalid) {
      this.backtestForm.markAllAsTouched();
      return;
    }

    const value = this.backtestForm.getRawValue();
    const strategy = value.strategy ?? this.backtestDefaults.strategy;
    const symbol = value.symbol ?? this.backtestDefaults.symbol;
    const timeframe = value.timeframe ?? this.backtestDefaults.timeframe;
    const startDate = value.startDate ?? this.backtestDefaults.startDate;
    const endDate = value.endDate ?? this.backtestDefaults.endDate;
    const capital = Number(value.capital ?? this.backtestDefaults.capital);
    const riskPct = Number(value.riskPct ?? this.backtestDefaults.riskPct);

    const yearSpan = rangeYears(startDate, endDate) || 1;
    const seed = hashSeed(strategy, symbol, timeframe, startDate, endDate);
    const base = backtestBase(strategy);
    const factor = timeframeFactor(timeframe);
    const cagr = base.cagr * factor + (seed % 4);
    const maxDd = base.maxDd * (1 + (seed % 6) / 20);
    const sharpe = base.sharpe * factor + (seed % 7) / 30;
    const winRate = base.winRate + (seed % 9) - 4;
    const trades = Math.round(base.tradesPerYear * factor * yearSpan);
    const profitFactor = base.profitFactor + (seed % 6) / 10;
    const expectedGain = (capital * cagr * yearSpan) / 100;

    this.backtestResult.set({
      runId: this.buildRunId('BACK'),
      executedAt: new Date(),
      summary: `${strategy} | ${symbol} | ${timeframe} | ${yearSpan.toFixed(1)}y`,
      status: cagr > 0 ? 'OK' : 'Watch',
      tags: [strategy, symbol, `${riskPct}% risk`],
      metrics: [
        { label: 'CAGR', value: formatPercent(cagr), tone: cagr >= 0 ? 'positive' : 'negative' },
        { label: 'Max DD', value: formatPercent(maxDd), tone: 'negative' },
        { label: 'Sharpe', value: NUMBER_FORMAT.format(sharpe) },
        { label: 'Win rate', value: formatPercent(winRate) },
        { label: 'Trades', value: NUMBER_FORMAT.format(trades) },
        { label: 'Profit factor', value: NUMBER_FORMAT.format(profitFactor) },
        { label: 'Gain estime', value: formatCurrency(expectedGain), tone: expectedGain >= 0 ? 'positive' : 'negative' }
      ]
    });
  }

  resetBacktest(): void {
    this.backtestForm.reset(this.backtestDefaults);
    this.runBacktest();
  }

  runMarketStats(): void {
    if (this.marketStatsForm.invalid) {
      this.marketStatsForm.markAllAsTouched();
      return;
    }

    const value = this.marketStatsForm.getRawValue();
    const symbol = value.symbol ?? this.statsDefaults.symbol;
    const timeframe = value.timeframe ?? this.statsDefaults.timeframe;
    const lookback = Number(value.lookback ?? this.statsDefaults.lookback);
    const pack = value.statsPack ?? this.statsDefaults.statsPack;
    const session = value.session ?? this.statsDefaults.session;

    const seed = hashSeed(symbol, timeframe, lookback, pack, session);
    const baseVol = marketVolatility(symbol);
    const vol = baseVol * timeframeFactor(timeframe) + (seed % 6);
    const avgRange = (symbolBasePrice(symbol) * vol) / 100 / 8;
    const trendScore = 40 + (seed % 50);
    const liquidity = 60 + (seed % 30);
    const skewness = (seed % 9) / 10 - 0.3;

    this.marketStatsResult.set({
      runId: this.buildRunId('STAT'),
      executedAt: new Date(),
      summary: `${symbol} | ${timeframe} | ${lookback} candles | ${pack}`,
      status: 'INFO',
      tags: [pack, session, value.includeWeekends ? 'weekends' : 'weekdays'],
      metrics: [
        { label: 'Volatility', value: formatPercent(vol) },
        { label: 'Avg range', value: formatCurrency(avgRange) },
        { label: 'Trend score', value: NUMBER_FORMAT.format(trendScore) },
        { label: 'Liquidity', value: NUMBER_FORMAT.format(liquidity) },
        { label: 'Skewness', value: NUMBER_FORMAT.format(skewness) }
      ]
    });
  }

  resetMarketStats(): void {
    this.marketStatsForm.reset(this.statsDefaults);
    this.runMarketStats();
  }

  runSeasonality(): void {
    if (this.seasonalityForm.invalid) {
      this.seasonalityForm.markAllAsTouched();
      return;
    }

    const value = this.seasonalityForm.getRawValue();
    const symbol = value.symbol ?? this.seasonalityDefaults.symbol;
    const timeframe = value.timeframe ?? this.seasonalityDefaults.timeframe;
    const window = value.window ?? this.seasonalityDefaults.window;
    const startYear = Number(value.startYear ?? this.seasonalityDefaults.startYear);
    const endYear = Number(value.endYear ?? this.seasonalityDefaults.endYear);

    const seed = hashSeed(symbol, timeframe, window, startYear, endYear);
    const bestMonth = MONTH_NAMES[seed % MONTH_NAMES.length];
    const worstMonth = MONTH_NAMES[(seed + 4) % MONTH_NAMES.length];
    const bestDow = DOW_NAMES[(seed + 2) % DOW_NAMES.length];
    const hitRate = 52 + (seed % 16);
    const amplitude = 3 + (seed % 10);
    const sampleYears = Math.max(1, endYear - startYear + 1);

    this.seasonalityResult.set({
      runId: this.buildRunId('SEAS'),
      executedAt: new Date(),
      summary: `${symbol} | ${timeframe} | ${window} | ${sampleYears}y`,
      status: 'INFO',
      tags: [window, value.filter ?? this.seasonalityDefaults.filter, value.normalize ? 'normalized' : 'raw'],
      metrics: [
        { label: 'Best month', value: bestMonth },
        { label: 'Worst month', value: worstMonth },
        { label: 'Best day', value: bestDow },
        { label: 'Hit rate', value: formatPercent(hitRate) },
        { label: 'Amplitude', value: formatPercent(amplitude) },
        { label: 'Sample', value: `${sampleYears} years` }
      ]
    });
  }

  resetSeasonality(): void {
    this.seasonalityForm.reset(this.seasonalityDefaults);
    this.runSeasonality();
  }

  runStressTests(): void {
    if (this.stressForm.invalid) {
      this.stressForm.markAllAsTouched();
      return;
    }

    const value = this.stressForm.getRawValue();
    const strategy = value.strategy ?? this.stressDefaults.strategy;
    const symbol = value.symbol ?? this.stressDefaults.symbol;
    const timeframe = value.timeframe ?? this.stressDefaults.timeframe;
    const scenario = value.scenario ?? this.stressDefaults.scenario;
    const capital = Number(value.capital ?? this.stressDefaults.capital);
    const leverage = Number(value.leverage ?? this.stressDefaults.leverage);
    const maxDdLimit = Number(value.maxDdLimit ?? this.stressDefaults.maxDdLimit);

    const seed = hashSeed(strategy, symbol, timeframe, scenario, leverage);
    const baseDd = 12 + (seed % 12);
    const maxDd = baseDd * (1 + leverage / 10);
    const recoveryDays = 60 + (seed % 120);
    const var95 = 6 + (seed % 8) * (1 + leverage / 12);
    const worstLoss = (capital * maxDd) / 100;
    const pass = maxDd <= maxDdLimit;

    this.stressResult.set({
      runId: this.buildRunId('STRESS'),
      executedAt: new Date(),
      summary: `${strategy} | ${symbol} | ${scenario} | lev ${leverage}x`,
      status: pass ? 'PASS' : 'FAIL',
      tags: [scenario, `${value.mcPaths ?? this.stressDefaults.mcPaths} paths`],
      metrics: [
        { label: 'Max DD', value: formatPercent(maxDd), tone: pass ? 'neutral' : 'negative' },
        { label: 'VaR 95', value: formatPercent(var95) },
        { label: 'Worst loss', value: formatCurrency(worstLoss), tone: 'negative' },
        { label: 'Recovery days', value: NUMBER_FORMAT.format(recoveryDays) },
        { label: 'Limit', value: formatPercent(maxDdLimit) }
      ]
    });
  }

  resetStressTests(): void {
    this.stressForm.reset(this.stressDefaults);
    this.runStressTests();
  }

  private buildRunId(prefix: string): string {
    const stamp = new Date();
    const date = `${stamp.getFullYear()}${pad2(stamp.getMonth() + 1)}${pad2(stamp.getDate())}`;
    const time = `${pad2(stamp.getHours())}${pad2(stamp.getMinutes())}${pad2(stamp.getSeconds())}`;
    return `${prefix}-${date}-${time}`;
  }
}

function symbolListValidator(symbols: string[]) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) {
      return null;
    }
    return symbols.includes(String(value)) ? null : { symbolUnknown: true };
  };
}

function dateRangeValidator(startKey: string, endKey: string) {
  return (control: AbstractControl): ValidationErrors | null => {
    const startValue = control.get(startKey)?.value as Date | string | null | undefined;
    const endValue = control.get(endKey)?.value as Date | string | null | undefined;
    if (!startValue || !endValue) {
      return null;
    }
    const start = startValue instanceof Date ? startValue : new Date(startValue);
    const end = endValue instanceof Date ? endValue : new Date(endValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    return start <= end ? null : { dateRange: true };
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatPercent(value: number): string {
  return `${NUMBER_FORMAT.format(value)}%`;
}

function formatCurrency(value: number): string {
  return CURRENCY_FORMAT.format(value);
}

function hashSeed(...parts: Array<string | number | Date | null | undefined>): number {
  const text = parts
    .map(part => {
      if (part === null || part === undefined) {
        return '';
      }
      if (part instanceof Date) {
        return Number.isNaN(part.getTime()) ? '' : part.toISOString();
      }
      return String(part);
    })
    .join('|');

  let hash = 7;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 10000;
  }
  return hash;
}

function symbolBasePrice(symbol: string): number {
  return SYMBOL_BASE_PRICE[symbol] ?? 100;
}

function timeframeFactor(timeframe: string): number {
  return TIMEFRAME_FACTOR[timeframe] ?? 1;
}

function jitter(base: number, seed: number, pct: number): number {
  const offset = (seed % 10) / 100 - 0.05;
  return base * (1 + offset * (pct / 0.05));
}

function estimateOrders(startDate: string | Date, endDate: string | Date, frequency: string): number {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  const days = Math.max(0, (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const step = FREQUENCY_DAYS[frequency] ?? 30;
  return Math.max(1, Math.floor(days / step) + 1);
}

function rangeYears(startDate: string | Date, endDate: string | Date): number {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  const days = Math.max(0, (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return days / 365;
}

function backtestBase(strategy: string): {
  cagr: number;
  maxDd: number;
  sharpe: number;
  winRate: number;
  tradesPerYear: number;
  profitFactor: number;
} {
  switch (strategy) {
    case 'Breakout':
      return { cagr: 18, maxDd: 22, sharpe: 1.4, winRate: 48, tradesPerYear: 180, profitFactor: 1.35 };
    case 'Momentum':
      return { cagr: 20, maxDd: 24, sharpe: 1.3, winRate: 46, tradesPerYear: 140, profitFactor: 1.4 };
    case 'MA Crossover':
      return { cagr: 15, maxDd: 20, sharpe: 1.2, winRate: 45, tradesPerYear: 120, profitFactor: 1.25 };
    default:
      return { cagr: 12, maxDd: 18, sharpe: 1.1, winRate: 50, tradesPerYear: 200, profitFactor: 1.3 };
  }
}

function marketVolatility(symbol: string): number {
  switch (symbol) {
    case 'BTCUSD':
      return 65;
    case 'ETHUSD':
      return 70;
    case 'XAUUSD':
      return 22;
    case 'AAPL':
      return 28;
    case 'SPY':
      return 18;
    case 'EURUSD':
      return 12;
    default:
      return 20;
  }
}

function frequencyLabel(value: string): string {
  switch (value) {
    case 'weekly':
      return 'Hebdo';
    case 'biweekly':
      return '2 semaines';
    case 'monthly':
      return 'Mensuel';
    default:
      return value;
  }
}
