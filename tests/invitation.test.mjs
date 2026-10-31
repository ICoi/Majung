import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm, mkdir, cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { escapeHtml, validateContent, renderInvitation, inlineAsset } from '../scripts/render.mjs';
import { assertSearchExcluded, checkPublic } from '../scripts/check-public.mjs';

const require = createRequire(import.meta.url);
const engine = require('staticrypt/lib/cryptoEngine.js');
const codec = require('staticrypt/lib/codec.js').init(engine);
const root = fileURLToPath(new URL('../',import.meta.url));
const sample = JSON.parse(await readFile(path.join(root,'content.example.json'),'utf8'));

test('실제 배포에 예시·미확정 내용과 잘못된 지도 주소를 허용하지 않음',()=>{
  assert.doesNotThrow(()=>validateContent(sample,true));
  assert.throws(()=>validateContent(sample,false));
  assert.throws(()=>validateContent({...sample,naverMapUrl:'javascript:alert(1)'},true));
  assert.throws(()=>validateContent({...sample,kakaoMapUrl:'https://map.kakao.com.evil.test/'},true));
  assert.throws(()=>validateContent({...sample,date:'2027-02-30'},true));
  assert.throws(()=>validateContent({...sample,time:'25:00'},true));
});

test('내용을 HTML로 실행하지 않고 텍스트로 표시하며, 서울 기준 날짜·시간을 생성',async()=>{
  const html = await renderInvitation(root,{...sample,couple:['<script>alert(1)</script>', '아주아주긴이름의참석자']},true);
  assert.ok(html.includes(escapeHtml('<script>alert(1)</script>')));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html,/2027년 3월 20일 토요일/);
  assert.match(html,/오후 12:00/);
  assert.match(html,/data:image\/svg\+xml;base64,/);
  assert.ok(!html.includes('{{'));
  assert.ok(!/<(?:img|script)[^>]+src="https?:/.test(html));
});

test('이미지는 로컬에 있는 파일만 내장하고, SVG 외부 참조를 차단',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'majung-test-'));
  try {
    await writeFile(path.join(directory,'map.svg'),'<svg><image href="https://example.com/photo.jpg"/></svg>');
    await assert.rejects(()=>inlineAsset(directory,'map.svg','map'));
    await assert.rejects(()=>inlineAsset(directory,'../not-an-asset.jpg','photo'));
    await writeFile(path.join(directory,'safe.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
    assert.match(await inlineAsset(directory,'safe.svg','map'),/^data:image\/svg\+xml;base64,/);
  } finally { await rm(directory,{recursive:true}); }
});

test('공개된 파일은 암호화되어 있고, 예시 결과물은 실제 배포를 차단',async()=>{
  const html = await checkPublic(path.join(root,'dist'));
  if (html.startsWith('<!-- invitation-mode:demo -->')) await assert.rejects(()=>checkPublic(path.join(root,'dist'),true));
  assert.ok(!html.includes(sample.address));
  assert.ok(!html.includes('김다정'));
  assert.ok(!html.includes('data:image'));
});

test('본문과 사진을 함께 암호화하고, 올바른 비밀번호로만 복원',async()=>{
  const password = 'test-only-random-passphrase-42';
  const salt=engine.generateRandomSalt();
  const source=await renderInvitation(root,sample,true);
  const encrypted=await codec.encode(source,password,salt);
  assert.ok(!encrypted.includes(sample.address));
  const good=await codec.decode(encrypted,await engine.hashPassword(password,salt),salt);
  assert.equal(good.success,true);
  assert.equal(good.decoded,source);
  const bad=await codec.decode(encrypted,await engine.hashPassword('wrong-password',salt),salt);
  assert.equal(bad.success,false);
});

test('실제 제작 경로에서 사진과 약도를 내장하고 지도 링크를 생성',async()=>{
  const fixture = await mkdtemp(path.join(os.tmpdir(),'majung-render-'));
  try {
    await cp(path.join(root,'src'),path.join(fixture,'src'),{recursive:true});
    await mkdir(path.join(fixture,'.private'));
    await writeFile(path.join(fixture,'.private/couple.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1kAAAAASUVORK5CYII=','base64'));
    await writeFile(path.join(fixture,'.private/map.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>');
    const data = JSON.parse(JSON.stringify(sample).replace(/예시/g,'검증용').replace(/확인 후/g,'확인하여'));
    Object.assign(data,{photo:'couple.png',naverMapUrl:'https://naver.me/test',kakaoMapUrl:'https://map.kakao.com/'});
    const html=await renderInvitation(fixture,data,false);
    assert.match(html,/data:image\/png;base64,/);
    assert.match(html,/data:image\/svg\+xml;base64,/);
    assert.match(html,/href="https:\/\/naver.me\/test"/);
    assert.match(html,/카카오맵 열기/);
    assert.ok(!html.includes('sample-banner">'));
  } finally { await rm(fixture,{recursive:true}); }
});

test('실제 생성한 암호화 파일을 복원하고 공개 HTML과 비밀번호를 분리',async()=>{
  const html=await checkPublic(path.join(root,'dist'));
  const demo=html.startsWith('<!-- invitation-mode:demo -->');
  const password=(process.env.STATICRYPT_PASSWORD && !demo) ? process.env.STATICRYPT_PASSWORD : (await readFile(path.join(root,demo ? '.private/preview-password.txt' : '.private/password.txt'),'utf8')).trim();
  assert.ok(!html.includes(password));
  const encrypted=html.match(/"staticryptEncryptedMsgUniqueVariableName":"([0-9a-f]+)"/)[1];
  const salt=html.match(/"staticryptSaltUniqueVariableName":"([0-9a-f]+)"/)[1];
  const result=await codec.decode(encrypted,await engine.hashPassword(password,salt),salt);
  assert.equal(result.success,true);
  assert.match(result.decoded,/<main id="invitation"/);
  assert.match(result.decoded,/data:image/);
  assert.doesNotThrow(()=>assertSearchExcluded(result.decoded));
});

test('검색 제외는 최초 HTML head에 필요하며, 누락되면 공개 파일 검사가 실패',async()=>{
  const html=await checkPublic(path.join(root,'dist'));
  const withoutRobots=html.replace(/<meta name="robots"[^>]*>/i,'');
  assert.throws(()=>assertSearchExcluded(withoutRobots));
  assert.throws(()=>assertSearchExcluded(withoutRobots.replace('</body>','<meta name="robots" content="noindex"></body>')));
  assert.throws(()=>assertSearchExcluded(html.replace(/content="noindex,[^"]*"/i,'content="index, follow"')));
  assert.throws(()=>assertSearchExcluded(withoutRobots.replace('</head>','<!-- <meta name="robots" content="noindex"> --></head>')));
  const directory=await mkdtemp(path.join(os.tmpdir(),'majung-search-'));
  try {
    await writeFile(path.join(directory,'.nojekyll'),'');
    await writeFile(path.join(directory,'index.html'),withoutRobots);
    await assert.rejects(()=>checkPublic(directory),/noindex/);
  } finally { await rm(directory,{recursive:true}); }
});
