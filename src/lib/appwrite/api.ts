import { AppwriteException, ID, Models, Permission, Query, Role } from 'appwrite';
import { INewPost, INewUser, IUpdatePost, IUpdateUser } from '@/types';
import { account, appwriteConfig, databases, storage, functions } from './config';
import { HydratedPost, InteractionRecord, PostRecord, ProfileRecord } from './models';
import { usernameToAccountId, usernameToLegacyEmail } from './identity';
import { RecoveryValidation, UsernameValidation } from '@/lib/validation';
import { clearFallbackSession, establishBrowserSession, normalizeFallbackSession } from './session';

const placeholder = '/assets/icons/profile-placeholder.svg';
const readMembers = Permission.read(Role.users());

function hasCode(error: unknown, code: number) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function ownerPermissions(accountId: string, shared = true) {
  return [Permission.read(shared ? Role.users() : Role.user(accountId)),
    Permission.update(Role.user(accountId)), Permission.delete(Role.user(accountId))];
}

async function currentAccount() {
  normalizeFallbackSession();
  try { return await account.get(); }
  catch (error) { if (hasCode(error, 401)) { clearFallbackSession(); return null; } throw error; }
}

async function requireAccount() {
  const user = await currentAccount();
  if (!user) throw new Error('Please sign in to continue.');
  return user;
}

async function listAll<T extends Models.Document>(collectionId: string, queries: string[] = []): Promise<T[]> {
  const documents: T[] = [];
  let cursor: string | undefined;
  while (true) {
    const page = await databases.listDocuments<T>(appwriteConfig.databaseId, collectionId, [
      ...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ]);
    documents.push(...page.documents);
    if (page.documents.length < 100 || documents.length >= page.total) return documents;
    cursor = page.documents[page.documents.length - 1].$id;
  }
}

async function recordsByIds<T extends Models.Document>(collectionId: string, ids: string[]): Promise<T[]> {
  const uniqueIds = [...new Set(ids)];
  const documents: T[] = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    documents.push(...await listAll<T>(collectionId, [Query.equal('$id', uniqueIds.slice(offset, offset + 100))]));
  }
  return documents;
}

async function hydratePosts(posts: PostRecord[]): Promise<HydratedPost[]> {
  if (!posts.length) return [];
  const creators = await recordsByIds<ProfileRecord>(appwriteConfig.userCollectionId, posts.map(post => post.creator));
  const creatorsById = new Map(creators.map(creator => [creator.$id, creator]));
  const likes: InteractionRecord[] = [];
  for (let offset = 0; offset < posts.length; offset += 100) {
    likes.push(...await listAll<InteractionRecord>(appwriteConfig.likesCollectionId, [
      Query.equal('post', posts.slice(offset, offset + 100).map(post => post.$id)),
    ]));
  }
  return posts.map(post => ({...post, tags: post.tags ?? [], creator: creatorsById.get(post.creator) ?? null,
    likes: likes.filter(like => like.post === post.$id).map(like => ({$id: like.user}))}));
}

async function hydratePostList(posts: Models.DocumentList<PostRecord>) {
  return {...posts, documents: await hydratePosts(posts.documents)};
}

export async function saveUserToDB(user: {accountId: string; name: string; username: string; imageUrl: string}) {
  const signedInUser = await requireAccount();
  if (signedInUser.$id !== user.accountId) throw new Error('You can only create your own profile.');
  return databases.createDocument<ProfileRecord>(appwriteConfig.databaseId, appwriteConfig.userCollectionId, user.accountId,
    {...user, bio: '', imageId: ''}, ownerPermissions(user.accountId));
}

async function ensureProfile(user: Models.User<Models.Preferences>) {
  try {
    return await databases.getDocument<ProfileRecord>(appwriteConfig.databaseId, appwriteConfig.userCollectionId, user.$id);
  } catch (error) {
    if (!hasCode(error, 404)) throw error;
    // Retry a failed first profile write after the user signs in again.
    try {
      return await saveUserToDB({accountId: user.$id, name: user.name || 'Member',
        username: typeof user.prefs.username === 'string' ? user.prefs.username : 'member_' + user.$id.slice(-8),
        imageUrl: placeholder});
    } catch (creationError) {
      if (!hasCode(creationError, 409)) throw creationError;
      return databases.getDocument<ProfileRecord>(appwriteConfig.databaseId, appwriteConfig.userCollectionId, user.$id);
    }
  }
}

export async function createUserAccount(user: INewUser) {
  const username = UsernameValidation.parse(user.username);
  const { email } = RecoveryValidation.parse({email: user.email});
  const availability = await authRequest({action: 'availability', username});
  if (!availability.available) throw new Error('That username is already taken.');
  try {
    await account.create(usernameToAccountId(username), email, user.password, username);
  } catch (error) {
    if (hasCode(error, 409)) throw new Error('That username or email is already in use.');
    throw error;
  }
  // The Users table is never guest-writable: establish the session first.
  await account.createEmailPasswordSession(email, user.password);
  await account.updatePrefs({username});
  return ensureProfile(await requireAccount());
}

export async function signInAccount(user: {username: string; password: string}) {
  const username = UsernameValidation.parse(user.username);
  const existing = await currentAccount();
  // Signup already establishes this session before writing the profile.
  if (existing?.prefs.username === username) return account.getSession('current');
  if (existing) await signOutAccount();
  if (!appwriteConfig.authFunctionId) {
    return account.createEmailPasswordSession(usernameToLegacyEmail(username), user.password);
  }
  const result = await authRequest({action: 'login', username, password: user.password});
  if (typeof result.session !== 'string' || !result.session) throw new Error('Sign in failed.');
  return establishBrowserSession(result.session, user.password);
}

async function authRequest(body: {action: 'login' | 'availability'; username: string; password?: string}) {
  if (!appwriteConfig.authFunctionId) throw new Error('Username authentication is not configured.');
  const execution = await functions.createExecution(appwriteConfig.authFunctionId, JSON.stringify(body), false);
  if (execution.responseStatusCode !== 200) {
    const status = execution.responseStatusCode;
    throw new AppwriteException(status === 401 ? 'Incorrect username or password.' : status === 429
      ? 'Too many sign-in attempts. Please wait a few minutes.' : 'Sign-in service is temporarily unavailable. Please try again.', status);
  }
  const result = JSON.parse(execution.responseBody) as {available?: boolean; session?: string};
  return result;
}

export async function signOutAccount() {
  let result;
  try { result = await account.deleteSession('current'); }
  catch (error) { if (!hasCode(error, 401)) throw error; }
  clearFallbackSession();
  return result;
}

export async function requestPasswordRecovery(email: string) {
  const values = RecoveryValidation.parse({email});
  try { await account.createRecovery(values.email, new URL('/reset-password', window.location.origin).toString()); }
  catch (error) { if (!hasCode(error, 404)) throw error; }
}

export async function resetPassword(userId: string, secret: string, password: string) {
  if (!userId || !secret || password.length < 8) throw new Error('Invalid password reset request.');
  return account.updateRecovery(userId, secret, password);
}

export async function getCurrentUser() {
  const user = await currentAccount();
  if (!user) return null;
  const profile = await ensureProfile(user);
  const [posts, saves, likes] = await Promise.all([
    listAll<PostRecord>(appwriteConfig.postCollectionId, [Query.equal('creator', profile.$id), Query.orderDesc('$createdAt')]),
    listAll<InteractionRecord>(appwriteConfig.savesCollectionId, [Query.equal('user', profile.$id), Query.orderAsc('$createdAt')]),
    listAll<InteractionRecord>(appwriteConfig.likesCollectionId, [Query.equal('user', profile.$id)]),
  ]);
  const referenced = await recordsByIds<PostRecord>(appwriteConfig.postCollectionId, [...saves, ...likes].map(record => record.post));
  const hydrated = await hydratePosts(referenced);
  const postsById = new Map(hydrated.map(post => [post.$id, post]));
  return {...profile, bio: profile.bio ?? '', imageUrl: profile.imageUrl || placeholder,
    posts: await hydratePosts(posts),
    save: saves.map(save => ({...save, post: postsById.get(save.post) ?? null})),
    liked: likes.map(like => postsById.get(like.post)).filter((post): post is HydratedPost => !!post)};
}

export async function getUserById(userId: string) {
  const user = await requireAccount();
  if (user.$id === userId) return getCurrentUser();
  const profile = await databases.getDocument<ProfileRecord>(appwriteConfig.databaseId, appwriteConfig.userCollectionId, userId);
  const posts = await listAll<PostRecord>(appwriteConfig.postCollectionId, [Query.equal('creator', userId), Query.orderDesc('$createdAt')]);
  // Private email and bookmarks never appear in another member's profile response.
  return {...profile, posts: await hydratePosts(posts), bio: profile.bio ?? '', imageUrl: profile.imageUrl || placeholder};
}

function tagsFromInput(tags = '') { return [...new Set(tags.split(',').map(tag => tag.trim()).filter(Boolean))]; }

export function getFilePreview(fileId: string) {
  // Direct viewing works on Free; image transformations require a paid plan.
  return storage.getFileView(appwriteConfig.storageId, fileId).toString();
}

export async function uploadFile(file: File) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error('Choose a PNG, JPEG, or WebP image up to 10 MiB.');
  }
  const user = await requireAccount();
  return storage.createFile(appwriteConfig.storageId, ID.unique(), file, [
    Permission.read(Role.any()), Permission.update(Role.user(user.$id)), Permission.delete(Role.user(user.$id)),
  ]);
}

export async function deleteFile(fileId: string) {
  await storage.deleteFile(appwriteConfig.storageId, fileId);
  return {status: 'ok'};
}

async function cleanUpFile(fileId: string) {
  try { await deleteFile(fileId); }
  catch { console.warn('Unable to clean up image file:', fileId); }
}

export async function createPost(post: INewPost) {
  const user = await requireAccount();
  if (post.userId !== user.$id) throw new Error('You can only create your own posts.');
  const file = await uploadFile(post.file[0]);
  try {
    return await databases.createDocument<PostRecord>(appwriteConfig.databaseId, appwriteConfig.postCollectionId, ID.unique(), {
      creator: user.$id, caption: post.caption, imageUrl: getFilePreview(file.$id), imageId: file.$id,
      location: post.location ?? '', tags: tagsFromInput(post.tags),
    }, ownerPermissions(user.$id));
  } catch (error) { await cleanUpFile(file.$id); throw error; }
}

export async function getRecentPosts() {
  return hydratePostList(await databases.listDocuments<PostRecord>(appwriteConfig.databaseId, appwriteConfig.postCollectionId, [
    Query.orderDesc('$createdAt'), Query.limit(20),
  ]));
}

export async function getPostbyId(postId: string) {
  const post = await databases.getDocument<PostRecord>(appwriteConfig.databaseId, appwriteConfig.postCollectionId, postId);
  return (await hydratePosts([post]))[0];
}

export async function UpdatePost(post: IUpdatePost) {
  const user = await requireAccount();
  const existing = await databases.getDocument<PostRecord>(appwriteConfig.databaseId, appwriteConfig.postCollectionId, post.postId);
  if (existing.creator !== user.$id) throw new Error('You can only edit your own posts.');
  const newFile = post.file.length ? await uploadFile(post.file[0]) : undefined;
  let updated: PostRecord;
  try {
    updated = await databases.updateDocument<PostRecord>(appwriteConfig.databaseId, appwriteConfig.postCollectionId, post.postId, {
      caption: post.caption, location: post.location ?? '', tags: tagsFromInput(post.tags),
      imageId: newFile?.$id ?? existing.imageId,
      imageUrl: newFile ? getFilePreview(newFile.$id) : existing.imageUrl,
    });
  } catch (error) { if (newFile) await cleanUpFile(newFile.$id); throw error; }
  if (newFile && existing.imageId) await cleanUpFile(existing.imageId);
  return updated;
}

export async function deletePost(postId: string, imageId: string) {
  if (!postId || !imageId) throw new Error('Post and image IDs are required.');
  const user = await requireAccount();
  const post = await databases.getDocument<PostRecord>(appwriteConfig.databaseId, appwriteConfig.postCollectionId, postId);
  if (post.creator !== user.$id || post.imageId !== imageId) throw new Error('You can only delete your own post.');
  await databases.deleteDocument(appwriteConfig.databaseId, appwriteConfig.postCollectionId, postId);
  await cleanUpFile(post.imageId);
  return {status: 'ok'};
}

async function ownInteraction(collection: string, userId: string, postId: string) {
  const found = await databases.listDocuments<InteractionRecord>(appwriteConfig.databaseId, collection, [
    Query.equal('user', userId), Query.equal('post', postId), Query.limit(1),
  ]);
  return found.documents[0];
}

export async function likePost(postId: string, likesArray: string[]) {
  const user = await requireAccount();
  await databases.getDocument(appwriteConfig.databaseId, appwriteConfig.postCollectionId, postId);
  const existing = await ownInteraction(appwriteConfig.likesCollectionId, user.$id, postId);
  if (likesArray.includes(user.$id) && !existing) {
    try {
      await databases.createDocument(appwriteConfig.databaseId, appwriteConfig.likesCollectionId, ID.unique(),
        {user: user.$id, post: postId}, [readMembers, Permission.delete(Role.user(user.$id))]);
    } catch (error) { if (!hasCode(error, 409)) throw error; }
  } else if (!likesArray.includes(user.$id) && existing) {
    await databases.deleteDocument(appwriteConfig.databaseId, appwriteConfig.likesCollectionId, existing.$id);
  }
  return {$id: postId};
}

export async function savePost(postId: string, userId: string) {
  const user = await requireAccount();
  if (userId !== user.$id) throw new Error('You can only create your own bookmarks.');
  await databases.getDocument(appwriteConfig.databaseId, appwriteConfig.postCollectionId, postId);
  const existing = await ownInteraction(appwriteConfig.savesCollectionId, user.$id, postId);
  if (existing) return existing;
  try {
    return await databases.createDocument<InteractionRecord>(appwriteConfig.databaseId, appwriteConfig.savesCollectionId, ID.unique(),
      {user: user.$id, post: postId}, [Permission.read(Role.user(user.$id)), Permission.delete(Role.user(user.$id))]);
  } catch (error) {
    if (!hasCode(error, 409)) throw error;
    const saved = await ownInteraction(appwriteConfig.savesCollectionId, user.$id, postId);
    if (!saved) throw error;
    return saved;
  }
}

export async function deleteSavedPost(savedRecordId: string) {
  await databases.deleteDocument(appwriteConfig.databaseId, appwriteConfig.savesCollectionId, savedRecordId);
  return {status: 'ok'};
}

export async function getInfinitePosts({pageParam}: {pageParam: string | undefined}) {
  return hydratePostList(await databases.listDocuments<PostRecord>(appwriteConfig.databaseId, appwriteConfig.postCollectionId, [
    Query.orderDesc('$createdAt'), Query.limit(10), ...(pageParam ? [Query.cursorAfter(pageParam)] : []),
  ]));
}

export async function getSearchPosts(searchterm: string) {
  return hydratePostList(await databases.listDocuments<PostRecord>(appwriteConfig.databaseId, appwriteConfig.postCollectionId, [
    Query.search('caption', searchterm.trim()), Query.orderDesc('$createdAt'), Query.limit(100),
  ]));
}

export async function updateUser(user: IUpdateUser) {
  const signedInUser = await requireAccount();
  if (user.userId !== signedInUser.$id) throw new Error('You can only update your own profile.');
  const existing = await databases.getDocument<ProfileRecord>(appwriteConfig.databaseId, appwriteConfig.userCollectionId, user.userId);
  const file = user.file.length ? await uploadFile(user.file[0]) : undefined;
  let updated: ProfileRecord;
  try {
    updated = await databases.updateDocument<ProfileRecord>(appwriteConfig.databaseId, appwriteConfig.userCollectionId, user.userId, {
      name: user.name.trim(), bio: user.bio,
      imageUrl: file ? getFilePreview(file.$id) : existing.imageUrl, imageId: file?.$id ?? existing.imageId ?? '',
    });
  } catch (error) { if (file) await cleanUpFile(file.$id); throw error; }
  if (file && existing.imageId) await cleanUpFile(existing.imageId);
  return updated;
}
