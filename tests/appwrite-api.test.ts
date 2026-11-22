import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/lib/appwrite/api');
const backend = vi.hoisted(() => ({
  account: {get: vi.fn(), create: vi.fn(), createEmailPasswordSession: vi.fn(), updatePrefs: vi.fn(), getSession: vi.fn(), deleteSession: vi.fn(), createRecovery: vi.fn(), updateRecovery: vi.fn()},
  functions: {createExecution: vi.fn()},
  databases: {getDocument: vi.fn(), listDocuments: vi.fn(), createDocument: vi.fn(), updateDocument: vi.fn(), deleteDocument: vi.fn()},
  storage: {createFile: vi.fn(), getFileView: vi.fn(), deleteFile: vi.fn()},
}));
vi.mock('@/lib/appwrite/config', () => ({...backend, appwriteConfig: {
  url: 'https://appwrite.test/v1', projectId: 'test-project', authFunctionId: 'postit-auth', databaseId: 'test-db', userCollectionId: 'users', postCollectionId: 'posts',
  likesCollectionId: 'likes', savesCollectionId: 'saves', storageId: 'images',
}}));
import * as api from '@/lib/appwrite/api';
import {appwriteConfig} from '@/lib/appwrite/config';

const metadata = {$id:'owner', $collectionId:'users', $databaseId:'test-db', $createdAt:'2026-11-22', $updatedAt:'2026-11-22', $permissions:[]};
const profile = {...metadata, accountId:'owner', name:'Owner', username:'owner', imageUrl:'/profile.png', bio:''};
const post = {...metadata, $id:'post-1', creator:'owner', caption:'Photo caption', imageUrl:'/original.png', imageId:'old-image', tags:[]};

beforeEach(() => {
  Object.values(backend).forEach(service => Object.values(service).forEach(mock => mock.mockReset()));
  backend.account.get.mockResolvedValue({$id:'owner', email:'owner@users.postit.invalid', name:'Owner', prefs:{username:'owner'}});
  backend.databases.listDocuments.mockResolvedValue({total:0, documents:[]});
  backend.functions.createExecution.mockResolvedValue({responseStatusCode:200, responseBody:JSON.stringify({available:true,session:'test-secret'})});
  backend.storage.getFileView.mockReturnValue(new URL('https://example.com/files/new-image/view'));
});

describe('Appwrite integration', () => {
  it('establishes a real-email session before creating a profile without exposing the email', async () => {
    const order: string[] = [];
    backend.account.createEmailPasswordSession.mockImplementation(async () => {order.push('session'); return {};});
    backend.databases.getDocument.mockRejectedValue({code:404});
    backend.databases.createDocument.mockImplementation(async () => {order.push('profile'); return profile;});
    await api.createUserAccount({username:'Owner', email:'Owner@Example.com', password:'password123'});
    expect(order).toEqual(['session','profile']);
    expect(backend.account.create).toHaveBeenCalledWith('u_owner','owner@example.com','password123','owner');
    expect(backend.account.createEmailPasswordSession).toHaveBeenCalledWith('owner@example.com','password123');
    const [, , id, data, permissions] = backend.databases.createDocument.mock.calls[0];
    expect(id).toBe('owner');
    expect(data).not.toHaveProperty('email');
    expect(permissions).toEqual(['read("users")','update("user:owner")','delete("user:owner")']);
  });

  it('returns null for a missing session but propagates service failures', async () => {
    backend.account.get.mockRejectedValueOnce({code:401});
    expect(await api.getCurrentUser()).toBeNull();
    backend.account.get.mockRejectedValueOnce({code:503});
    await expect(api.getCurrentUser()).rejects.toEqual({code:503});
  });

  it('reuses the session established during signup', async () => {
    backend.account.getSession.mockResolvedValue({$id:'session'});
    await api.signInAccount({username:'OWNER',password:'password123'});
    expect(backend.account.createEmailPasswordSession).not.toHaveBeenCalled();
  });

  it('uses the server function for username login, then establishes a browser session', async () => {
    backend.account.get.mockRejectedValue({code:401});
    vi.mocked(fetch).mockResolvedValueOnce({ok:true,status:200,json:async()=>({email:'new@example.com'})} as Response)
      .mockResolvedValueOnce({ok:true,status:204} as Response);
    await api.signInAccount({username:' New_User ',password:'password123'});
    expect(backend.functions.createExecution).toHaveBeenCalledWith('postit-auth',JSON.stringify({action:'login',username:'new_user',password:'password123'}),false);
    expect(backend.account.createEmailPasswordSession).toHaveBeenCalledWith('new@example.com','password123');
    expect(fetch).toHaveBeenNthCalledWith(1,'https://appwrite.test/v1/account',expect.objectContaining({credentials:'omit'}));
    expect(fetch).toHaveBeenNthCalledWith(2,'https://appwrite.test/v1/account/sessions/current',expect.objectContaining({method:'DELETE',credentials:'omit'}));
    expect(localStorage.getItem('cookieFallback')).not.toContain('test-secret');
  });

  it('reports invalid credentials and rate limits without hiding them behind a generic failure', async () => {
    backend.account.get.mockRejectedValue({code:401});
    backend.functions.createExecution.mockResolvedValueOnce({responseStatusCode:401,responseBody:'{}'});
    await expect(api.signInAccount({username:'owner',password:'wrong-password'})).rejects.toMatchObject({code:401});
    backend.functions.createExecution.mockResolvedValueOnce({responseStatusCode:429,responseBody:'{}'});
    await expect(api.signInAccount({username:'owner',password:'password123'})).rejects.toMatchObject({code:429});
    expect(backend.account.createEmailPasswordSession).not.toHaveBeenCalled();
  });

  it('reports an unavailable username without attempting to create a session', async () => {
    backend.account.create.mockRejectedValue({code:409});
    await expect(api.createUserAccount({username:'owner',email:'owner@example.com',password:'password123'})).rejects.toThrow('That username or email is already in use.');
    expect(backend.account.createEmailPasswordSession).not.toHaveBeenCalled();
  });

  it('preserves existing username login when the new function is not deployed', async () => {
    const configuredId = appwriteConfig.authFunctionId;
    appwriteConfig.authFunctionId = '';
    backend.account.get.mockRejectedValue({code:401});
    try {
      await api.signInAccount({username:'OWNER',password:'password123'});
      expect(backend.account.createEmailPasswordSession).toHaveBeenCalledWith('owner@users.postit.invalid','password123');
      expect(backend.functions.createExecution).not.toHaveBeenCalled();
    } finally { appwriteConfig.authFunctionId = configuredId; }
  });

  it('cleans up a newly uploaded image when creating a post fails', async () => {
    backend.storage.createFile.mockResolvedValue({$id:'new-image'});
    backend.databases.createDocument.mockRejectedValue(new Error('Database unavailable'));
    await expect(api.createPost({userId:'owner',caption:'Photo caption',file:[new File(['image'],'photo.png',{type:'image/png'})]})).rejects.toThrow('Database unavailable');
    expect(backend.storage.deleteFile).toHaveBeenCalledWith('images','new-image');
  });

  it('does not create an account if a legacy username is already registered', async () => {
    backend.functions.createExecution.mockResolvedValue({responseStatusCode:200,responseBody:'{"available":false}'});
    await expect(api.createUserAccount({username:'owner',email:'new@example.com',password:'password123'})).rejects.toThrow('That username is already taken.');
    expect(backend.account.create).not.toHaveBeenCalled();
  });

  it('uses the current website for email recovery and hides unknown email errors', async () => {
    backend.account.createRecovery.mockRejectedValueOnce({code:404});
    await expect(api.requestPasswordRecovery(' Owner@Example.com ')).resolves.toBeUndefined();
    expect(backend.account.createRecovery).toHaveBeenCalledWith('owner@example.com',window.location.origin + '/reset-password');
    backend.account.createRecovery.mockRejectedValueOnce({code:429});
    await expect(api.requestPasswordRecovery('owner@example.com')).rejects.toEqual({code:429});
  });

  it('completes recovery with the emailed credentials and new password', async () => {
    await api.resetPassword('owner','emailed-secret','newPassword123');
    expect(backend.account.updateRecovery).toHaveBeenCalledWith('owner','emailed-secret','newPassword123');
    await expect(api.resetPassword('','', 'short')).rejects.toThrow();
  });

  it('keeps the old image if updating a post fails', async () => {
    backend.databases.getDocument.mockResolvedValue(post);
    backend.storage.createFile.mockResolvedValue({$id:'new-image'});
    backend.databases.updateDocument.mockRejectedValue(new Error('Database unavailable'));
    await expect(api.UpdatePost({postId:'post-1',caption:'New caption',imageId:'old-image',imageUrl:'/original.png',file:[new File(['image'],'new.png',{type:'image/png'})]})).rejects.toThrow();
    expect(backend.storage.deleteFile).toHaveBeenCalledWith('images','new-image');
    expect(backend.storage.deleteFile).not.toHaveBeenCalledWith('images','old-image');
  });

  it('removes the old image only after a successful edit', async () => {
    backend.databases.getDocument.mockResolvedValue(post);
    backend.storage.createFile.mockResolvedValue({$id:'new-image'});
    backend.databases.updateDocument.mockResolvedValue({...post,imageId:'new-image'});
    await api.UpdatePost({postId:'post-1',caption:'New caption',imageId:'old-image',imageUrl:'/original.png',file:[new File(['image'],'new.png',{type:'image/png'})]});
    expect(backend.storage.deleteFile).toHaveBeenCalledWith('images','old-image');
    expect(backend.databases.updateDocument.mock.invocationCallOrder[0]).toBeLessThan(backend.storage.deleteFile.mock.invocationCallOrder[0]);
  });

  it('prevents editing a different author\'s post before uploading', async () => {
    backend.databases.getDocument.mockResolvedValue({...post,creator:'someone-else'});
    await expect(api.UpdatePost({postId:'post-1',caption:'New caption',imageId:'old-image',imageUrl:'/original.png',file:[]})).rejects.toThrow('own posts');
    expect(backend.storage.createFile).not.toHaveBeenCalled();
    expect(backend.databases.updateDocument).not.toHaveBeenCalled();
  });

  it('records only the current user\'s like without modifying the post', async () => {
    backend.databases.getDocument.mockResolvedValue(post);
    await api.likePost('post-1',['owner','someone-else']);
    expect(backend.databases.createDocument).toHaveBeenCalledWith('test-db','likes',expect.any(String),{user:'owner',post:'post-1'},['read("users")','delete("user:owner")']);
    expect(backend.databases.updateDocument).not.toHaveBeenCalled();
  });

  it('grants only the bookmark owner read/delete permission', async () => {
    backend.databases.getDocument.mockResolvedValue(post);
    backend.databases.createDocument.mockResolvedValue({$id:'save-1'});
    await api.savePost('post-1','owner');
    expect(backend.databases.createDocument).toHaveBeenCalledWith('test-db','saves',expect.any(String),{user:'owner',post:'post-1'},['read("user:owner")','delete("user:owner")']);
    await expect(api.savePost('post-1','someone-else')).rejects.toThrow('own bookmarks');
  });

  it('uses direct image viewing instead of paid transformations', () => {
    expect(api.getFilePreview('new-image')).toBe('https://example.com/files/new-image/view');
    expect(backend.storage.getFileView).toHaveBeenCalledWith('images','new-image');
  });

  it('hydrates creator and like data from separate tables', async () => {
    backend.databases.listDocuments.mockImplementation(async (_database, collection) => ({
      total:1, documents: collection === 'posts' ? [post] : collection === 'users' ? [profile] : [{...metadata,user:'member-2',post:'post-1'}],
    }));
    const result = await api.getRecentPosts();
    expect(result.documents[0].creator?.name).toBe('Owner');
    expect(result.documents[0].likes).toEqual([{$id:'member-2'}]);
  });
});
