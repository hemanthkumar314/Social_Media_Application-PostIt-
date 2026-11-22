import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Opt-in integration check. Uses only newly created synthetic accounts/data.
// Never reads an admin API key, changes the schema, or touches pre-existing rows.
if (!process.argv.includes('--run')) {
  console.log('Use node scripts/appwrite-smoke.mjs --run to test the configured fresh project.');
  process.exit(0);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const testOrigin = new URL(process.env.POSTIT_TEST_ORIGIN ?? 'http://localhost:5173').origin;
const schema = JSON.parse(await readFile(new URL('../appwrite/schema.json', import.meta.url), 'utf8'));
const env = Object.fromEntries((await readFile(new URL('../.env.local', import.meta.url), 'utf8')).split(/\r?\n/)
  .filter(line => /^VITE_APPWRITE_[A-Z_]+=/.test(line)).map(line => {const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1).trim()];}));
assert.equal(env.VITE_APPWRITE_PROJECT_ID, schema.projectId, 'Refusing to test a different project');
assert.equal(env.VITE_APPWRITE_DATABASE_ID, schema.databaseId);
assert.equal(env.VITE_APPWRITE_URL, schema.endpoint);
assert.ok(env.VITE_APPWRITE_AUTH_FUNCTION_ID, 'Deploy and configure the prepared username-auth function before running the email-signup integration check.');

globalThis.File = File;
let activeActor;
const nativeFetch = globalThis.fetch;
const localStore = {getItem: key => activeActor?.local.get(key) ?? null, setItem: (key, value) => activeActor?.local.set(key, value)};
globalThis.window = {localStorage: localStore, location: {origin:testOrigin}, console: {warn() {}}};
globalThis.fetch = async (url, options = {}) => {
  const headers = new Headers(options.headers);
  headers.set('Origin', testOrigin);
  if (options.credentials !== 'omit' && activeActor?.cookies.size) headers.set('Cookie', [...activeActor.cookies].map(([key,value]) => key + '=' + value).join('; '));
  const response = await nativeFetch(url, {...options, headers, signal: options.signal ?? AbortSignal.timeout(25000)});
  const cookies = response.headers.get('set-cookie') ?? '';
  if (options.credentials !== 'omit') for (const match of cookies.matchAll(/(?:^|,\s*)(a_session_[^=;,\s]+)=([^;,]*)/g)) activeActor?.cookies.set(match[1],match[2]);
  return response;
};

const bundled = await build({stdin: {contents: "export * from './src/lib/appwrite/api'; export { account, databases, storage, appwriteConfig } from './src/lib/appwrite/config';", resolveDir: root, loader: 'ts'},
  absWorkingDir: root, tsconfig: root + 'tsconfig.app.json', bundle: true, platform: 'node', format: 'esm', write: false,
  define: {'import.meta.env': JSON.stringify(env)}});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const runId = Date.now().toString(36);
const actors = [];
const results = [];
let post;
let save;
let profileImageId;
let failure;
const pass = name => {results.push({name, passed: true}); console.log('PASS ' + name);};
async function denied(operation) {
  let error;
  try { await operation(); } catch (caught) {error = caught;}
  assert.ok(error && [401,403,404].includes(error.code), 'Expected a permission denial');
}
async function createActor(suffix) {
  const actor = {local: new Map(), cookies: new Map(), username: 'smoke_' + runId + '_' + suffix, password: randomBytes(24).toString('base64url')};
  activeActor = actor;
  actors.push(actor);
  try {
    const profile = await api.createUserAccount({username: actor.username, email: actor.username + '@example.com', password: actor.password});
    actor.id = profile.$id;
  } catch (error) {
    try {actor.id = (await api.account.get()).$id;} catch { /* Account/session creation failed before a usable session. */ }
    throw error;
  }
  return actor;
}
function photo(name) {
  return new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOxoAAAAASUVORK5CYII=', 'base64')], name, {type:'image/png'});
}

try {
  const first = await createActor('a');
  const current = await api.getCurrentUser();
  assert.equal(current.id ?? current.$id, first.id);
  assert.equal(current.email, undefined);
  assert.equal(current.username, first.username);
  const rawProfile = await api.databases.getDocument(schema.databaseId, 'users', first.id);
  assert.equal(rawProfile.email, undefined);
  assert.equal((await api.account.get()).email, first.username + '@example.com');
  pass('Username and email signup, session creation, and profiles without exposed email');

  await assert.rejects(api.createUserAccount({username:first.username.toUpperCase(),email:'other_'+runId+'@example.com',password:'DifferentPassword123'}), /username is already taken/);
  pass('Username uniqueness is case-insensitive');

  await api.requestPasswordRecovery(first.username + '@example.com');
  await assert.rejects(api.resetPassword(first.id, 'invalid-test-secret', 'NewTestPassword123'), error => [400,401,403,404].includes(error.code));
  pass('Email recovery request accepts the website reset URL and rejects invalid recovery secrets (inbox delivery not tested)');

  post = await api.createPost({userId:first.id, caption:'PostIt smoke test photo', location:'Test location', tags:'test, photo', file:[photo('smoke.png')]});
  assert.equal(post.creator, first.id);
  assert.ok(post.imageUrl.includes('/view?'));
  const publicImage = await nativeFetch(post.imageUrl, {signal:AbortSignal.timeout(25000)});
  assert.equal(publicImage.status,200);
  pass('Image upload and public direct image delivery');

  const feed = await api.getRecentPosts();
  assert.equal(feed.documents.find(item => item.$id === post.$id)?.creator?.$id,first.id);
  assert.ok((await api.getInfinitePosts({pageParam:undefined})).documents.some(item => item.$id === post.$id));
  assert.ok((await api.getSearchPosts('PostIt')).documents.some(item => item.$id === post.$id));
  pass('Home feed, Explore, creator hydration, and full-text search');

  await api.UpdatePost({postId:post.$id,caption:'PostIt edited smoke test photo',imageId:post.imageId,imageUrl:post.imageUrl,location:'Updated location',tags:'test',file:[]});
  assert.equal((await api.getPostbyId(post.$id)).caption,'PostIt edited smoke test photo');
  const updatedProfile = await api.updateUser({userId:first.id,name:'Smoke Test Edited',bio:'Synthetic test profile',file:[photo('profile.png')],imageId:'',imageUrl:rawProfile.imageUrl});
  profileImageId = updatedProfile.imageId;
  assert.equal(updatedProfile.name,'Smoke Test Edited');
  pass('Post editing and profile name, bio, and photo updates');

  await api.signOutAccount();
  first.cookies.clear(); first.local.clear();
  assert.equal(await api.getCurrentUser(),null);
  await assert.rejects(api.signInAccount({username:first.username,password:'wrong-password-123'}));
  assert.equal(await api.getCurrentUser(),null);
  pass('Incorrect passwords cannot establish a session');
  await api.signInAccount({username:first.username.toUpperCase(),password:first.password});
  assert.equal((await api.getCurrentUser()).$id,first.id);
  pass('Logout and case-insensitive username/password login');

  const second = await createActor('b');
  await api.likePost(post.$id,[first.id,second.id]);
  const liked = await api.getPostbyId(post.$id);
  assert.deepEqual(liked.likes,[{$id:second.id}]);
  await api.likePost(post.$id,[second.id]);
  assert.equal((await api.getPostbyId(post.$id)).likes.length,1);
  pass('Likes are owned individually and duplicate likes are prevented');

  save = await api.savePost(post.$id,second.id);
  assert.equal((await api.savePost(post.$id,second.id)).$id,save.$id);
  assert.equal((await api.getCurrentUser()).save[0].post.$id,post.$id);
  await denied(() => api.databases.updateDocument(schema.databaseId,'posts',post.$id,{caption:'Unauthorized edit'}));
  await denied(() => api.storage.deleteFile('images',post.imageId));
  const visibleProfile = await api.getUserById(first.id);
  assert.equal(visibleProfile.email,undefined);
  assert.equal(visibleProfile.save,undefined);
  pass('Another account cannot edit posts, delete images, or read private profile data');

  activeActor = first;
  await denied(() => api.databases.getDocument(schema.databaseId,'saves',save.$id));
  assert.equal((await api.databases.listDocuments(schema.databaseId,'saves')).total,0);
  pass('Bookmarks are unreadable by another signed-in account');

  activeActor = undefined;
  // List endpoints filter inaccessible rows; direct document reads reject access.
  const guestFeed = await api.getRecentPosts();
  assert.equal(guestFeed.total,0);
  assert.equal(guestFeed.documents.length,0);
  await denied(() => api.getPostbyId(post.$id));
  pass('Guests see no feed records and cannot read a protected post directly');
} catch (error) {
  failure = error;
  console.error('FAIL ' + (error?.message ?? 'Unknown integration error'));
} finally {
  // Delete only rows/files created in this run, then block these synthetic accounts.
  // Blocking is reversible in Appwrite Console; no admin key or permanent user deletion is used.
  for (const actor of [...actors].reverse()) {
    activeActor = actor;
    if (!actor.id) continue;
    const cleanup = async (label, operation) => {try {await operation();} catch(error) {if (error?.code !== 404) {console.error('Cleanup needs attention: ' + label); failure ??= error;}}};
    if (actor === actors[1] && post) {
      await cleanup('like', () => api.likePost(post.$id,[]));
      if (save) await cleanup('bookmark', () => api.deleteSavedPost(save.$id));
    }
    if (actor === actors[0]) {
      if (post) await cleanup('post and image', () => api.deletePost(post.$id,post.imageId));
      if (profileImageId) await cleanup('profile image', () => api.deleteFile(profileImageId));
    }
    await cleanup('test profile', () => api.databases.deleteDocument(schema.databaseId,'users',actor.id));
    await cleanup('disable synthetic account', () => api.account.updateStatus());
  }
  globalThis.fetch = nativeFetch;
  delete globalThis.window;
  const report = {projectId:schema.projectId, origin:testOrigin, timestamp:new Date().toISOString(), passed:!failure, checks:results,
    disabledTestAccountIds:actors.map(actor => actor.id), cleanup: failure ? 'Review output' : 'Test rows and files removed; synthetic Auth accounts blocked'};
  await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
  await writeFile(new URL('../artifacts/appwrite-smoke.json',import.meta.url),JSON.stringify(report,null,2));
  console.log('Completed ' + results.length + ' live checks. Synthetic Auth accounts: ' + actors.length + '.');
}
if (failure) process.exitCode = 1;
