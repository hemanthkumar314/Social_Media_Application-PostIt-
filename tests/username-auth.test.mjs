import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createHandler} from '../appwrite/functions/username-auth/src/main.js';

const fetchImpl = vi.fn();
const handler = createHandler({endpoint:'https://appwrite.test/v1', projectId:'test-project', fetchImpl});
const response = (data, status = 200, headers = {}) => ({ok: status < 400, status,
  json: async () => data, headers: {get: key => headers[key] ?? null}});
const invoke = body => handler({req:{method:'POST',bodyText:JSON.stringify(body),headers:{'x-appwrite-key':'runtime-test-key'}},
  res:{json:(body,status,headers) => ({body,status,headers})}});
const member = {$id:'u_owner',name:'owner',status:true,email:'private@example.com',prefs:{username:'owner'}};
beforeEach(() => fetchImpl.mockReset());

describe('private username authentication function', () => {
  it('validates the password without the admin key and returns only the session', async () => {
    fetchImpl.mockResolvedValueOnce(response(member)).mockResolvedValueOnce(response({},201,{'set-cookie':'a_session_test-project=session-secret; Path=/; Secure; HttpOnly'}));
    const result = await invoke({action:'login',username:'OWNER',password:'password123'});
    expect(result).toEqual({status:200,body:{session:'session-secret'},headers:{'cache-control':'no-store'}});
    expect(fetchImpl.mock.calls[0][1].headers['X-Appwrite-Key']).toBe('runtime-test-key');
    const login = fetchImpl.mock.calls[1];
    expect(login[0]).toBe('https://appwrite.test/v1/account/sessions/email');
    expect(login[1].headers).not.toHaveProperty('X-Appwrite-Key');
    expect(JSON.parse(login[1].body)).toEqual({email:'private@example.com',password:'password123'});
    expect(JSON.stringify(result)).not.toContain('private@example.com');
  });
  it('accepts Appwrite fallback cookies', async () => {
    fetchImpl.mockResolvedValueOnce(response(member)).mockResolvedValueOnce(response({},201,{'x-fallback-cookies':'{"a_session_test-project":"fallback-secret"}'}));
    expect((await invoke({action:'login',username:'owner',password:'password123'})).body).toEqual({session:'fallback-secret'});
  });
  it('resolves legacy accounts without exposing their non-deliverable email', async () => {
    fetchImpl.mockResolvedValueOnce(response({},404)).mockResolvedValueOnce(response({users:[{...member,$id:'random-id',email:'owner@users.postit.invalid'}]}))
      .mockResolvedValueOnce(response({},201,{'set-cookie':'a_session_test-project=legacy-secret; Path=/'}));
    expect((await invoke({action:'login',username:'owner',password:'password123'})).body).toEqual({session:'legacy-secret'});
    expect(fetchImpl.mock.calls[1][0].searchParams.getAll('queries[]')[0]).toContain('owner');
  });
  it('does not authenticate blocked users', async () => {
    fetchImpl.mockResolvedValueOnce(response({...member,status:false}));
    expect((await invoke({action:'login',username:'owner',password:'password123'})).status).toBe(401);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('preserves native password rate limits', async () => {
    fetchImpl.mockResolvedValueOnce(response(member)).mockResolvedValueOnce(response({message:'Private upstream details'},429));
    expect(await invoke({action:'login',username:'owner',password:'password123'})).toMatchObject({status:429,body:{message:'Try again later.'}});
  });
  it('checks availability across new and legacy accounts without returning user data', async () => {
    fetchImpl.mockResolvedValueOnce(response(member));
    expect((await invoke({action:'availability',username:'owner'})).body).toEqual({available:false});
    fetchImpl.mockResolvedValueOnce(response({},404)).mockResolvedValueOnce(response({users:[]}));
    expect((await invoke({action:'availability',username:'new_user'})).body).toEqual({available:true});
  });
  it('fails closed on invalid input and upstream failures', async () => {
    expect((await invoke(null)).status).toBe(400);
    expect((await invoke([])).status).toBe(400);
    expect((await invoke({action:'login',username:'../owner',password:'password123'})).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    fetchImpl.mockRejectedValueOnce(new Error('Contains private upstream details'));
    expect((await invoke({action:'login',username:'owner',password:'password123'}))).toMatchObject({status:503,body:{message:'Authentication is temporarily unavailable.'}});
  });
});
