import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderInvitation } from './render.mjs';
import { assertSearchExcluded } from './check-public.mjs';
import { validatePassword } from './password.mjs';

const require = createRequire(import.meta.url);
const cryptoEngine = require('staticrypt/lib/cryptoEngine.js');
const codec = require('staticrypt/lib/codec.js').init(cryptoEngine);
const { buildStaticryptJS } = require('staticrypt/cli/helpers.js');
const { renderTemplate } = require('staticrypt/lib/formater.js');
const root = fileURLToPath(new URL('../',import.meta.url));
const demo = process.argv.includes('--demo');
const largeText = process.argv.includes('--large-text');

try {
  if (largeText && !demo) throw new Error('큰 글씨 검사 화면은 예시 모드에서만 생성합니다.');
  await mkdir(path.join(root,'.private'), {recursive:true,mode:0o700});
  let content;
  try { content=await readFile(path.join(root,'.private/content.json'),'utf8'); }
  catch (error) {
    if (!demo || error.code !== 'ENOENT') throw error;
    content=await readFile(path.join(root,'content.example.json'),'utf8');
  }
  const data = JSON.parse(content);
  // Keep the real venue out of tracked examples, and apply it to both build modes.
  try { Object.assign(data, JSON.parse(await readFile(path.join(root,'.private/venue.json'),'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let password;
  if (demo) {
    const passwordFile = path.join(root,largeText ? '.private/large-text-password.txt' : '.private/preview-password.txt');
    try { password = (await readFile(passwordFile,'utf8')).trim(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      password = randomBytes(18).toString('base64url');
      await writeFile(passwordFile, password+'\n', {mode:0o600});
    }
  } else {
    password = process.env.STATICRYPT_PASSWORD || (await readFile(path.join(root,'.private/password.txt'),'utf8')).trim();
  }
  validatePassword(password, demo);
  let plaintext = await renderInvitation(root,data,demo);
  if (largeText) plaintext = plaintext.replace('</style>', 'html { font-size: 200%; }</style>');
  assertSearchExcluded(plaintext);
  const salt = cryptoEngine.generateRandomSalt();
  const encrypted = await codec.encode(plaintext,password,salt);
  let template = (await readFile(path.join(root,'src/lock.html'),'utf8')).replace('{{sampleNote}}', demo ? '<p class="sample">디자인 확인용 예시 초대장입니다.</p>' : '');
  if (largeText) template = template.replace('</style>', 'html { font-size: 200%; }</style>');
  const html = `<!-- invitation-mode:${demo ? 'demo' : 'production'} -->\n` + renderTemplate(template, {
    js_staticrypt:buildStaticryptJS(),
    staticrypt_config:{staticryptEncryptedMsgUniqueVariableName:encrypted,staticryptSaltUniqueVariableName:salt,isRememberEnabled:false,rememberDurationInDays:0}
  });
  if (html.includes(password)) throw new Error('비밀번호 노출 검사에 실패했습니다.');
  assertSearchExcluded(html);
  if (largeText) {
    await writeFile(path.join(root,'.private/large-text.html'),html,{mode:0o600});
    console.log('200% 글씨 검사 화면 생성 완료: /large-text/ · 비밀번호: .private/large-text-password.txt');
    process.exit(0);
  }
  await mkdir(path.join(root,'dist'),{recursive:true});
  await writeFile(path.join(root,'.private/encrypted.tmp'),html);
  await rename(path.join(root,'.private/encrypted.tmp'),path.join(root,'dist/index.html'));
  await writeFile(path.join(root,'dist/.nojekyll'),'');
  console.log(demo ? '예시 초대장 생성 완료. 비밀번호: .private/preview-password.txt (공유·커밋 금지)' : '실제 초대장 암호화 완료. 배포 전 npm test로 확인해 주세요.');
} catch (error) {
  // Do not dump content, paths to personal assets, or environment variables.
  console.error(error instanceof SyntaxError ? '내용 JSON 형식을 확인해 주세요. 원본 내용은 출력하지 않습니다.' : error.code === 'ENOENT' ? '필요한 로컬 자료가 없습니다. README의 .private 설정을 확인해 주세요.' : `생성 실패: ${error.message}`);
  process.exitCode = 1;
}
