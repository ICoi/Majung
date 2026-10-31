# 마중 · 상견례 초대장

사진으로 시작해 일시, 장소, 양가 가족과 길 안내를 읽는 모바일 초대장입니다. 비밀번호를 입력하면 브라우저 안에서 본문과 이미지를 복호화합니다. 별도 서버·가입·외부 폰트·분석 도구는 없습니다.

## 프로젝트 작업 기준

합의된 방향과 작업 방식은 [majung-invitation 스킬](.agents/skills/majung-invitation/SKILL.md)에 정리합니다. 방향이 바뀌면 관련 구현과 함께 스킬을 갱신하고, 의미 있는 작업 단위를 검증한 뒤 로컬 커밋으로 남깁니다. 후속 작업에서는 [AGENTS.md](AGENTS.md)의 지침을 먼저 읽습니다.

## 예시 확인

Node.js 22 이상에서 실행합니다.

```sh
npm ci
npm run demo
npm run preview
```

`http://127.0.0.1:4173/Majung/`을 엽니다. 예시 비밀번호는 **로컬의 `.private/preview-password.txt`**에서 확인합니다. 파일이 없으면 처음 생성할 때 임의 비밀번호를 만들고, 이후 빌드에서는 기존 값을 유지합니다. 이 파일을 수정한 뒤 `npm run demo`를 실행하면 예시 비밀번호가 변경됩니다. 실제 배포용 비밀번호는 숫자 6자리이며, 예시 모드는 비어 있지 않은 값을 허용합니다. 비밀번호를 커밋하거나 URL에 넣지 마세요. 예시의 인명·날짜·식당·약도는 모두 가상이며, 지도 링크는 실제 장소를 입력한 뒤 표시됩니다.

미리보기 서버는 암호화된 초대장만 제공합니다. 저장소 전체나 `.private` 원본을 일반 정적 서버로 제공하지 마세요. `file://` 대신 localhost 또는 HTTPS로 열어야 WebCrypto가 동작합니다.

## 실제 내용 넣기

`.gitignore`가 먼저 적용된 상태에서 아래처럼 로컬 전용 폴더를 준비합니다.

```sh
mkdir -p .private
chmod 700 .private
cp content.example.json .private/content.json
```

`.private/content.json`의 모든 예시를 실제 내용으로 교체합니다.

| 항목 | 입력 내용 |
| --- | --- |
| `couple`, `invitation` | 두 사람 이름 두 개, 초대 문구. 줄바꿈은 `\n` |
| `date`, `time` | 한국 시각 기준 `YYYY-MM-DD`, 24시간제 `HH:MM`. 요일 자동 표시 |
| `venue`, `address`, `room` | 장소명, 도로명 주소, 예약명·층·룸 |
| `families` | 양가별 제목, 가족사진 파일명 `photo`, 사진 설명 `photoAlt`, 참석자 관계·이름 |
| `driving` | 차량으로 식당 앞까지 오는 진입 방향. 대중교통 안내는 사용하지 않음 |
| `navigationQuery`, `parkingAddress` | 식당 앞까지 안내하는 정확한 검색어, 차량 도착 주소 |
| `parking` | 식당 앞 주차, 자리가 없으면 발렛 주차 이용 안내. 요금·운영 시간은 확인된 경우에만 입력 |
| `mapDescription` | 약도 내용을 글로도 설명 |
| `naverMapUrl`, `kakaoMapUrl` | 해당 장소의 공식 HTTPS 지도 공유 링크 |
| `navigation` | 목적지 `name`, WGS84 `latitude`(위도)·`longitude`(경도), `kakaoNaviUrl`(카카오내비 앱에서 복사한 목적지 공유 링크) |
| `photo`, `photoAlt`, `map` | `.private` 안의 사진 파일명, 사진 설명, 약도 파일명 |

사진을 `.private/couple.jpg`, 실제 약도를 `.private/map.svg` 등에 보관합니다. 사진은 JPG·PNG·WebP, 약도는 SVG도 지원합니다. 이미지당 최대 3MB이며, 사진은 가로 1200~1600px 정도로 줄이고 위치정보 등 메타데이터를 제거해 주세요. 사진 전체를 비율 그대로 표시하므로 얼굴이 자동 잘리지 않습니다. SVG 약도는 외부 이미지·폰트·스크립트 없이 독립된 파일이어야 합니다. 예시 약도를 실제 위치처럼 사용하지 마세요.

가족 소개에는 양가별 가족사진을 한 장씩 넣습니다. `.private/family-one.jpg`, `.private/family-two.jpg`로 보관하고 각 `families` 항목의 `photo`와 `photoAlt`에 연결합니다. 사진 아래에는 관계·이름을 표시하며, 가족별 영역을 세로로 배치합니다. 가족사진도 본문과 함께 암호화됩니다. 예시 모드에서는 실제 사진 대신 자리 표시자를 사용하며, 실제 배포 빌드에는 두 가족의 사진과 사진 설명이 필요합니다.

확정된 식당 정보는 로컬 전용 `.private/venue.json`에 따로 보관할 수 있습니다. 이 파일이 있으면 `content.example.json`(예시) 또는 `.private/content.json`(실제)을 읽은 뒤 해당 필드를 덮어 적용합니다. `venue`, `address`, `driving`, `navigationQuery`, `parkingAddress`, 지도 링크와 `navigation`을 입력합니다. 이름·일시·사진 등 아직 미정인 항목은 예시로 유지하면서 실제 목적지 연결을 확인할 수 있습니다. 실제 식당명·주소·좌표는 공개 예시나 스킬에 옮겨 적지 마세요.

내비게이션 버튼은 외부 앱을 여는 방식이며 API 키나 내장 지도 SDK를 사용하지 않습니다. 네이버지도는 `nmap://navigation`, T맵은 `tmap://route`에 목적지를 전달합니다. 카카오내비는 **카카오내비 앱 → 목적지 검색 → 공유 → 링크 복사**로 얻은 공식 HTTPS 주소를 `navigation.kakaoNaviUrl`에 넣습니다. 카카오맵 공유 링크와 구분하고, 실제 휴대폰에서 카카오내비로 열리는지 확인하세요. 링크가 없으면 예시에는 준비 중으로 표시하고 실제 배포 빌드는 차단합니다.

데스크톱에서 네이버지도·T맵 버튼을 누르면 휴대폰 이용 안내를 표시합니다. 모바일에서는 앱 연결을 시도하며, 앱이 없거나 인앱 브라우저가 막으면 주소 복사 또는 웹 지도를 이용할 수 있습니다. [네이버지도 규격](https://guide-gov.ncloud-docs.com/docs/naveropenapiv3-maps-url-scheme-url-scheme), [T맵 개발자 지원](https://openapi.sk.com/qnaCommunity/716), [카카오내비 공식 웹 연동 안내](https://developers.kakao.com/docs/ko/kakaonavi/js)를 참고하세요. SDK 기반 카카오내비 연결을 선택하는 경우에는 별도의 앱 키가 필요하지만 현재 구현에는 SDK를 넣지 않습니다.

사용자가 정한 초대장 전용 **숫자 6자리 비밀번호**를 `.private/password.txt`에 저장한 뒤 파일 권한을 제한합니다. 터미널 명령 인수나 저장소의 설정 파일에 비밀번호를 적지 마세요.

```sh
chmod 600 .private/password.txt
npm run build
npm test
node scripts/check-public.mjs --production
```

`STATICRYPT_PASSWORD` 환경변수를 사용하면 비밀번호 파일 대신 그 값을 읽습니다. 원본 HTML은 디스크에 생성하지 않고 메모리에서 암호화하며, 사진과 약도도 HTML 안에 내장해 함께 암호화합니다. 생성 결과는 `dist/index.html` 한 개와 `.nojekyll`입니다. 실제 빌드는 지도 링크, 필수 자료, 남은 예시·미정 문구를 검사합니다.

## GitHub Pages 배포

실제 내용과 사진을 확인한 뒤 배포합니다. 현재 저장소의 원격 주소는 `ICoi/Majung`입니다.

1. GitHub 저장소의 **Settings → Pages → Source → GitHub Actions**를 선택합니다.
2. 위의 실제 빌드·검사를 실행합니다.
3. `git status --short`로 `.private`, 사진 원본, 비밀번호가 추가되지 않는지 확인합니다. 처음 올리기 전과 이후에도 `git ls-files .private`의 출력이 없어야 합니다.
4. 코드와 암호화된 `dist`를 `main` 브랜치에 커밋·푸시합니다.
5. `Publish encrypted invitation` 작업이 통과한 뒤 반환된 Pages 주소에서 다시 확인합니다.

워크플로는 **dist 폴더만** 배포합니다. 예시 빌드는 공개 배포를 차단합니다. 암호화는 로컬에서 끝내므로 GitHub Actions에 비밀번호나 사진 원본을 등록할 필요가 없습니다. 내용 수정 때마다 로컬에서 다시 빌드하고 암호화 결과를 올립니다. 새 기기로 옮길 때는 `.private`를 별도로 안전하게 옮겨야 합니다.

페이지 링크와 비밀번호는 따로 전달합니다. 링크·비밀번호를 전달받은 사람은 누구나 열 수 있습니다. 암호화 파일은 누구나 내려받을 수 있으며, 본문은 비밀번호를 입력한 뒤 열립니다. 원본을 실수로 커밋했다면 파일 삭제만으로 과거 Git 기록에서 지워지지 않습니다.

## 구글·네이버 검색 제외

잠금 화면과 복호화된 초대장 모두 HTML `head`에 `robots` 메타 태그의 `noindex, nofollow, noarchive, nosnippet, noimageindex`를 포함합니다. 구글·네이버의 검색 제외는 `noindex`를 기준으로 하며, 부가 지시어의 지원 범위는 검색엔진마다 다릅니다. 빌드 시 두 화면을 검사하고, 공개 파일·GitHub 배포 검사에서도 `noindex` 누락을 차단합니다. 사이트맵 생성이나 검색엔진 등록은 하지 않습니다.

검색로봇이 `noindex`를 읽을 수 있도록 `robots.txt`로 페이지 접근을 차단하지 않습니다. 이후 사용자 도메인을 연결한다면 도메인 루트의 robots.txt도 확인합니다. [구글 안내](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [네이버 안내](https://searchadvisor.naver.com/guide/markup-structure)를 참고하세요.

이는 검색 제외 요청이며 모든 로봇의 준수나 이미 노출된 결과의 즉시 삭제까지 보장하는 접근 제한은 아닙니다. 비밀번호 암호화는 그대로 유지합니다. 공개 GitHub 저장소 자체는 검색될 수 있지만 실제 개인정보와 원본 이미지는 저장소에 포함하지 않습니다.

## 큰 글씨 확인

기본 본문은 `1.125rem`, 글줄 높이는 `1.85`입니다. 텍스트 상자에 고정 높이나 말줄임을 쓰지 않으며, 가족·주소·버튼은 공간이 부족하면 세로로 내려옵니다. 핀치 확대를 제한하지 않습니다. 약도는 이미지라 글씨 설정에 맞춰 커지지 않으므로 같은 내용을 바로 아래 텍스트로 제공합니다.

```sh
npm run demo:large-text
```

미리보기 서버를 실행하고 `/large-text/`에서 확인합니다. 이 화면은 잠금·본문 모두 기본 글씨를 200%로 설정한 로컬 검사 전용이며, 비밀번호는 `.private/large-text-password.txt`에 있습니다. 공개 `dist`는 바뀌지 않습니다.

- 320px·390px·768px 너비에서 가로 스크롤, 겹침, 잘린 글씨 확인
- 200% 글씨 화면에서 긴 주소, 가족 이름, 비밀번호 오류 안내, 복사 버튼 확인
- 실제 휴대폰 Safari·Chrome에서 큰 글씨 설정과 확대 확인
- 올바른/틀린 비밀번호, 새로고침 후 다시 잠김, 비밀번호 보기 확인
- 주소 복사 성공 및 사용 불가 시 직접 복사 안내 확인
- 실제 지도 링크의 목적지·차량 입구와 주차 정책 재확인
- 실제 iPhone·Android에서 세 앱의 목적지 전달, 앱 미설치 시 안내 확인. 데스크톱의 화면 크기 변경만으로 앱 실행을 검증한 것으로 간주하지 않음

암호화는 [StatiCrypt 3.5.4](https://github.com/robinmoisson/staticrypt)를 고정 버전으로 사용합니다. `npm test`는 암호화 복원, 잘못된 비밀번호, 날짜·URL·자료 검사, HTML 이스케이프와 이미지 내장을 검증합니다.
