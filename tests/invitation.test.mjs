import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm, mkdir, cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { escapeHtml, validateContent, renderInvitation, inlineAsset } from '../scripts/render.mjs';
import { assertSearchExcluded, checkPublic } from '../scripts/check-public.mjs';
import { validatePassword, assertPasswordNotExposed } from '../scripts/password.mjs';
import { navigationLinks, validateNavigation } from '../scripts/navigation.mjs';

const require = createRequire(import.meta.url);
const engine = require('staticrypt/lib/cryptoEngine.js');
const codec = require('staticrypt/lib/codec.js').init(engine);
const root = fileURLToPath(new URL('../',import.meta.url));
const sample = JSON.parse(await readFile(path.join(root,'content.example.json'),'utf8'));

test('암호문에 우연히 포함된 숫자는 허용하고 평문 비밀번호 노출은 차단',()=>{
  const encrypted='{"staticryptEncryptedMsgUniqueVariableName":"ab123456cd"}';
  assert.doesNotThrow(()=>assertPasswordNotExposed(encrypted,'123456'));
  assert.throws(()=>assertPasswordNotExposed(encrypted+'<p>123456</p>','123456'));
});

test('실제 비밀번호는 앞자리 0을 보존하는 숫자 6자리이며 예시는 비어 있지 않아야 함',()=>{
  assert.doesNotThrow(()=>validatePassword('012345'));
  assert.doesNotThrow(()=>validatePassword('123456'));
  for (const invalid of ['', '12345', '1234567', 'abcdef', '12345a', '123456 ', '１２３４５６']) {
    assert.throws(()=>validatePassword(invalid));
  }
  assert.doesNotThrow(()=>validatePassword('local-demo',true));
  assert.throws(()=>validatePassword('   ',true));
});

test('실제 배포에 예시·미확정 내용과 잘못된 지도 주소를 허용하지 않음',()=>{
  assert.doesNotThrow(()=>validateContent(sample,true));
  assert.throws(()=>validateContent(sample,false));
  assert.throws(()=>validateContent({...sample,naverMapUrl:'javascript:alert(1)'},true));
  assert.throws(()=>validateContent({...sample,kakaoMapUrl:'https://map.kakao.com.evil.test/'},true));
  assert.throws(()=>validateContent({...sample,date:'2027-02-30'},true));
  assert.throws(()=>validateContent({...sample,time:'25:00'},true));
  assert.throws(()=>validateContent({...sample,displayNames:['하나']},true));
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
  assert.ok(!html.includes('대중교통'));
  assert.ok(html.includes(escapeHtml(sample.parking.split('\n')[1])));
});

test('선택형 가족 소개와 키워드는 HTML을 실행하지 않고 표시',async()=>{
  const data=structuredClone(sample);
  Object.assign(data.families[0].members[0],{tagline:'<b>소개</b>',description:'<script>소개</script>',tags:['<img onerror=alert(1)>']});
  const html=await renderInvitation(root,data,true);
  for (const value of ['<b>소개</b>','<script>소개</script>','<img onerror=alert(1)>']) {
    assert.ok(html.includes(escapeHtml(value)));
    assert.ok(!html.includes(value));
  }
  data.families[0].members[0].tags='잘못된 형식';
  assert.throws(()=>validateContent(data,true));
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
    data.navigation={name:'검증용 식당 & 가족',latitude:37.5,longitude:126.9};
    data.families.forEach((family)=>{ family.photo='couple.png'; });
    const html=await renderInvitation(fixture,data,false);
    assert.match(html,/data:image\/png;base64,/);
    assert.match(html,/data:image\/svg\+xml;base64,/);
    assert.match(html,/href="https:\/\/naver.me\/test"/);
    assert.match(html,/data-navigation="kakao"/);
    assert.ok(!html.includes('<p class="sample-banner">'));
    assert.equal((html.match(/class="family-photo"/g)||[]).length,2);
    assert.equal((html.match(/data:image\/png;base64,/g)||[]).length,3);
    const preview=await renderInvitation(fixture,data,true);
    assert.equal((preview.match(/data:image\/png;base64,/g)||[]).length,3);
    assert.ok(preview.includes('식당 주변 약도'));
    assert.ok(!preview.includes('예시 약도 · 실제 위치가 아닙니다.'));
    const partial=structuredClone(data);
    partial.families[0].photo='missing-family.jpg';
    const partialPreview=await renderInvitation(fixture,partial,true);
    assert.equal((partialPreview.match(/data:image\/png;base64,/g)||[]).length,2);
    assert.equal((partialPreview.match(/class="family-photo-placeholder"/g)||[]).length,1);
    const missingPhoto=structuredClone(data);
    delete missingPhoto.families[0].photo;
    assert.throws(()=>validateContent(missingPhoto,false),/가족사진/);
    await assert.rejects(()=>renderInvitation(fixture,{...data,families:data.families.map((family)=>({...family,photo:'https://example.com/family.jpg'}))},false));
  } finally { await rm(fixture,{recursive:true}); }
});

test('내비게이션은 세 앱에 동일한 목적지와 정확한 위도·경도를 전달',()=>{
  const destination={name:'검증 식당 & 모임',latitude:37.5,longitude:126.9};
  validateNavigation(destination,true);
  const links=navigationLinks(destination);
  assert.equal(links.length,3);
  const tmap=new URL(links.find(link=>link.id==='tmap').url);
  assert.equal(tmap.protocol,'tmap:');
  assert.equal(tmap.searchParams.get('rGoName'),destination.name);
  assert.equal(tmap.searchParams.get('rGoX'),'126.9');
  assert.equal(tmap.searchParams.get('rGoY'),'37.5');
  const naver=new URL(links.find(link=>link.id==='naver').url);
  assert.equal(naver.protocol,'nmap:');
  assert.equal(naver.hostname,'navigation');
  assert.equal(naver.searchParams.get('dlat'),'37.5');
  assert.equal(naver.searchParams.get('dlng'),'126.9');
  assert.equal(naver.searchParams.get('dname'),destination.name);
  const kakao=new URL(links.find(link=>link.id==='kakao').url);
  assert.equal(kakao.protocol,'kakaomap:');
  assert.equal(kakao.hostname,'route');
  assert.equal(kakao.searchParams.get('ep'),'37.5,126.9');
  assert.equal(kakao.searchParams.get('by'),'car');
  assert.equal(links.find(link=>link.id==='kakao').label,'카카오맵');
  assert.throws(()=>validateNavigation({...destination,latitude:126.9,longitude:37.5}));
  assert.throws(()=>validateNavigation({...destination,latitude:NaN}));
  assert.throws(()=>validateNavigation(null,true));
  assert.doesNotThrow(()=>validateNavigation(destination,true));
});

test('모바일은 앱 링크를 실행하고 데스크톱은 앱 실행 대신 이용 안내를 표시',async()=>{
  const script=await readFile(path.join(root,'src/invitation.js'),'utf8');
  for (const [userAgent,platform,maxTouchPoints,mobile] of [
    ['Desktop','MacIntel',0,false], ['Android','Linux',5,true], ['iPhone','iPhone',5,true], ['Macintosh','MacIntel',5,true]
  ]) {
    const links=navigationLinks({name:'검증 식당',latitude:37.5,longitude:126.9}).map(link=>({
      href:link.url,dataset:{navigation:link.id,appLabel:link.label},addEventListener(_,handler){this.click=handler;}
    }));
    const status={textContent:''},fallback={hidden:true};
    const document={
      querySelectorAll(selector){return selector==='[data-navigation]' ? links : [];},
      querySelector(selector){return selector==='.navigation-status' ? status : selector==='.navigation-install' ? fallback : selector==='main' ? {focus(){}} : null;}
    };
    vm.runInNewContext(script,{document,navigator:{userAgent,platform,maxTouchPoints},window:{location:{origin:'https://example.test'}},URL});
    for(const link of links){
      let prevented=false;
      link.click({preventDefault(){prevented=true;}});
      assert.equal(prevented,!mobile);
      assert.equal(fallback.hidden,false);
      assert.ok(status.textContent.includes(link.dataset.appLabel));
    }
    assert.equal(new URL(links.find(link=>link.dataset.navigation==='naver').href).searchParams.get('appname'),'https://example.test');
  }
});

test('스크롤 안내는 첫 실제 스크롤에 사라지고 맨 위로 돌아와도 다시 표시되지 않음',async()=>{
  const script=await readFile(path.join(root,'src/invitation.js'),'utf8');
  for(const [initialScroll,innerHeight,shouldShow] of [[0,800,true],[100,800,true],[0,4000,false]]) {
    const hint={hidden:true},listeners=new Map();
    const window={scrollY:initialScroll,innerHeight,addEventListener(name,handler){listeners.set(name,handler);},removeEventListener(name){listeners.delete(name);}};
    const document={documentElement:{scrollHeight:3000},querySelectorAll(){return [];},querySelector(selector){return selector==='[data-scroll-hint]' ? hint : selector==='main' ? {focus(){}} : null;}};
    vm.runInNewContext(script,{document,window});
    assert.equal(hint.hidden,!shouldShow);
    if(shouldShow){
      listeners.get('scroll')();
      assert.equal(hint.hidden,false);
      window.scrollY=10;listeners.get('scroll')();
      assert.equal(hint.hidden,false);
      listeners.get('wheel')();
      window.scrollY=20;listeners.get('scroll')();
      assert.equal(hint.hidden,true);
      assert.equal(listeners.has('scroll'),false);
      window.scrollY=0;
      assert.equal(hint.hidden,true);
    }
  }
});

test('약도 이미지와 크게 보기 버튼이 동일한 확대 화면을 열고 이미지를 재사용',async()=>{
  const script=await readFile(path.join(root,'src/invitation.js'),'utf8');
  const triggers=[{},{}];
  triggers.forEach(button=>button.addEventListener=(_,handler)=>{button.click=handler;});
  const sourceImage={src:'data:image/png;base64,example'},zoomImage={src:''};
  const mapScroll={scrollWidth:800,clientWidth:300,scrollLeft:0};
  let opened=0;
  const dialog={showModal(){opened++;}};
  const document={
    querySelectorAll(selector){return selector==='[data-map-expand]' ? triggers : [];},
    querySelector(selector){return selector==='.map img' ? sourceImage : selector==='.map-dialog-scroll' ? mapScroll : selector==='main' ? {focus(){}} : null;},
    getElementById(id){return id==='map-dialog' ? dialog : zoomImage;}
  };
  vm.runInNewContext(script,{document,window:{}});
  triggers[0].click();triggers[1].click();
  assert.equal(opened,2);
  assert.equal(zoomImage.src,sourceImage.src);
  assert.equal(mapScroll.scrollLeft,250);
});

test('실제 생성한 암호화 파일을 복원하고 공개 HTML과 비밀번호를 분리',async()=>{
  const html=await checkPublic(path.join(root,'dist'));
  const demo=html.startsWith('<!-- invitation-mode:demo -->');
  const password=(process.env.STATICRYPT_PASSWORD && !demo) ? process.env.STATICRYPT_PASSWORD : (await readFile(path.join(root,demo ? '.private/preview-password.txt' : '.private/password.txt'),'utf8')).trim();
  assert.doesNotThrow(()=>assertPasswordNotExposed(html,password));
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
