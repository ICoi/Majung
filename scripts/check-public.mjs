import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function assertSearchExcluded(html) {
  // Crawlers must see this in the initial HTML head, before unlocking or running JS.
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]?.replace(/<!--[\s\S]*?-->/g, '') || '';
  const tags = head.match(/<meta\b[^>]*>/gi) || [];
  const excluded = tags.some((tag) => {
    if (!/\bname\s*=\s*["']robots["']/i.test(tag)) return false;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    return content.toLowerCase().split(/[\s,]+/).includes('noindex');
  });
  if (!excluded) throw new Error('HTML head에 검색 제외용 robots noindex 설정이 필요합니다.');
}

export async function checkPublic(directory, production = false) {
  const entries = await readdir(directory);
  if (entries.sort().join(',') !== '.nojekyll,index.html') throw new Error('dist에는 암호화된 index.html과 .nojekyll만 있어야 합니다.');
  const html = await readFile(path.join(directory,'index.html'),'utf8');
  assertSearchExcluded(html);
  if (!/"staticryptEncryptedMsgUniqueVariableName":"[0-9a-f]+"/.test(html) || !/"isRememberEnabled":false/.test(html)) throw new Error('암호화 결과물을 확인해 주세요.');
  if (production && !html.startsWith('<!-- invitation-mode:production -->')) throw new Error('예시 초대장은 배포하지 않습니다. 실제 자료로 npm run build를 실행해 주세요.');
  if (/data:image|<img\b|\{\{\w+\}\}|\/\*\[\|/.test(html)) throw new Error('공개 결과물에 원본 이미지나 미완성 템플릿이 있습니다.');
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await checkPublic(fileURLToPath(new URL('../dist/',import.meta.url)),process.argv.includes('--production')); console.log('공개 파일 검사 통과'); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
