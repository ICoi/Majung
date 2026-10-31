import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));

export function render(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`템플릿 항목이 없습니다: ${key}`);
    return values[key];
  });
}

export function validateContent(data, demo = false) {
  const fields = ['invitation', 'date', 'time', 'venue', 'address', 'room', 'transit', 'driving', 'navigationQuery', 'parkingAddress', 'parking', 'mapDescription', 'photoAlt'];
  for (const key of fields) {
    if (typeof data[key] !== 'string' || !data[key].trim()) throw new Error(`필수 항목을 채워 주세요: ${key}`);
  }
  if (!Array.isArray(data.couple) || data.couple.length !== 2 || data.couple.some((name) => typeof name !== 'string' || !name.trim())) throw new Error('두 사람의 이름을 입력해 주세요.');
  if (!Array.isArray(data.families) || data.families.length !== 2) throw new Error('양가 가족 정보를 입력해 주세요.');
  for (const family of data.families) {
    if (!family.title || !Array.isArray(family.members) || !family.members.length || family.members.some((m) => !m.relation || !m.name)) throw new Error('가족의 관계와 이름을 채워 주세요.');
  }
  const date = new Date(`${data.date}T00:00:00+09:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(date.valueOf()) || new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(date) !== data.date) throw new Error('날짜는 유효한 YYYY-MM-DD 형식이어야 합니다.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) throw new Error('시간은 HH:MM 형식이어야 합니다.');
  for (const key of ['naverMapUrl', 'kakaoMapUrl']) {
    if (demo && !data[key]) continue;
    let url;
    try { url = new URL(data[key]); } catch { throw new Error(`지도 링크를 확인해 주세요: ${key}`); }
    const allowed = key === 'naverMapUrl' ? ['map.naver.com', 'naver.me'] : ['map.kakao.com', 'kko.to', 'place.map.kakao.com'];
    if (url.protocol !== 'https:' || !allowed.includes(url.hostname) || url.username || url.password) throw new Error(`공식 HTTPS 지도 링크가 필요합니다: ${key}`);
  }
  if (!demo && /예시|미정|확인 후|입력해|추후/.test(JSON.stringify(data))) throw new Error('실제 배포 전에 예시·미확정 정보를 교체해 주세요.');
}

export async function inlineAsset(privateDir, filename, kind) {
  if (typeof filename !== 'string' || !filename || path.isAbsolute(filename)) throw new Error('로컬 이미지 파일명을 입력해 주세요.');
  const root = await realpath(privateDir);
  const resolved = await realpath(path.resolve(privateDir, filename));
  if (!resolved.startsWith(root + path.sep)) throw new Error('이미지는 .private 폴더 안에 보관해 주세요.');
  const types = {'.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml'};
  const extension = path.extname(resolved).toLowerCase();
  if (!types[extension] || (kind === 'photo' && extension === '.svg')) throw new Error('사진은 JPG·PNG·WebP, 약도는 SVG·JPG·PNG·WebP를 사용해 주세요.');
  const bytes = await readFile(resolved);
  if (bytes.length > 3 * 1024 * 1024) throw new Error('이미지 한 장의 용량을 3MB 이하로 줄여 주세요.');
  const svgContent = bytes.toString().replace(/xmlns(?:\:\w+)?\s*=\s*["'][^"']+["']/g, '');
  if (extension === '.svg' && /(?:https?:|\/\/|<script|<foreignObject|@import|url\(|href\s*=)/i.test(svgContent)) throw new Error('약도 SVG에는 외부 참조나 스크립트를 넣을 수 없습니다.');
  return `data:${types[extension]};base64,${bytes.toString('base64')}`;
}

const placeholder = `<div class="photo-placeholder" role="img" aria-label="두 사람의 사진 자리 표시자"><svg viewBox="0 0 200 200" fill="none" aria-hidden="true"><path d="M30 170V85a45 45 0 0 1 90 0v85M80 170V70a45 45 0 0 1 90 0v100" stroke="currentColor" stroke-width="1.5"/><circle cx="75" cy="95" r="16" stroke="currentColor"/><path d="M47 147c0-36 56-36 56 0" stroke="currentColor"/><circle cx="125" cy="80" r="16" stroke="currentColor"/><path d="M97 132c0-36 56-36 56 0" stroke="currentColor"/></svg><p>두 사람의 사진이 들어갈 자리</p></div>`;

export async function renderInvitation(root, data, demo) {
  validateContent(data, demo);
  const src = path.join(root, 'src');
  const [template, styles, script] = await Promise.all(['invitation.html','styles.css','invitation.js'].map((name) => readFile(path.join(src,name),'utf8')));
  const date = new Date(`${data.date}T${data.time}:00+09:00`);
  const dateLabel = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(date);
  const timeLabel = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',hour:'numeric',minute:'2-digit',hour12:true}).format(date);
  const photo = demo ? placeholder : `<img src="${await inlineAsset(path.join(root,'.private'), data.photo, 'photo')}" alt="${escapeHtml(data.photoAlt)}" decoding="async">`;
  const mapData = demo ? `data:image/svg+xml;base64,${Buffer.from(await readFile(path.join(src,'sample-map.svg'))).toString('base64')}` : await inlineAsset(path.join(root,'.private'), data.map, 'map');
  const families = data.families.map((family) => `<div class="family"><h3>${escapeHtml(family.title)}</h3><dl>${family.members.map((member) => `<div><dt>${escapeHtml(member.relation)}</dt><dd>${escapeHtml(member.name)}</dd></div>`).join('')}</dl></div>`).join('');
  const mapLinks = [['naverMapUrl','네이버지도 열기'],['kakaoMapUrl','카카오맵 열기']].filter(([key]) => data[key]).map(([key,label]) => `<a class="button" href="${escapeHtml(data[key])}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only"> (새 창)</span></a>`).join('');
  return render(template, {
    ...Object.fromEntries(Object.entries(data).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,escapeHtml(v)])),
    styles, script, photo, families, mapLinks,
    nameOne: escapeHtml(data.couple[0]), nameTwo: escapeHtml(data.couple[1]),
    datetime: `${data.date}T${data.time}:00+09:00`, dateLabel:escapeHtml(dateLabel), timeLabel:escapeHtml(timeLabel),
    map: `<img src="${mapData}" alt="${demo ? '예시 약도' : '장소와 주차장 입구 약도'}" loading="lazy" decoding="async">`,
    mapCaption: demo ? '예시 약도 · 실제 위치가 아닙니다.' : '장소와 주차장 입구 · 자세한 설명은 아래를 참고해 주세요.',
    sampleBanner: demo ? '<p class="sample-banner">디자인 확인용 예시입니다.<br>날짜·이름·장소는 실제 정보가 아닙니다.</p>' : ''
  });
}
