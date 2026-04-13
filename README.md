# Ops Relay

`Ops Relay` is a VS Code sidebar extension that renders a text-only monitor for:

- KOSPI
- KOSDAQ
- USD/KRW
- KRW per 100 JPY
- S&P 500
- NASDAQ
- Dow Jones
- User-selected watch targets

The default presentation intentionally avoids charts, colors, and finance-dashboard styling. Everything is rendered as plain tree items so it looks closer to an internal runtime panel than a stock app.

## What it looks like

- Appears inside the default Explorer sidebar
- Defaults to a stealth label set such as `ops.relay`, `signal.core`, `signal.fx`, and `watch.alloc`
- Shows sync state, source, last update time, and payload status in the same list
- Refresh is manual by default, with optional interval polling

## Data source

This version uses Yahoo Finance's public quote endpoint:

- `https://query1.finance.yahoo.com/v7/finance/quote`

Why this source:

- No API key required
- Covers Korean indices, FX pairs, US major indices, and regular stock symbols in one place
- Cheap to ship because it uses Node's built-in `https` client instead of extra SDKs

Trade-off:

- It is not an official paid market-data contract. If Yahoo changes the endpoint or rate-limits harder, the extension may need a source swap.

## Watch target formats

Open the `Ops Relay` view title buttons and use:

- `Refresh Ops Relay`
- `Register Relay Target`
- `Remove Relay Target`

Accepted watch target formats:

- `AAPL`
- `MSFT`
- `005930.KS`
- `035720.KQ`
- `Naver=035420.KS`
- `Samsung:005930.KS`

Notes:

- If you enter only a 6-digit Korean code like `005930`, it defaults to `.KS`
- For KOSDAQ, enter the suffix explicitly, for example `035720.KQ`

You can also edit settings directly:

```json
"runtimeFeed.watchlist": [
  "AAPL",
  "005930.KS",
  "Kakao=035720.KQ"
]
```

If you search by name in the add dialog, the extension queries Yahoo Finance search first and lets you choose a matching symbol.

## Settings

```json
"runtimeFeed.displayMode": "stealth",
"runtimeFeed.autoRefreshSeconds": 0,
"runtimeFeed.requestTimeoutMs": 10000
```

- `displayMode`: `stealth` hides direct market names in the tree, `explicit` shows them
- `autoRefreshSeconds`: `0` disables polling
- `requestTimeoutMs`: upstream HTTP timeout in milliseconds

## Run locally

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch an Extension Development Host.

## Package locally

```bash
npm run package
```

## If you want a more official fallback later

The current implementation does not require an API key.

If you later want a key-based fallback:

1. Create a free key from Alpha Vantage.
2. Store it in a VS Code setting or secret storage.
3. Swap the fetch layer in `src/extension.ts`.

Alpha Vantage is easier to document formally, but Yahoo currently covers the mixed symbol set better for this extension's default requirements.
