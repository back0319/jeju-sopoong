# 제주 소풍 · 주세요 브랜드 에셋

디자이너 AI 원본에서 추출한 웹용 에셋입니다. 로고 SVG는 **진짜 벡터**라
확대해도 깨지지 않습니다.

## 로고

| 파일 | 용도 |
|---|---|
| `logo-wordmark.svg` `.png` | **기본 가로형.** 헤더에 이걸 쓰세요 |
| `logo-stacked.svg` `.png` | 세로형. 좁은 폭이나 시작 화면용 |
| `logo-house.svg` `.png` | 하우스 프레임형. 푸터·인쇄물용 |
| `logo-house-outline.svg` `.png` | 하우스 아웃라인. 워터마크·배경용 |
| `symbol.svg` `.png` | 음표 심볼. 파비콘·로딩·좁은 자리 |

## 서비스 로고 (주세요)

| 파일 | 용도 |
|---|---|
| `juseyo-wordmark.svg` `.png` | JUSEYO 워드마크 |
| `juseyo-badge.svg` `.png` | 검정 다각형 배지 |

## 파비콘

`favicon-32.png` · `apple-touch-icon.png` (180) · `icon-192.png` · `icon-512.png`

Next.js는 `app/` 폴더에 `icon.png`, `apple-icon.png`로 두면 자동 인식합니다.

## 원물 일러스트 (`ingredients/`)

특별 추가 재료 4종. **주문 화면의 토핑 선택 카드와 원물 소개 화면에
그대로 쓰면 됩니다.**

| 파일 | 재료 | 카드 배경색 |
|---|---|---|
| `carrot.svg` `.png` | 당근 | 노랑 |
| `pork.svg` `.png` | 제주 돼지고기 | 분홍 |
| `turban-shell.svg` `.png` | 뿔소라 | 하늘 |
| `fernbrake.svg` `.png` | 고사리 | 회색 |

각 일러스트에는 영문 라벨(CARROT / PORK / TURBAN SHELL / FERNBRAKE)이
그림 안에 포함되어 있습니다. 한국어 화면에서는 라벨이 영문으로 보이므로,
카드 아래에 한글 이름을 따로 표시하세요.

## 김밥 단면 패턴 색상

패턴 이미지에서 추출한 실제 사용 색상입니다. 배경 패턴이나 포인트 컬러로
쓸 수 있습니다.

**패턴 1 (자연 톤)**

`#427840` 진녹 · `#D6F3D8` 연민트 · `#E2693C` 주황 · `#EF8965` 연주황
· `#F4F458` 노랑 · `#976220` 갈색 · `#3E3510` 진갈색

**패턴 2 (형광 톤)**

`#2E7C3C` 진녹 · `#DAFFE1` 연민트 · `#F15A24` 주황 · `#FF825C` 연주황
· `#FFFF21` 형광노랑 · `#F8AF22` 노랑 · `#C2C5FF` 연보라

원본 패턴 이미지 `김밥단면패턴1.png` / `김밥단면패턴2.png`도 함께 있습니다.

## 사용 방법

로고 SVG는 원본 벡터라 색상이 `fill="rgb(0%,0%,0%)"`로 고정되어 있습니다.
다크모드에서 색을 바꾸려면 CSS 필터를 쓰거나, `symbol.svg`처럼
`currentColor`로 된 파일을 쓰세요.

```html
<img src="/brand/logo-wordmark.svg" alt="제주 소풍" height="32">
```

```css
/* 어두운 배경에서 흰색으로 */
.logo-invert { filter: invert(1); }
```

## 주의

- 로고는 비율을 유지해 쓰고, 임의로 늘리거나 색을 바꾸지 마세요.
- 원물 일러스트는 카드 배경색이 그림에 포함되어 있어 배경이 투명하지
  않습니다. 카드 UI에 그대로 넣는 것을 전제로 만들어졌습니다.
