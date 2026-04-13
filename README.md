# Ops Relay

Text-only sidebar stock/currency monitor for VS Code.  
VS Code용 텍스트 기반 사이드바 증시/환율 모니터 입니다.

Ops Relay shows live market-related signals in a plain operational view.  
Ops Relay는 실시간 시장 관련 신호를 운영 패널처럼 단순한 형태로 보여줍니다.

Reason for the name: We wanted to avoid a stock-like name and give it more of a dev tool extension vibe.
Ops Relay라고 이름지은 이유는, stock 같은 이름을 사용하면 너무 주식 느낌이 나서, 최대한 개발용 extension 같은 비주얼을 주기 위함입니다.

회사에서도 눈치보지 말고 편하게 주가를 확인해보세요.

## Features

- KOSPI, KOSDAQ, USD/KRW, KRW per 100 JPY
- S&P 500, NASDAQ, Dow Jones
- User watchlist
- Manual refresh
- Text-only layout, no charts
- Session-aware display for active market hours

## 기능

- 코스피, 코스닥, 원/달러, 100엔당 원화
- S&P 500, 나스닥, 다우존스
- 사용자 관심 종목 목록
- 수동 새로고침
- 차트 없는 텍스트 전용 레이아웃
- 현재 운영 중인 세션 기준 표시

## Usage

Open `Ops Relay` in the Explorer sidebar.  
Use the toolbar buttons to refresh, add, or remove watch targets.

`Explorer` 사이드바에서 `Ops Relay`를 열면 됩니다.  
상단 버튼으로 새로고침, 관심 종목 추가, 삭제를 할 수 있습니다.

## Settings

- `runtimeFeed.displayMode`
- `runtimeFeed.watchlist`
- `runtimeFeed.autoRefreshSeconds`
- `runtimeFeed.requestTimeoutMs`

## Data Source

This extension currently uses public Yahoo Finance endpoints.  
No API key is required in the current version.

현재 버전은 Yahoo Finance 공개 엔드포인트를 사용합니다.  
별도 API 키는 필요하지 않습니다.

## Repository

- GitHub: https://github.com/taehyunkim3/vscode-kospi
- Issues: https://github.com/taehyunkim3/vscode-kospi/issues
