# vscode stock

VS Code Activity Bar의 전용 아이콘 아래에서 주가, 지수, 환율과 선택한 종목의 주요 뉴스를 텍스트로 보여주는 확장입니다.

기본 모드는 시장명과 종목명을 바로 알아볼 수 있는 명시 모드입니다. 설정에서 스텔스 모드로 바꾸면 자세히 보지 않는 한 주식 시세 정보처럼 보이지 않는 라벨을 사용할 수 있습니다.

## 기능

- 코스피, 코스닥, 원/달러, 100엔당 원화
- S&P 500, 나스닥, 다우존스
- 관심 종목 추가
- 선택한 종목 기준 주요 뉴스 표시
- 수동 새로고침
- 상승/하락 방향 아이콘 표시
- 차트 없는 텍스트 전용 레이아웃
- 현재 운영 중인 세션 기준 표시
- 관심 종목 클릭 시 뉴스 대상 선택
- 관심 종목 삭제 후 Undo 지원

## 사용법

왼쪽 `Activity Bar`에서 `vscode kospi` 아이콘을 누르면 됩니다.  
`시장 시세` 뷰에서 종목을 클릭하면 `주요 뉴스` 뷰가 해당 종목 기준으로 갱신됩니다.  
상단 버튼으로 새로고침, 관심 종목 추가, 삭제를 할 수 있습니다.

## 설정

- `runtimeFeed.displayMode`
- `runtimeFeed.watchlist`
- `runtimeFeed.autoRefreshSeconds`
- `runtimeFeed.requestTimeoutMs`

`runtimeFeed.displayMode`는 `explicit`과 `stealth`를 지원합니다. 처음 설치하면 `explicit` 모드로 시작하며, 사이드바를 덜 눈에 띄게 쓰고 싶다면 `stealth`로 변경하면 됩니다.

## 데이터 소스

현재 버전은 Yahoo Finance 공개 엔드포인트를 사용합니다.  
별도 API 키는 필요하지 않습니다.

## 저장소

- GitHub: https://github.com/taehyunkim3/vscode-kospi
- Issues: https://github.com/taehyunkim3/vscode-kospi/issues
