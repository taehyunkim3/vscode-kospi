import * as https from 'node:https';
import * as vscode from 'vscode';

const CONFIG_NAMESPACE = 'runtimeFeed';
const VIEW_ID = 'runtimeFeedView';
const YAHOO_CHART_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH_ENDPOINT = 'https://query1.finance.yahoo.com/v1/finance/search';

type SectionKey = 'runtime.pipe' | 'core.indices' | 'fx.bridge' | 'watch.targets';
type DisplayMode = 'stealth' | 'explicit';

interface QuoteDefinition {
  readonly section: Exclude<SectionKey, 'runtime.pipe'>;
  readonly key: string;
  readonly explicitLabel: string;
  readonly stealthLabel: string;
  readonly symbol: string;
  readonly decimals?: number;
  readonly transformPrice?: (price: number) => number;
  readonly notes?: string;
}

interface YahooQuote {
  readonly symbol: string;
  readonly shortName?: string;
  readonly longName?: string;
  readonly regularMarketPrice?: number;
  readonly regularMarketChange?: number;
  readonly regularMarketChangePercent?: number;
  readonly regularMarketTime?: number;
  readonly regularMarketPreviousClose?: number;
  readonly marketState?: string;
  readonly currency?: string;
}

interface YahooChartMeta {
  readonly symbol?: string;
  readonly shortName?: string;
  readonly longName?: string;
  readonly regularMarketPrice?: number;
  readonly previousClose?: number;
  readonly chartPreviousClose?: number;
  readonly regularMarketTime?: number;
  readonly currency?: string;
  readonly exchangeName?: string;
  readonly currentTradingPeriod?: {
    readonly pre?: YahooTradingPeriod;
    readonly regular?: YahooTradingPeriod;
    readonly post?: YahooTradingPeriod;
  };
}

interface YahooChartResult {
  readonly meta?: YahooChartMeta;
  readonly timestamp?: number[];
  readonly indicators?: {
    readonly quote?: Array<{
      readonly close?: Array<number | null>;
    }>;
  };
}

interface YahooTradingPeriod {
  readonly start?: number;
  readonly end?: number;
}

interface YahooChartResponse {
  readonly chart?: {
    readonly result?: YahooChartResult[];
    readonly error?: {
      readonly code?: string;
      readonly description?: string;
    };
  };
}

interface YahooSearchQuote {
  readonly symbol?: string;
  readonly shortname?: string;
  readonly longname?: string;
  readonly exchDisp?: string;
  readonly quoteType?: string;
  readonly typeDisp?: string;
}

interface YahooSearchResponse {
  readonly quotes?: YahooSearchQuote[];
}

interface WatchCandidatePick extends vscode.QuickPickItem {
  readonly entry: string;
}

interface FeedSnapshot {
  readonly quotes: Map<string, YahooQuote>;
  readonly updatedAt?: Date;
  readonly errorMessage?: string;
}

const CORE_DEFINITIONS: readonly QuoteDefinition[] = [
  { section: 'core.indices', key: 'kospi', explicitLabel: 'KOSPI', stealthLabel: 'kr.main', symbol: '^KS11', decimals: 2 },
  { section: 'core.indices', key: 'kosdaq', explicitLabel: 'KOSDAQ', stealthLabel: 'kr.growth', symbol: '^KQ11', decimals: 2 },
  { section: 'core.indices', key: 'sp500', explicitLabel: 'S&P 500', stealthLabel: 'us.large', symbol: '^GSPC', decimals: 2 },
  { section: 'core.indices', key: 'nasdaq', explicitLabel: 'NASDAQ', stealthLabel: 'us.tech', symbol: '^IXIC', decimals: 2 },
  { section: 'core.indices', key: 'dow', explicitLabel: 'Dow Jones', stealthLabel: 'us.legacy', symbol: '^DJI', decimals: 2 },
];

const FX_DEFINITIONS: readonly QuoteDefinition[] = [
  { section: 'fx.bridge', key: 'usd_krw', explicitLabel: 'USD/KRW', stealthLabel: 'fx.usd.krw', symbol: 'KRW=X', decimals: 2 },
  {
    section: 'fx.bridge',
    key: 'krw_per_100_jpy',
    explicitLabel: 'KRW per 100 JPY',
    stealthLabel: 'fx.jpy.krw.100',
    symbol: 'JPYKRW=X',
    decimals: 2,
    transformPrice: (price) => price * 100,
    notes: 'Rendered as KRW per 100 JPY.',
  },
];

class FeedNode extends vscode.TreeItem {
  public children: FeedNode[] = [];
  public watchEntry?: string;

  public constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
  }
}

class RuntimeFeedProvider implements vscode.TreeDataProvider<FeedNode>, vscode.Disposable {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<FeedNode | undefined>();
  private snapshot: FeedSnapshot = { quotes: new Map() };
  private isRefreshing = false;
  private refreshTimer: NodeJS.Timeout | undefined;

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public constructor() {
    this.applyRefreshSchedule();
  }

  public dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  public getTreeItem(element: FeedNode): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: FeedNode): FeedNode[] {
    if (element) {
      return element.children;
    }

    return this.buildRootNodes();
  }

  public async refresh(): Promise<void> {
    if (this.isRefreshing) {
      return;
    }

    this.isRefreshing = true;
    this.onDidChangeTreeDataEmitter.fire(undefined);

    try {
      const definitions = [...CORE_DEFINITIONS, ...FX_DEFINITIONS, ...this.getWatchDefinitions()];
      const quotes = await fetchQuotes(
        definitions.map((definition) => definition.symbol),
        getRequestTimeoutMs(),
      );

      this.snapshot = {
        quotes,
        updatedAt: new Date(),
        errorMessage: undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upstream failure';
      this.snapshot = {
        ...this.snapshot,
        errorMessage: message,
      };
    } finally {
      this.isRefreshing = false;
      this.onDidChangeTreeDataEmitter.fire(undefined);
    }
  }

  public applyRefreshSchedule(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    const intervalSeconds = getAutoRefreshSeconds();
    if (intervalSeconds <= 0) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, intervalSeconds * 1000);
  }

  private buildRootNodes(): FeedNode[] {
    return [
      this.buildRuntimeSection(),
      this.buildSection('core.indices', CORE_DEFINITIONS),
      this.buildSection('fx.bridge', FX_DEFINITIONS),
      this.buildSection('watch.targets', this.getWatchDefinitions()),
    ];
  }

  private buildRuntimeSection(): FeedNode {
    const section = new FeedNode(
      getDisplayMode() === 'stealth' ? 'ops.relay' : 'runtime.pipe',
      vscode.TreeItemCollapsibleState.Expanded,
    );
    section.description = 'control plane';
    section.children = [
      this.buildLeaf(
        'transport.status',
        this.isRefreshing ? 'pulling upstream' : this.snapshot.errorMessage ? 'degraded' : 'online',
        buildStatusTooltip(this.snapshot, this.isRefreshing),
      ),
      this.buildLeaf('transport.source', 'yahoo.chart.v8', 'Public Yahoo Finance chart endpoint'),
      this.buildLeaf('transport.mode', getAutoRefreshSeconds() > 0 ? 'interval' : 'manual', 'Polling mode'),
      this.buildLeaf(
        'transport.updated_at',
        this.snapshot.updatedAt ? formatDateTime(this.snapshot.updatedAt) : 'pending',
        'Last successful sync',
      ),
    ];

    if (this.snapshot.errorMessage) {
      section.children.push(
        this.buildLeaf('transport.error', this.snapshot.errorMessage, 'Most recent upstream error'),
      );
    }

    return section;
  }

  private buildSection(
    title: Exclude<SectionKey, 'runtime.pipe'>,
    definitions: readonly QuoteDefinition[],
  ): FeedNode {
    const section = new FeedNode(resolveSectionLabel(title), vscode.TreeItemCollapsibleState.Expanded);
    section.description = `${definitions.length} feed${definitions.length === 1 ? '' : 's'}`;

    if (definitions.length === 0) {
      section.children = [
        this.buildLeaf('watch.empty', 'use Add Runtime Target', 'No user watch targets configured'),
      ];
      return section;
    }

    section.children = definitions.map((definition) => this.buildQuoteNode(definition));
    return section;
  }

  private buildQuoteNode(definition: QuoteDefinition): FeedNode {
    const item = new FeedNode(resolveQuoteLabel(definition), vscode.TreeItemCollapsibleState.None);
    if (definition.section === 'watch.targets') {
      item.contextValue = 'watchTarget';
      item.watchEntry = `${definition.explicitLabel}=${definition.symbol}`;
      item.command = {
        command: 'runtimeFeed.removeWatchSymbol',
        title: 'Remove Relay Target',
        arguments: [item],
      };
    }

    const quote = this.snapshot.quotes.get(definition.symbol);

    if (!quote) {
      item.description = this.isRefreshing ? 'syncing' : 'unavailable';
      item.tooltip = buildMissingTooltip(definition, this.snapshot.errorMessage);
      return item;
    }

    const price = typeof quote.regularMarketPrice === 'number'
      ? applyTransform(quote.regularMarketPrice, definition.transformPrice)
      : undefined;
    const percent = quote.regularMarketChangePercent;
    item.description = `${formatPrice(price, definition.decimals)} | ${formatPercent(percent)}`;
    item.tooltip = buildQuoteTooltip(definition, quote, price, this.snapshot.updatedAt);
    return item;
  }

  private buildLeaf(label: string, description: string, tooltip: string): FeedNode {
    const item = new FeedNode(label, vscode.TreeItemCollapsibleState.None);
    item.description = description;
    item.tooltip = tooltip;
    return item;
  }

  private getWatchDefinitions(): QuoteDefinition[] {
    const configuredItems = vscode.workspace
      .getConfiguration(CONFIG_NAMESPACE)
      .get<string[]>('watchlist', []);

    const seen = new Set<string>();
    const watchDefinitions: QuoteDefinition[] = [];

    for (const configuredItem of configuredItems) {
      const parsed = parseWatchEntry(configuredItem);
      if (!parsed || seen.has(parsed.symbol)) {
        continue;
      }

      seen.add(parsed.symbol);
      watchDefinitions.push(parsed);
    }

    return watchDefinitions;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new RuntimeFeedProvider();
  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: false,
  });

  context.subscriptions.push(
    provider,
    treeView,
    vscode.commands.registerCommand('runtimeFeed.refresh', async () => {
      await provider.refresh();
    }),
    vscode.commands.registerCommand('runtimeFeed.addWatchSymbol', async () => {
      const input = await vscode.window.showInputBox({
        title: 'Register Relay Target',
        prompt: 'Search company, symbol, or KRX code',
        placeHolder: 'Examples: Apple, AAPL, 삼성전자, 005930, 035720.KQ',
        ignoreFocusOut: true,
      });

      if (!input?.trim()) {
        return;
      }

      const configuration = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
      const watchlist = configuration.get<string[]>('watchlist', []);
      const selection = await selectWatchCandidate(input.trim());
      if (!selection) {
        return;
      }

      const candidate = selection.entry;
      const parsedCandidate = parseWatchEntry(candidate);
      const normalizedCandidateSymbol = parsedCandidate?.symbol;
      const existingSymbols = new Set(
        watchlist
          .map((entry) => parseWatchEntry(entry)?.symbol)
          .filter((symbol): symbol is string => typeof symbol === 'string'),
      );

      if (watchlist.includes(candidate) || (normalizedCandidateSymbol && existingSymbols.has(normalizedCandidateSymbol))) {
        void vscode.window.showInformationMessage('Runtime target already exists.');
        return;
      }

      await configuration.update('watchlist', [...watchlist, candidate], vscode.ConfigurationTarget.Global);
      await provider.refresh();
    }),
    vscode.commands.registerCommand('runtimeFeed.removeWatchSymbol', async (node?: FeedNode) => {
      const configuration = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
      const watchlist = configuration.get<string[]>('watchlist', []);

      if (watchlist.length === 0) {
        void vscode.window.showInformationMessage('No runtime targets to remove.');
        return;
      }

      const directEntry = node?.watchEntry;
      let entryToRemove: string | undefined;

      if (directEntry && watchlist.includes(directEntry)) {
        entryToRemove = directEntry;
      } else {
        const selected = await vscode.window.showQuickPick(
          watchlist.map((entry) => ({
            label: entry,
          })),
          {
            title: 'Remove Relay Target',
            placeHolder: 'Choose a symbol to remove from watch.alloc',
            ignoreFocusOut: true,
          },
        );

        if (!selected) {
          return;
        }

        entryToRemove = selected.label;
      }

      await configuration.update(
        'watchlist',
        watchlist.filter((entry) => entry !== entryToRemove),
        vscode.ConfigurationTarget.Global,
      );
      await provider.refresh();
    }),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!event.affectsConfiguration(CONFIG_NAMESPACE)) {
        return;
      }

      provider.applyRefreshSchedule();
      await provider.refresh();
    }),
  );

  void provider.refresh();
}

export function deactivate(): void {
  // No-op.
}

function parseWatchEntry(rawEntry: string): QuoteDefinition | undefined {
  const trimmed = rawEntry.trim();
  if (!trimmed) {
    return undefined;
  }

  const delimiterIndex = trimmed.search(/[:=]/u);
  const hasDelimiter = delimiterIndex >= 0;
  const rawLabel = hasDelimiter ? trimmed.slice(0, delimiterIndex).trim() : trimmed;
  const rawSymbol = hasDelimiter ? trimmed.slice(delimiterIndex + 1).trim() : trimmed;
  if (!rawSymbol) {
    return undefined;
  }

  const symbol = normalizeSymbol(rawSymbol);
  const labelText = rawLabel || symbol;
  const stealthBase = sanitizeIdentifier(rawLabel || symbol);
  return {
    section: 'watch.targets',
    key: `watch-${symbol.toLowerCase()}`,
    explicitLabel: labelText,
    stealthLabel: `target.${stealthBase}`,
    symbol,
    decimals: 2,
  };
}

function normalizeSymbol(value: string): string {
  const trimmed = value.trim();

  if (/^\d{6}$/u.test(trimmed)) {
    return `${trimmed}.KS`;
  }

  return trimmed.toUpperCase();
}

function applyTransform(price: number, transformPrice?: (price: number) => number): number {
  return transformPrice ? transformPrice(price) : price;
}

function formatPrice(price: number | undefined, decimals = 2): string {
  if (typeof price !== 'number' || Number.isNaN(price)) {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

function formatPercent(percent: number | undefined): string {
  if (typeof percent !== 'number' || Number.isNaN(percent)) {
    return 'n/a';
  }

  const prefix = percent > 0 ? '+' : '';
  return `${prefix}${percent.toFixed(2)}%`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

function buildQuoteTooltip(
  definition: QuoteDefinition,
  quote: YahooQuote,
  renderedPrice: number | undefined,
  updatedAt: Date | undefined,
): string {
  const lines = [
    `label: ${resolveQuoteLabel(definition)}`,
    `market_name: ${definition.explicitLabel}`,
    `symbol: ${definition.symbol}`,
    `price: ${formatPrice(renderedPrice, definition.decimals)}`,
    `change_percent: ${formatPercent(quote.regularMarketChangePercent)}`,
    `market_state: ${quote.marketState ?? 'UNKNOWN'}`,
    `currency: ${quote.currency ?? 'n/a'}`,
    `upstream_name: ${quote.shortName ?? quote.longName ?? 'n/a'}`,
    `quote_time: ${quote.regularMarketTime ? formatDateTime(new Date(quote.regularMarketTime * 1000)) : 'n/a'}`,
    `sync_time: ${updatedAt ? formatDateTime(updatedAt) : 'n/a'}`,
  ];

  if (definition.notes) {
    lines.push(`notes: ${definition.notes}`);
  }

  return lines.join('\n');
}

function resolveSectionLabel(section: Exclude<SectionKey, 'runtime.pipe'>): string {
  const displayMode = getDisplayMode();
  if (displayMode === 'explicit') {
    switch (section) {
      case 'core.indices':
        return 'indices';
      case 'fx.bridge':
        return 'fx';
      case 'watch.targets':
        return 'watchlist';
    }
  }

  switch (section) {
    case 'core.indices':
      return 'signal.core';
    case 'fx.bridge':
      return 'signal.fx';
    case 'watch.targets':
      return 'watch.alloc';
  }
}

function resolveQuoteLabel(definition: QuoteDefinition): string {
  return getDisplayMode() === 'explicit' ? definition.explicitLabel : definition.stealthLabel;
}

function getDisplayMode(): DisplayMode {
  return vscode.workspace.getConfiguration(CONFIG_NAMESPACE).get<DisplayMode>('displayMode', 'stealth');
}

function buildStatusTooltip(snapshot: FeedSnapshot, isRefreshing: boolean): string {
  const lines = [
    `state: ${isRefreshing ? 'pulling upstream' : snapshot.errorMessage ? 'degraded' : 'online'}`,
    `last_success: ${snapshot.updatedAt ? formatDateTime(snapshot.updatedAt) : 'n/a'}`,
  ];

  if (snapshot.errorMessage) {
    lines.push(`last_error: ${snapshot.errorMessage}`);
  }

  return lines.join('\n');
}

function buildMissingTooltip(definition: QuoteDefinition, errorMessage?: string): string {
  const lines = [
    `symbol: ${definition.symbol}`,
    'status: no payload in cache',
  ];

  if (errorMessage) {
    lines.push(`last_error: ${errorMessage}`);
  }

  return lines.join('\n');
}

function getRequestTimeoutMs(): number {
  return Math.max(
    2000,
    vscode.workspace.getConfiguration(CONFIG_NAMESPACE).get<number>('requestTimeoutMs', 10000),
  );
}

function getAutoRefreshSeconds(): number {
  return Math.max(
    0,
    vscode.workspace.getConfiguration(CONFIG_NAMESPACE).get<number>('autoRefreshSeconds', 0),
  );
}

function sanitizeIdentifier(value: string): string {
  const lowered = value.trim().toLowerCase();
  const sanitized = lowered.replace(/[^a-z0-9]+/gu, '.').replace(/^\.+|\.+$/gu, '');
  return sanitized || 'unknown';
}

function looksLikeDirectSymbol(value: string): boolean {
  return /^[A-Za-z0-9.^=-]{1,20}(?:\.[A-Za-z]{1,4})?$/u.test(value.trim()) || /^\d{6}$/u.test(value.trim());
}

async function selectWatchCandidate(input: string): Promise<{ entry: string } | undefined> {
  const normalizedRawSymbol = normalizeSymbol(input);
  let suggestions: YahooSearchQuote[] = [];
  let searchFailed = false;

  try {
    suggestions = await searchSymbols(input, getRequestTimeoutMs());
  } catch {
    searchFailed = true;
  }

  const picks: WatchCandidatePick[] = [];
  const seenEntries = new Set<string>();

  for (const suggestion of suggestions) {
    const symbol = normalizeSymbol(suggestion.symbol ?? '');
    if (!symbol) {
      continue;
    }

    const preferredName = suggestion.shortname ?? suggestion.longname ?? symbol;
    const entry = `${preferredName}=${symbol}`;
    if (seenEntries.has(entry)) {
      continue;
    }

    seenEntries.add(entry);
    picks.push({
      entry,
      label: preferredName,
      description: `${symbol} · ${suggestion.exchDisp ?? suggestion.typeDisp ?? 'feed'}`,
      detail: suggestion.longname && suggestion.longname !== preferredName ? suggestion.longname : undefined,
      alwaysShow: true,
    });
  }

  const canUseRawSymbol = looksLikeDirectSymbol(input) || picks.length === 0;
  if (canUseRawSymbol) {
    const rawEntry = normalizedRawSymbol;
    if (!seenEntries.has(rawEntry)) {
      picks.unshift({
        entry: rawEntry,
        label: `Use raw symbol`,
        description: rawEntry,
        detail: 'Registers the exact normalized symbol without a company-name label',
        alwaysShow: true,
      });
    }
  }

  if (picks.length === 0) {
    void vscode.window.showWarningMessage(searchFailed ? 'Target search failed and no direct symbol was detected.' : 'No matching relay targets found.');
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(picks, {
    title: 'Select Relay Target',
    placeHolder: 'Pick a matching instrument or use the raw symbol',
    ignoreFocusOut: true,
  });

  if (!selected) {
    return undefined;
  }

  return { entry: selected.entry };
}

async function fetchQuotes(symbols: readonly string[], timeoutMs: number): Promise<Map<string, YahooQuote>> {
  const uniqueSymbols = [...new Set(symbols)];
  if (uniqueSymbols.length === 0) {
    return new Map();
  }

  const quoteMap = new Map<string, YahooQuote>();
  const failures: string[] = [];

  for (const symbol of uniqueSymbols) {
    try {
      const quote = await fetchChartQuote(symbol, timeoutMs);
      quoteMap.set(symbol, quote);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown chart upstream failure';
      failures.push(`${symbol}: ${message}`);
    }
  }

  if (quoteMap.size === 0 && failures.length > 0) {
    throw new Error(failures[0]);
  }

  return quoteMap;
}

async function fetchChartQuote(symbol: string, timeoutMs: number): Promise<YahooQuote> {
  const url = new URL(`${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(symbol)}`);
  url.searchParams.set('interval', '1m');
  url.searchParams.set('range', '1d');
  url.searchParams.set('includePrePost', 'true');
  url.searchParams.set('events', 'div,splits');
  url.searchParams.set('lang', 'en-US');
  url.searchParams.set('region', 'US');

  const response = await requestJson<YahooChartResponse>(url, timeoutMs);
  const chartError = response.chart?.error;
  if (chartError?.description) {
    throw new Error(chartError.description);
  }

  const result = response.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) {
    throw new Error('No chart metadata returned from upstream');
  }

  const activeTick = extractActiveTick(result, meta);
  const regularMarketPrice = activeTick?.price ?? meta.regularMarketPrice;
  const previousClose = meta.previousClose ?? meta.chartPreviousClose;
  const regularMarketChange =
    typeof regularMarketPrice === 'number' && typeof previousClose === 'number'
      ? regularMarketPrice - previousClose
      : undefined;
  const regularMarketChangePercent =
    typeof regularMarketChange === 'number' && typeof previousClose === 'number' && previousClose !== 0
      ? (regularMarketChange / previousClose) * 100
      : undefined;

  return {
    symbol: meta.symbol ?? symbol,
    shortName: meta.shortName,
    longName: meta.longName,
    regularMarketPrice,
    regularMarketPreviousClose: previousClose,
    regularMarketChange,
    regularMarketChangePercent,
    regularMarketTime: activeTick?.timestamp ?? meta.regularMarketTime,
    marketState: activeTick?.session ?? meta.exchangeName,
    currency: meta.currency,
  };
}

function extractActiveTick(
  result: YahooChartResult | undefined,
  meta: YahooChartMeta,
): { price: number; timestamp: number; session: string } | undefined {
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  for (let index = Math.min(timestamps.length, closes.length) - 1; index >= 0; index -= 1) {
    const timestamp = timestamps[index];
    const price = closes[index];
    if (typeof timestamp !== 'number' || typeof price !== 'number' || Number.isNaN(price)) {
      continue;
    }

    return {
      price,
      timestamp,
      session: resolveSessionName(timestamp, meta.currentTradingPeriod),
    };
  }

  return undefined;
}

function resolveSessionName(
  timestamp: number,
  currentTradingPeriod?: YahooChartMeta['currentTradingPeriod'],
): string {
  const pre = currentTradingPeriod?.pre;
  if (isWithinPeriod(timestamp, pre)) {
    return 'PRE';
  }

  const regular = currentTradingPeriod?.regular;
  if (isWithinPeriod(timestamp, regular)) {
    return 'REGULAR';
  }

  const post = currentTradingPeriod?.post;
  if (isWithinPeriod(timestamp, post)) {
    return 'POST';
  }

  return 'ACTIVE';
}

function isWithinPeriod(timestamp: number, period?: YahooTradingPeriod): boolean {
  return typeof period?.start === 'number'
    && typeof period?.end === 'number'
    && timestamp >= period.start
    && timestamp <= period.end;
}

async function searchSymbols(query: string, timeoutMs: number): Promise<YahooSearchQuote[]> {
  const url = new URL(YAHOO_SEARCH_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('quotesCount', '8');
  url.searchParams.set('newsCount', '0');
  url.searchParams.set('enableFuzzyQuery', 'true');
  url.searchParams.set('lang', 'en-US');
  url.searchParams.set('region', 'US');

  const response = await requestJson<YahooSearchResponse>(url, timeoutMs);
  return (response.quotes ?? []).filter((quote) => typeof quote.symbol === 'string');
}

async function requestJson<T>(url: URL, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'runtime-feed-vscode-extension/0.0.1',
        },
        timeout: timeoutMs,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${statusCode} from upstream quote service`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('error', reject);
        response.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    request.on('error', reject);
  });
}
