import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {randomBytes} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {build} from 'esbuild';

// Explicit, persistent demo content requested by the user. No admin key or real
// member session is used. Passwords exist only in memory; demo logins are blocked
// afterward while their shared profiles and posts remain available.
if (!process.argv.includes('--run')) {
  console.log('Use node scripts/seed-demo-posts.mjs --run [--preview] to create the 12 requested demo posts.');
  process.exit(0);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const manifestUrl = new URL('../artifacts/demo-posts.json', import.meta.url);
let previous;
try { previous = JSON.parse(await readFile(manifestUrl, 'utf8')); } catch(error) { if (error.code !== 'ENOENT') throw error; }
if (previous) {
  assert.equal(previous.status, 'complete', 'A previous demo seed needs review; refusing to duplicate its data.');
  console.log(`Demo seed already complete: ${previous.posts.length} posts. No accounts or posts were added.`);
  process.exit(0);
}
const schema = JSON.parse(await readFile(new URL('../appwrite/schema.json', import.meta.url), 'utf8'));
const env = Object.fromEntries((await readFile(new URL('../.env.local', import.meta.url), 'utf8')).split(/\r?\n/)
  .filter(line => /^VITE_APPWRITE_[A-Z_]+=/.test(line)).map(line => {const index = line.indexOf('='); return [line.slice(0,index),line.slice(index+1).trim()];}));
assert.equal(env.VITE_APPWRITE_PROJECT_ID,schema.projectId);
assert.equal(env.VITE_APPWRITE_DATABASE_ID,schema.databaseId);
assert.equal(env.VITE_APPWRITE_URL,schema.endpoint);
assert.ok(env.VITE_APPWRITE_AUTH_FUNCTION_ID);
const entries = JSON.parse(await readFile(new URL('../design/demo-posts/posts.json', import.meta.url), 'utf8'));
assert.equal(entries.length,12);
const assets = new Map();
for (const key of new Set(entries.map(entry => entry.asset))) {
  const bytes = await readFile(new URL(`../design/demo-posts/${key}.png`, import.meta.url));
  assert.ok(bytes.length < 10 * 1024 * 1024, 'Demo image exceeds the bucket limit');
  assets.set(key,bytes);
}

let activeActor;
const nativeFetch = globalThis.fetch;
globalThis.File = File;
globalThis.window = {location:{origin:'http://localhost:5173'},console:{warn(){}},localStorage:{
  getItem:key => activeActor?.local.get(key) ?? null,
  setItem:(key,value) => activeActor?.local.set(key,value),
}};
globalThis.fetch = async (url, options = {}) => {
  const headers = new Headers(options.headers);
  headers.set('Origin','http://localhost:5173');
  if (options.credentials !== 'omit' && activeActor?.cookies.size) headers.set('Cookie',[...activeActor.cookies].map(([key,value]) => `${key}=${value}`).join('; '));
  const response = await nativeFetch(url,{...options,headers,signal:options.signal ?? AbortSignal.timeout(30000)});
  if (options.credentials !== 'omit') for (const match of (response.headers.get('set-cookie') ?? '').matchAll(/(?:^|,\s*)(a_session_[^=;,\s]+)=([^;,]*)/g)) activeActor?.cookies.set(match[1],match[2]);
  return response;
};
const bundled = await build({stdin:{contents:"export * from './src/lib/appwrite/api'; export {account,databases} from './src/lib/appwrite/config'; export {Query} from 'appwrite';",resolveDir:root,loader:'ts'},
  absWorkingDir:root,tsconfig:root+'tsconfig.app.json',bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':JSON.stringify(env)}});
const api = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const runId = Date.now().toString(36);
const actors = [];
const report = {projectId:schema.projectId,status:'creating',accounts:[],posts:[],checks:[]};
let complete = false;
let failure;
const saveReport = async () => {await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true}); await writeFile(manifestUrl,JSON.stringify(report,null,2));};
const pass = name => {report.checks.push(name);console.log('PASS '+name);};

try {
  for (const [key,name,bio] of [
    ['movies','Reel Club (Demo)','Example account for Avengers and Doomsday fan discussions. Generated fan art, not official movie news.'],
    ['cars','Garage Club (Demo)','Example car enthusiast account. Generated automotive images for testing the shared feed.'],
  ]) {
    const actor = {key,username:`demo_${key}_${runId}`,email:`postit.${key}.${runId}@example.com`,password:randomBytes(24).toString('base64url'),local:new Map(),cookies:new Map()};
    actors.push(actor);activeActor=actor;
    try { actor.profile = await api.createUserAccount(actor); actor.id = actor.profile.$id; }
    catch(error) {try {actor.id=(await api.account.get()).$id;} catch {} throw error;}
    await api.updateUser({userId:actor.id,name,bio,file:[],imageId:'',imageUrl:actor.profile.imageUrl});
    actor.name=name;
    report.accounts.push({id:actor.id,username:actor.username,email:actor.email,name,status:'active'});
    await saveReport();
  }
  const targetUsername = 'hemanth1704';
  const target = (await api.databases.listDocuments(schema.databaseId,'users',[api.Query.equal('username',targetUsername),api.Query.limit(2)])).documents;
  assert.equal(target.length,1,'Unable to identify your profile uniquely; no demo posts were created.');
  const before = await api.getUserById(target[0].$id);
  const ownPostIds = before.posts.map(post => post.$id).sort();

  for (const entry of entries) {
    activeActor=actors.find(actor => actor.key === entry.account);
    const post = await api.createPost({userId:activeActor.id,caption:entry.caption,location:entry.location,tags:entry.tags,
      file:[new File([assets.get(entry.asset)],entry.asset+'.png',{type:'image/png'})]});
    report.posts.push({id:post.$id,creator:post.creator,imageId:post.imageId,asset:entry.asset,caption:entry.caption});
    await saveReport();
    console.log(`Created demo post ${report.posts.length}/12`);
  }
  const seeded = new Set(report.posts.map(post=>post.id));
  const feed = await api.getRecentPosts();
  assert.equal(feed.documents.filter(post=>seeded.has(post.$id)).length,12);
  pass('All 12 demo posts are visible in the signed-in shared feed');
  for (const actor of actors) {
    const profile = await api.getUserById(actor.id);
    assert.equal(profile.posts.filter(post=>seeded.has(post.$id)).length,6);
    assert.ok(profile.posts.every(post=>post.creator.$id===actor.id));
    for (const post of profile.posts.filter(post=>seeded.has(post.$id))) assert.equal((await nativeFetch(post.imageUrl,{method:'HEAD',signal:AbortSignal.timeout(20000)})).status,200);
  }
  pass('Each demo profile owns exactly six demo posts, with accessible images');
  const after = await api.getUserById(target[0].$id);
  assert.deepEqual(after.posts.map(post=>post.$id).sort(),ownPostIds);
  assert.ok(after.posts.every(post=>!seeded.has(post.$id)));
  report.yourProfile = {id:target[0].$id,username:targetUsername,postsBefore:ownPostIds.length,postsAfter:after.posts.length,demoPostsInYourProfile:0};
  pass('Your own Posts tab is unchanged and contains zero demo posts');
  activeActor=actors[0];
  const otherPost=report.posts.find(post=>post.creator===actors[1].id);
  await assert.rejects(api.UpdatePost({postId:otherPost.id,caption:'Not allowed',imageId:otherPost.imageId,imageUrl:'',location:'Test',tags:'demo',file:[]}),/own posts/);
  pass('One demo account cannot edit the other account’s posts');
  complete=true;
  if (process.argv.includes('--preview')) {
    console.log('TEMPORARY_DEMO_PREVIEW '+JSON.stringify({username:actors[0].username,password:actors[0].password}));
    console.log('Type done to finish preview and block both demo logins. No passwords are saved to disk.');
    const input=createInterface({input:process.stdin,output:process.stdout});
    const deadline=setTimeout(()=>input.close(),10*60*1000);
    for await (const line of input) {if (line.trim()==='done') {input.close();break;}}
    clearTimeout(deadline);
  }
} catch(error) {
  failure=error;console.error('FAIL '+(error?.message ?? 'Demo seed failed'));
} finally {
  for (const actor of [...actors].reverse()) {
    activeActor=actor;
    if (!actor.id) continue;
    if (!complete) {
      for (const post of report.posts.filter(post=>post.creator===actor.id)) {
        try {await api.deletePost(post.id,post.imageId);} catch {console.error('Needs cleanup: '+post.id);}
      }
      try {await api.databases.deleteDocument(schema.databaseId,'users',actor.id);} catch {}
    }
    try {
      await api.account.updateStatus();
      const recorded=report.accounts.find(account=>account.id===actor.id);if(recorded)recorded.status='blocked';
    } catch(error) {failure ??=error;console.error('Needs attention: demo account '+actor.id);}
  }
  report.status=complete && !failure ? 'complete' : 'needs-review';
  report.createdAt=new Date().toISOString();
  report.note='Demo posts and profiles are retained on success. Demo Auth accounts are blocked; passwords are not retained.';
  await saveReport();
  globalThis.fetch=nativeFetch;delete globalThis.window;
}
if (failure) process.exitCode=1;
else console.log('Completed: 12 retained demo posts across two profiles; your own posts are unchanged.');
