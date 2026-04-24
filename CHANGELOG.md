# Changelog

## 0.0.7

- Polished sidebar labels, command titles, and default display mode for clearer first-run UX
- Simplified the news view header so articles appear higher in the sidebar
- Added quote direction icons and watchlist removal Undo
- Reduced duplicate news refreshes after changing the selected symbol
- Batched quote refresh requests to improve perceived refresh speed with watchlists
- Expanded marketplace search metadata with stock, index, exchange-rate, news, Korean-market, and Cursor keywords
- Updated display name and description to improve discoverability

## 0.0.6

- Lowered the VS Code engine requirement to `^1.104.0` for Cursor 3.1.15 compatibility
- Bumped release metadata to `0.0.6`

## 0.0.5

- Lowered the minimum VS Code engine requirement to `^1.105.0` for Cursor compatibility
- Bumped release metadata to `0.0.5`

## 0.0.4

- Replaced editor-based news preview with expandable sidebar news detail
- Added lazy article detail loading when a news item is expanded
- Kept news content text-only and wrapped into multiple lines in the tree

## 0.0.3

- Added a news-target picker action in the news view title
- Marked the active news symbol directly in the quotes list
- Added clearer in-view guidance for changing the current news target

## 0.0.2

- Added a dedicated Activity Bar icon and sidebar container
- Added a stock news tree view tied to the selected quote
- Fixed the bug where clicking a watch target removed it immediately
- Preserved raw watchlist entries during removal and refresh flows

## 0.0.1

- Initial Runtime Feed sidebar implementation
- Text-only market, FX, and watch-target monitoring
- Manual refresh plus optional interval polling
- Yahoo search-based target registration
- Stealth and explicit label modes
