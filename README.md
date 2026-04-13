# vscode stock

VS Code Activity Bar의 전용 아이콘 아래에서 주가, 지수, 환율과 선택한 종목의 주요 뉴스를 텍스트로 보여주는 확장입니다.

자세히 보지 않으면, 아무도 이게 주식 시세 정보라는걸 알수 없도록 디자인했습니다.

## 기능

- 코스피, 코스닥, 원/달러, 100엔당 원화
- S&P 500, 나스닥, 다우존스
- 관심 종목 추가
- 선택한 종목 기준 주요 뉴스 표시
- 수동 새로고침
- 차트 없는 텍스트 전용 레이아웃
- 현재 운영 중인 세션 기준 표시
- 관심 종목 클릭 시 뉴스 대상 선택

## 사용법

왼쪽 `Activity Bar`에서 `vscode kospi` 아이콘을 누르면 됩니다.  
`시장 시세` 뷰에서 종목을 클릭하면 `주요 뉴스` 뷰가 해당 종목 기준으로 갱신됩니다.  
상단 버튼으로 새로고침, 관심 종목 추가, 삭제를 할 수 있습니다.

## 설정

- `runtimeFeed.displayMode`
- `runtimeFeed.watchlist`
- `runtimeFeed.autoRefreshSeconds`
- `runtimeFeed.requestTimeoutMs`

## 데이터 소스

현재 버전은 Yahoo Finance 공개 엔드포인트를 사용합니다.  
별도 API 키는 필요하지 않습니다.

## 저장소

- GitHub: https://github.com/taehyunkim3/vscode-kospi
- Issues: https://github.com/taehyunkim3/vscode-kospi/issues
