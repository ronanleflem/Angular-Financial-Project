import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, UntypedFormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCheckboxChange } from '@angular/material/checkbox';
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
  DcaGridLevel,
  DcaTpSlBlock,
  BacktestTpSlBlock,
  BacktestScreeningBlock,
  BacktestStrategyParamsBlock,
  BacktestFiltersBlock,
  MarketStatsBlock,
  MarketStatsPersistenceBlock,
  MarketStatsOutputBlock,
  SeasonalityBlock,
  SeasonalityPersistenceBlock,
  SeasonalityArtifactsBlock,
  PerformanceBlock,
  MonteCarloStressTests,
  ValidationError,
  validateRunRequest
} from '../../models/run-request-input.model';
import { SpecsPreviewService, SpecPreviewResponse } from '../../services/specs-preview.service';
import { PresetsService, RunPreset } from '../../services/presets.service';
import { RunsService } from '../../services/runs.service';
import { ParameterCatalogService } from '../../services/parameter-catalog.service';
import { DataImportRangesApiService } from '../../services/data-import-ranges-api.service';
import { catchError, finalize, of } from 'rxjs';
import { buildCanonicalRunPayload, CanonicalRunRequest } from '../../services/run-request-adapter';
import {
  BackendMappingContext,
  BackendValidationError,
  RunTheme,
  mapBackendFieldToControlName,
  parseBackendValidationErrors
} from '../../utils/backend-validation';
import { mergePresetFormValue } from '../../utils/preset-form-fallback';
import { PresetCompatibility, evaluatePresetCompatibility } from '../../utils/preset-version';
import {
  DeltaIngestionRange,
  DeltaIngestionRangeFilters,
  DeltaInsertedType
} from '../../models/delta-ingestion-range.model';

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
});

const SYMBOL_BASE_PRICE: Record<string, number> = {
  BTC: 42000,
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
const DCA_ALLOWED_EXECUTION_MODES = ['bar_close', 'intracandle'] as const;
const DCA_ALLOWED_DRAWDOWN_REFERENCES = ['ATH', '1M', '3M', '6M', '1Y'] as const;
const DCA_ALLOWED_ASSET_CLASSES = ['CRYPTO', 'EQUITY', 'ETF', 'STOCK', 'ACTION'] as const;
const SYMBOL_QUOTE_SUFFIXES = ['USDT', 'USDC', 'USD'] as const;
const NOT_IMPLEMENTED_YET_MESSAGE = 'Not implemented yet';

type MetricTone = 'positive' | 'negative' | 'neutral';
type RunKey = 'dca' | 'backtests' | 'market-stats' | 'seasonality' | 'stress-tests';
type DcaStrategyType = 'dca_equity' | 'dca_etf' | 'crypto_grid';
type DcaParamTab = 'params' | 'stress';
type BacktestParamTab = 'params' | 'stress';
type BacktestSourceMode = 'auto' | 'csv_path' | 'mysql_config';

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
  params: FilterParam[];
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

interface DeltaPresetPeriod {
  startDate: string;
  endDate: string;
}

interface BacktestSourceResolution {
  implicitSupported: boolean;
  csvSupported: boolean;
  mysqlSupported: boolean;
}

const DEFAULT_FILTER_OPTIONS: FilterOption[] = [
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

const DEFAULT_RULE_OPTIONS: FilterRuleOption[] = [
  { id: 'drawdown_guard', label: 'Drawdown guard', params: [] },
  { id: 'macro_filter', label: 'Macro filter', params: [] }
];
const UNSUPPORTED_RULE_IDS = new Set(['momentum_alignment']);

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
  private readonly dataImportRangesApi = inject(DataImportRangesApiService);

  readonly runOptions: Array<{ key: RunKey; label: string; description: string }> = [
    { key: 'dca', label: 'DCA grid', description: 'Accumulation periodique' },
    { key: 'backtests', label: 'Backtests', description: 'Simulateur historique' },
    { key: 'market-stats', label: 'Market stats', description: 'KPIs et profils de marche' },
    { key: 'seasonality', label: 'Saisonnalite', description: 'Cycles et patterns temporels' },
    { key: 'stress-tests', label: 'Stress tests', description: 'Chocs et scenarios extremes' }
  ];

  readonly symbols = ['BTC', 'ETH', 'EUR', 'AAPL', 'SPY', 'XAU'];
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
  readonly dcaExecutionModes = [...DCA_ALLOWED_EXECUTION_MODES];
  readonly dcaDrawdownRefs = [...DCA_ALLOWED_DRAWDOWN_REFERENCES];
  readonly dcaAssetClasses = [...DCA_ALLOWED_ASSET_CLASSES];
  readonly dcaTpSlModes = ['rule_based'];
  readonly deltaInsertedTypes: DeltaInsertedType[] = ['CRYPTO', 'ETF', 'FOREX', 'STOCK'];
  readonly dcaTpSlPresets = ['none', 'tp_2_sl_1', 'tp_3_sl_1.5'];
  readonly backtestSourceModeOptions: Array<{ value: BacktestSourceMode; label: string }> = [
    { value: 'auto', label: 'Auto (backend resolution)' },
    { value: 'csv_path', label: 'CSV path' },
    { value: 'mysql_config', label: 'MySQL config' }
  ];
  readonly dcaUniverseOptions = [
    { id: 'SPY', label: 'SPY', assetClass: 'ETF', exchange: 'NYSE', broker: 'IBKR' },
    { id: 'QQQ', label: 'QQQ', assetClass: 'ETF', exchange: 'NASDAQ', broker: 'IBKR' },
    { id: 'AAPL', label: 'AAPL', assetClass: 'Equity', exchange: 'NASDAQ', broker: 'IBKR' },
    { id: 'BTCUSD', label: 'BTCUSD', assetClass: 'Crypto', exchange: 'BINANCE', broker: 'BINANCE' },
    { id: 'ETHUSD', label: 'ETHUSD', assetClass: 'Crypto', exchange: 'COINBASE', broker: 'COINBASE' }
  ];

  backtestFilterOptions: FilterOption[] = [...DEFAULT_FILTER_OPTIONS];

  backtestRuleOptions: FilterRuleOption[] = [...DEFAULT_RULE_OPTIONS];

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
  readonly seasonalitySessionUtcBuckets = [
    { label: 'Asia', range: '00:00-06:59' },
    { label: 'Europe', range: '07:00-11:59' },
    { label: 'EU_US_overlap', range: '12:00-15:59' },
    { label: 'US', range: '16:00-20:59' },
    { label: 'Other', range: '21:00-23:59' }
  ] as const;
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
    symbol: 'BTC',
    timeframe: '1h',
    frequency: 'weekly',
    amount: 200,
    startDate: new Date(2023, 0, 1),
    endDate: new Date(2024, 11, 31),
    useDeltaPreset: false,
    deltaQuerySymbol: '',
    deltaQueryInsertedType: 'CRYPTO' as DeltaInsertedType,
    deltaQueryTimeframe: '',
    symbols: [] as string[],
    deltaPresetSymbol: '',
    deltaPresetSymbols: [] as string[],
    deltaPresetTimeframe: '',
    feePct: 0.1,
    reinvestDividends: true,
    broker: 'BINANCE',
    includeDcaAdvanced: false,
    strategyType: 'dca_equity' as DcaStrategyType,
    assetClass: 'CRYPTO',
    gridPresets: ['grid_balanced'],
    drawdownReference: 'ATH',
    executionMode: 'bar_close',
    tpSlEnabled: true,
    tpSlMode: 'rule_based',
    tpValue: 2.0,
    slValue: 1.0,
    breakEvenEnabled: true,
    breakEvenTriggerPct: 1.0,
    requireCrossing: true,
    activationLimit: 8,
    resetOnNewHigh: true,
    rearmOnReboundPct: 6,
    forceCloseEnd: false,
    cryptoTpSlPreset: 'tp_3_sl_1.5',
    universe: ['SPY', 'AAPL'],
    includeDcaUniverse: false,
    filters: ['volatility_guard'],
    filterRules: ['drawdown_guard'],
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
    includePerformance: false,
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
    symbol: 'EUR',
    assetClass: 'CRYPTO',
    timeframe: '1h',
    startDate: new Date(2019, 0, 1),
    endDate: new Date(2024, 11, 31),
    useDeltaPreset: false,
    deltaQuerySymbol: '',
    deltaQueryInsertedType: 'CRYPTO' as DeltaInsertedType,
    deltaQueryTimeframe: '',
    deltaPresetSymbol: '',
    deltaPresetTimeframe: '',
    sourceMode: 'auto' as BacktestSourceMode,
    csvPath: '',
    mysqlEnv: '',
    mysqlHost: '',
    mysqlPort: 3306,
    mysqlDatabase: '',
    mysqlTable: '',
    mysqlUser: '',
    mysqlPassword: '',
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
    filterRules: ['drawdown_guard'],
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
    mcSeed: 11,
    includePerformance: false
  } as const;

  private readonly statsDefaults = {
    symbol: 'BTC',
    timeframe: '4h',
    useDeltaPreset: false,
    deltaQuerySymbol: '',
    deltaQueryInsertedType: 'CRYPTO' as DeltaInsertedType,
    deltaQueryTimeframe: '',
    deltaPresetSymbol: '',
    deltaPresetTimeframe: '',
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
    useDeltaPreset: false,
    deltaQuerySymbol: '',
    deltaQueryInsertedType: 'CRYPTO' as DeltaInsertedType,
    deltaQueryTimeframe: '',
    deltaPresetSymbol: '',
    deltaPresetTimeframe: '',
    window: 'Monthly',
    startYear: 2010,
    endYear: 2024,
    profileId: 'by_session',
    profileMeasure: 'avg_return',
    profileRetHorizon: 5,
    profileMinSamples: 100,
    signalMethod: 'zscore',
    signalThreshold: 1.2,
    signalTopk: 5,
    signalDims: ['session'],
    signalCombine: 'mean',
    optunaMaxTrials: 80,
    optunaSearchSpace: 'default',
    executionRiskModel: 'fixed_fraction',
    executionTpSl: 'tp_2_sl_1',
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
    profile_by_session_min_bars: 200,
    includePerformance: false
  } as const;

  private readonly stressDefaults = {
    strategy: 'Breakout v2',
    symbol: 'SPY',
    timeframe: '1d',
    startDate: new Date(2018, 0, 1),
    endDate: new Date(2024, 11, 31),
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
    timestampAlignment: 'asof',
    includeStressAdvanced: false
  } as const;

  readonly dcaForm = this.fb.group(
    {
      symbol: [this.dcaDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
      timeframe: [this.dcaDefaults.timeframe, Validators.required],
      frequency: [this.dcaDefaults.frequency, Validators.required],
      amount: [this.dcaDefaults.amount, [Validators.required, Validators.min(10)]],
      startDate: [this.dcaDefaults.startDate, Validators.required],
      endDate: [this.dcaDefaults.endDate, Validators.required],
      useDeltaPreset: [this.dcaDefaults.useDeltaPreset],
      deltaQuerySymbol: [this.dcaDefaults.deltaQuerySymbol],
      deltaQueryInsertedType: [this.dcaDefaults.deltaQueryInsertedType],
      deltaQueryTimeframe: [this.dcaDefaults.deltaQueryTimeframe],
      symbols: [this.dcaDefaults.symbols],
      deltaPresetSymbol: [this.dcaDefaults.deltaPresetSymbol],
      deltaPresetSymbols: [this.dcaDefaults.deltaPresetSymbols],
      deltaPresetTimeframe: [this.dcaDefaults.deltaPresetTimeframe],
      feePct: [this.dcaDefaults.feePct, [Validators.min(0)]],
      reinvestDividends: [this.dcaDefaults.reinvestDividends],
      broker: [this.dcaDefaults.broker],
      includeDcaAdvanced: [this.dcaDefaults.includeDcaAdvanced],
      strategyType: [this.dcaDefaults.strategyType, Validators.required],
      assetClass: [
        this.dcaDefaults.assetClass,
        [Validators.required, oneOfValidator(DCA_ALLOWED_ASSET_CLASSES)]
      ],
      gridPresets: [this.dcaDefaults.gridPresets],
      drawdownReference: [this.dcaDefaults.drawdownReference, oneOfValidator(DCA_ALLOWED_DRAWDOWN_REFERENCES)],
      executionMode: [this.dcaDefaults.executionMode, oneOfValidator(DCA_ALLOWED_EXECUTION_MODES)],
      tpSlEnabled: [this.dcaDefaults.tpSlEnabled],
      tpSlMode: [this.dcaDefaults.tpSlMode, oneOfValidator(['rule_based'])],
      tpValue: [this.dcaDefaults.tpValue, [Validators.min(0.000001)]],
      slValue: [this.dcaDefaults.slValue, [Validators.min(0.000001)]],
      breakEvenEnabled: [this.dcaDefaults.breakEvenEnabled],
      breakEvenTriggerPct: [this.dcaDefaults.breakEvenTriggerPct, [Validators.min(0)]],
      requireCrossing: [this.dcaDefaults.requireCrossing],
      activationLimit: [this.dcaDefaults.activationLimit, [Validators.min(0)]],
      resetOnNewHigh: [this.dcaDefaults.resetOnNewHigh],
      rearmOnReboundPct: [this.dcaDefaults.rearmOnReboundPct, [Validators.min(0)]],
      forceCloseEnd: [this.dcaDefaults.forceCloseEnd],
      cryptoTpSlPreset: [this.dcaDefaults.cryptoTpSlPreset],
      universe: [this.dcaDefaults.universe],
      includeDcaUniverse: [this.dcaDefaults.includeDcaUniverse],
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
      includePerformance: [this.dcaDefaults.includePerformance],
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
    { validators: [dateRangeValidator('startDate', 'endDate'), dcaTpSlValidator(), dcaUniverseSelectionValidator()] }
  );

  readonly backtestForm = this.fb.group(
    {
      strategy: [this.backtestDefaults.strategy, Validators.required],
      symbol: [this.backtestDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
      assetClass: [
        this.backtestDefaults.assetClass,
        [Validators.required, oneOfValidator(DCA_ALLOWED_ASSET_CLASSES)]
      ],
      timeframe: [this.backtestDefaults.timeframe, Validators.required],
      startDate: [this.backtestDefaults.startDate, Validators.required],
      endDate: [this.backtestDefaults.endDate, Validators.required],
      useDeltaPreset: [this.backtestDefaults.useDeltaPreset],
      deltaQuerySymbol: [this.backtestDefaults.deltaQuerySymbol],
      deltaQueryInsertedType: [this.backtestDefaults.deltaQueryInsertedType],
      deltaQueryTimeframe: [this.backtestDefaults.deltaQueryTimeframe],
      deltaPresetSymbol: [this.backtestDefaults.deltaPresetSymbol],
      deltaPresetTimeframe: [this.backtestDefaults.deltaPresetTimeframe],
      sourceMode: [this.backtestDefaults.sourceMode, Validators.required],
      csvPath: [this.backtestDefaults.csvPath],
      mysqlEnv: [this.backtestDefaults.mysqlEnv],
      mysqlHost: [this.backtestDefaults.mysqlHost],
      mysqlPort: [this.backtestDefaults.mysqlPort, [Validators.min(1)]],
      mysqlDatabase: [this.backtestDefaults.mysqlDatabase],
      mysqlTable: [this.backtestDefaults.mysqlTable],
      mysqlUser: [this.backtestDefaults.mysqlUser],
      mysqlPassword: [this.backtestDefaults.mysqlPassword],
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
      includePerformance: [this.backtestDefaults.includePerformance],
      presetName: [''],
      presetId: ['']
    },
    { validators: [dateRangeValidator('startDate', 'endDate'), control => this.backtestSourceModeValidator(control)] }
  );

  readonly marketStatsForm = this.fb.group({
    symbol: [this.statsDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
    timeframe: [this.statsDefaults.timeframe, Validators.required],
    useDeltaPreset: [this.statsDefaults.useDeltaPreset],
    deltaQuerySymbol: [this.statsDefaults.deltaQuerySymbol],
    deltaQueryInsertedType: [this.statsDefaults.deltaQueryInsertedType],
    deltaQueryTimeframe: [this.statsDefaults.deltaQueryTimeframe],
    deltaPresetSymbol: [this.statsDefaults.deltaPresetSymbol],
    deltaPresetTimeframe: [this.statsDefaults.deltaPresetTimeframe],
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
    useDeltaPreset: [this.seasonalityDefaults.useDeltaPreset],
    deltaQuerySymbol: [this.seasonalityDefaults.deltaQuerySymbol],
    deltaQueryInsertedType: [this.seasonalityDefaults.deltaQueryInsertedType],
    deltaQueryTimeframe: [this.seasonalityDefaults.deltaQueryTimeframe],
    deltaPresetSymbol: [this.seasonalityDefaults.deltaPresetSymbol],
    deltaPresetTimeframe: [this.seasonalityDefaults.deltaPresetTimeframe],
    window: [this.seasonalityDefaults.window, Validators.required],
    startYear: [this.seasonalityDefaults.startYear, [Validators.min(1990)]],
    endYear: [this.seasonalityDefaults.endYear, [Validators.max(new Date().getFullYear())]],
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
    includePerformance: [this.seasonalityDefaults.includePerformance],
    presetName: [''],
    presetId: ['']
  });

  readonly stressForm = this.fb.group({
    strategy: [this.stressDefaults.strategy, Validators.required],
    symbol: [this.stressDefaults.symbol, [Validators.required, symbolListValidator(this.symbols)]],
    timeframe: [this.stressDefaults.timeframe, Validators.required],
    startDate: [this.stressDefaults.startDate, Validators.required],
    endDate: [this.stressDefaults.endDate, Validators.required],
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
    includeStressAdvanced: [this.stressDefaults.includeStressAdvanced],
    presetName: [''],
    presetId: ['']
  }, { validators: dateRangeValidator('startDate', 'endDate') });

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
  readonly dcaCapabilitiesInfo = signal<string | null>(null);
  readonly deltaRangesLoading = signal(false);
  readonly deltaRangesError = signal<string | null>(null);
  readonly deltaRanges = signal<DeltaIngestionRange[]>([]);
  readonly dcaCanonicalSupportedFields = signal<string[]>([]);
  readonly dcaCanonicalAcceptedButNotWiredFields = signal<string[]>([]);
  readonly dcaPresetSupportedEntries = signal<string[]>([]);
  readonly dcaPresetNotSupportedEntries = signal<string[]>([]);
  readonly dcaLegacySupportedFields = signal<string[]>([]);
  readonly dcaLegacyOnlyFields = signal<string[]>([]);
  readonly dcaLegacyNotes = signal<string[]>([]);
  readonly dcaUniverseCanonicalSupported = signal(false);
  readonly backtestCapabilitiesInfo = signal<string | null>(null);
  readonly backtestCanonicalSupportedFields = signal<string[]>([]);
  readonly backtestCanonicalAcceptedButNotWiredFields = signal<string[]>([]);
  readonly backtestImplicitSourceSupported = signal(true);
  readonly presetMessages = signal<Record<RunKey, string | null>>({
    'dca': null,
    'backtests': null,
    'market-stats': null,
    'seasonality': null,
    'stress-tests': null
  });
  catalogVersion = 'v1';
  private supportedFilterIds = new Set<string>();
  private supportedRuleIds = new Set<string>();
  private supportedDcaGridPresets = new Set<string>();
  private hasCapabilitiesFilterSupport = false;
  private backtestCapabilitiesAvailable = false;
  private backtestSupportedFields = new Set<string>();
  private backtestAcceptedButNotWiredFields = new Set<string>();
  private backtestCsvSourceSupported = true;
  private backtestMysqlSourceSupported = true;

  constructor() {
    this.setUniverseControlAvailability(false);
    this.bindStressAdvancedControls();
    this.bindDcaDeltaPresetControls();
    this.bindBacktestDeltaPresetControls();
    this.bindBacktestSourceControls();
    this.bindMarketStatsDeltaPresetControls();
    this.bindSeasonalityDeltaPresetControls();
    this.runForSelection(this.selectedRun());
    this.loadPresets();
    this.loadCatalog();
    this.loadDcaCapabilities();
    this.loadBacktestCapabilities();
  }

  private bindStressAdvancedControls(): void {
    const includeAdvancedControl = this.stressForm.get('includeStressAdvanced');
    const scenarioControl = this.stressForm.get('scenario');
    if (!includeAdvancedControl || !scenarioControl) {
      return;
    }

    const applyState = (enabled: boolean) => {
      if (enabled) {
        scenarioControl.enable({ emitEvent: false });
        return;
      }
      scenarioControl.disable({ emitEvent: false });
    };

    applyState(Boolean(includeAdvancedControl.value));
    includeAdvancedControl.valueChanges.subscribe(value => applyState(Boolean(value)));
  }

  private bindDcaDeltaPresetControls(): void {
    const useDeltaPreset = this.dcaForm.get('useDeltaPreset');
    const deltaPresetSymbols = this.dcaForm.get('deltaPresetSymbols');
    const symbolsControl = this.dcaForm.get('symbols');
    const deltaPresetTimeframe = this.dcaForm.get('deltaPresetTimeframe');
    const symbol = this.dcaForm.get('symbol');
    const timeframe = this.dcaForm.get('timeframe');
    const startDate = this.dcaForm.get('startDate');
    const endDate = this.dcaForm.get('endDate');
    if (!useDeltaPreset || !deltaPresetSymbols || !symbolsControl || !deltaPresetTimeframe || !symbol || !timeframe || !startDate || !endDate) {
      return;
    }

    const applyState = (enabled: boolean) => {
      if (enabled) {
        symbol.disable({ emitEvent: false });
        symbolsControl.disable({ emitEvent: false });
        timeframe.disable({ emitEvent: false });
        startDate.disable({ emitEvent: false });
        endDate.disable({ emitEvent: false });
        deltaPresetSymbols.setValidators([Validators.required]);
        deltaPresetTimeframe.setValidators([Validators.required]);
      } else {
        symbol.enable({ emitEvent: false });
        symbolsControl.enable({ emitEvent: false });
        timeframe.enable({ emitEvent: false });
        startDate.enable({ emitEvent: false });
        endDate.enable({ emitEvent: false });
        deltaPresetSymbols.clearValidators();
        deltaPresetTimeframe.clearValidators();
      }
      deltaPresetSymbols.updateValueAndValidity({ emitEvent: false });
      deltaPresetTimeframe.updateValueAndValidity({ emitEvent: false });
    };

    applyState(Boolean(useDeltaPreset.value));
    useDeltaPreset.valueChanges.subscribe(value => applyState(Boolean(value)));
    deltaPresetSymbols.valueChanges.subscribe(() => this.syncDeltaPresetSelection());
    deltaPresetTimeframe.valueChanges.subscribe(() => this.syncDeltaPresetSelection());
  }

  onDcaUseDeltaPresetChange(event: MatCheckboxChange): void {
    if (!event.checked) {
      return;
    }
    if (this.deltaRanges().length > 0 || this.deltaRangesLoading()) {
      return;
    }
    this.loadDeltaRanges();
  }

  onBacktestUseDeltaPresetChange(event: MatCheckboxChange): void {
    if (!event.checked) {
      return;
    }
    if (this.deltaRanges().length > 0 || this.deltaRangesLoading()) {
      return;
    }
    this.loadBacktestDeltaRanges();
  }

  onMarketStatsUseDeltaPresetChange(event: MatCheckboxChange): void {
    if (!event.checked) {
      return;
    }
    if (this.deltaRanges().length > 0 || this.deltaRangesLoading()) {
      return;
    }
    this.loadMarketStatsDeltaRanges();
  }

  onSeasonalityUseDeltaPresetChange(event: MatCheckboxChange): void {
    if (!event.checked) {
      return;
    }
    if (this.deltaRanges().length > 0 || this.deltaRangesLoading()) {
      return;
    }
    this.loadSeasonalityDeltaRanges();
  }

  loadDeltaRanges(): void {
    if (this.deltaRangesLoading()) {
      return;
    }
    const raw = this.dcaForm.getRawValue();
    const filters: DeltaIngestionRangeFilters = {
      symbol: String(raw.deltaQuerySymbol ?? '').trim() || undefined,
      insertedType: (String(raw.deltaQueryInsertedType ?? '').trim() as DeltaInsertedType) || undefined,
      timeframe: String(raw.deltaQueryTimeframe ?? '').trim() || undefined,
      limit: 200
    };

    this.deltaRangesLoading.set(true);
    this.deltaRangesError.set(null);
    this.dataImportRangesApi
      .getRanges(filters)
      .pipe(finalize(() => this.deltaRangesLoading.set(false)))
      .subscribe({
        next: ranges => {
          const sorted = [...ranges].sort((a, b) => {
            const left = new Date(a.insertedAt).getTime();
            const right = new Date(b.insertedAt).getTime();
            return right - left;
          });
          this.deltaRanges.set(sorted);
          this.syncDeltaPresetSelection();
        },
        error: err => {
          console.error('[StrategyLauncher] Failed to load delta ranges', err);
          this.deltaRanges.set([]);
          this.deltaRangesError.set('Impossible de charger les presets Delta.');
        }
      });
  }

  loadBacktestDeltaRanges(): void {
    this.loadDeltaRangesForForm(this.backtestForm);
  }

  loadMarketStatsDeltaRanges(): void {
    this.loadDeltaRangesForForm(this.marketStatsForm);
  }

  loadSeasonalityDeltaRanges(): void {
    this.loadDeltaRangesForForm(this.seasonalityForm);
  }

  deltaAvailableSymbols(): string[] {
    return Array.from(new Set(this.deltaRanges().map(item => item.symbol).filter(Boolean))).sort();
  }

  deltaAvailableTimeframes(): string[] {
    const symbols = this.selectedDeltaSymbols();
    if (symbols.length === 0) {
      return [];
    }
    return Array.from(
      new Set(
        this.deltaRanges()
          .filter(item => symbols.includes(item.symbol))
          .map(item => item.timeframe)
          .filter(Boolean)
      )
    ).sort();
  }

  selectedDeltaPeriod(): DeltaPresetPeriod | null {
    const symbols = this.selectedDeltaSymbols();
    const timeframe = String(this.dcaForm.get('deltaPresetTimeframe')?.value ?? '').trim();
    if (symbols.length === 0 || !timeframe) {
      return null;
    }
    const rows = this.deltaRanges().filter(item => symbols.includes(item.symbol) && item.timeframe === timeframe);
    if (rows.length === 0) {
      return null;
    }
    const starts = rows.map(item => new Date(item.startDate).getTime()).filter(Number.isFinite);
    const ends = rows.map(item => new Date(item.endDate).getTime()).filter(Number.isFinite);
    if (starts.length === 0 || ends.length === 0) {
      return null;
    }
    return {
      startDate: new Date(Math.min(...starts)).toISOString(),
      endDate: new Date(Math.max(...ends)).toISOString()
    };
  }

  selectedDeltaPeriodLabel(): string {
    const period = this.selectedDeltaPeriod();
    if (!period) {
      return '';
    }
    return `${period.startDate} -> ${period.endDate}`;
  }

  backtestDeltaAvailableSymbols(): string[] {
    return this.deltaAvailableSymbolsForForm(this.backtestForm);
  }

  backtestDeltaAvailableTimeframes(): string[] {
    return this.deltaAvailableTimeframesForForm(this.backtestForm);
  }

  backtestSelectedDeltaPeriodLabel(): string {
    const period = this.selectedDeltaPeriodForForm(this.backtestForm);
    return period ? `${period.startDate} -> ${period.endDate}` : '';
  }

  marketStatsDeltaAvailableSymbols(): string[] {
    return this.deltaAvailableSymbolsForForm(this.marketStatsForm);
  }

  marketStatsDeltaAvailableTimeframes(): string[] {
    return this.deltaAvailableTimeframesForForm(this.marketStatsForm);
  }

  marketStatsSelectedDeltaPeriodLabel(): string {
    const period = this.selectedDeltaPeriodForForm(this.marketStatsForm);
    return period ? `${period.startDate} -> ${period.endDate}` : '';
  }

  seasonalityDeltaAvailableSymbols(): string[] {
    return this.deltaAvailableSymbolsForForm(this.seasonalityForm);
  }

  seasonalityDeltaAvailableTimeframes(): string[] {
    return this.deltaAvailableTimeframesForForm(this.seasonalityForm);
  }

  seasonalitySelectedDeltaPeriodLabel(): string {
    const period = this.selectedDeltaPeriodForForm(this.seasonalityForm);
    return period ? `${period.startDate} -> ${period.endDate}` : '';
  }

  private syncDeltaPresetSelection(): void {
    const symbolControl = this.dcaForm.get('deltaPresetSymbols');
    const timeframeControl = this.dcaForm.get('deltaPresetTimeframe');
    const startControl = this.dcaForm.get('startDate');
    const endControl = this.dcaForm.get('endDate');
    if (!symbolControl || !timeframeControl || !startControl || !endControl) {
      return;
    }

    const symbols = this.deltaAvailableSymbols();
    const selectedSymbols = this.selectedDeltaSymbols();
    const validSymbols = selectedSymbols.filter(symbol => symbols.includes(symbol));
    if (symbols.length > 0 && validSymbols.length === 0) {
      symbolControl.setValue([symbols[0]] as any, { emitEvent: false });
    } else if (selectedSymbols.length !== validSymbols.length) {
      symbolControl.setValue(validSymbols as any, { emitEvent: false });
    }

    const timeframes = this.deltaAvailableTimeframes();
    const currentTimeframe = String(timeframeControl.value ?? '').trim();
    if (timeframes.length > 0 && !timeframes.includes(currentTimeframe)) {
      timeframeControl.setValue(timeframes[0] as any, { emitEvent: false });
    }

    if (Boolean(this.dcaForm.get('useDeltaPreset')?.value)) {
      const period = this.selectedDeltaPeriod();
      if (period) {
        startControl.setValue(new Date(period.startDate) as any, { emitEvent: false });
        endControl.setValue(new Date(period.endDate) as any, { emitEvent: false });
      }
    }
  }

  private selectedDeltaSymbols(): string[] {
    const value = this.dcaForm.get('deltaPresetSymbols')?.value as ReadonlyArray<string> | string | null | undefined;
    if (Array.isArray(value)) {
      return Array.from(new Set(value.map(item => String(item).trim()).filter(Boolean)));
    }
    const single = String(value ?? '').trim();
    return single ? [single] : [];
  }

  private bindBacktestDeltaPresetControls(): void {
    this.bindSingleDeltaPresetControls(this.backtestForm, period => {
      const startControl = this.backtestForm.get('startDate');
      const endControl = this.backtestForm.get('endDate');
      if (!startControl || !endControl) {
        return;
      }
      startControl.setValue(new Date(period.startDate) as any, { emitEvent: false });
      endControl.setValue(new Date(period.endDate) as any, { emitEvent: false });
    });
  }

  private bindBacktestSourceControls(): void {
    const sourceMode = this.backtestForm.get('sourceMode');
    if (!sourceMode) {
      return;
    }
    sourceMode.valueChanges.subscribe(() => {
      this.backtestForm.updateValueAndValidity({ emitEvent: false });
    });
  }

  backtestSourceModeAvailable(mode: BacktestSourceMode): boolean {
    const implicitSupported = typeof this.backtestImplicitSourceSupported === 'function'
      ? this.backtestImplicitSourceSupported()
      : true;
    if (mode === 'auto') {
      return implicitSupported;
    }
    if (mode === 'csv_path') {
      return this.backtestCsvSourceSupported;
    }
    if (mode === 'mysql_config') {
      return this.backtestMysqlSourceSupported;
    }
    return false;
  }

  private backtestSourceModeValidator(control?: AbstractControl | null): ValidationErrors | null {
    const form = control as UntypedFormGroup | null;
    if (!form?.get) {
      return null;
    }
    const implicitSupported = typeof this.backtestImplicitSourceSupported === 'function'
      ? this.backtestImplicitSourceSupported()
      : true;
    const mode = String(form.get('sourceMode')?.value ?? this.backtestDefaults.sourceMode) as BacktestSourceMode;
    if (mode === 'auto') {
      return implicitSupported ? null : { sourceRequired: true };
    }
    if (mode === 'csv_path') {
      const csvPath = String(form.get('csvPath')?.value ?? '').trim();
      return csvPath ? null : { sourcePathRequired: true };
    }
    if (mode === 'mysql_config') {
      const mysqlEnv = String(form.get('mysqlEnv')?.value ?? '').trim();
      const mysqlHost = String(form.get('mysqlHost')?.value ?? '').trim();
      const mysqlDatabase = String(form.get('mysqlDatabase')?.value ?? '').trim();
      const mysqlTable = String(form.get('mysqlTable')?.value ?? '').trim();
      if (mysqlEnv || (mysqlHost && mysqlDatabase && mysqlTable)) {
        return null;
      }
      return { sourceMysqlRequired: true };
    }
    return { sourceModeInvalid: true };
  }

  private bindMarketStatsDeltaPresetControls(): void {
    this.bindSingleDeltaPresetControls(this.marketStatsForm);
  }

  private bindSeasonalityDeltaPresetControls(): void {
    this.bindSingleDeltaPresetControls(this.seasonalityForm, period => {
      const startYearControl = this.seasonalityForm.get('startYear');
      const endYearControl = this.seasonalityForm.get('endYear');
      if (!startYearControl || !endYearControl) {
        return;
      }
      startYearControl.setValue(new Date(period.startDate).getUTCFullYear() as any, { emitEvent: false });
      endYearControl.setValue(new Date(period.endDate).getUTCFullYear() as any, { emitEvent: false });
    });
  }

  private bindSingleDeltaPresetControls(
    form: UntypedFormGroup,
    applyPeriod?: (period: DeltaPresetPeriod) => void
  ): void {
    const useDeltaPreset = form.get('useDeltaPreset');
    const deltaPresetSymbol = form.get('deltaPresetSymbol');
    const deltaPresetTimeframe = form.get('deltaPresetTimeframe');
    const symbol = form.get('symbol');
    const timeframe = form.get('timeframe');
    if (!useDeltaPreset || !deltaPresetSymbol || !deltaPresetTimeframe || !symbol || !timeframe) {
      return;
    }

    const startDate = form.get('startDate');
    const endDate = form.get('endDate');
    const applyState = (enabled: boolean) => {
      if (enabled) {
        symbol.disable({ emitEvent: false });
        timeframe.disable({ emitEvent: false });
        startDate?.disable({ emitEvent: false });
        endDate?.disable({ emitEvent: false });
        deltaPresetSymbol.setValidators([Validators.required]);
        deltaPresetTimeframe.setValidators([Validators.required]);
      } else {
        symbol.enable({ emitEvent: false });
        timeframe.enable({ emitEvent: false });
        startDate?.enable({ emitEvent: false });
        endDate?.enable({ emitEvent: false });
        deltaPresetSymbol.clearValidators();
        deltaPresetTimeframe.clearValidators();
      }
      deltaPresetSymbol.updateValueAndValidity({ emitEvent: false });
      deltaPresetTimeframe.updateValueAndValidity({ emitEvent: false });
    };

    applyState(Boolean(useDeltaPreset.value));
    useDeltaPreset.valueChanges.subscribe(value => applyState(Boolean(value)));
    deltaPresetSymbol.valueChanges.subscribe(() => this.syncSingleDeltaPresetSelection(form, applyPeriod));
    deltaPresetTimeframe.valueChanges.subscribe(() => this.syncSingleDeltaPresetSelection(form, applyPeriod));
  }

  private loadDeltaRangesForForm(form: UntypedFormGroup): void {
    if (this.deltaRangesLoading()) {
      return;
    }
    const raw = form.getRawValue() as Record<string, unknown>;
    const filters: DeltaIngestionRangeFilters = {
      symbol: String(raw['deltaQuerySymbol'] ?? '').trim() || undefined,
      insertedType: (String(raw['deltaQueryInsertedType'] ?? '').trim() as DeltaInsertedType) || undefined,
      timeframe: String(raw['deltaQueryTimeframe'] ?? '').trim() || undefined,
      limit: 200
    };

    this.deltaRangesLoading.set(true);
    this.deltaRangesError.set(null);
    this.dataImportRangesApi
      .getRanges(filters)
      .pipe(finalize(() => this.deltaRangesLoading.set(false)))
      .subscribe({
        next: ranges => {
          const sorted = [...ranges].sort((a, b) => {
            const left = new Date(a.insertedAt).getTime();
            const right = new Date(b.insertedAt).getTime();
            return right - left;
          });
          this.deltaRanges.set(sorted);
          this.syncSingleDeltaPresetSelection(form, this.singleDeltaPeriodApplierForForm(form));
        },
        error: err => {
          console.error('[StrategyLauncher] Failed to load delta ranges', err);
          this.deltaRanges.set([]);
          this.deltaRangesError.set('Impossible de charger les presets Delta.');
        }
      });
  }

  private singleDeltaPeriodApplierForForm(
    form: UntypedFormGroup
  ): ((period: DeltaPresetPeriod) => void) | undefined {
    if (form === this.backtestForm) {
      return period => {
        this.backtestForm.get('startDate')?.setValue(new Date(period.startDate) as any, { emitEvent: false });
        this.backtestForm.get('endDate')?.setValue(new Date(period.endDate) as any, { emitEvent: false });
      };
    }
    if (form === this.seasonalityForm) {
      return period => {
        this.seasonalityForm.get('startYear')?.setValue(new Date(period.startDate).getUTCFullYear() as any, { emitEvent: false });
        this.seasonalityForm.get('endYear')?.setValue(new Date(period.endDate).getUTCFullYear() as any, { emitEvent: false });
      };
    }
    return undefined;
  }

  private deltaAvailableSymbolsForForm(form: UntypedFormGroup): string[] {
    return Array.from(new Set(this.deltaRanges().map(item => item.symbol).filter(Boolean))).sort();
  }

  private deltaAvailableTimeframesForForm(form: UntypedFormGroup): string[] {
    const symbol = String(form.get('deltaPresetSymbol')?.value ?? '').trim();
    if (!symbol) {
      return [];
    }
    return Array.from(
      new Set(
        this.deltaRanges()
          .filter(item => item.symbol === symbol)
          .map(item => item.timeframe)
          .filter(Boolean)
      )
    ).sort();
  }

  private selectedDeltaPeriodForForm(form: UntypedFormGroup): DeltaPresetPeriod | null {
    const symbol = String(form.get('deltaPresetSymbol')?.value ?? '').trim();
    const timeframe = String(form.get('deltaPresetTimeframe')?.value ?? '').trim();
    if (!symbol || !timeframe) {
      return null;
    }
    const rows = this.deltaRanges().filter(item => item.symbol === symbol && item.timeframe === timeframe);
    if (rows.length === 0) {
      return null;
    }
    const starts = rows.map(item => new Date(item.startDate).getTime()).filter(Number.isFinite);
    const ends = rows.map(item => new Date(item.endDate).getTime()).filter(Number.isFinite);
    if (starts.length === 0 || ends.length === 0) {
      return null;
    }
    return {
      startDate: new Date(Math.min(...starts)).toISOString(),
      endDate: new Date(Math.max(...ends)).toISOString()
    };
  }

  private syncSingleDeltaPresetSelection(
    form: UntypedFormGroup,
    applyPeriod?: (period: DeltaPresetPeriod) => void
  ): void {
    const symbolControl = form.get('deltaPresetSymbol');
    const timeframeControl = form.get('deltaPresetTimeframe');
    if (!symbolControl || !timeframeControl) {
      return;
    }
    const symbols = this.deltaAvailableSymbolsForForm(form);
    const currentSymbol = String(symbolControl.value ?? '').trim();
    if (symbols.length > 0 && !symbols.includes(currentSymbol)) {
      symbolControl.setValue(symbols[0] as any, { emitEvent: false });
    }

    const timeframes = this.deltaAvailableTimeframesForForm(form);
    const currentTimeframe = String(timeframeControl.value ?? '').trim();
    if (timeframes.length > 0 && !timeframes.includes(currentTimeframe)) {
      timeframeControl.setValue(timeframes[0] as any, { emitEvent: false });
    }

    if (Boolean(form.get('useDeltaPreset')?.value)) {
      const period = this.selectedDeltaPeriodForForm(form);
      if (period && applyPeriod) {
        applyPeriod(period);
      }
    }
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

  displaySymbol(symbol: string): string {
    return toBaseSymbol(symbol);
  }

  isDcaGridSupported(gridPreset: string): boolean {
    if (this.supportedDcaGridPresets.size === 0) {
      return true;
    }
    return this.supportedDcaGridPresets.has(gridPreset);
  }

  dcaGridTooltip(gridPreset: string): string | null {
    if (this.isDcaGridSupported(gridPreset)) {
      return null;
    }
    return 'Non supporte runtime (/runs/capabilities).';
  }

  isLegacyOnlyDcaField(fieldPath: string): boolean {
    return this.dcaLegacyOnlyFields().includes(fieldPath);
  }

  canUseCanonicalUniverse(): boolean {
    return this.dcaUniverseCanonicalSupported();
  }

  isBacktestFieldSupported(path: string): boolean {
    if (!this.backtestCapabilitiesAvailable) {
      return true;
    }
    return this.hasCapabilityField(this.backtestSupportedFields, path);
  }

  isBacktestFieldRuntimeWired(path: string): boolean {
    if (!this.backtestCapabilitiesAvailable) {
      return true;
    }
    if (!this.hasCapabilityField(this.backtestSupportedFields, path)) {
      return false;
    }
    return !this.hasCapabilityFieldAtOrAbove(this.backtestAcceptedButNotWiredFields, path);
  }

  hasDcaCapabilitiesDetails(): boolean {
    return (
      this.dcaCanonicalSupportedFields().length > 0 ||
      this.dcaCanonicalAcceptedButNotWiredFields().length > 0 ||
      this.dcaPresetSupportedEntries().length > 0 ||
      this.dcaPresetNotSupportedEntries().length > 0 ||
      this.dcaLegacySupportedFields().length > 0 ||
      this.dcaLegacyOnlyFields().length > 0 ||
      this.dcaLegacyNotes().length > 0
    );
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
      if (!this.hasCapabilitiesFilterSupport) {
        this.supportedFilterIds = new Set(Object.keys(catalog.filters_expanded?.items ?? {}));
      }
      this.filterUnsupportedSelections();
      this.catalogReady.set(true);
    });
  }

  private filterUnsupportedSelections(): void {
    if (this.supportedFilterIds.size > 0) {
      const backtestFilters = (this.backtestForm.get('filters')?.value as ReadonlyArray<string> | null) ?? [];
      const backtestAllowed = backtestFilters.filter(id => this.supportedFilterIds.has(id));
      this.backtestForm.get('filters')?.setValue(backtestAllowed as any);

      const dcaFilters = (this.dcaForm.get('filters')?.value as ReadonlyArray<string> | null) ?? [];
      const dcaAllowed = dcaFilters.filter(id => this.supportedFilterIds.has(id));
      this.dcaForm.get('filters')?.setValue(dcaAllowed as any);
    }

    if (this.supportedRuleIds.size > 0) {
      const backtestRules = (this.backtestForm.get('filterRules')?.value as ReadonlyArray<string> | null) ?? [];
      const backtestAllowed = backtestRules.filter(id => this.supportedRuleIds.has(id));
      this.backtestForm.get('filterRules')?.setValue(backtestAllowed as any);

      const dcaRules = (this.dcaForm.get('filterRules')?.value as ReadonlyArray<string> | null) ?? [];
      const dcaAllowed = dcaRules.filter(id => this.supportedRuleIds.has(id));
      this.dcaForm.get('filterRules')?.setValue(dcaAllowed as any);
    }
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
    if (theme === 'stress-tests') {
      normalized['startDate'] = normalizeDate(formValue['startDate']);
      normalized['endDate'] = normalizeDate(formValue['endDate']);
    }
    return normalized;
  }

  private loadDcaCapabilities(): void {
    this.runsService
      .getRunCapabilities('dca')
      .pipe(
        catchError(err => {
          console.warn('[StrategyLauncher] /runs/capabilities unavailable, fallback static mode', err);
          this.supportedDcaGridPresets = new Set();
          this.supportedRuleIds = new Set();
          this.hasCapabilitiesFilterSupport = false;
          this.backtestFilterOptions = [...DEFAULT_FILTER_OPTIONS];
          this.backtestRuleOptions = [...DEFAULT_RULE_OPTIONS];
          this.supportedFilterIds = new Set(this.backtestFilterOptions.map(option => option.id));
          this.dcaCapabilitiesInfo.set('Capabilities runtime indisponibles, mode statique active.');
          this.dcaCanonicalSupportedFields.set([]);
          this.dcaCanonicalAcceptedButNotWiredFields.set([]);
          this.dcaPresetSupportedEntries.set([]);
          this.dcaPresetNotSupportedEntries.set([]);
          this.dcaLegacySupportedFields.set([]);
          this.dcaLegacyOnlyFields.set([]);
          this.dcaLegacyNotes.set([]);
          this.dcaUniverseCanonicalSupported.set(false);
          this.setUniverseControlAvailability(false);
          return of(null);
        })
      )
      .subscribe(capabilities => {
        if (!capabilities) {
          return;
        }
        const capabilitiesRecord = capabilities as Record<string, unknown>;
        const canonicalFields = this.extractCanonicalFields(capabilitiesRecord);
        const presets = this.extractDcaPresetCapabilities(capabilitiesRecord);
        const gridPresets = this.extractDcaGridCapabilities(capabilities);
        const filterSupport = this.extractCapabilitiesFilterSupport(capabilitiesRecord);
        const legacy = this.extractLegacyDcaFields(capabilities);
        this.dcaCanonicalSupportedFields.set(canonicalFields.supported);
        this.dcaCanonicalAcceptedButNotWiredFields.set(canonicalFields.acceptedButNotWired);
        this.dcaPresetSupportedEntries.set(presets.supportedEntries);
        this.dcaPresetNotSupportedEntries.set(presets.notSupportedEntries);
        this.dcaLegacySupportedFields.set(legacy.supported);
        this.dcaLegacyOnlyFields.set(legacy.notInCanonical);
        this.dcaLegacyNotes.set(this.extractStringArray((capabilities as any)?.legacy_dca?.notes));
        this.dcaUniverseCanonicalSupported.set(
          canonicalFields.supported.some(field => this.isCanonicalUniverseField(field))
        );
        this.setUniverseControlAvailability(this.dcaUniverseCanonicalSupported());
        this.applyCapabilitiesFilterSupport(filterSupport);
        if (gridPresets.length === 0) {
          this.supportedDcaGridPresets = new Set();
          this.dcaCapabilitiesInfo.set(
            legacy.notInCanonical.length > 0
              ? 'Mode capabilities actif: UI canonical + indications legacy-only.'
              : null
          );
          return;
        }
        this.supportedDcaGridPresets = new Set(gridPresets);
        this.dcaCapabilitiesInfo.set(
          'Mode capabilities actif: options runtime non supportees masquees/desactivees.'
        );
        this.filterUnsupportedDcaGridSelections();
      });
  }

  private loadBacktestCapabilities(): void {
    this.runsService
      .getRunCapabilities('backtest')
      .pipe(
        catchError(err => {
          console.warn('[StrategyLauncher] /runs/capabilities(backtest) unavailable, fallback static mode', err);
          this.backtestCapabilitiesAvailable = false;
          this.backtestSupportedFields = new Set<string>();
          this.backtestAcceptedButNotWiredFields = new Set<string>();
          this.backtestImplicitSourceSupported.set(true);
          this.backtestCsvSourceSupported = true;
          this.backtestMysqlSourceSupported = true;
          this.backtestCapabilitiesInfo.set('Capabilities backtest indisponibles, mode statique active.');
          this.backtestCanonicalSupportedFields.set([]);
          this.backtestCanonicalAcceptedButNotWiredFields.set([]);
          this.applyBacktestSourceResolution({
            implicitSupported: true,
            csvSupported: true,
            mysqlSupported: true
          });
          return of(null);
        })
      )
      .subscribe(capabilities => {
        if (!capabilities) {
          return;
        }
        const capabilitiesRecord = capabilities as Record<string, unknown>;
        const fields = this.extractCanonicalFields(capabilitiesRecord);
        const filterSupport = this.extractCapabilitiesFilterSupport(capabilitiesRecord);
        const sourceResolution = this.extractBacktestSourceResolution(capabilitiesRecord);
        this.backtestCapabilitiesAvailable = fields.supported.length > 0 || fields.acceptedButNotWired.length > 0;
        this.backtestSupportedFields = new Set(fields.supported);
        this.backtestAcceptedButNotWiredFields = new Set(fields.acceptedButNotWired);
        this.backtestCanonicalSupportedFields.set(fields.supported);
        this.backtestCanonicalAcceptedButNotWiredFields.set(fields.acceptedButNotWired);
        this.applyBacktestSourceResolution(sourceResolution);
        if (filterSupport.filters.length > 0 || filterSupport.rules.length > 0) {
          this.applyCapabilitiesFilterSupport(filterSupport);
        }
        this.backtestCapabilitiesInfo.set(
          this.backtestCapabilitiesAvailable
            ? 'Mode capabilities backtest actif.'
            : null
        );
      });
  }

  private extractDcaGridCapabilities(payload: Record<string, unknown>): string[] {
    const candidates: unknown[] = [
      (payload as any)?.presets?.supported?.strategy?.grid,
      (payload as any)?.strategy?.grid_presets,
      (payload as any)?.strategy?.grid,
      (payload as any)?.dca?.strategy?.grid_presets,
      (payload as any)?.dca?.strategy?.grid,
      (payload as any)?.supported?.strategy?.grid,
      (payload as any)?.supported?.grid_presets,
      (payload as any)?.options?.grid_presets
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.every(value => typeof value === 'string')) {
        return Array.from(new Set(candidate.map(value => String(value).trim()).filter(Boolean)));
      }
      if (candidate && typeof candidate === 'object') {
        const enabledKeys = Object.entries(candidate as Record<string, unknown>)
          .filter(([, value]) => Boolean(value))
          .map(([key]) => key.trim())
          .filter(Boolean);
        if (enabledKeys.length > 0) {
          return Array.from(new Set(enabledKeys));
        }
      }
    }
    return [];
  }

  private extractCanonicalFields(payload: Record<string, unknown>): {
    supported: string[];
    acceptedButNotWired: string[];
  } {
    const fields = (((payload as any)?.fields ?? (payload as any)?.canonical?.fields ?? {}) as Record<string, unknown>);
    return {
      supported: this.extractStringArray(fields['supported']),
      acceptedButNotWired: this.extractStringArray(fields['accepted_but_not_wired'])
    };
  }

  private extractBacktestSourceResolution(payload: Record<string, unknown>): BacktestSourceResolution {
    const candidates: Array<Record<string, unknown> | null> = [
      ((payload as any)?.data_source_resolution ?? null) as Record<string, unknown> | null,
      ((payload as any)?.backtest?.data_source_resolution ?? null) as Record<string, unknown> | null,
      ((payload as any)?.capabilities?.data_source_resolution ?? null) as Record<string, unknown> | null
    ];
    const resolution = candidates.find(candidate => candidate && typeof candidate === 'object');
    if (!resolution) {
      return { implicitSupported: true, csvSupported: true, mysqlSupported: true };
    }

    const supportedModes = this.extractStringArray(
      resolution['supported_modes'] ?? resolution['modes'] ?? resolution['supported']
    ).map(mode => mode.toLowerCase());
    const hasModes = supportedModes.length > 0;
    const implicitSupportedFromModes = supportedModes.some(mode =>
      mode === 'auto' || mode === 'implicit' || mode === 'backend_resolution'
    );
    const csvSupportedFromModes = supportedModes.some(mode =>
      mode === 'csv' || mode === 'csv_path' || mode === 'path'
    );
    const mysqlSupportedFromModes = supportedModes.some(mode =>
      mode === 'mysql' || mode === 'mysql_config'
    );
    const implicitFlag = resolution['implicit_supported'];
    const explicitRequiredFlag = resolution['explicit_required'];
    return {
      implicitSupported: typeof implicitFlag === 'boolean'
        ? implicitFlag
        : typeof explicitRequiredFlag === 'boolean'
          ? !explicitRequiredFlag
          : hasModes
            ? implicitSupportedFromModes
            : true,
      csvSupported: hasModes ? csvSupportedFromModes : true,
      mysqlSupported: hasModes ? mysqlSupportedFromModes : true
    };
  }

  private applyBacktestSourceResolution(resolution: BacktestSourceResolution): void {
    this.backtestImplicitSourceSupported.set(resolution.implicitSupported);
    this.backtestCsvSourceSupported = resolution.csvSupported;
    this.backtestMysqlSourceSupported = resolution.mysqlSupported;
    const sourceModeControl = this.backtestForm.get('sourceMode');
    if (!sourceModeControl) {
      return;
    }
    const currentMode = String(sourceModeControl.value ?? this.backtestDefaults.sourceMode) as BacktestSourceMode;
    const hasCurrentMode = this.backtestSourceModeAvailable(currentMode);
    if (hasCurrentMode) {
      this.backtestForm.updateValueAndValidity({ emitEvent: false });
      return;
    }
    const fallbackMode: BacktestSourceMode = resolution.implicitSupported
      ? 'auto'
      : resolution.csvSupported
        ? 'csv_path'
        : resolution.mysqlSupported
          ? 'mysql_config'
          : 'auto';
    sourceModeControl.setValue(fallbackMode as any, { emitEvent: false });
    this.backtestForm.updateValueAndValidity({ emitEvent: false });
  }

  private isCanonicalUniverseField(fieldPath: string): boolean {
    const normalized = String(fieldPath).trim().toLowerCase();
    return (
      normalized === 'universe' ||
      normalized.startsWith('universe.') ||
      normalized === 'data.universe' ||
      normalized.startsWith('data.universe.')
    );
  }

  private setUniverseControlAvailability(enabled: boolean): void {
    const control = this.dcaForm.get('includeDcaUniverse');
    if (!control) {
      return;
    }
    if (enabled) {
      control.enable({ emitEvent: false });
      return;
    }
    control.setValue(false, { emitEvent: false });
    control.disable({ emitEvent: false });
  }

  private extractDcaPresetCapabilities(payload: Record<string, unknown>): {
    supportedEntries: string[];
    notSupportedEntries: string[];
  } {
    const presets = ((payload as any)?.presets ?? {}) as Record<string, unknown>;
    const supported = ((presets['supported'] ?? {}) as Record<string, unknown>);
    const notSupported = ((presets['not_supported'] ?? {}) as Record<string, unknown>);
    return {
      supportedEntries: this.flattenPresetEntries(supported),
      notSupportedEntries: this.flattenPresetEntries(notSupported)
    };
  }

  private flattenPresetEntries(node: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(node).flatMap(([key, value]) => {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value)) {
        const items = value.map(item => String(item).trim()).filter(Boolean);
        if (items.length === 0) {
          return [];
        }
        return [`${currentPath}: ${items.join(', ')}`];
      }
      if (value && typeof value === 'object') {
        return this.flattenPresetEntries(value as Record<string, unknown>, currentPath);
      }
      return [];
    });
  }

  private extractLegacyDcaFields(payload: Record<string, unknown>): { supported: string[]; notInCanonical: string[] } {
    const legacyFields = ((payload as any)?.legacy_dca?.fields ?? {}) as Record<string, unknown>;
    const legacyRunnerSupported = this.extractStringArray(legacyFields['supported_in_legacy_runner']);
    const canonicalPassthroughSupported = this.extractStringArray(legacyFields['canonical_passthrough_supported']);

    if (legacyRunnerSupported.length > 0 || canonicalPassthroughSupported.length > 0) {
      const passthroughSet = new Set(canonicalPassthroughSupported);
      const legacyOnly = legacyRunnerSupported.filter(field => !passthroughSet.has(field));
      return {
        supported: Array.from(new Set(legacyRunnerSupported)),
        notInCanonical: Array.from(new Set(legacyOnly))
      };
    }

    // Backward compatibility with older capabilities payload shape.
    const supported = this.extractStringArray(legacyFields['supported']);
    const notInCanonical = this.extractStringArray(legacyFields['not_in_canonical']);
    return {
      supported: Array.from(new Set(supported)),
      notInCanonical: Array.from(new Set(notInCanonical))
    };
  }

  private extractCapabilitiesFilterSupport(payload: Record<string, unknown>): { filters: string[]; rules: string[] } {
    const filtersBlock = ((payload as any)?.filters ?? {}) as Record<string, unknown>;
    const supportedIds = filtersBlock['supported_ids'];
    if (Array.isArray(supportedIds)) {
      if (supportedIds.every(item => typeof item === 'string')) {
        const ids = this.extractStringArray(supportedIds);
        return { filters: ids, rules: ids };
      }
      const filterIds: string[] = [];
      const ruleIds: string[] = [];
      supportedIds.forEach(item => {
        if (!item || typeof item !== 'object') {
          return;
        }
        const entry = item as Record<string, unknown>;
        const id = String(entry['id'] ?? '').trim();
        const type = String(entry['type'] ?? entry['kind'] ?? '').trim().toLowerCase();
        if (!id) {
          return;
        }
        if (type === 'rule' || type === 'rules') {
          ruleIds.push(id);
          return;
        }
        filterIds.push(id);
      });
      return { filters: Array.from(new Set(filterIds)), rules: Array.from(new Set(ruleIds)) };
    }
    if (supportedIds && typeof supportedIds === 'object') {
      const typed = supportedIds as Record<string, unknown>;
      const filters = this.extractStringArray(typed['filters'] ?? typed['filter_ids']);
      const rules = this.extractStringArray(typed['rules'] ?? typed['rule_ids']);
      return {
        filters,
        rules: rules.length > 0 ? rules : filters
      };
    }
    return { filters: [], rules: [] };
  }

  private hasCapabilityField(fields: ReadonlySet<string>, targetPath: string): boolean {
    const target = String(targetPath).trim();
    if (!target) {
      return false;
    }
    for (const field of fields) {
      const normalized = String(field).trim();
      if (!normalized) {
        continue;
      }
      if (
        normalized === target ||
        normalized.startsWith(`${target}.`) ||
        target.startsWith(`${normalized}.`)
      ) {
        return true;
      }
    }
    return false;
  }

  private hasCapabilityFieldAtOrAbove(fields: ReadonlySet<string>, targetPath: string): boolean {
    const target = String(targetPath).trim();
    if (!target) {
      return false;
    }
    for (const field of fields) {
      const normalized = String(field).trim();
      if (!normalized) {
        continue;
      }
      if (normalized === target || target.startsWith(`${normalized}.`)) {
        return true;
      }
    }
    return false;
  }

  private applyCapabilitiesFilterSupport(support: { filters: string[]; rules: string[] }): void {
    const defaultFilterById = new Map(DEFAULT_FILTER_OPTIONS.map(option => [option.id, option]));
    const defaultRuleById = new Map(DEFAULT_RULE_OPTIONS.map(option => [option.id, option]));

    if (support.filters.length > 0) {
      this.hasCapabilitiesFilterSupport = true;
      this.supportedFilterIds = new Set(support.filters);
      this.backtestFilterOptions = support.filters.map(id => {
        const known = defaultFilterById.get(id);
        if (known) {
          return known;
        }
        return { id, label: humanizeId(id), params: this.buildCatalogParams(id) };
      });
      this.ensureFilterParamControls(this.dcaForm, 'dca_filter_', this.backtestFilterOptions);
      this.ensureFilterParamControls(this.backtestForm, 'filter_', this.backtestFilterOptions);
    } else {
      this.hasCapabilitiesFilterSupport = false;
      this.backtestFilterOptions = [...DEFAULT_FILTER_OPTIONS];
      this.supportedFilterIds = new Set(this.backtestFilterOptions.map(option => option.id));
    }

    const supportedRules = support.rules.filter(id => !UNSUPPORTED_RULE_IDS.has(id));
    if (supportedRules.length > 0) {
      this.supportedRuleIds = new Set(supportedRules);
      this.backtestRuleOptions = supportedRules.map(id => {
        const known = defaultRuleById.get(id);
        if (known) {
          return known;
        }
        return { id, label: humanizeId(id), params: this.buildCatalogParams(id) };
      });
      this.ensureRuleControls(this.dcaForm, 'dca_rule_', supportedRules);
      this.ensureRuleControls(this.backtestForm, 'rule_', supportedRules);
      this.ensureRuleParamControls(this.dcaForm, 'dca_filter_', this.backtestRuleOptions);
      this.ensureRuleParamControls(this.backtestForm, 'filter_', this.backtestRuleOptions);
    } else {
      this.supportedRuleIds = new Set();
      this.backtestRuleOptions = [...DEFAULT_RULE_OPTIONS];
    }

    this.filterUnsupportedSelections();
  }

  private ensureRuleControls(form: UntypedFormGroup, prefix: string, ruleIds: ReadonlyArray<string>): void {
    ruleIds.forEach(ruleId => {
      const modeControlName = `${prefix}${ruleId}_mode`;
      const weightControlName = `${prefix}${ruleId}_weight`;
      if (!form.contains(modeControlName)) {
        form.addControl(modeControlName, this.fb.control('soft'));
      }
      if (!form.contains(weightControlName)) {
        form.addControl(weightControlName, this.fb.control(0.5));
      }
    });
  }

  private ensureFilterParamControls(
    form: UntypedFormGroup,
    prefix: string,
    options: ReadonlyArray<FilterOption>
  ): void {
    options.forEach(option => {
      option.params.forEach(param => {
        const controlName = `${prefix}${option.id}_${param.key}`;
        if (!form.contains(controlName)) {
          form.addControl(controlName, this.fb.control(this.defaultParamValue(param)));
        }
      });
    });
  }

  private ensureRuleParamControls(
    form: UntypedFormGroup,
    prefix: string,
    options: ReadonlyArray<FilterRuleOption>
  ): void {
    options.forEach(option => {
      option.params.forEach(param => {
        const controlName = `${prefix}${option.id}_${param.key}`;
        if (!form.contains(controlName)) {
          form.addControl(controlName, this.fb.control(this.defaultParamValue(param)));
        }
      });
    });
  }

  private buildCatalogParams(id: string): FilterParam[] {
    return this.catalogService.filterParams(id).map(param => this.mapCatalogParam(param));
  }

  private mapCatalogParam(param: { name: string; type: string; enum?: string[] }): FilterParam {
    const rawType = String(param.type ?? '').trim().toLowerCase();
    const enumOptions = Array.isArray(param.enum) ? param.enum : [];
    if (enumOptions.length > 0) {
      return { key: param.name, label: humanizeId(param.name), type: 'select', options: enumOptions };
    }
    const mappedType = ['int', 'float', 'number', 'numeric'].includes(rawType) ? 'number' : 'text';
    return { key: param.name, label: humanizeId(param.name), type: mappedType };
  }

  private defaultParamValue(param: FilterParam): number | string {
    if (param.type === 'number') {
      return 0;
    }
    if (param.type === 'select') {
      return (param.options ?? [])[0] ?? '';
    }
    return '';
  }

  private extractStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return Array.from(
      new Set(value.map(item => String(item).trim()).filter(Boolean))
    );
  }

  private filterUnsupportedDcaGridSelections(): void {
    if (this.supportedDcaGridPresets.size === 0) {
      return;
    }
    const control = this.dcaForm.get('gridPresets');
    const selected = (control?.value as ReadonlyArray<string> | null | undefined) ?? [];
    const allowed = selected.filter(preset => this.supportedDcaGridPresets.has(preset));
    if (allowed.length !== selected.length) {
      control?.setValue((allowed.length > 0 ? allowed : ['grid_balanced']) as any);
    }
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
    const canonical = buildCanonicalRunPayload(payload, payload.runType, { catalogVersion: this.catalogVersion });
    this.payloadCanonicalPreview.set(canonical);
    this.payloadCanonicalPaths.set(collectPaths(canonical));
  }

  formatValidationLabel(error: UiValidationError): string {
    return error.field ?? error.path ?? 'global';
  }

  formatValidationMessage(error: UiValidationError): string {
    if (error.source === 'backend' && this.isBackendNotImplementedError(error.code, error.message)) {
      return NOT_IMPLEMENTED_YET_MESSAGE;
    }
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
      control.setErrors({
        ...existing,
        backend: { code: err.code, message: this.normalizeBackendMessage(err) }
      });
      control.markAsTouched();
    });

    this.previewErrors.set(unmapped);
  }

  private toUiBackendError(error: BackendValidationError): UiValidationError {
    return {
      source: 'backend',
      field: error.field,
      code: error.code,
      message: this.normalizeBackendMessage(error) || error.code || 'Erreur de validation'
    };
  }

  private normalizeBackendMessage(error: BackendValidationError): string | undefined {
    if (this.isBackendNotImplementedError(error.code, error.message)) {
      return NOT_IMPLEMENTED_YET_MESSAGE;
    }
    return error.message;
  }

  private isBackendNotImplementedError(code?: string, message?: string): boolean {
    const normalizedCode = String(code ?? '')
      .trim()
      .toLowerCase();
    const normalizedMessage = String(message ?? '')
      .trim()
      .toLowerCase();
    return (
      normalizedCode === 'not_implemented_feature' ||
      normalizedMessage.includes('not implemented yet')
    );
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
    const useDeltaPreset = Boolean(v.useDeltaPreset);
    const deltaPeriod = useDeltaPreset ? this.selectedDeltaPeriod() : null;
    const canUseUniverse = this.canUseCanonicalUniverse();
    const explicitUniverse = canUseUniverse && Boolean(v.includeDcaUniverse) ? this.buildDcaUniverse(v) : undefined;
    const selectedSymbols = Array.from(new Set(((v.symbols ?? []) as ReadonlyArray<string>).map(item => String(item).trim()).filter(Boolean)));
    const deltaSymbols = useDeltaPreset
      ? Array.from(new Set(((v.deltaPresetSymbols ?? []) as ReadonlyArray<string>).map(item => toBaseSymbol(String(item).trim())).filter(Boolean)))
      : [];
    const autoUniverseSymbols = useDeltaPreset ? deltaSymbols : selectedSymbols;
    const autoUniverse = canUseUniverse && autoUniverseSymbols.length > 1
      ? this.buildUniverseFromSymbols(autoUniverseSymbols, String(v.assetClass ?? this.dcaDefaults.assetClass))
      : undefined;
    const selectedUniverse = explicitUniverse ?? autoUniverse;
    const universePrimarySymbol = canUseUniverse ? (selectedUniverse?.[0]?.symbol?.trim() ?? '') : '';
    const autoSingleSymbol = autoUniverseSymbols.length === 1 ? autoUniverseSymbols[0] : '';
    const effectiveSymbol = universePrimarySymbol || (useDeltaPreset
      ? (autoSingleSymbol || toBaseSymbol(String(v.deltaPresetSymbol ?? '').trim()))
      : (autoSingleSymbol || String(v.symbol ?? this.dcaDefaults.symbol)));
    const effectiveTimeframe = useDeltaPreset
      ? String(v.deltaPresetTimeframe ?? '').trim()
      : String(v.timeframe ?? this.dcaDefaults.timeframe);
    const effectiveStartDate = useDeltaPreset && deltaPeriod
      ? deltaPeriod.startDate
      : toIsoDate(v.startDate ?? this.dcaDefaults.startDate);
    const effectiveEndDate = useDeltaPreset && deltaPeriod
      ? deltaPeriod.endDate
      : toIsoDate(v.endDate ?? this.dcaDefaults.endDate);

    const params: DcaStrategyCore = {
      type: (v.strategyType ?? this.dcaDefaults.strategyType) as DcaStrategyType,
      params: this.buildDcaParams(v)
    };

    return {
      runType: 'dca',
      data: {
        symbol: effectiveSymbol || this.dcaDefaults.symbol,
        timeframe: effectiveTimeframe || this.dcaDefaults.timeframe,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate
      },
      universe: canUseUniverse ? selectedUniverse : undefined,
      strategy: params,
      filters: this.buildFiltersBlock(
        v.filters,
        v.filterRules,
        v.filterRuleMinScore,
        v.filterRuleMinScorePct,
        'dca_'
      ),
      performance: v.includePerformance
        ? this.buildPerformanceBlock(
            v.initialCapital,
            v.capitalPerUnit,
            v.maxCapitalPerTrade,
            undefined,
            undefined,
            this.buildDcaStressTests(v)
          )
        : undefined
    };
  }

  private buildBacktestRequest(): RunRequestInput {
    const v = this.backtestForm.getRawValue();
    const useDeltaPreset = Boolean(v.useDeltaPreset);
    const deltaPeriod = useDeltaPreset ? this.selectedDeltaPeriodForForm(this.backtestForm) : null;
    const effectiveSymbol = useDeltaPreset
      ? toBaseSymbol(String(v.deltaPresetSymbol ?? '').trim())
      : String(v.symbol ?? this.backtestDefaults.symbol);
    const effectiveTimeframe = useDeltaPreset
      ? String(v.deltaPresetTimeframe ?? '').trim()
      : String(v.timeframe ?? this.backtestDefaults.timeframe);
    const effectiveStartDate = useDeltaPreset && deltaPeriod
      ? deltaPeriod.startDate
      : toIsoDate(v.startDate ?? this.backtestDefaults.startDate);
    const effectiveEndDate = useDeltaPreset && deltaPeriod
      ? deltaPeriod.endDate
      : toIsoDate(v.endDate ?? this.backtestDefaults.endDate);
    const sourceMode = String(v.sourceMode ?? this.backtestDefaults.sourceMode) as BacktestSourceMode;
    const includeTpSl = this.isBacktestFieldRuntimeWired('strategy.params.tp_sl');
    const includeScreening = this.isBacktestFieldRuntimeWired('strategy.params.screening');
    const includeFilters = this.isBacktestFieldRuntimeWired('filters');
    const includeFilterRules = this.isBacktestFieldRuntimeWired('filters.rules');
    const includePerformance = this.isBacktestFieldRuntimeWired('performance');
    const assetClassRaw = String(v.assetClass ?? this.backtestDefaults.assetClass);
    const assetClass = (DCA_ALLOWED_ASSET_CLASSES as readonly string[]).includes(assetClassRaw)
      ? assetClassRaw
      : this.backtestDefaults.assetClass;
    const strategyParams: Record<string, unknown> = { assetClass };
    if (includeTpSl) {
      strategyParams['tpSl'] = this.buildBacktestTpSl(v);
    }
    if (includeScreening) {
      strategyParams['screening'] = this.buildBacktestScreening(v);
    }
    const strategy = Object.keys(strategyParams).length > 0
      ? { params: strategyParams as BacktestStrategyParamsBlock }
      : undefined;
    const data: Record<string, unknown> = {
      symbol: effectiveSymbol || this.backtestDefaults.symbol,
      timeframe: effectiveTimeframe || this.backtestDefaults.timeframe,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate
    };
    if (sourceMode === 'csv_path') {
      const csvPath = String(v.csvPath ?? '').trim();
      if (csvPath) {
        data['source'] = 'csv';
        data['path'] = csvPath;
      }
    } else if (sourceMode === 'mysql_config') {
      data['source'] = 'mysql';
      const mysqlEnv = String(v.mysqlEnv ?? '').trim();
      if (mysqlEnv) {
        data['mysqlEnv'] = mysqlEnv;
      }
      const mysqlHost = String(v.mysqlHost ?? '').trim();
      const mysqlDatabase = String(v.mysqlDatabase ?? '').trim();
      const mysqlTable = String(v.mysqlTable ?? '').trim();
      const mysqlUser = String(v.mysqlUser ?? '').trim();
      const mysqlPassword = String(v.mysqlPassword ?? '').trim();
      const mysqlPort = Number(v.mysqlPort ?? 0);
      const mysql: Record<string, unknown> = {};
      if (mysqlHost) {
        mysql['host'] = mysqlHost;
      }
      if (Number.isFinite(mysqlPort) && mysqlPort > 0) {
        mysql['port'] = mysqlPort;
      }
      if (mysqlDatabase) {
        mysql['database'] = mysqlDatabase;
      }
      if (mysqlTable) {
        mysql['table'] = mysqlTable;
      }
      if (mysqlUser) {
        mysql['user'] = mysqlUser;
      }
      if (mysqlPassword) {
        mysql['password'] = mysqlPassword;
      }
      if (Object.keys(mysql).length > 0) {
        data['mysql'] = mysql;
      }
    }
    return {
      runType: 'backtest',
      data: data as any,
      strategy,
      signal: {
        type: 'ema_cross',
        fast: Number(v.fast ?? this.backtestDefaults.fast),
        slow: Number(v.slow ?? this.backtestDefaults.slow),
        requireCrossing: Boolean(v.requireCrossing ?? this.backtestDefaults.requireCrossing)
      },
      filters: includeFilters ? this.buildFiltersBlock(
        v.filters,
        includeFilterRules ? v.filterRules : [],
        v.filterRuleMinScore,
        v.filterRuleMinScorePct
      ) : undefined,
      performance: includePerformance && v.includePerformance
        ? this.buildPerformanceBlock(
            v.capital,
            undefined,
            undefined,
            v.riskPct,
            v.riskFreeRate,
            this.buildBacktestStressTests(v)
          )
        : undefined
    };
  }

  private buildMarketStatsRequest(): RunRequestInput {
    const v = this.marketStatsForm.getRawValue();
    const useDeltaPreset = Boolean(v.useDeltaPreset);
    const effectiveSymbol = useDeltaPreset
      ? toBaseSymbol(String(v.deltaPresetSymbol ?? '').trim())
      : String(v.symbol ?? this.statsDefaults.symbol);
    const effectiveTimeframe = useDeltaPreset
      ? String(v.deltaPresetTimeframe ?? '').trim()
      : String(v.timeframe ?? this.statsDefaults.timeframe);
    return {
      runType: 'market_stats',
      data: {
        symbol: effectiveSymbol || this.statsDefaults.symbol,
        timeframe: effectiveTimeframe || this.statsDefaults.timeframe,
        lookback: Number(v.lookback ?? this.statsDefaults.lookback),
        statsPack: String(v.statsPack ?? this.statsDefaults.statsPack),
        session: String(v.session ?? this.statsDefaults.session),
        includeWeekends: Boolean(v.includeWeekends ?? this.statsDefaults.includeWeekends)
      },
      stats: this.buildMarketStatsBlock(v),
      persistence: this.buildMarketStatsPersistence(v),
      output: this.buildMarketStatsOutput(v)
    };
  }

  private buildSeasonalityRequest(): RunRequestInput {
    const v = this.seasonalityForm.getRawValue();
    const useDeltaPreset = Boolean(v.useDeltaPreset);
    const deltaPeriod = useDeltaPreset ? this.selectedDeltaPeriodForForm(this.seasonalityForm) : null;
    const effectiveSymbol = useDeltaPreset
      ? toBaseSymbol(String(v.deltaPresetSymbol ?? '').trim())
      : String(v.symbol ?? this.seasonalityDefaults.symbol);
    const effectiveTimeframe = useDeltaPreset
      ? String(v.deltaPresetTimeframe ?? '').trim()
      : String(v.timeframe ?? this.seasonalityDefaults.timeframe);
    const effectiveStartYear = useDeltaPreset && deltaPeriod
      ? new Date(deltaPeriod.startDate).getUTCFullYear()
      : Number(v.startYear ?? this.seasonalityDefaults.startYear);
    const effectiveEndYear = useDeltaPreset && deltaPeriod
      ? new Date(deltaPeriod.endDate).getUTCFullYear()
      : Number(v.endYear ?? this.seasonalityDefaults.endYear);
    return {
      runType: 'seasonality',
      data: {
        symbol: effectiveSymbol || this.seasonalityDefaults.symbol,
        timeframe: effectiveTimeframe || this.seasonalityDefaults.timeframe,
        window: String(v.window ?? this.seasonalityDefaults.window),
        startYear: effectiveStartYear,
        endYear: effectiveEndYear
      },
      seasonality: this.buildSeasonalityBlock(v),
      persistence: this.buildSeasonalityPersistence(v),
      output: this.buildSeasonalityOutput(v),
      performance: v.includePerformance ? this.buildPerformanceBlock(undefined, undefined, undefined) : undefined
    };
  }

  private buildStressTestsRequest(): RunRequestInput {
    const v = this.stressForm.getRawValue();
    return {
      runType: 'stress_tests',
      data: {
        symbol: String(v.symbol ?? this.stressDefaults.symbol),
        timeframe: String(v.timeframe ?? this.stressDefaults.timeframe),
        startDate: toIsoDate(v.startDate ?? this.stressDefaults.startDate),
        endDate: toIsoDate(v.endDate ?? this.stressDefaults.endDate)
      },
      performance: {
        ...this.buildPerformanceBlock(
          v.capital,
          undefined,
          undefined,
          undefined,
          undefined
        ),
        stressTests: this.buildStressTestsBlock(v)
      }
    };
  }

  private buildDcaParams(value: ReturnType<typeof this.dcaForm.getRawValue>): DcaStrategyCore['params'] {
    const type = (value.strategyType ?? this.dcaDefaults.strategyType) as DcaStrategyType;
    const assetClassRaw = String(value.assetClass ?? this.dcaDefaults.assetClass);
    const assetClass = (DCA_ALLOWED_ASSET_CLASSES as readonly string[]).includes(assetClassRaw)
      ? assetClassRaw
      : this.dcaDefaults.assetClass;
    switch (type) {
      case 'dca_etf':
        return {
          kind: 'dca_etf',
          assetClass,
          activationLimit: Number(value.activationLimit ?? this.dcaDefaults.activationLimit),
          resetOnNewHigh: Boolean(value.resetOnNewHigh ?? this.dcaDefaults.resetOnNewHigh),
          rearmOnReboundPct: Number(value.rearmOnReboundPct ?? this.dcaDefaults.rearmOnReboundPct),
          forceCloseEnd: Boolean(value.forceCloseEnd ?? this.dcaDefaults.forceCloseEnd)
        };
      case 'crypto_grid':
        return {
          kind: 'crypto_grid',
          assetClass: 'CRYPTO',
          grid: this.buildDcaGridFromPresets(value.gridPresets),
          tpSl: this.buildDcaTpSlFromLegacyPreset(String(value.cryptoTpSlPreset ?? this.dcaDefaults.cryptoTpSlPreset))
        };
      default:
        const executionMode = String(value.executionMode ?? this.dcaDefaults.executionMode);
        const drawdownReference = String(value.drawdownReference ?? this.dcaDefaults.drawdownReference);
        return {
          kind: 'dca_equity',
          assetClass,
          drawdownReference: (DCA_ALLOWED_DRAWDOWN_REFERENCES as readonly string[]).includes(drawdownReference)
            ? drawdownReference
            : this.dcaDefaults.drawdownReference,
          executionMode: (DCA_ALLOWED_EXECUTION_MODES as readonly string[]).includes(executionMode)
            ? executionMode
            : this.dcaDefaults.executionMode,
          tpSl: this.buildDcaTpSlFromForm(value),
          grid: this.buildDcaGridFromPresets(value.gridPresets),
          requireCrossing: Boolean(value.requireCrossing ?? this.dcaDefaults.requireCrossing)
        };
    }
  }

  private buildDcaGridFromPresets(gridPresetsValue: unknown): DcaGridLevel[] {
    const presets = Array.from((gridPresetsValue ?? []) as ReadonlyArray<string>);
    const selected = presets.length ? presets : [...this.dcaDefaults.gridPresets];
    const seen = new Set<number>();
    const grid = selected
      .flatMap(preset => this.gridPresetToLevels(preset))
      .filter(level => {
        if (seen.has(level.dd)) {
          return false;
        }
        seen.add(level.dd);
        return true;
      });

    return grid.length ? grid : [{ dd: -5, weight: 1 }];
  }

  private gridPresetToLevels(preset: string): DcaGridLevel[] {
    switch (preset) {
      case 'grid_conservative':
        return [
          { dd: -3, weight: 0.8 },
          { dd: -6, weight: 1 },
          { dd: -10, weight: 1.2 }
        ];
      case 'grid_aggressive':
        return [
          { dd: -4, weight: 1.2 },
          { dd: -8, weight: 1 },
          { dd: -12, weight: 0.8 }
        ];
      case 'grid_balanced':
      default:
        return [
          { dd: -5, weight: 1 },
          { dd: -10, weight: 1 },
          { dd: -15, weight: 1 }
        ];
    }
  }

  private buildDcaTpSlFromForm(value: ReturnType<typeof this.dcaForm.getRawValue>): DcaTpSlBlock {
    const enabled = Boolean(value.tpSlEnabled ?? this.dcaDefaults.tpSlEnabled);
    const modeRaw = String(value.tpSlMode ?? this.dcaDefaults.tpSlMode);
    const mode = this.dcaTpSlModes.includes(modeRaw) ? modeRaw : this.dcaDefaults.tpSlMode;
    return {
      enabled,
      mode,
      tp: {
        type: 'percent',
        value: Number(value.tpValue ?? this.dcaDefaults.tpValue)
      },
      sl: {
        type: 'percent',
        value: Number(value.slValue ?? this.dcaDefaults.slValue)
      },
      breakEven: {
        enabled: Boolean(value.breakEvenEnabled ?? this.dcaDefaults.breakEvenEnabled),
        triggerPct: Number(value.breakEvenTriggerPct ?? this.dcaDefaults.breakEvenTriggerPct)
      }
    };
  }

  private buildDcaTpSlFromLegacyPreset(presetValue: string): DcaTpSlBlock {
    switch (presetValue) {
      case 'none':
        return {
          enabled: false,
          mode: 'rule_based',
          tp: { type: 'percent', value: 0 },
          sl: { type: 'percent', value: 0 },
          breakEven: { enabled: false, triggerPct: 0 }
        };
      case 'tp_3_sl_1.5':
        return {
          enabled: true,
          mode: 'rule_based',
          tp: { type: 'percent', value: 3 },
          sl: { type: 'percent', value: 1.5 },
          breakEven: { enabled: true, triggerPct: 1.5 }
        };
      case 'tp_2_sl_1':
      default:
        return {
          enabled: true,
          mode: 'rule_based',
          tp: { type: 'percent', value: 2 },
          sl: { type: 'percent', value: 1 },
          breakEven: { enabled: true, triggerPct: 1 }
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
    const allowedRules = this.supportedRuleIds.size > 0
      ? rules.filter(id => this.supportedRuleIds.has(id))
      : rules.filter(id => !UNSUPPORTED_RULE_IDS.has(id));
    const filterIdsForCanonical = Array.from(new Set([...allowedFilters, ...allowedRules]));

    return {
      filters: filterIdsForCanonical.map(id => ({
        id,
        params: this.buildFilterParams(id, prefix)
      })),
      rules: allowedRules.map(id => ({
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
    const params = this.backtestFilterOptions.find(option => option.id === id)?.params
      ?? this.backtestRuleOptions.find(option => option.id === id)?.params
      ?? [];
    const result: Record<string, number | string | boolean> = {};
    params.forEach(param => {
      const controlName = `${prefix}filter_${id}_${param.key}`;
      result[param.key] = coerceParamValue(this.getControlValue(controlName));
    });
    return result;
  }

  private buildUniverseFromSymbols(symbols: ReadonlyArray<string>, defaultAssetClass: string) {
    if (!symbols.length) {
      return undefined;
    }
    return symbols.map(symbol => {
      const item = this.dcaUniverseOptions.find(option => option.id === symbol);
      if (!item) {
        return { symbol, assetClass: defaultAssetClass || 'Unknown' };
      }
      return {
        symbol: item.id,
        assetClass: item.assetClass,
        exchange: item.exchange,
        broker: item.broker
      };
    });
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
      }
    };
  }

  private buildMarketStatsPersistence(
    value: ReturnType<typeof this.marketStatsForm.getRawValue>
  ): MarketStatsPersistenceBlock {
    return {
      enabled: Boolean(value.persistenceEnabled ?? this.statsDefaults.persistenceEnabled),
      specId: String(value.persistenceSpecId ?? this.statsDefaults.persistenceSpecId),
      datasetId: String(value.persistenceDatasetId ?? this.statsDefaults.persistenceDatasetId)
    };
  }

  private buildMarketStatsOutput(
    value: ReturnType<typeof this.marketStatsForm.getRawValue>
  ): MarketStatsOutputBlock {
    return {
      outDir: String(value.artifactsOutDir ?? this.statsDefaults.artifactsOutDir)
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
    const baseDims = Array.from((value.signalDims ?? this.seasonalityDefaults.signalDims) as ReadonlyArray<string>);
    const dims = Array.from(new Set([...baseDims, 'session']));
    return {
      profile: {
        id: profileId,
        bySession: dims.includes('session'),
        measure: String(value.profileMeasure ?? this.seasonalityDefaults.profileMeasure),
        retHorizon: Number(value.profileRetHorizon ?? this.seasonalityDefaults.profileRetHorizon),
        minSamplesBin: Number(value.profileMinSamples ?? this.seasonalityDefaults.profileMinSamples),
        params: this.buildSeasonalityParams(profileId)
      },
      signal: {
        method: String(value.signalMethod ?? this.seasonalityDefaults.signalMethod),
        threshold: Number(value.signalThreshold ?? this.seasonalityDefaults.signalThreshold),
        topk: Number(value.signalTopk ?? this.seasonalityDefaults.signalTopk),
        dims,
        combine: String(value.signalCombine ?? this.seasonalityDefaults.signalCombine)
      },
      compute: {
        maxTrials: Number(value.optunaMaxTrials ?? this.seasonalityDefaults.optunaMaxTrials),
        searchSpace: String(value.optunaSearchSpace ?? this.seasonalityDefaults.optunaSearchSpace)
      },
      execution: {
        riskModel: String(value.executionRiskModel ?? this.seasonalityDefaults.executionRiskModel),
        tpSl: String(value.executionTpSl ?? this.seasonalityDefaults.executionTpSl)
      }
    };
  }

  private buildSeasonalityPersistence(
    value: ReturnType<typeof this.seasonalityForm.getRawValue>
  ): SeasonalityPersistenceBlock {
    return {
      enabled: Boolean(value.persistenceEnabled ?? this.seasonalityDefaults.persistenceEnabled),
      specId: String(value.persistenceSpecId ?? this.seasonalityDefaults.persistenceSpecId),
      datasetId: String(value.persistenceDatasetId ?? this.seasonalityDefaults.persistenceDatasetId)
    };
  }

  private buildSeasonalityOutput(
    value: ReturnType<typeof this.seasonalityForm.getRawValue>
  ): SeasonalityArtifactsBlock {
    return {
      outDir: String(value.artifactsOutDir ?? this.seasonalityDefaults.artifactsOutDir)
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

  private buildStressTestsBlock(value: ReturnType<typeof this.stressForm.getRawValue>): MonteCarloStressTests {
    return {
      enabled: true,
      nSims: Number(value.nSims ?? this.stressDefaults.nSims),
      seed: Number(value.seed ?? this.stressDefaults.seed),
      method: String(value.method ?? this.stressDefaults.method),
      blockSize: Number(value.blockSize ?? this.stressDefaults.blockSize)
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

  backtestRuleParams(ruleId: string): FilterParam[] {
    return this.backtestRuleOptions.find(option => option.id === ruleId)?.params ?? [];
  }

  ruleParamControlName(ruleId: string, paramKey: string): string {
    return `filter_${ruleId}_${paramKey}`;
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

  dcaRuleParams(ruleId: string): FilterParam[] {
    return this.backtestRuleOptions.find(option => option.id === ruleId)?.params ?? [];
  }

  dcaRuleParamControlName(ruleId: string, paramKey: string): string {
    return `dca_filter_${ruleId}_${paramKey}`;
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

function humanizeId(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
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

function oneOfValidator(values: readonly string[]) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return values.includes(String(value)) ? null : { oneOf: { allowed: values } };
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

function dcaTpSlValidator() {
  return (control: AbstractControl): ValidationErrors | null => {
    const strategyType = String(control.get('strategyType')?.value ?? '');
    if (strategyType !== 'dca_equity') {
      return null;
    }
    const enabled = Boolean(control.get('tpSlEnabled')?.value);
    if (!enabled) {
      return null;
    }
    const mode = String(control.get('tpSlMode')?.value ?? '');
    const tpValue = Number(control.get('tpValue')?.value);
    const slValue = Number(control.get('slValue')?.value);
    const errors: Record<string, boolean> = {};
    if (mode !== 'rule_based') {
      errors['tpSlModeInvalid'] = true;
    }
    if (!Number.isFinite(tpValue) || tpValue <= 0) {
      errors['tpValueInvalid'] = true;
    }
    if (!Number.isFinite(slValue) || slValue <= 0) {
      errors['slValueInvalid'] = true;
    }
    return Object.keys(errors).length ? errors : null;
  };
}

function dcaUniverseSelectionValidator() {
  return (control: AbstractControl): ValidationErrors | null => {
    const includeUniverse = Boolean(control.get('includeDcaUniverse')?.value);
    if (!includeUniverse) {
      return null;
    }
    const selection = control.get('universe')?.value as ReadonlyArray<unknown> | null | undefined;
    return Array.isArray(selection) && selection.length > 0
      ? null
      : { universeRequired: true };
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

function toBaseSymbol(value: string): string {
  const symbol = String(value ?? '').trim().toUpperCase();
  if (!symbol) {
    return '';
  }
  for (const suffix of SYMBOL_QUOTE_SUFFIXES) {
    if (symbol.length > suffix.length && symbol.endsWith(suffix)) {
      return symbol.slice(0, -suffix.length);
    }
  }
  return symbol;
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
    case 'BTC':
      return 65;
    case 'ETHUSD':
    case 'ETH':
      return 70;
    case 'XAUUSD':
    case 'XAU':
      return 22;
    case 'AAPL':
      return 28;
    case 'SPY':
      return 18;
    case 'EURUSD':
    case 'EUR':
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
