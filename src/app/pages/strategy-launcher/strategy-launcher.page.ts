import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, UntypedFormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  RunRequestInput,
  DcaStrategyCore,
  BacktestTpSlBlock,
  BacktestScreeningBlock,
  BacktestFiltersBlock,
  MarketStatsBlock,
  SeasonalityBlock,
  PerformanceBlock,
  MonteCarloStressTests,
  ValidationError,
  validateRunRequest
} from '../../models/run-request-input.model';
import { SpecsPreviewService, SpecPreviewResponse } from '../../services/specs-preview.service';
import { PresetsService, RunPreset } from '../../services/presets.service';
import { RunsService } from '../../services/runs.service';
import { ParameterCatalogService } from '../../services/parameter-catalog.service';
import { finalize } from 'rxjs';
import { mapRunRequestToCanonical, CanonicalRunRequest } from '../../services/run-request-adapter';
import {
  BackendMappingContext,
  BackendValidationError,
  RunTheme,
  mapBackendFieldToControlName,
  parseBackendValidationErrors
} from '../../utils/backend-validation';
import { mergePresetFormValue } from '../../utils/preset-form-fallback';
import { PresetCompatibility, evaluatePresetCompatibility } from '../../utils/preset-version';

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
type DcaStrategyType = 'dca_equity' | 'dca_etf' | 'crypto_grid';
type DcaParamTab = 'params' | 'stress';
type BacktestParamTab = 'params' | 'stress';

interface UiValidationError {
  source: 'local' | 'backend';
  path?: string;
  field?: string;
  code?: string;
  message: string;
}

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

interface MarketOption {
  id: string;
  label: string;
  params: FilterParam[];
}

interface SeasonalityOption {
  id: string;
  label: string;
  params: FilterParam[];
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
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatSelectModule,
    MatTooltipModule
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
  private readonly specsPreview = inject(SpecsPreviewService);
  private readonly runsService = inject(RunsService);
  private readonly router = inject(Router);
  private readonly presetsService = inject(PresetsService);
  private readonly catalogService = inject(ParameterCatalogService);

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

  signalTypes = ['ema_cross', 'ema_rsi', 'breakout_channel'];
  readonly dynamicSlModes = ['atr_trailing', 'fixed', 'hybrid'];
  readonly jitterDistributions = ['gaussian', 'uniform', 'laplace'];
  dcaStrategyTypes: DcaStrategyType[] = ['dca_equity', 'dca_etf', 'crypto_grid'];
  readonly dcaGridPresets = ['grid_conservative', 'grid_balanced', 'grid_aggressive'];
  readonly dcaExecutionModes = ['limit', 'market', 'vwap'];
  readonly dcaDrawdownRefs = ['rolling_high', 'rolling_avg', 'benchmark'];
  readonly dcaTpSlPresets = ['none', 'tp_2_sl_1', 'tp_3_sl_1.5'];
  readonly dcaUniverseOptions = [
    { id: 'SPY', label: 'SPY', assetClass: 'ETF', exchange: 'NYSE', broker: 'IBKR' },
    { id: 'QQQ', label: 'QQQ', assetClass: 'ETF', exchange: 'NASDAQ', broker: 'IBKR' },
    { id: 'AAPL', label: 'AAPL', assetClass: 'Equity', exchange: 'NASDAQ', broker: 'IBKR' },
    { id: 'BTCUSD', label: 'BTCUSD', assetClass: 'Crypto', exchange: 'BINANCE', broker: 'BINANCE' },
    { id: 'ETHUSD', label: 'ETHUSD', assetClass: 'Crypto', exchange: 'COINBASE', broker: 'COINBASE' }
  ];

  backtestFilterOptions: FilterOption[] = [
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

  backtestRuleOptions: FilterRuleOption[] = [
    { id: 'momentum_alignment', label: 'Momentum alignment' },
    { id: 'drawdown_guard', label: 'Drawdown guard' },
    { id: 'macro_filter', label: 'Macro filter' }
  ];

  marketEventOptions: MarketOption[] = [
    {
      id: 'vol_spike',
      label: 'Volatility spike',
      params: [
        { key: 'window', label: 'Fenetre', type: 'number', min: 5, max: 120, step: 1 },
        { key: 'threshold', label: 'Seuil %', type: 'number', min: 5, max: 80, step: 1 }
      ]
    },
    {
      id: 'gap_open',
      label: 'Gap open',
      params: [
        { key: 'gap_pct', label: 'Gap %', type: 'number', min: 0.5, max: 20, step: 0.1 },
        { key: 'session', label: 'Session', type: 'select', options: ['RTH', 'Asia', 'Full'] }
      ]
    },
    {
      id: 'breakout',
      label: 'Breakout',
      params: [
        { key: 'lookback', label: 'Lookback', type: 'number', min: 10, max: 300, step: 5 },
        { key: 'buffer_pct', label: 'Buffer %', type: 'number', min: 0, max: 5, step: 0.1 }
      ]
    }
  ];

  marketConditionOptions: MarketOption[] = [
    {
      id: 'trend_regime',
      label: 'Trend regime',
      params: [
        { key: 'ma_fast', label: 'MA fast', type: 'number', min: 5, max: 100, step: 1 },
        { key: 'ma_slow', label: 'MA slow', type: 'number', min: 20, max: 300, step: 5 }
      ]
    },
    {
      id: 'liquidity_gate',
      label: 'Liquidity gate',
      params: [
        { key: 'min_volume', label: 'Volume min', type: 'number', min: 1000, max: 1000000, step: 1000 },
        { key: 'max_spread_bps', label: 'Spread max (bps)', type: 'number', min: 1, max: 50, step: 1 }
      ]
    },
    {
      id: 'volatility_band',
      label: 'Volatility band',
      params: [
        { key: 'vol_min', label: 'Vol min %', type: 'number', min: 5, max: 60, step: 1 },
        { key: 'vol_max', label: 'Vol max %', type: 'number', min: 10, max: 120, step: 1 }
      ]
    }
  ];

  marketTargetOptions: MarketOption[] = [
    {
      id: 'mean_reversion',
      label: 'Mean reversion',
      params: [
        { key: 'horizon', label: 'Horizon', type: 'number', min: 5, max: 200, step: 1 },
        { key: 'zscore', label: 'Z-score', type: 'number', min: 0.5, max: 5, step: 0.1 }
      ]
    },
    {
      id: 'momentum_follow',
      label: 'Momentum follow',
      params: [
        { key: 'hold_days', label: 'Hold days', type: 'number', min: 1, max: 90, step: 1 },
        { key: 'min_return', label: 'Min return %', type: 'number', min: 0, max: 20, step: 0.5 }
      ]
    },
    {
      id: 'range_extension',
      label: 'Range extension',
      params: [
        { key: 'range_pct', label: 'Range %', type: 'number', min: 1, max: 25, step: 0.5 },
        { key: 'exit_pct', label: 'Exit %', type: 'number', min: 0.5, max: 10, step: 0.5 }
      ]
    }
  ];

  seasonalityProfileOptions: SeasonalityOption[] = [
    {
      id: 'by_hour',
      label: 'By hour',
      params: [
        { key: 'tz', label: 'Timezone', type: 'select', options: ['UTC', 'NY', 'LON'] },
        { key: 'bin_size', label: 'Bin size (h)', type: 'number', min: 1, max: 6, step: 1 }
      ]
    },
    {
      id: 'by_dow',
      label: 'By day of week',
      params: [
        { key: 'week_start', label: 'Week start', type: 'select', options: ['Mon', 'Sun'] },
        { key: 'smooth', label: 'Smooth', type: 'number', min: 0, max: 5, step: 0.5 }
      ]
    },
    {
      id: 'by_month',
      label: 'By month',
      params: [
        { key: 'rolling', label: 'Rolling', type: 'select', options: ['off', '3m', '6m'] },
        { key: 'normalize', label: 'Normalize', type: 'select', options: ['none', 'zscore'] }
      ]
    },
    {
      id: 'by_session',
      label: 'By session',
      params: [
        { key: 'sessions', label: 'Sessions', type: 'select', options: ['Asia/Europe/US', 'RTH only'] },
        { key: 'min_bars', label: 'Min bars', type: 'number', min: 50, max: 2000, step: 50 }
      ]
    }
  ];

  readonly seasonalitySignalMethods = ['zscore', 'percentile', 'topk'];
  seasonalitySignalDims = ['hour', 'dow', 'month', 'session', 'symbol'];
  readonly seasonalityCombineModes = ['mean', 'weighted', 'vote'];

  readonly backtestStrategies = ['Breakout', 'Mean Reversion', 'Momentum', 'MA Crossover'];
  readonly statsPacks = ['Volatility', 'Liquidity', 'Regime', 'Microstructure'];
  readonly seasonalityWindows = ['Monthly', 'Weekly', 'Day of Week', 'Intraday'];
  readonly seasonalityFilters = ['All', 'Bull', 'Bear'];
  readonly stressStrategies = ['Breakout v2', 'Trend Rider', 'Carry FX', 'Stat Arb'];
  readonly stressScenarios = ['2008 Crash', 'Covid 2020', 'Flash Crash 2010', 'Rates Shock 2022'];
  stressSourceOptions = ['equity', 'returns', 'trades'];
  stressMethodOptions = ['bootstrap', 'block_bootstrap', 'gaussian'];
  readonly stressTimeDistModes = ['calendar', 'business', 'custom'];
  readonly stressParamDriftModes = ['none', 'linear', 'stochastic'];
  readonly stressParamDriftDists = ['normal', 'uniform', 'triangular'];
  readonly stressSizingDists = ['fixed', 'normal', 'lognormal', 'uniform'];
  readonly stressOutputModes = ['summary', 'full', 'quantiles'];
  stressScenarioTypes = ['shock', 'vol_shift', 'drawdown', 'crash_window'];
  readonly stressAggregationModes = ['sum', 'mean', 'weighted'];
  readonly stressAlignmentModes = ['asof', 'inner', 'outer'];
  readonly stressScenarioSlots = [1, 2, 3];

  private readonly dcaDefaults = {
    symbol: 'BTCUSD',
    timeframe: '1h',
    frequency: 'weekly',
    amount: 200,
    startDate: new Date(2023, 0, 1),
    endDate: new Date(2024, 11, 31),
    feePct: 0.1,
    reinvestDividends: true,
    broker: 'BINANCE',
    strategyType: 'dca_equity' as DcaStrategyType,
    gridPresets: ['grid_balanced'],
    drawdownReference: 'rolling_high',
    executionMode: 'limit',
    tpSlPreset: 'tp_2_sl_1',
    requireCrossing: true,
    activationLimit: 8,
    resetOnNewHigh: true,
    rearmOnReboundPct: 6,
    forceCloseEnd: false,
    cryptoTpSlPreset: 'tp_3_sl_1.5',
    universe: ['SPY', 'AAPL'],
    filters: ['volatility_guard'],
    filterRules: ['momentum_alignment'],
    filterRuleMinScore: 60,
    filterRuleMinScorePct: 70,
    initialCapital: 25000,
    capitalPerUnit: 500,
    maxCapitalPerTrade: 2500,
    mcEnabled: false,
    mcPaths: 500,
    mcHorizonDays: 180,
    mcShockVolPct: 22,
    mcSeed: 7,
    dca_filter_volatility_guard_window: 30,
    dca_filter_volatility_guard_threshold: 22,
    dca_filter_trend_regime_lookback: 120,
    dca_filter_trend_regime_min_strength: 55,
    dca_filter_liquidity_spread_max_spread_bps: 12,
    dca_filter_liquidity_spread_min_volume: 20000,
    dca_rule_momentum_alignment_mode: 'soft',
    dca_rule_momentum_alignment_weight: 0.6,
    dca_rule_drawdown_guard_mode: 'hard',
    dca_rule_drawdown_guard_weight: 0.8,
    dca_rule_macro_filter_mode: 'soft',
    dca_rule_macro_filter_weight: 0.4
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
    rule_macro_filter_weight: 0.4,
    mcEnabled: false,
    mcPaths: 800,
    mcHorizonDays: 120,
    mcShockVolPct: 18,
    mcSeed: 11
  } as const;

  private readonly statsDefaults = {
    symbol: 'BTCUSD',
    timeframe: '4h',
    lookback: 500,
    statsPack: 'Volatility',
    session: 'Full',
    includeWeekends: true,
    eventId: 'vol_spike',
    conditionId: 'trend_regime',
    targetId: 'mean_reversion',
    validationTrainMonths: 18,
    validationTestMonths: 6,
    validationFolds: 4,
    validationEmbargoDays: 3,
    persistenceEnabled: false,
    persistenceSpecId: 'spec_001',
    persistenceDatasetId: 'dataset_main',
    artifactsOutDir: 'artifacts/market-stats',
    event_vol_spike_window: 20,
    event_vol_spike_threshold: 25,
    event_gap_open_gap_pct: 1.5,
    event_gap_open_session: 'RTH',
    event_breakout_lookback: 50,
    event_breakout_buffer_pct: 0.5,
    condition_trend_regime_ma_fast: 20,
    condition_trend_regime_ma_slow: 120,
    condition_liquidity_gate_min_volume: 50000,
    condition_liquidity_gate_max_spread_bps: 10,
    condition_volatility_band_vol_min: 12,
    condition_volatility_band_vol_max: 40,
    target_mean_reversion_horizon: 30,
    target_mean_reversion_zscore: 1.5,
    target_momentum_follow_hold_days: 14,
    target_momentum_follow_min_return: 2.5,
    target_range_extension_range_pct: 5,
    target_range_extension_exit_pct: 2
  } as const;

  private readonly seasonalityDefaults = {
    symbol: 'SPY',
    timeframe: '1d',
    window: 'Monthly',
    startYear: 2010,
    endYear: 2024,
    filter: 'All',
    normalize: true,
    profileId: 'by_month',
    profileMeasure: 'avg_return',
    profileRetHorizon: 5,
    profileMinSamples: 100,
    signalMethod: 'zscore',
    signalThreshold: 1.2,
    signalTopk: 5,
    signalDims: ['month'],
    signalCombine: 'mean',
    optunaMaxTrials: 80,
    optunaSearchSpace: 'default',
    executionRiskModel: 'fixed_fraction',
    executionTpSl: 'tp_2_sl_1',
    validationTrainMonths: 24,
    validationTestMonths: 6,
    validationFolds: 3,
    validationEmbargoDays: 2,
    persistenceEnabled: false,
    persistenceSpecId: 'seas_001',
    persistenceDatasetId: 'seasonality_ds',
    artifactsOutDir: 'artifacts/seasonality',
    profile_by_hour_tz: 'UTC',
    profile_by_hour_bin_size: 1,
    profile_by_dow_week_start: 'Mon',
    profile_by_dow_smooth: 1,
    profile_by_month_rolling: 'off',
    profile_by_month_normalize: 'none',
    profile_by_session_sessions: 'Asia/Europe/US',
    profile_by_session_min_bars: 200
  } as const;

  private readonly stressDefaults = {
    strategy: 'Breakout v2',
    symbol: 'SPY',
    timeframe: '1d',
    scenario: '2008 Crash',
    capital: 50000,
    leverage: 2,
    maxDdLimit: 25,
    mcPaths: 500,
    source: 'equity',
    nSims: 2000,
    seed: 42,
    method: 'block_bootstrap',
    blockSize: 20,
    overlapping: true,
    timeDistMode: 'business',
    timeDistSeed: 11,
    paramDriftMode: 'stochastic',
    paramDriftDist: 'normal',
    paramDriftMu: 0.0,
    paramDriftSigma: 0.25,
    paramDriftLow: -0.5,
    paramDriftHigh: 0.5,
    paramDriftMin: -0.8,
    paramDriftMax: 0.8,
    paramDriftSeed: 21,
    sizingDist: 'lognormal',
    sizingMu: 0.0,
    sizingSigma: 0.6,
    sizingLow: 0.5,
    sizingHigh: 1.8,
    sizingMin: 0.2,
    sizingMax: 2.5,
    outputMode: 'summary',
    outputMaxCurves: 40,
    outputCurveStride: 5,
    scenario1Type: 'shock',
    scenario1ShockPct: 12,
    scenario1VolMultiplier: 1.4,
    scenario1DrawdownPct: 18,
    scenario1Window: 30,
    scenario1Index: 'SPX',
    scenario2Type: 'vol_shift',
    scenario2ShockPct: 6,
    scenario2VolMultiplier: 1.8,
    scenario2DrawdownPct: 10,
    scenario2Window: 45,
    scenario2Index: 'VIX',
    scenario3Type: 'drawdown',
    scenario3ShockPct: 8,
    scenario3VolMultiplier: 1.2,
    scenario3DrawdownPct: 22,
    scenario3Window: 60,
    scenario3Index: 'NDX',
    aggregation: 'weighted',
    weights: '0.5,0.3,0.2',
    timestampAlignment: 'asof'
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
      broker: [this.dcaDefaults.broker],
      strategyType: [this.dcaDefaults.strategyType, Validators.required],
      gridPresets: [this.dcaDefaults.gridPresets],
      drawdownReference: [this.dcaDefaults.drawdownReference],
      executionMode: [this.dcaDefaults.executionMode],
      tpSlPreset: [this.dcaDefaults.tpSlPreset],
      requireCrossing: [this.dcaDefaults.requireCrossing],
      activationLimit: [this.dcaDefaults.activationLimit, [Validators.min(0)]],
      resetOnNewHigh: [this.dcaDefaults.resetOnNewHigh],
      rearmOnReboundPct: [this.dcaDefaults.rearmOnReboundPct, [Validators.min(0)]],
      forceCloseEnd: [this.dcaDefaults.forceCloseEnd],
      cryptoTpSlPreset: [this.dcaDefaults.cryptoTpSlPreset],
      universe: [this.dcaDefaults.universe],
      filters: [this.dcaDefaults.filters],
      filterRules: [this.dcaDefaults.filterRules],
      filterRuleMinScore: [this.dcaDefaults.filterRuleMinScore, [Validators.min(0)]],
      filterRuleMinScorePct: [this.dcaDefaults.filterRuleMinScorePct, [Validators.min(0), Validators.max(100)]],
      initialCapital: [this.dcaDefaults.initialCapital, [Validators.min(0)]],
      capitalPerUnit: [this.dcaDefaults.capitalPerUnit, [Validators.min(0)]],
      maxCapitalPerTrade: [this.dcaDefaults.maxCapitalPerTrade, [Validators.min(0)]],
      mcEnabled: [this.dcaDefaults.mcEnabled],
      mcPaths: [this.dcaDefaults.mcPaths, [Validators.min(10)]],
      mcHorizonDays: [this.dcaDefaults.mcHorizonDays, [Validators.min(1)]],
      mcShockVolPct: [this.dcaDefaults.mcShockVolPct, [Validators.min(0)]],
      mcSeed: [this.dcaDefaults.mcSeed, [Validators.min(0)]],
      dca_filter_volatility_guard_window: [this.dcaDefaults.dca_filter_volatility_guard_window, [Validators.min(1)]],
      dca_filter_volatility_guard_threshold: [this.dcaDefaults.dca_filter_volatility_guard_threshold, [Validators.min(1)]],
      dca_filter_trend_regime_lookback: [this.dcaDefaults.dca_filter_trend_regime_lookback, [Validators.min(1)]],
      dca_filter_trend_regime_min_strength: [this.dcaDefaults.dca_filter_trend_regime_min_strength, [Validators.min(0), Validators.max(100)]],
      dca_filter_liquidity_spread_max_spread_bps: [
        this.dcaDefaults.dca_filter_liquidity_spread_max_spread_bps,
        [Validators.min(0)]
      ],
      dca_filter_liquidity_spread_min_volume: [this.dcaDefaults.dca_filter_liquidity_spread_min_volume, [Validators.min(0)]],
      dca_rule_momentum_alignment_mode: [this.dcaDefaults.dca_rule_momentum_alignment_mode],
      dca_rule_momentum_alignment_weight: [this.dcaDefaults.dca_rule_momentum_alignment_weight, [Validators.min(0), Validators.max(1)]],
      dca_rule_drawdown_guard_mode: [this.dcaDefaults.dca_rule_drawdown_guard_mode],
      dca_rule_drawdown_guard_weight: [this.dcaDefaults.dca_rule_drawdown_guard_weight, [Validators.min(0), Validators.max(1)]],
      dca_rule_macro_filter_mode: [this.dcaDefaults.dca_rule_macro_filter_mode],
      dca_rule_macro_filter_weight: [this.dcaDefaults.dca_rule_macro_filter_weight, [Validators.min(0), Validators.max(1)]],
      presetName: [''],
      presetId: ['']
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
      rule_macro_filter_weight: [this.backtestDefaults.rule_macro_filter_weight, [Validators.min(0), Validators.max(1)]],
      mcEnabled: [this.backtestDefaults.mcEnabled],
      mcPaths: [this.backtestDefaults.mcPaths, [Validators.min(10)]],
      mcHorizonDays: [this.backtestDefaults.mcHorizonDays, [Validators.min(1)]],
      mcShockVolPct: [this.backtestDefaults.mcShockVolPct, [Validators.min(0)]],
      mcSeed: [this.backtestDefaults.mcSeed, [Validators.min(0)]],
      presetName: [''],
      presetId: ['']
    },
    { validators: dateRangeValidator('startDate', 'endDate') }
  );

  readonly marketStatsForm = this.fb.group({
    symbol: [this.statsDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
    timeframe: [this.statsDefaults.timeframe, Validators.required],
    lookback: [this.statsDefaults.lookback, [Validators.min(100), Validators.max(5000)]],
    statsPack: [this.statsDefaults.statsPack, Validators.required],
    session: [this.statsDefaults.session],
    includeWeekends: [this.statsDefaults.includeWeekends],
    eventId: [this.statsDefaults.eventId, Validators.required],
    conditionId: [this.statsDefaults.conditionId, Validators.required],
    targetId: [this.statsDefaults.targetId, Validators.required],
    validationTrainMonths: [this.statsDefaults.validationTrainMonths, [Validators.min(1)]],
    validationTestMonths: [this.statsDefaults.validationTestMonths, [Validators.min(1)]],
    validationFolds: [this.statsDefaults.validationFolds, [Validators.min(1)]],
    validationEmbargoDays: [this.statsDefaults.validationEmbargoDays, [Validators.min(0)]],
    persistenceEnabled: [this.statsDefaults.persistenceEnabled],
    persistenceSpecId: [this.statsDefaults.persistenceSpecId],
    persistenceDatasetId: [this.statsDefaults.persistenceDatasetId],
    artifactsOutDir: [this.statsDefaults.artifactsOutDir],
    event_vol_spike_window: [this.statsDefaults.event_vol_spike_window, [Validators.min(1)]],
    event_vol_spike_threshold: [this.statsDefaults.event_vol_spike_threshold, [Validators.min(1)]],
    event_gap_open_gap_pct: [this.statsDefaults.event_gap_open_gap_pct, [Validators.min(0)]],
    event_gap_open_session: [this.statsDefaults.event_gap_open_session],
    event_breakout_lookback: [this.statsDefaults.event_breakout_lookback, [Validators.min(1)]],
    event_breakout_buffer_pct: [this.statsDefaults.event_breakout_buffer_pct, [Validators.min(0)]],
    condition_trend_regime_ma_fast: [this.statsDefaults.condition_trend_regime_ma_fast, [Validators.min(1)]],
    condition_trend_regime_ma_slow: [this.statsDefaults.condition_trend_regime_ma_slow, [Validators.min(1)]],
    condition_liquidity_gate_min_volume: [this.statsDefaults.condition_liquidity_gate_min_volume, [Validators.min(0)]],
    condition_liquidity_gate_max_spread_bps: [this.statsDefaults.condition_liquidity_gate_max_spread_bps, [Validators.min(0)]],
    condition_volatility_band_vol_min: [this.statsDefaults.condition_volatility_band_vol_min, [Validators.min(0)]],
    condition_volatility_band_vol_max: [this.statsDefaults.condition_volatility_band_vol_max, [Validators.min(0)]],
    target_mean_reversion_horizon: [this.statsDefaults.target_mean_reversion_horizon, [Validators.min(1)]],
    target_mean_reversion_zscore: [this.statsDefaults.target_mean_reversion_zscore, [Validators.min(0)]],
    target_momentum_follow_hold_days: [this.statsDefaults.target_momentum_follow_hold_days, [Validators.min(1)]],
    target_momentum_follow_min_return: [this.statsDefaults.target_momentum_follow_min_return, [Validators.min(0)]],
    target_range_extension_range_pct: [this.statsDefaults.target_range_extension_range_pct, [Validators.min(0)]],
    target_range_extension_exit_pct: [this.statsDefaults.target_range_extension_exit_pct, [Validators.min(0)]],
    presetName: [''],
    presetId: ['']
  });

  readonly seasonalityForm = this.fb.group({
    symbol: [this.seasonalityDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
    timeframe: [this.seasonalityDefaults.timeframe, Validators.required],
    window: [this.seasonalityDefaults.window, Validators.required],
    startYear: [this.seasonalityDefaults.startYear, [Validators.min(1990)]],
    endYear: [this.seasonalityDefaults.endYear, [Validators.max(new Date().getFullYear())]],
    filter: [this.seasonalityDefaults.filter],
    normalize: [this.seasonalityDefaults.normalize],
    profileId: [this.seasonalityDefaults.profileId, Validators.required],
    profileMeasure: [this.seasonalityDefaults.profileMeasure, Validators.required],
    profileRetHorizon: [this.seasonalityDefaults.profileRetHorizon, [Validators.min(1)]],
    profileMinSamples: [this.seasonalityDefaults.profileMinSamples, [Validators.min(10)]],
    signalMethod: [this.seasonalityDefaults.signalMethod, Validators.required],
    signalThreshold: [this.seasonalityDefaults.signalThreshold, [Validators.min(0)]],
    signalTopk: [this.seasonalityDefaults.signalTopk, [Validators.min(1)]],
    signalDims: [this.seasonalityDefaults.signalDims],
    signalCombine: [this.seasonalityDefaults.signalCombine],
    optunaMaxTrials: [this.seasonalityDefaults.optunaMaxTrials, [Validators.min(1)]],
    optunaSearchSpace: [this.seasonalityDefaults.optunaSearchSpace],
    executionRiskModel: [this.seasonalityDefaults.executionRiskModel],
    executionTpSl: [this.seasonalityDefaults.executionTpSl],
    validationTrainMonths: [this.seasonalityDefaults.validationTrainMonths, [Validators.min(1)]],
    validationTestMonths: [this.seasonalityDefaults.validationTestMonths, [Validators.min(1)]],
    validationFolds: [this.seasonalityDefaults.validationFolds, [Validators.min(1)]],
    validationEmbargoDays: [this.seasonalityDefaults.validationEmbargoDays, [Validators.min(0)]],
    persistenceEnabled: [this.seasonalityDefaults.persistenceEnabled],
    persistenceSpecId: [this.seasonalityDefaults.persistenceSpecId],
    persistenceDatasetId: [this.seasonalityDefaults.persistenceDatasetId],
    artifactsOutDir: [this.seasonalityDefaults.artifactsOutDir],
    profile_by_hour_tz: [this.seasonalityDefaults.profile_by_hour_tz],
    profile_by_hour_bin_size: [this.seasonalityDefaults.profile_by_hour_bin_size, [Validators.min(1)]],
    profile_by_dow_week_start: [this.seasonalityDefaults.profile_by_dow_week_start],
    profile_by_dow_smooth: [this.seasonalityDefaults.profile_by_dow_smooth, [Validators.min(0)]],
    profile_by_month_rolling: [this.seasonalityDefaults.profile_by_month_rolling],
    profile_by_month_normalize: [this.seasonalityDefaults.profile_by_month_normalize],
    profile_by_session_sessions: [this.seasonalityDefaults.profile_by_session_sessions],
    profile_by_session_min_bars: [this.seasonalityDefaults.profile_by_session_min_bars, [Validators.min(1)]],
    presetName: [''],
    presetId: ['']
  });

  readonly stressForm = this.fb.group({
    strategy: [this.stressDefaults.strategy, Validators.required],
    symbol: [this.stressDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
    timeframe: [this.stressDefaults.timeframe, Validators.required],
    scenario: [this.stressDefaults.scenario, Validators.required],
    capital: [this.stressDefaults.capital, [Validators.min(1000)]],
    leverage: [this.stressDefaults.leverage, [Validators.min(1)]],
    maxDdLimit: [this.stressDefaults.maxDdLimit, [Validators.min(5)]],
    mcPaths: [this.stressDefaults.mcPaths, [Validators.min(100)]],
    source: [this.stressDefaults.source, Validators.required],
    nSims: [this.stressDefaults.nSims, [Validators.min(100)]],
    seed: [this.stressDefaults.seed, [Validators.min(0)]],
    method: [this.stressDefaults.method, Validators.required],
    blockSize: [this.stressDefaults.blockSize, [Validators.min(1)]],
    overlapping: [this.stressDefaults.overlapping],
    timeDistMode: [this.stressDefaults.timeDistMode],
    timeDistSeed: [this.stressDefaults.timeDistSeed, [Validators.min(0)]],
    paramDriftMode: [this.stressDefaults.paramDriftMode],
    paramDriftDist: [this.stressDefaults.paramDriftDist],
    paramDriftMu: [this.stressDefaults.paramDriftMu],
    paramDriftSigma: [this.stressDefaults.paramDriftSigma, [Validators.min(0)]],
    paramDriftLow: [this.stressDefaults.paramDriftLow],
    paramDriftHigh: [this.stressDefaults.paramDriftHigh],
    paramDriftMin: [this.stressDefaults.paramDriftMin],
    paramDriftMax: [this.stressDefaults.paramDriftMax],
    paramDriftSeed: [this.stressDefaults.paramDriftSeed, [Validators.min(0)]],
    sizingDist: [this.stressDefaults.sizingDist],
    sizingMu: [this.stressDefaults.sizingMu],
    sizingSigma: [this.stressDefaults.sizingSigma, [Validators.min(0)]],
    sizingLow: [this.stressDefaults.sizingLow],
    sizingHigh: [this.stressDefaults.sizingHigh],
    sizingMin: [this.stressDefaults.sizingMin],
    sizingMax: [this.stressDefaults.sizingMax],
    outputMode: [this.stressDefaults.outputMode],
    outputMaxCurves: [this.stressDefaults.outputMaxCurves, [Validators.min(1)]],
    outputCurveStride: [this.stressDefaults.outputCurveStride, [Validators.min(1)]],
    scenario1Type: [this.stressDefaults.scenario1Type],
    scenario1ShockPct: [this.stressDefaults.scenario1ShockPct, [Validators.min(0)]],
    scenario1VolMultiplier: [this.stressDefaults.scenario1VolMultiplier, [Validators.min(0)]],
    scenario1DrawdownPct: [this.stressDefaults.scenario1DrawdownPct, [Validators.min(0)]],
    scenario1Window: [this.stressDefaults.scenario1Window, [Validators.min(1)]],
    scenario1Index: [this.stressDefaults.scenario1Index],
    scenario2Type: [this.stressDefaults.scenario2Type],
    scenario2ShockPct: [this.stressDefaults.scenario2ShockPct, [Validators.min(0)]],
    scenario2VolMultiplier: [this.stressDefaults.scenario2VolMultiplier, [Validators.min(0)]],
    scenario2DrawdownPct: [this.stressDefaults.scenario2DrawdownPct, [Validators.min(0)]],
    scenario2Window: [this.stressDefaults.scenario2Window, [Validators.min(1)]],
    scenario2Index: [this.stressDefaults.scenario2Index],
    scenario3Type: [this.stressDefaults.scenario3Type],
    scenario3ShockPct: [this.stressDefaults.scenario3ShockPct, [Validators.min(0)]],
    scenario3VolMultiplier: [this.stressDefaults.scenario3VolMultiplier, [Validators.min(0)]],
    scenario3DrawdownPct: [this.stressDefaults.scenario3DrawdownPct, [Validators.min(0)]],
    scenario3Window: [this.stressDefaults.scenario3Window, [Validators.min(1)]],
    scenario3Index: [this.stressDefaults.scenario3Index],
    aggregation: [this.stressDefaults.aggregation],
    weights: [this.stressDefaults.weights],
    timestampAlignment: [this.stressDefaults.timestampAlignment],
    presetName: [''],
    presetId: ['']
  });

  readonly dcaResult = signal<StrategyResult | null>(null);
  readonly backtestResult = signal<StrategyResult | null>(null);
  readonly marketStatsResult = signal<StrategyResult | null>(null);
  readonly seasonalityResult = signal<StrategyResult | null>(null);
  readonly stressResult = signal<StrategyResult | null>(null);

  readonly selectedRun = signal<RunKey>('dca');
  readonly selectedDcaTab = signal<DcaParamTab>('params');
  readonly selectedBacktestTab = signal<BacktestParamTab>('params');
  readonly previewErrors = signal<UiValidationError[]>([]);
  readonly previewResult = signal<SpecPreviewResponse | null>(null);
  readonly previewLoading = signal(false);
  readonly submitLoading = signal(false);
  readonly payloadPreview = signal<RunRequestInput | null>(null);
  readonly payloadPreviewPaths = signal<string[]>([]);
  readonly payloadCanonicalPreview = signal<CanonicalRunRequest | null>(null);
  readonly payloadCanonicalPaths = signal<string[]>([]);
  readonly presets = signal<RunPreset[]>([]);
  readonly catalogReady = signal(false);
  readonly presetMessages = signal<Record<RunKey, string | null>>({
    'dca': null,
    'backtests': null,
    'market-stats': null,
    'seasonality': null,
    'stress-tests': null
  });
  catalogVersion = 'v1';
  private supportedFilterIds = new Set<string>();

  constructor() {
    this.runForSelection(this.selectedRun());
    this.loadPresets();
    this.loadCatalog();
  }

  selectRun(key: RunKey): void {
    if (this.selectedRun() === key) {
      return;
    }
    this.selectedRun.set(key);
    this.previewErrors.set([]);
    this.previewResult.set(null);
    this.runForSelection(key);
  }

  private runForSelection(key: RunKey): void {
    const payload = this.buildRequestForTheme(key);
    this.previewErrors.set([]);
    this.previewResult.set(null);
    this.setPayloadPreview(payload);
  }

  isFilterSupported(id: string): boolean {
    if (this.supportedFilterIds.size === 0) {
      return true;
    }
    return this.supportedFilterIds.has(id);
  }

  filterTooltip(id: string): string | null {
    return this.catalogService.filterTooltip(id);
  }

  enumTooltip(enumKey: string, value?: string): string | null {
    return this.catalogService.enumTooltip(enumKey, value);
  }

  presetsByTheme(theme: RunKey): RunPreset[] {
    return this.presets().filter(preset => preset.theme === theme);
  }

  presetMessage(theme: RunKey): string | null {
    return this.presetMessages()[theme];
  }

  presetCompatibility(preset: RunPreset): PresetCompatibility {
    return evaluatePresetCompatibility(this.catalogVersion, preset.catalogVersion).status;
  }

  savePreset(theme: RunKey): void {
    const form = this.getFormForTheme(theme);
    const name = String(form.get('presetName')?.value ?? '').trim();
    if (!name) {
      this.setPresetMessage(theme, 'Nom de preset requis.');
      return;
    }
    const payload = this.buildRequestForTheme(theme);
    const preset = this.presetsService.savePreset({
      name,
      theme,
      catalogVersion: this.catalogVersion,
      formValue: form.getRawValue(),
      payload
    });
    this.loadPresets();
    form.get('presetId')?.setValue(preset.id);
    this.setPresetMessage(theme, `Preset "${preset.name}" sauvegarde.`);
  }

  loadPreset(theme: RunKey): void {
    const form = this.getFormForTheme(theme);
    const id = String(form.get('presetId')?.value ?? '').trim();
    if (!id) {
      this.setPresetMessage(theme, 'Selectionne un preset.');
      return;
    }
    const preset = this.presetsService.getPreset(id);
    if (!preset) {
      this.setPresetMessage(theme, 'Preset introuvable.');
      return;
    }
    const compatibility = evaluatePresetCompatibility(this.catalogVersion, preset.catalogVersion);
    if (compatibility.status === 'incompatible') {
      this.setPresetMessage(
        theme,
        `Preset incompatible (${preset.catalogVersion} vs ${this.catalogVersion}).`
      );
      return;
    }
    const merged = mergePresetFormValue(theme, preset.formValue, preset.payload);
    const normalized = this.normalizePresetFormValue(theme, merged);
    form.reset(normalized);
    form.get('presetId')?.setValue(preset.id);
    if (compatibility.status === 'warning') {
      this.setPresetMessage(theme, `Preset "${preset.name}" charge avec avertissement. ${compatibility.message}`);
    } else {
      this.setPresetMessage(theme, `Preset "${preset.name}" charge.`);
    }
  }

  private setPresetMessage(theme: RunKey, message: string | null): void {
    this.presetMessages.update(current => ({ ...current, [theme]: message }));
  }

  private loadPresets(): void {
    this.presets.set(this.presetsService.getAllPresets());
  }

  private loadCatalog(): void {
    this.catalogService.loadCatalog().subscribe(catalog => {
      if (!catalog) {
        return;
      }
      this.catalogVersion = catalog.meta?.version ?? this.catalogVersion;
      this.applyCatalogEnums(catalog.enums ?? {});
      this.supportedFilterIds = new Set(Object.keys(catalog.filters_expanded?.items ?? {}));
      this.filterUnsupportedSelections();
      this.catalogReady.set(true);
    });
  }

  private filterUnsupportedSelections(): void {
    if (this.supportedFilterIds.size === 0) {
      return;
    }
    const backtestFilters = (this.backtestForm.get('filters')?.value as ReadonlyArray<string> | null) ?? [];
    const backtestAllowed = backtestFilters.filter(id => this.supportedFilterIds.has(id));
    this.backtestForm.get('filters')?.setValue(backtestAllowed as any);

    const dcaFilters = (this.dcaForm.get('filters')?.value as ReadonlyArray<string> | null) ?? [];
    const dcaAllowed = dcaFilters.filter(id => this.supportedFilterIds.has(id));
    this.dcaForm.get('filters')?.setValue(dcaAllowed as any);
  }

  private applyCatalogEnums(enums: Record<string, string[]>): void {
    const signalEnums = enums['signal.types'];
    if (Array.isArray(signalEnums) && signalEnums.length > 0) {
      this.signalTypes = signalEnums;
      if (!signalEnums.includes(String(this.backtestForm.get('signalType')?.value ?? ''))) {
        this.backtestForm.get('signalType')?.setValue(signalEnums[0] as any);
      }
    }

    const dcaEnums = enums['strategy.types'];
    if (Array.isArray(dcaEnums) && dcaEnums.length > 0) {
      this.dcaStrategyTypes = dcaEnums as DcaStrategyType[];
      if (!dcaEnums.includes(String(this.dcaForm.get('strategyType')?.value ?? ''))) {
        this.dcaForm.get('strategyType')?.setValue(dcaEnums[0] as any);
      }
    }

    const seasonalityDims = enums['seasonality.signal.dims'];
    if (Array.isArray(seasonalityDims) && seasonalityDims.length > 0) {
      this.seasonalitySignalDims = seasonalityDims;
      const current = (this.seasonalityForm.get('signalDims')?.value as ReadonlyArray<string> | null) ?? [];
      const filtered = current.filter(dim => seasonalityDims.includes(dim));
      this.seasonalityForm
        .get('signalDims')
        ?.setValue((filtered.length ? filtered : [seasonalityDims[0]]) as any);
    }

    const statsEvents = enums['stats.events'];
    if (Array.isArray(statsEvents) && statsEvents.length > 0) {
      const filtered = this.marketEventOptions.filter(option => statsEvents.includes(option.id));
      this.marketEventOptions = filtered.length
        ? filtered
        : statsEvents.map(id => ({ id, label: id, params: [] }));
      if (!statsEvents.includes(String(this.marketStatsForm.get('eventId')?.value ?? ''))) {
        this.marketStatsForm.get('eventId')?.setValue(statsEvents[0] as any);
      }
    }

    const statsConditions = enums['stats.conditions'];
    if (Array.isArray(statsConditions) && statsConditions.length > 0) {
      const filtered = this.marketConditionOptions.filter(option => statsConditions.includes(option.id));
      this.marketConditionOptions = filtered.length
        ? filtered
        : statsConditions.map(id => ({ id, label: id, params: [] }));
      if (!statsConditions.includes(String(this.marketStatsForm.get('conditionId')?.value ?? ''))) {
        this.marketStatsForm.get('conditionId')?.setValue(statsConditions[0] as any);
      }
    }

    const statsTargets = enums['stats.targets'];
    if (Array.isArray(statsTargets) && statsTargets.length > 0) {
      const filtered = this.marketTargetOptions.filter(option => statsTargets.includes(option.id));
      this.marketTargetOptions = filtered.length
        ? filtered
        : statsTargets.map(id => ({ id, label: id, params: [] }));
      if (!statsTargets.includes(String(this.marketStatsForm.get('targetId')?.value ?? ''))) {
        this.marketStatsForm.get('targetId')?.setValue(statsTargets[0] as any);
      }
    }

    const mcSources = enums['monte_carlo.source'];
    if (Array.isArray(mcSources) && mcSources.length > 0) {
      this.stressSourceOptions = mcSources;
      if (!mcSources.includes(String(this.stressForm.get('source')?.value ?? ''))) {
        this.stressForm.get('source')?.setValue(mcSources[0] as any);
      }
    }

    const mcMethods = enums['monte_carlo.method'];
    if (Array.isArray(mcMethods) && mcMethods.length > 0) {
      this.stressMethodOptions = mcMethods;
      if (!mcMethods.includes(String(this.stressForm.get('method')?.value ?? ''))) {
        this.stressForm.get('method')?.setValue(mcMethods[0] as any);
      }
    }

    const scenarioTypes = enums['scenario.types'];
    if (Array.isArray(scenarioTypes) && scenarioTypes.length > 0) {
      this.stressScenarioTypes = scenarioTypes;
    }
  }

  private getFormForTheme(theme: RunKey): UntypedFormGroup {
    switch (theme) {
      case 'dca':
        return this.dcaForm as UntypedFormGroup;
      case 'backtests':
        return this.backtestForm as UntypedFormGroup;
      case 'market-stats':
        return this.marketStatsForm as UntypedFormGroup;
      case 'seasonality':
        return this.seasonalityForm as UntypedFormGroup;
      case 'stress-tests':
        return this.stressForm as UntypedFormGroup;
      default:
        return this.dcaForm as UntypedFormGroup;
    }
  }

  private buildRequestForTheme(theme: RunKey): RunRequestInput {
    switch (theme) {
      case 'dca':
        return this.buildDcaRequest();
      case 'backtests':
        return this.buildBacktestRequest();
      case 'market-stats':
        return this.buildMarketStatsRequest();
      case 'seasonality':
        return this.buildSeasonalityRequest();
      case 'stress-tests':
        return this.buildStressTestsRequest();
      default:
        return this.buildDcaRequest();
    }
  }

  private normalizePresetFormValue(theme: RunKey, formValue: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...formValue };
    if (theme === 'dca') {
      normalized['startDate'] = normalizeDate(formValue['startDate']);
      normalized['endDate'] = normalizeDate(formValue['endDate']);
    }
    if (theme === 'backtests') {
      normalized['startDate'] = normalizeDate(formValue['startDate']);
      normalized['endDate'] = normalizeDate(formValue['endDate']);
      normalized['screenWindowStart'] = normalizeDate(formValue['screenWindowStart']);
      normalized['screenWindowEnd'] = normalizeDate(formValue['screenWindowEnd']);
    }
    return normalized;
  }

  buildRunRequest(): RunRequestInput {
    switch (this.selectedRun()) {
      case 'dca':
        return this.buildDcaRequest();
      case 'backtests':
        return this.buildBacktestRequest();
      case 'market-stats':
        return this.buildMarketStatsRequest();
      case 'seasonality':
        return this.buildSeasonalityRequest();
      case 'stress-tests':
        return this.buildStressTestsRequest();
      default:
        return this.buildDcaRequest();
    }
  }

  previewSpec(): void {
    if (this.previewLoading()) {
      return;
    }
    this.clearBackendErrors(this.getFormForTheme(this.selectedRun()));
    const payload = this.buildRunRequest();
    this.setPayloadPreview(payload);
    const errors = validateRunRequest(payload);
    this.previewErrors.set(this.mapLocalErrors(errors));
    this.previewResult.set(null);

    if (errors.length > 0) {
      return;
    }

    this.previewLoading.set(true);
    this.specsPreview
      .previewSpec(payload)
      .pipe(finalize(() => this.previewLoading.set(false)))
      .subscribe({
        next: response => {
          this.previewResult.set(response);
        },
        error: err => {
          const backendErrors = parseBackendValidationErrors(err);
          if (backendErrors.length > 0) {
            this.applyBackendErrors(backendErrors);
            return;
          }
          console.error('[StrategyLauncher] Preview failed', err);
          this.previewErrors.set([{ source: 'local', path: 'server', message: 'preview failed' }]);
        }
      });
  }

  submitRun(): void {
    if (this.submitLoading()) {
      return;
    }
    this.clearBackendErrors(this.getFormForTheme(this.selectedRun()));
    const payload = this.buildRunRequest();
    this.setPayloadPreview(payload);
    const errors = validateRunRequest(payload);
    this.previewErrors.set(this.mapLocalErrors(errors));
    this.previewResult.set(null);

    if (errors.length > 0) {
      return;
    }

    this.submitLoading.set(true);
    this.runsService
      .submitRun(payload, { catalogVersion: this.catalogVersion })
      .pipe(finalize(() => this.submitLoading.set(false)))
      .subscribe({
        next: response => {
          const requestId = response?.requestId ?? response?.runId;
          if (!requestId) {
            this.previewErrors.set([{ source: 'local', path: 'server', message: 'requestId manquant' }]);
            return;
          }
          this.router.navigate(['/runs', requestId]);
        },
        error: err => {
          const backendErrors = parseBackendValidationErrors(err);
          if (backendErrors.length > 0) {
            this.applyBackendErrors(backendErrors);
            return;
          }
          console.error('[StrategyLauncher] Run submission failed', err);
          this.previewErrors.set([{ source: 'local', path: 'server', message: 'soumission echouee' }]);
        }
      });
  }

  showPayloadPreview(): void {
    const payload = this.buildRunRequest();
    this.setPayloadPreview(payload);
  }

  copyPayloadUi(): void {
    const payload = this.payloadPreview();
    if (!payload) {
      return;
    }
    const text = JSON.stringify(payload, null, 2);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(err => {
        console.error('[StrategyLauncher] Clipboard write failed', err);
      });
    }
  }

  copyPayloadCanonical(): void {
    const payload = this.payloadCanonicalPreview();
    if (!payload) {
      return;
    }
    const text = JSON.stringify(payload, null, 2);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(err => {
        console.error('[StrategyLauncher] Clipboard write failed', err);
      });
    }
  }

  exportPayloadUi(): void {
    const payload = this.payloadPreview();
    if (!payload) {
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payload-ui-${payload.runType}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportPayloadCanonical(): void {
    const payload = this.payloadCanonicalPreview();
    if (!payload) {
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payload-canonical-${payload.spec_type}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private setPayloadPreview(payload: RunRequestInput): void {
    this.payloadPreview.set(payload);
    this.payloadPreviewPaths.set(collectPaths(payload));
    const canonical = mapRunRequestToCanonical(payload, { catalogVersion: this.catalogVersion });
    this.payloadCanonicalPreview.set(canonical);
    this.payloadCanonicalPaths.set(collectPaths(canonical));
  }

  formatValidationLabel(error: UiValidationError): string {
    return error.field ?? error.path ?? 'global';
  }

  formatValidationMessage(error: UiValidationError): string {
    if (error.message && error.code && error.message !== error.code) {
      return `${error.message} (${error.code})`;
    }
    return error.message || error.code || 'Erreur de validation';
  }

  private mapLocalErrors(errors: ValidationError[]): UiValidationError[] {
    return errors.map(err => ({ source: 'local', path: err.path, message: err.message }));
  }

  private applyBackendErrors(errors: BackendValidationError[]): void {
    const runTheme = this.selectedRun() as RunTheme;
    const form = this.getFormForTheme(this.selectedRun());
    const context = this.buildBackendMappingContext();
    const unmapped: UiValidationError[] = [];

    errors.forEach(err => {
      const controlName = mapBackendFieldToControlName(err.field, runTheme, context);
      if (!controlName) {
        unmapped.push(this.toUiBackendError(err));
        return;
      }
      const control = form.get(controlName);
      if (!control) {
        unmapped.push(this.toUiBackendError(err));
        return;
      }
      const existing = control.errors ?? {};
      control.setErrors({ ...existing, backend: { code: err.code, message: err.message } });
      control.markAsTouched();
    });

    this.previewErrors.set(unmapped);
  }

  private toUiBackendError(error: BackendValidationError): UiValidationError {
    return {
      source: 'backend',
      field: error.field,
      code: error.code,
      message: error.message || error.code || 'Erreur de validation'
    };
  }

  private clearBackendErrors(form: UntypedFormGroup): void {
    Object.values(form.controls).forEach(control => {
      const errors = control.errors;
      if (!errors || !errors['backend']) {
        return;
      }
      const { backend, ...rest } = errors;
      control.setErrors(Object.keys(rest).length ? rest : null);
    });
  }

  private buildBackendMappingContext(): BackendMappingContext {
    return {
      marketEventId: String(this.marketStatsForm.get('eventId')?.value ?? ''),
      marketConditionId: String(this.marketStatsForm.get('conditionId')?.value ?? ''),
      marketTargetId: String(this.marketStatsForm.get('targetId')?.value ?? ''),
      seasonalityProfileId: String(this.seasonalityForm.get('profileId')?.value ?? '')
    };
  }

  private buildDcaRequest(): RunRequestInput {
    const v = this.dcaForm.getRawValue();
    const params: DcaStrategyCore = {
      type: (v.strategyType ?? this.dcaDefaults.strategyType) as DcaStrategyType,
      grid: Array.from((v.gridPresets ?? []) as ReadonlyArray<string>),
      params: this.buildDcaParams(v)
    };

    return {
      runType: 'dca',
      data: {
        symbol: String(v.symbol ?? this.dcaDefaults.symbol),
        timeframe: String(v.timeframe ?? this.dcaDefaults.timeframe),
        frequency: String(v.frequency ?? this.dcaDefaults.frequency),
        amount: Number(v.amount ?? this.dcaDefaults.amount),
        startDate: toIsoDate(v.startDate ?? this.dcaDefaults.startDate),
        endDate: toIsoDate(v.endDate ?? this.dcaDefaults.endDate),
        feePct: Number(v.feePct ?? this.dcaDefaults.feePct),
        broker: String(v.broker ?? this.dcaDefaults.broker),
        reinvestDividends: Boolean(v.reinvestDividends ?? this.dcaDefaults.reinvestDividends),
        universe: this.buildDcaUniverse(v)
      },
      strategy: params,
      filters: this.buildFiltersBlock(
        v.filters,
        v.filterRules,
        v.filterRuleMinScore,
        v.filterRuleMinScorePct,
        'dca_'
      ),
      performance: this.buildPerformanceBlock(
        v.initialCapital,
        v.capitalPerUnit,
        v.maxCapitalPerTrade,
        undefined,
        undefined,
        this.buildDcaStressTests(v)
      )
    };
  }

  private buildBacktestRequest(): RunRequestInput {
    const v = this.backtestForm.getRawValue();
    return {
      runType: 'backtest',
      data: {
        symbol: String(v.symbol ?? this.backtestDefaults.symbol),
        timeframe: String(v.timeframe ?? this.backtestDefaults.timeframe),
        startDate: toIsoDate(v.startDate ?? this.backtestDefaults.startDate),
        endDate: toIsoDate(v.endDate ?? this.backtestDefaults.endDate),
        strategyName: String(v.strategy ?? this.backtestDefaults.strategy)
      },
      strategy: {
        name: String(v.strategy ?? this.backtestDefaults.strategy),
        tpSl: this.buildBacktestTpSl(v),
        screening: this.buildBacktestScreening(v)
      },
      signal: {
        type: String(v.signalType ?? this.backtestDefaults.signalType),
        fast: Number(v.fast ?? this.backtestDefaults.fast),
        slow: Number(v.slow ?? this.backtestDefaults.slow),
        requireCrossing: Boolean(v.requireCrossing ?? this.backtestDefaults.requireCrossing)
      },
      filters: this.buildFiltersBlock(
        v.filters,
        v.filterRules,
        v.filterRuleMinScore,
        v.filterRuleMinScorePct
      ),
      performance: this.buildPerformanceBlock(
        v.capital,
        undefined,
        undefined,
        v.riskPct,
        v.riskFreeRate,
        this.buildBacktestStressTests(v)
      )
    };
  }

  private buildMarketStatsRequest(): RunRequestInput {
    const v = this.marketStatsForm.getRawValue();
    return {
      runType: 'market_stats',
      data: {
        symbol: String(v.symbol ?? this.statsDefaults.symbol),
        timeframe: String(v.timeframe ?? this.statsDefaults.timeframe),
        lookback: Number(v.lookback ?? this.statsDefaults.lookback),
        statsPack: String(v.statsPack ?? this.statsDefaults.statsPack),
        session: String(v.session ?? this.statsDefaults.session),
        includeWeekends: Boolean(v.includeWeekends ?? this.statsDefaults.includeWeekends)
      },
      stats: this.buildMarketStatsBlock(v)
    };
  }

  private buildSeasonalityRequest(): RunRequestInput {
    const v = this.seasonalityForm.getRawValue();
    return {
      runType: 'seasonality',
      data: {
        symbol: String(v.symbol ?? this.seasonalityDefaults.symbol),
        timeframe: String(v.timeframe ?? this.seasonalityDefaults.timeframe),
        window: String(v.window ?? this.seasonalityDefaults.window),
        startYear: Number(v.startYear ?? this.seasonalityDefaults.startYear),
        endYear: Number(v.endYear ?? this.seasonalityDefaults.endYear),
        filter: String(v.filter ?? this.seasonalityDefaults.filter),
        normalize: Boolean(v.normalize ?? this.seasonalityDefaults.normalize)
      },
      seasonality: this.buildSeasonalityBlock(v),
      performance: this.buildPerformanceBlock(undefined, undefined, undefined)
    };
  }

  private buildStressTestsRequest(): RunRequestInput {
    const v = this.stressForm.getRawValue();
    return {
      runType: 'stress_tests',
      data: {
        symbol: String(v.symbol ?? this.stressDefaults.symbol),
        timeframe: String(v.timeframe ?? this.stressDefaults.timeframe)
      },
      performance: {
        ...this.buildPerformanceBlock(
          v.capital,
          undefined,
          undefined,
          undefined,
          undefined
        ),
        stressTests: this.buildStressTestsBlock(v, true)
      }
    };
  }

  private buildDcaParams(value: ReturnType<typeof this.dcaForm.getRawValue>): DcaStrategyCore['params'] {
    const type = (value.strategyType ?? this.dcaDefaults.strategyType) as DcaStrategyType;
    switch (type) {
      case 'dca_etf':
        return {
          kind: 'dca_etf',
          activationLimit: Number(value.activationLimit ?? this.dcaDefaults.activationLimit),
          resetOnNewHigh: Boolean(value.resetOnNewHigh ?? this.dcaDefaults.resetOnNewHigh),
          rearmOnReboundPct: Number(value.rearmOnReboundPct ?? this.dcaDefaults.rearmOnReboundPct),
          forceCloseEnd: Boolean(value.forceCloseEnd ?? this.dcaDefaults.forceCloseEnd)
        };
      case 'crypto_grid':
        return {
          kind: 'crypto_grid',
          tpSl: String(value.cryptoTpSlPreset ?? this.dcaDefaults.cryptoTpSlPreset)
        };
      default:
        return {
          kind: 'dca_equity',
          drawdownReference: String(value.drawdownReference ?? this.dcaDefaults.drawdownReference),
          executionMode: String(value.executionMode ?? this.dcaDefaults.executionMode),
          tpSl: String(value.tpSlPreset ?? this.dcaDefaults.tpSlPreset),
          requireCrossing: Boolean(value.requireCrossing ?? this.dcaDefaults.requireCrossing)
        };
    }
  }

  private buildDcaUniverse(value: ReturnType<typeof this.dcaForm.getRawValue>) {
    const universe = Array.from((value.universe ?? []) as ReadonlyArray<string>);
    if (!universe.length) {
      return undefined;
    }
    return universe.map(symbol => {
      const item = this.dcaUniverseOptions.find(option => option.id === symbol);
      if (!item) {
        return { symbol, assetClass: 'Unknown' };
      }
      return {
        symbol: item.id,
        assetClass: item.assetClass,
        exchange: item.exchange,
        broker: item.broker
      };
    });
  }

  private buildFiltersBlock(
    filtersValue: unknown,
    rulesValue: unknown,
    minScore: unknown,
    minScorePct: unknown,
    prefix = ''
  ): BacktestFiltersBlock {
    const filters = (filtersValue as ReadonlyArray<string> | null | undefined) ?? [];
    const allowedFilters = this.supportedFilterIds.size > 0
      ? filters.filter(id => this.supportedFilterIds.has(id))
      : filters;
    const rules = (rulesValue as ReadonlyArray<string> | null | undefined) ?? [];

    return {
      filters: allowedFilters.map(id => ({
        id,
        params: this.buildFilterParams(id, prefix)
      })),
      rules: rules.map(id => ({
        id,
        mode: String(this.getControlValue(`${prefix}rule_${id}_mode`) ?? 'soft') as 'soft' | 'hard',
        weight: Number(this.getControlValue(`${prefix}rule_${id}_weight`) ?? 0.5)
      })),
      rulesConfig: {
        minScore: Number(minScore ?? 0),
        minScorePct: Number(minScorePct ?? 0)
      }
    };
  }

  private buildFilterParams(id: string, prefix: string): Record<string, number | string | boolean> {
    const params = this.backtestFilterOptions.find(option => option.id === id)?.params ?? [];
    const result: Record<string, number | string | boolean> = {};
    params.forEach(param => {
      const controlName = `${prefix}filter_${id}_${param.key}`;
      result[param.key] = coerceParamValue(this.getControlValue(controlName));
    });
    return result;
  }

  private buildBacktestTpSl(value: ReturnType<typeof this.backtestForm.getRawValue>): BacktestTpSlBlock {
    return {
      atrWindow: Number(value.atrWindow ?? this.backtestDefaults.atrWindow),
      atrK: Number(value.atrK ?? this.backtestDefaults.atrK),
      rMult: Number(value.rMult ?? this.backtestDefaults.rMult),
      slippageBps: Number(value.slippageBps ?? this.backtestDefaults.slippageBps),
      feeBps: Number(value.feeBps ?? this.backtestDefaults.feeBps),
      stopLossPct: Number(value.stopLoss ?? this.backtestDefaults.stopLoss),
      takeProfitPct: Number(value.takeProfit ?? this.backtestDefaults.takeProfit),
      trailingStop: Boolean(value.trailingStop ?? this.backtestDefaults.trailingStop),
      dynamicSl: {
        enabled: Boolean(value.dynamicSlEnabled ?? this.backtestDefaults.dynamicSlEnabled),
        mode: String(value.dynamicSlMode ?? this.backtestDefaults.dynamicSlMode),
        atrMult: Number(value.dynamicSlAtrMult ?? this.backtestDefaults.dynamicSlAtrMult)
      },
      jitter: {
        enabled: Boolean(value.tpslJitterEnabled ?? this.backtestDefaults.tpslJitterEnabled),
        dist: String(value.tpslJitterDist ?? this.backtestDefaults.tpslJitterDist),
        tpBps: Number(value.tpslJitterTpBps ?? this.backtestDefaults.tpslJitterTpBps),
        slBps: Number(value.tpslJitterSlBps ?? this.backtestDefaults.tpslJitterSlBps),
        seed: Number(value.tpslJitterSeed ?? this.backtestDefaults.tpslJitterSeed)
      }
    };
  }

  private buildBacktestScreening(value: ReturnType<typeof this.backtestForm.getRawValue>): BacktestScreeningBlock {
    return {
      enabled: Boolean(value.screeningEnabled ?? this.backtestDefaults.screeningEnabled),
      window: value.screenWindowStart && value.screenWindowEnd
        ? { startDate: toIsoDate(value.screenWindowStart), endDate: toIsoDate(value.screenWindowEnd) }
        : undefined,
      maxBars: Number(value.screenMaxBars ?? this.backtestDefaults.screenMaxBars),
      maxTrades: Number(value.screenMaxTrades ?? this.backtestDefaults.screenMaxTrades),
      maxSeconds: Number(value.screenMaxSeconds ?? this.backtestDefaults.screenMaxSeconds)
    };
  }

  private buildMarketStatsBlock(value: ReturnType<typeof this.marketStatsForm.getRawValue>): MarketStatsBlock {
    const eventId = String(value.eventId ?? this.statsDefaults.eventId);
    const conditionId = String(value.conditionId ?? this.statsDefaults.conditionId);
    const targetId = String(value.targetId ?? this.statsDefaults.targetId);

    return {
      event: {
        id: eventId,
        params: this.buildMarketParams('event', eventId)
      },
      condition: {
        id: conditionId,
        params: this.buildMarketParams('condition', conditionId)
      },
      target: {
        id: targetId,
        params: this.buildMarketParams('target', targetId)
      },
      validation: {
        trainMonths: Number(value.validationTrainMonths ?? this.statsDefaults.validationTrainMonths),
        testMonths: Number(value.validationTestMonths ?? this.statsDefaults.validationTestMonths),
        folds: Number(value.validationFolds ?? this.statsDefaults.validationFolds),
        embargoDays: Number(value.validationEmbargoDays ?? this.statsDefaults.validationEmbargoDays)
      },
      persistence: {
        enabled: Boolean(value.persistenceEnabled ?? this.statsDefaults.persistenceEnabled),
        specId: String(value.persistenceSpecId ?? this.statsDefaults.persistenceSpecId),
        datasetId: String(value.persistenceDatasetId ?? this.statsDefaults.persistenceDatasetId)
      },
      artifacts: {
        outDir: String(value.artifactsOutDir ?? this.statsDefaults.artifactsOutDir)
      }
    };
  }

  private buildMarketParams(prefix: 'event' | 'condition' | 'target', id: string) {
    const params = prefix === 'event'
      ? this.marketEventParams(id)
      : prefix === 'condition'
        ? this.marketConditionParams(id)
        : this.marketTargetParams(id);
    const result: Record<string, number | string | boolean> = {};
    params.forEach(param => {
      const controlName = `${prefix}_${id}_${param.key}`;
      result[param.key] = coerceParamValue(this.getControlValue(controlName));
    });
    return result;
  }

  private buildSeasonalityBlock(value: ReturnType<typeof this.seasonalityForm.getRawValue>): SeasonalityBlock {
    const profileId = String(value.profileId ?? this.seasonalityDefaults.profileId);
    return {
      profile: {
        id: profileId,
        measure: String(value.profileMeasure ?? this.seasonalityDefaults.profileMeasure),
        retHorizon: Number(value.profileRetHorizon ?? this.seasonalityDefaults.profileRetHorizon),
        minSamplesBin: Number(value.profileMinSamples ?? this.seasonalityDefaults.profileMinSamples),
        params: this.buildSeasonalityParams(profileId)
      },
      signal: {
        method: String(value.signalMethod ?? this.seasonalityDefaults.signalMethod),
        threshold: Number(value.signalThreshold ?? this.seasonalityDefaults.signalThreshold),
        topk: Number(value.signalTopk ?? this.seasonalityDefaults.signalTopk),
        dims: Array.from((value.signalDims ?? this.seasonalityDefaults.signalDims) as ReadonlyArray<string>),
        combine: String(value.signalCombine ?? this.seasonalityDefaults.signalCombine)
      },
      compute: {
        maxTrials: Number(value.optunaMaxTrials ?? this.seasonalityDefaults.optunaMaxTrials),
        searchSpace: String(value.optunaSearchSpace ?? this.seasonalityDefaults.optunaSearchSpace)
      },
      execution: {
        riskModel: String(value.executionRiskModel ?? this.seasonalityDefaults.executionRiskModel),
        tpSl: String(value.executionTpSl ?? this.seasonalityDefaults.executionTpSl)
      },
      validation: {
        trainMonths: Number(value.validationTrainMonths ?? this.seasonalityDefaults.validationTrainMonths),
        testMonths: Number(value.validationTestMonths ?? this.seasonalityDefaults.validationTestMonths),
        folds: Number(value.validationFolds ?? this.seasonalityDefaults.validationFolds),
        embargoDays: Number(value.validationEmbargoDays ?? this.seasonalityDefaults.validationEmbargoDays)
      },
      persistence: {
        enabled: Boolean(value.persistenceEnabled ?? this.seasonalityDefaults.persistenceEnabled),
        specId: String(value.persistenceSpecId ?? this.seasonalityDefaults.persistenceSpecId),
        datasetId: String(value.persistenceDatasetId ?? this.seasonalityDefaults.persistenceDatasetId)
      },
      artifacts: {
        outDir: String(value.artifactsOutDir ?? this.seasonalityDefaults.artifactsOutDir)
      }
    };
  }

  private buildSeasonalityParams(profileId: string) {
    const params = this.seasonalityProfileParams(profileId);
    const result: Record<string, number | string | boolean> = {};
    params.forEach(param => {
      result[param.key] = coerceParamValue(this.getControlValue(`profile_${profileId}_${param.key}`));
    });
    return result;
  }

  private buildPerformanceBlock(
    initialCapital?: unknown,
    capitalPerUnit?: unknown,
    maxCapitalPerTrade?: unknown,
    riskPct?: unknown,
    riskFreeRatePct?: unknown,
    stressTests?: MonteCarloStressTests
  ): PerformanceBlock {
    return {
      initialCapital: initialCapital !== undefined ? Number(initialCapital) : undefined,
      capitalPerUnit: capitalPerUnit !== undefined ? Number(capitalPerUnit) : undefined,
      maxCapitalPerTrade: maxCapitalPerTrade !== undefined ? Number(maxCapitalPerTrade) : undefined,
      riskPct: riskPct !== undefined ? Number(riskPct) : undefined,
      riskFreeRatePct: riskFreeRatePct !== undefined ? Number(riskFreeRatePct) : undefined,
      stressTests
    };
  }

  private buildDcaStressTests(value: ReturnType<typeof this.dcaForm.getRawValue>): MonteCarloStressTests {
    return {
      enabled: Boolean(value.mcEnabled ?? this.dcaDefaults.mcEnabled),
      nSims: Number(value.mcPaths ?? this.dcaDefaults.mcPaths),
      seed: Number(value.mcSeed ?? this.dcaDefaults.mcSeed),
      method: 'monte_carlo',
      output: {
        mode: 'summary'
      },
      scenarios: [],
      multiAsset: undefined
    };
  }

  private buildBacktestStressTests(value: ReturnType<typeof this.backtestForm.getRawValue>): MonteCarloStressTests {
    return {
      enabled: Boolean(value.mcEnabled ?? this.backtestDefaults.mcEnabled),
      nSims: Number(value.mcPaths ?? this.backtestDefaults.mcPaths),
      seed: Number(value.mcSeed ?? this.backtestDefaults.mcSeed),
      method: 'monte_carlo',
      output: {
        mode: 'summary'
      },
      scenarios: [],
      multiAsset: undefined
    };
  }

  private buildStressTestsBlock(
    value: ReturnType<typeof this.stressForm.getRawValue>,
    forceEnabled = false
  ): MonteCarloStressTests {
    return {
      enabled: forceEnabled ? true : Boolean(value.source ?? true),
      source: String(value.source ?? this.stressDefaults.source),
      nSims: Number(value.nSims ?? this.stressDefaults.nSims),
      seed: Number(value.seed ?? this.stressDefaults.seed),
      method: String(value.method ?? this.stressDefaults.method),
      blockSize: Number(value.blockSize ?? this.stressDefaults.blockSize),
      overlapping: Boolean(value.overlapping ?? this.stressDefaults.overlapping),
      timeDistribution: {
        mode: String(value.timeDistMode ?? this.stressDefaults.timeDistMode),
        seed: Number(value.timeDistSeed ?? this.stressDefaults.timeDistSeed)
      },
      paramDrift: {
        mode: String(value.paramDriftMode ?? this.stressDefaults.paramDriftMode),
        dist: String(value.paramDriftDist ?? this.stressDefaults.paramDriftDist),
        mu: Number(value.paramDriftMu ?? this.stressDefaults.paramDriftMu),
        sigma: Number(value.paramDriftSigma ?? this.stressDefaults.paramDriftSigma),
        low: Number(value.paramDriftLow ?? this.stressDefaults.paramDriftLow),
        high: Number(value.paramDriftHigh ?? this.stressDefaults.paramDriftHigh),
        min: Number(value.paramDriftMin ?? this.stressDefaults.paramDriftMin),
        max: Number(value.paramDriftMax ?? this.stressDefaults.paramDriftMax),
        seed: Number(value.paramDriftSeed ?? this.stressDefaults.paramDriftSeed)
      },
      sizing: {
        dist: String(value.sizingDist ?? this.stressDefaults.sizingDist),
        low: Number(value.sizingLow ?? this.stressDefaults.sizingLow),
        high: Number(value.sizingHigh ?? this.stressDefaults.sizingHigh),
        mu: Number(value.sizingMu ?? this.stressDefaults.sizingMu),
        sigma: Number(value.sizingSigma ?? this.stressDefaults.sizingSigma),
        min: Number(value.sizingMin ?? this.stressDefaults.sizingMin),
        max: Number(value.sizingMax ?? this.stressDefaults.sizingMax)
      },
      output: {
        mode: String(value.outputMode ?? this.stressDefaults.outputMode),
        maxCurves: Number(value.outputMaxCurves ?? this.stressDefaults.outputMaxCurves),
        curveStride: Number(value.outputCurveStride ?? this.stressDefaults.outputCurveStride)
      },
      scenarios: this.stressScenarioSlots.map(slot => ({
        type: String((value as Record<string, unknown>)[`scenario${slot}Type`] ?? ''),
        shockPct: Number((value as Record<string, unknown>)[`scenario${slot}ShockPct`] ?? 0),
        volMultiplier: Number((value as Record<string, unknown>)[`scenario${slot}VolMultiplier`] ?? 0),
        drawdownPct: Number((value as Record<string, unknown>)[`scenario${slot}DrawdownPct`] ?? 0),
        window: Number((value as Record<string, unknown>)[`scenario${slot}Window`] ?? 0),
        index: String((value as Record<string, unknown>)[`scenario${slot}Index`] ?? '')
      })),
      multiAsset: {
        aggregation: String(value.aggregation ?? this.stressDefaults.aggregation),
        weights: String(value.weights ?? this.stressDefaults.weights)
          .split(',')
          .map(item => Number(item.trim()))
          .filter(item => Number.isFinite(item)),
        timestampAlignment: String(value.timestampAlignment ?? this.stressDefaults.timestampAlignment)
      }
    };
  }

  private getControlValue(controlName: string): unknown {
    return (
      this.dcaForm.get(controlName)?.value ??
      this.backtestForm.get(controlName)?.value ??
      this.marketStatsForm.get(controlName)?.value ??
      this.seasonalityForm.get(controlName)?.value ??
      this.stressForm.get(controlName)?.value
    );
  }

  selectDcaTab(tab: DcaParamTab): void {
    this.selectedDcaTab.set(tab);
  }

  selectBacktestTab(tab: BacktestParamTab): void {
    this.selectedBacktestTab.set(tab);
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

  dcaSelectedFilters(): string[] {
    const value = this.dcaForm.get('filters')?.value as ReadonlyArray<string> | null | undefined;
    return value ? Array.from(value) : [];
  }

  dcaSelectedRules(): string[] {
    const value = this.dcaForm.get('filterRules')?.value as ReadonlyArray<string> | null | undefined;
    return value ? Array.from(value) : [];
  }

  dcaFilterParams(filterId: string): FilterParam[] {
    return this.backtestFilterOptions.find(option => option.id === filterId)?.params ?? [];
  }

  dcaFilterParamControlName(filterId: string, paramKey: string): string {
    return `dca_filter_${filterId}_${paramKey}`;
  }

  dcaRuleModeControlName(ruleId: string): string {
    return `dca_rule_${ruleId}_mode`;
  }

  dcaRuleWeightControlName(ruleId: string): string {
    return `dca_rule_${ruleId}_weight`;
  }

  marketEventParams(eventId: string): FilterParam[] {
    return this.marketEventOptions.find(option => option.id === eventId)?.params ?? [];
  }

  marketConditionParams(conditionId: string): FilterParam[] {
    return this.marketConditionOptions.find(option => option.id === conditionId)?.params ?? [];
  }

  marketTargetParams(targetId: string): FilterParam[] {
    return this.marketTargetOptions.find(option => option.id === targetId)?.params ?? [];
  }

  marketParamControlName(prefix: string, id: string, paramKey: string): string {
    return `${prefix}_${id}_${paramKey}`;
  }

  seasonalityProfileParams(profileId: string): FilterParam[] {
    return this.seasonalityProfileOptions.find(option => option.id === profileId)?.params ?? [];
  }

  seasonalityProfileControlName(profileId: string, paramKey: string): string {
    return `profile_${profileId}_${paramKey}`;
  }

  runDca(): void {
    if (this.dcaForm.invalid) {
      this.dcaForm.markAllAsTouched();
      return;
    }
    this.submitRun();
  }

  resetDca(): void {
    this.dcaForm.reset(this.dcaDefaults);
    this.runForSelection('dca');
  }

  runBacktest(): void {
    if (this.backtestForm.invalid) {
      this.backtestForm.markAllAsTouched();
      return;
    }
    this.submitRun();
  }

  resetBacktest(): void {
    this.backtestForm.reset(this.backtestDefaults);
    this.runForSelection('backtests');
  }

  runMarketStats(): void {
    if (this.marketStatsForm.invalid) {
      this.marketStatsForm.markAllAsTouched();
      return;
    }
    this.submitRun();
  }

  resetMarketStats(): void {
    this.marketStatsForm.reset(this.statsDefaults);
    this.runForSelection('market-stats');
  }

  runSeasonality(): void {
    if (this.seasonalityForm.invalid) {
      this.seasonalityForm.markAllAsTouched();
      return;
    }
    this.submitRun();
  }

  resetSeasonality(): void {
    this.seasonalityForm.reset(this.seasonalityDefaults);
    this.runForSelection('seasonality');
  }

  runStressTests(): void {
    if (this.stressForm.invalid) {
      this.stressForm.markAllAsTouched();
      return;
    }
    this.submitRun();
  }

  resetStressTests(): void {
    this.stressForm.reset(this.stressDefaults);
    this.runForSelection('stress-tests');
  }

  private buildRunId(prefix: string): string {
    const stamp = new Date();
    const date = `${stamp.getFullYear()}${pad2(stamp.getMonth() + 1)}${pad2(stamp.getDate())}`;
    const time = `${pad2(stamp.getHours())}${pad2(stamp.getMinutes())}${pad2(stamp.getSeconds())}`;
    return `${prefix}-${date}-${time}`;
  }
}

function toIsoDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function coerceParamValue(value: unknown): number | string | boolean {
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function collectPaths(value: unknown, prefix = ''): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectPaths(item, `${prefix}[${index}]`));
  }
  if (typeof value !== 'object') {
    return prefix ? [prefix] : [];
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) {
    return prefix ? [prefix] : [];
  }
  return entries.flatMap(([key, val]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return collectPaths(val, path);
  });
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
