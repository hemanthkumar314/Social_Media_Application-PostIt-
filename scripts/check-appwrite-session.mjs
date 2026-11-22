import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Account, Client} from 'appwrite';

if (!process.argv.includes('--run')) {
  console.log('Use node scripts/check-appwrite-session.mjs --run for the opt-in stale-cookie regression check.');
  process.exit(0);
}
const root=fileURLToPath(new URL('../',import.meta.url));
const testOrigin=new URL(process.env.POSTIT_TEST_ORIGIN??'http://localhost:5173').origin;
const schema=JSON.parse(await readFile(new URL('../appwrite/schema.json',import.meta.url),'utf8'));
const env=Object.fromEntries((await readFile(new URL('../.env.local',import.meta.url),'utf8')).split(/\r?\n/)
  .filter(line=>/^VITE_APPWRITE_[A-Z_]+=/.test(line)).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1).trim()];}));
assert.equal(env.VITE_APPWRITE_PROJECT_ID,schema.projectId);
assert.equal(env.VITE_APPWRITE_URL,schema.endpoint);
const nativeFetch=globalThis.fetch;
const local=new Map();
let cookies=new Map();
globalThis.window={localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value)},console:{warn(){}},location:{origin:testOrigin}};
globalThis.fetch=async(url,options={})=>{
  const headers=new Headers(options.headers);headers.set('Origin',testOrigin);
  if(options.credentials!=='omit' && cookies.size)headers.set('Cookie',[...cookies].map(([key,value])=>`${key}=${value}`).join('; '));
  const response=await nativeFetch(url,{...options,headers,signal:options.signal??AbortSignal.timeout(25000)});
  if(options.credentials!=='omit')for(const match of(response.headers.get('set-cookie')??'').matchAll(/(?:^|,\s*)(a_session_[^=;,\s]+)=([^;,]*)/g))cookies.set(match[1],match[2]);
  return response;
};
const bundled=await build({stdin:{contents:"export * from './src/lib/appwrite/api'; export {account,databases,client} from './src/lib/appwrite/config';",resolveDir:root,loader:'ts'},
  absWorkingDir:root,tsconfig:root+'tsconfig.app.json',bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':JSON.stringify(env)}});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const username='session_check_'+Date.now().toString(36);
const email=username+'@example.com';
const password=randomBytes(24).toString('base64url');
let accountId;
let failed;
const report={projectId:schema.projectId,origin:testOrigin,checks:{},cleanup:'pending'};
try {
  const profile=await api.createUserAccount({username,email,password});accountId=profile.$id;
  const staleCookies=new Map(cookies);
  assert.ok([...staleCookies.values()].some(Boolean),'The test must contain an actual Appwrite session cookie');
  await api.signOutAccount();
  local.clear();cookies=new Map(staleCookies);
  report.checks.expiredCookieIsUnauthenticated=(await api.getCurrentUser())===null;
  try {await api.signInAccount({username,password});report.checks.loginWithStaleCookie=(await api.account.get()).$id===accountId;}
  catch(error){report.checks.loginWithStaleCookie=false;report.loginError={code:error?.code??null,message:error?.message??'Sign-in failed'};}
  assert.ok(report.checks.loginWithStaleCookie,'The app could not log in with an expired browser cookie present');
  report.checks.browserCookieReplaced=[...staleCookies].every(([key,value])=>!value || cookies.get(key)!==value);
  assert.ok(report.checks.browserCookieReplaced);
  assert.equal((await api.account.listSessions()).total,1,'Temporary handoff sessions must be closed');
  report.checks.noTemporarySessionLeftBehind=true;
  const freshAccount=new Account(new Client().setEndpoint(schema.endpoint).setProject(schema.projectId));
  assert.equal((await freshAccount.get()).$id,accountId);
  report.checks.freshClientKeepsSession=true;
  cookies.clear();
  assert.equal((await freshAccount.get()).$id,accountId);
  report.checks.thirdPartyCookiesBlockedStillWorks=true;
} catch(error){failed=error;console.error('FAIL '+error.message);}
finally {
  cookies.clear();local.clear();
  if(accountId){
    try {
      await api.account.createEmailPasswordSession(email,password);
      assert.equal((await api.account.get()).$id,accountId);
      await api.databases.deleteDocument(schema.databaseId,'users',accountId);
      await api.account.updateStatus();
      report.cleanup='Synthetic profile removed; synthetic Auth account blocked';
    }catch(error){failed??=error;report.cleanup='Needs review';}
  }
  globalThis.fetch=nativeFetch;delete globalThis.window;
  report.passed=!failed;
  await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
  await writeFile(new URL('../artifacts/appwrite-session-check.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
if(failed)process.exitCode=1;
