import {beforeEach,describe,expect,it,vi} from 'vitest';

const backend=vi.hoisted(()=>({account:{createEmailPasswordSession:vi.fn()}}));
vi.mock('@/lib/appwrite/config',()=>({...backend,appwriteConfig:{projectId:'test-project',url:'https://appwrite.test/v1'}}));
import {clearFallbackSession,establishBrowserSession,normalizeFallbackSession} from '@/lib/appwrite/session';

const response=(status:number,email?:unknown)=>({ok:status<400,status,json:async()=>({email})} as Response);
beforeEach(()=>backend.account.createEmailPasswordSession.mockReset());

describe('browser session handoff',()=>{
  it('omits old cookies during handoff, closes the temporary session, and preserves other projects',async()=>{
    localStorage.setItem('cookieFallback',JSON.stringify({'a_session_test-project':'expired','a_session_other-project':'other-session'}));
    vi.mocked(fetch).mockResolvedValueOnce(response(200,'member@example.com')).mockResolvedValueOnce(response(204));
    backend.account.createEmailPasswordSession.mockImplementation(async()=>{
      expect(JSON.parse(localStorage.getItem('cookieFallback')!)).toEqual({'a_session_other-project':'other-session'});
      return {$id:'browser-session'};
    });
    expect(await establishBrowserSession('temporary-session','password123')).toEqual({$id:'browser-session'});
    for(const [,options] of vi.mocked(fetch).mock.calls){
      expect(options?.credentials).toBe('omit');
      expect(options?.headers).toEqual({'X-Appwrite-Project':'test-project','X-Fallback-Cookies':'{"a_session_test-project":"temporary-session"}'});
    }
    expect(backend.account.createEmailPasswordSession).toHaveBeenCalledWith('member@example.com','password123');
    expect(localStorage.getItem('cookieFallback')).not.toContain('temporary-session');
  });
  it('closes a rejected temporary session without attempting a browser login',async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(401));
    await expect(establishBrowserSession('invalid-session','password123')).rejects.toMatchObject({code:401});
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(backend.account.createEmailPasswordSession).not.toHaveBeenCalled();
  });
  it('fails closed if the authenticated response has no email',async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(response(200,null)).mockResolvedValueOnce(response(204));
    await expect(establishBrowserSession('temporary-session','password123')).rejects.toMatchObject({code:503});
    expect(backend.account.createEmailPasswordSession).not.toHaveBeenCalled();
  });
  it('does not create another session when temporary-session cleanup fails',async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(response(200,'member@example.com')).mockResolvedValueOnce(response(503));
    await expect(establishBrowserSession('temporary-session','password123')).rejects.toMatchObject({code:503});
    expect(backend.account.createEmailPasswordSession).not.toHaveBeenCalled();
  });
  it('preserves an earlier authentication error if cleanup also fails',async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(503));
    await expect(establishBrowserSession('invalid-session','password123')).rejects.toMatchObject({code:401});
    expect(backend.account.createEmailPasswordSession).not.toHaveBeenCalled();
  });
  it('recovers from malformed storage rather than throwing during sign-in',()=>{
    for(const raw of ['not json','null','[]']){
      localStorage.setItem('cookieFallback',raw);
      expect(()=>normalizeFallbackSession()).not.toThrow();
      expect(localStorage.getItem('cookieFallback')).toBe('{}');
    }
  });
  it('clears only this project’s current and legacy fallback sessions',()=>{
    localStorage.setItem('cookieFallback',JSON.stringify({'a_session_test-project':'expired','a_session_test-project_legacy':'legacy','a_session_other-project':'keep'}));
    clearFallbackSession();
    expect(JSON.parse(localStorage.getItem('cookieFallback')!)).toEqual({'a_session_other-project':'keep'});
  });
  it('normalizes invalid cookie values before the SDK sends them',()=>{
    localStorage.setItem('cookieFallback',JSON.stringify({'a_session_test-project':42,'a_session_other-project':'keep'}));
    normalizeFallbackSession();
    expect(JSON.parse(localStorage.getItem('cookieFallback')!)).toEqual({'a_session_other-project':'keep'});
  });
});
