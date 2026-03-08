import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  MarketAnalysisRunDetail,
  MarketAnalysisRunResult,
  MarketAnalysisRunsPage
} from '../../models/market-analysis.models';
import { MarketAnalysisRunsService } from '../../services/market-analysis-runs.service';
import { MarketAnalysisPage } from './market-analysis.page';

describe('MarketAnalysisPage', () => {
  let fixture: ComponentFixture<MarketAnalysisPage>;
  let component: MarketAnalysisPage;
  let marketAnalysisRunsSpy: jasmine.SpyObj<MarketAnalysisRunsService>;

  const mockRunsPage: MarketAnalysisRunsPage = {
    items: [
      {
        runId: 'run-1',
        requestId: 'req-1',
        specType: 'market_stats',
        status: 'SUCCEEDED',
        createdAt: '2026-03-05T10:00:00Z',
        startedAt: '2026-03-05T10:01:00Z',
        finishedAt: '2026-03-05T10:02:00Z',
        updatedAt: '2026-03-05T10:02:00Z',
        errorMessage: null,
        attempts: 1,
        maxAttempts: 3,
        cancelRequested: false,
        persistenceEnabled: true,
        specId: 'spec-1',
        datasetId: 'dataset-1'
      }
    ],
    page: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
    sort: 'created_at,desc'
  };

  const mockRunDetail: MarketAnalysisRunDetail = {
    runId: 'run-1',
    requestId: 'req-1',
    specType: 'market_stats',
    status: 'SUCCEEDED',
    createdAt: '2026-03-05T10:00:00Z',
    startedAt: '2026-03-05T10:01:00Z',
    finishedAt: '2026-03-05T10:02:00Z',
    updatedAt: '2026-03-05T10:02:00Z',
    errorMessage: null,
    attempts: 1,
    maxAttempts: 3,
    cancelRequested: false,
    persistenceEnabled: true,
    specId: 'spec-1',
    datasetId: 'dataset-1',
    payloadJson: { symbol: 'EURUSD' },
    progressJson: { progress: 100 },
    resultJsonAvailable: true
  };

  const mockRunResult: MarketAnalysisRunResult = {
    runId: 'run-1',
    specType: 'market_stats',
    source: 'persisted_tables',
    meta: {
      specId: 'spec-1',
      datasetId: 'dataset-1',
      outDir: '/tmp/out',
      window: '3y',
      start: '2023-01-01',
      end: '2025-12-31',
      status: 'SUCCEEDED'
    },
    data: {
      marketStatsRows: [{ event: 'breakout', n: 10 }],
      seasonalityProfiles: [{ profile: 'dow', score: 0.7 }],
      seasonalityRunSummary: { trades: 42 },
      rawResultJson: { source: 'json' }
    }
  };

  beforeEach(async () => {
    marketAnalysisRunsSpy = jasmine.createSpyObj<MarketAnalysisRunsService>('MarketAnalysisRunsService', [
      'getRuns',
      'getRunDetail',
      'getRunResult'
    ]);

    TestBed.configureTestingModule({
      imports: [MarketAnalysisPage],
      providers: [{ provide: MarketAnalysisRunsService, useValue: marketAnalysisRunsSpy }]
    });
    await TestBed.compileComponents();
  });

  const stubDefaultResponses = () => {
    marketAnalysisRunsSpy.getRuns.and.returnValue(of(mockRunsPage));
    marketAnalysisRunsSpy.getRunDetail.and.returnValue(of(mockRunDetail));
    marketAnalysisRunsSpy.getRunResult.and.returnValue(of(mockRunResult));
  };

  const createComponent = () => {
    fixture = TestBed.createComponent(MarketAnalysisPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should trigger the runs catalog calls on init', () => {
    stubDefaultResponses();

    createComponent();

    expect(marketAnalysisRunsSpy.getRuns).toHaveBeenCalledWith({
      specType: 'market_stats',
      status: '',
      symbol: '',
      timeframe: '',
      page: 0,
      size: 10,
      sort: 'created_at,desc'
    });
    expect(marketAnalysisRunsSpy.getRunDetail).toHaveBeenCalledWith('run-1');
    expect(marketAnalysisRunsSpy.getRunResult).toHaveBeenCalledWith('run-1');
  });

  it('should apply explicit runs catalog filters only when run filters are set', () => {
    stubDefaultResponses();

    createComponent();

    marketAnalysisRunsSpy.getRuns.calls.reset();

    component.analysisForm.patchValue({
      runSpecType: 'market_stats',
      runStatus: 'SUCCEEDED',
      runSymbol: 'BTC',
      runTimeframe: '1D',
      runsPageSize: 25
    });

    component.refreshRuns();

    expect(marketAnalysisRunsSpy.getRuns).toHaveBeenCalledWith({
      specType: 'market_stats',
      status: 'SUCCEEDED',
      symbol: 'BTC',
      timeframe: '1D',
      page: 0,
      size: 25,
      sort: 'created_at,desc'
    });
  });

  it('should load the runs catalog and expose pagination state', () => {
    stubDefaultResponses();

    createComponent();

    expect(component.runsPage()).toEqual(mockRunsPage);
    expect(component.runRangeLabel()).toBe('1-1 / 1');
    expect(component.canGoToPreviousRunsPage()).toBeFalse();
    expect(component.canGoToNextRunsPage()).toBeFalse();
    expect(component.selectedRunDetail()).toEqual(mockRunDetail);
    expect(component.selectedRunResult()).toEqual(mockRunResult);
  });

  it('should keep the page focused on selected market_stats runs', () => {
    stubDefaultResponses();

    createComponent();

    expect(component.selectedRunHasMarketStatsView()).toBeTrue();
    expect(component.selectedRunHasSeasonalityView()).toBeFalse();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Consultation des runs persistés');
    expect(root.textContent).not.toContain('Ces filtres proviennent de l\'analyse de marche courante');
    expect(root.querySelectorAll('.kpi-card').length).toBe(0);
  });

  it('should project seasonality tabs from the selected seasonality run result', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunDetail.and.returnValue(
      of({
        ...mockRunDetail,
        specType: 'seasonality'
      })
    );
    marketAnalysisRunsSpy.getRunResult.and.returnValue(
      of({
        ...mockRunResult,
        specType: 'seasonality',
        data: {
          marketStatsRows: [],
          seasonalityProfiles: [
            { z_score: 1.2, avg_return: 1.5, bucket: 'Jan', spec_id: 'spec-1' },
            { z_score: -0.4, avg_return: -0.5, bucket: 'Feb', spec_id: 'spec-1' }
          ],
          seasonalityRunSummary: { best_month: 'Jan', observations: 24 },
          rawResultJson: null
        }
      })
    );

    createComponent();

    expect(component.selectedRunHasSeasonalityView()).toBeTrue();
    expect(component.selectedRunHasMarketStatsView()).toBeFalse();
    expect(component.selectedRunSeasonalityColumns()).toEqual(['spec_id', 'bucket', 'avg_return', 'z_score']);

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Saisonnalite du run selectionne');
    expect(root.textContent).toContain('Jan');
    expect(root.textContent).toContain('best_month');

    const headers = Array.from(root.querySelectorAll('.seasonality-run-table thead th')).map(node => node.textContent?.trim());
    expect(headers).toContain('Spec Id');
    expect(headers).toContain('Avg Return');
  });

  it('should qualify partial metadata instead of rendering a mostly empty result meta grid', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunResult.and.returnValue(
      of({
        ...mockRunResult,
        source: 'persisted_tables',
        meta: {
          specId: null,
          datasetId: null,
          outDir: null,
          window: null,
          start: null,
          end: null,
          status: 'SUCCEEDED'
        },
        data: {
          marketStatsRows: [{ event: 'breakout', n: 10 }],
          seasonalityProfiles: [],
          seasonalityRunSummary: null,
          rawResultJson: null
        }
      })
    );

    createComponent();

    expect(component.selectedRunResultSourceLabel()).toBe('Source: persisted_tables');
    expect(component.selectedRunResultMetaCards()).toEqual([
      { label: 'Source', value: 'persisted_tables' },
      { label: 'Window', value: 'Non disponible', note: 'non disponible pour ce type de run' }
    ]);
    expect(component.selectedRunResultMetaNote()).toBe(
      'Resultat tabulaire disponible. Certaines metadonnees ne sont pas fournies pour ce type de run.'
    );
  });

  it('should explain result_json-only runs when no structured rows are available', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunResult.and.returnValue(
      of({
        ...mockRunResult,
        source: 'result_json',
        meta: {
          specId: null,
          datasetId: null,
          outDir: null,
          window: null,
          start: null,
          end: null,
          status: 'SUCCEEDED'
        },
        data: {
          marketStatsRows: [],
          seasonalityProfiles: [],
          seasonalityRunSummary: null,
          rawResultJson: { payload: { rows: 0 } }
        }
      })
    );

    createComponent();

    expect(component.selectedRunResultSourceLabel()).toBe('Source: result_json');
    expect(component.selectedRunResultMetaNote()).toBe(
      'Resultat disponible uniquement via result_json. Les metadonnees structurees peuvent etre partielles.'
    );
  });

  it('should render enriched market_stats rows with prioritized columns and formatted values', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunResult.and.returnValue(
      of({
        ...mockRunResult,
        data: {
          ...mockRunResult.data,
          marketStatsRows: [
            {
              event: 'breakout',
              target: 'continuation_n',
              n: 42,
              lift_freq: 1.2345,
              lift_bayes: 1.1111,
              p_value: 0.01234,
              q_value: 0.04567,
              significant: true,
              p_mean: 0.54321,
              p_map: 0.51234,
              hdi_low: 0.41,
              hdi_high: 0.62,
              insufficient: false
            }
          ]
        }
      })
    );

    createComponent();

    const root = fixture.nativeElement as HTMLElement;
    const marketStatsTable = root.querySelector('.market-stats-run-table') as HTMLTableElement;
    const headers = Array.from(marketStatsTable.querySelectorAll('thead th')).map(cell => cell.textContent?.trim());
    const firstRow = Array.from(marketStatsTable.querySelectorAll('tbody tr:first-child td')).map(cell => cell.textContent?.trim());

    expect(headers).toContain('Lift Freq');
    expect(headers).toContain('Lift Bayes');
    expect(headers).toContain('p_value');
    expect(headers).toContain('q_value');
    expect(headers).toContain('Significant');
    expect(headers).toContain('P Mean');
    expect(headers).toContain('P Map');
    expect(headers).toContain('Hdi Low');
    expect(headers).toContain('Hdi High');
    expect(headers.indexOf('Event')).toBeLessThan(headers.indexOf('Lift Freq'));
    expect(firstRow).toContain('1.2345');
    expect(firstRow).toContain('0.0123');
    expect(firstRow).toContain('Yes');
    expect(firstRow).toContain('No');
  });

  it('should keep backward-compatible market_stats rendering when only legacy columns are present', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunResult.and.returnValue(
      of({
        ...mockRunResult,
        data: {
          ...mockRunResult.data,
          marketStatsRows: [{ event: 'breakout', n: 10 }]
        }
      })
    );

    createComponent();

    expect(component.selectedRunMarketStatsColumns()).toEqual(['event', 'n']);
    const root = fixture.nativeElement as HTMLElement;
    const marketStatsTable = root.querySelector('.market-stats-run-table') as HTMLTableElement;
    const firstRow = Array.from(marketStatsTable.querySelectorAll('tbody tr:first-child td')).map(cell => cell.textContent?.trim());
    expect(firstRow).toEqual(['breakout', '10']);
  });

  it('should request the next runs page with the current filters', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRuns.and.returnValues(
      of({
        ...mockRunsPage,
        page: 0,
        totalElements: 15,
        totalPages: 2
      }),
      of({
        ...mockRunsPage,
        page: 1,
        totalElements: 15,
        totalPages: 2
      })
    );

    createComponent();
    component.loadNextRunsPage();

    expect(marketAnalysisRunsSpy.getRuns.calls.mostRecent().args[0]).toEqual({
      specType: 'market_stats',
      status: '',
      symbol: '',
      timeframe: '',
      page: 1,
      size: 10,
      sort: 'created_at,desc'
    });
    expect(component.runsPage().page).toBe(1);
  });

  it('should expose a result info message when the selected run result is not ready', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunResult.and.returnValue(throwError(() => ({ status: 409 })));

    createComponent();

    expect(component.selectedRunDetail()).toEqual(mockRunDetail);
    expect(component.selectedRunResultInfo()).toBe('Resultat pas encore disponible pour ce run.');
  });

  it('maps 422 runs errors to a validation message', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRuns.and.returnValue(
      throwError(() => ({
        status: 422,
        error: {
          errors: [{ field: 'symbol', message: 'Symbol is required' }]
        }
      }))
    );

    createComponent();

    expect(component.runsError()).toBe('Filtres invalides pour le catalogue des runs. symbol: Symbol is required');
  });

  it('maps 404 detail errors to a run not found message', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunDetail.and.returnValue(throwError(() => ({ status: 404 })));

    createComponent();

    expect(component.selectedRunError()).toBe('Run introuvable.');
  });

  it('maps 5xx runs errors to a service unavailable message', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRuns.and.returnValue(throwError(() => ({ status: 503 })));

    createComponent();

    expect(component.runsError()).toBe('Service indisponible temporairement. Reessayez.');
    expect(component.runsPage().items).toEqual([]);
  });

  it('maps status 0 runs errors to a service unavailable message', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRuns.and.returnValue(throwError(() => ({ status: 0 })));

    createComponent();

    expect(component.runsError()).toBe('Service indisponible temporairement. Reessayez.');
    expect(component.runsPage().items).toEqual([]);
  });
});
