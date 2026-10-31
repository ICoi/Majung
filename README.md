# 마중 · 상견례 초대장

사진으로 시작해 일시, 장소, 양가 가족과 길 안내를 읽는 모바일 초대장입니다. 비밀번호를 입력하면 브라우저 안에서 본문과 이미지를 복호화합니다. 별도 서버·가입·외부 폰트·분석 도구는 없습니다.

## 예시 확인

Node.js 22 이상에서 실행합니다.

```sh
npm ci
npm run demo
npm run preview
```

`http://127.0.0.1:4173/Majung/`을 엽니다. 임의 생성한 예시 비밀번호는 **로컬의 `.private/preview-password.txt`**에서 확인합니다. 비밀번호를 커밋하거나 URL에 넣지 마세요. 예시의 인명·날짜·식당·약도는 모두 가상이며, 지도 링크는 실제 장소를 입력한 뒤 표시됩니다. 예시를 다시 생성하면 비밀번호도 바뀝니다.

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
| `families` | 양가별 제목, 참석자 관계·이름 |
| `transit`, `driving` | 역·출구·도보 안내, 차량 진입 방향 |
| `navigationQuery`, `parkingAddress` | 주차장으로 안내하는 정확한 검색어, 차량 진입구 주소 |
| `parking` | 위치·입구·무료 시간·인증 방법을 확인해 입력 |
| `mapDescription` | 약도 내용을 글로도 설명 |
| `naverMapUrl`, `kakaoMapUrl` | 해당 장소의 공식 HTTPS 지도 공유 링크 |
| `photo`, `photoAlt`, `map` | `.private` 안의 사진 파일명, 사진 설명, 약도 파일명 |

사진을 `.private/couple.jpg`, 실제 약도를 `.private/map.svg` 등에 보관합니다. 사진은 JPG·PNG·WebP, 약도는 SVG도 지원합니다. 이미지당 최대 3MB이며, 사진은 가로 1200~1600px 정도로 줄이고 위치정보 등 메타데이터를 제거해 주세요. 사진 전체를 비율 그대로 표시하므로 얼굴이 자동 잘리지 않습니다. SVG 약도는 외부 이미지·폰트·스크립트 없이 독립된 파일이어야 합니다. 예시 약도를 실제 위치처럼 사용하지 마세요.

초대장 전용 **16자 이상의 길고 추측하기 어려운 비밀번호**를 `.private/password.txt`에 저장한 뒤 파일 권한을 제한합니다. 터미널 명령 인수나 저장소의 설정 파일에 비밀번호를 적지 마세요.

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

페이지 링크와 비밀번호는 따로 전달합니다. 링크·비밀번호를 전달받은 사람은 누구나 열 수 있습니다. 암호화 파일은 누구나 내려받을 수 있으므로 짧은 비밀번호는 사용하지 마세요. 원본을 실수로 커밋했다면 파일 삭제만으로 과거 Git 기록에서 지워지지 않습니다.

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

암호화는 [StatiCrypt 3.5.4](https://github.com/robinmoisson/staticrypt)를 고정 버전으로 사용합니다. `npm test`는 암호화 복원, 잘못된 비밀번호, 날짜·URL·자료 검사, HTML 이스케이프와 이미지 내장을 검증합니다.
