import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/appwrite/api';
import { useGetPosts } from '@/lib/react-query/queriesAndMutations';
import FileUploader from '@/components/shared/FileUploader';
import PostStats from '@/components/shared/PostStats';
import { document, queryWrapper, renderApp, testPost, testUser } from './helpers';

beforeEach(() => {
  vi.mocked(api.getCurrentUser).mockResolvedValue(testUser);
  vi.mocked(api.getUserById).mockResolvedValue(testUser);
  vi.mocked(api.getPostbyId).mockResolvedValue(testPost);
  vi.mocked(api.getRecentPosts).mockResolvedValue({total: 0, documents: []});
  vi.mocked(api.getInfinitePosts).mockResolvedValue({total: 0, documents: []});
});

describe('routing and authentication', () => {
  it('keeps sign-up accessible without a session or cookie fallback', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(undefined);
    renderApp('/sign-up');
    expect(await screen.findByRole('heading', {name: 'Create a new account'})).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/sign-up');
  });

  it('waits for session checking before displaying a private page', async () => {
    let finish!: (user: typeof testUser) => void;
    vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(resolve => {finish = resolve;}));
    renderApp('/create-post');
    expect(screen.queryByRole('heading', {name: 'Create Post'})).toBeNull();
    await act(async () => finish(testUser));
    expect(await screen.findByRole('heading', {name: 'Create Post'})).toBeTruthy();
  });

  it('redirects unauthenticated private routes to sign-in', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(undefined);
    renderApp('/saved');
    expect(await screen.findByRole('heading', {name: 'Login to your account'})).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/sign-in');
  });

  it('redirects signed-in users away from sign-in without a fallback cookie', async () => {
    renderApp('/sign-in');
    expect(await screen.findByRole('heading', {name: 'Home Feed'})).toBeTruthy();
  });

  it('returns to the requested private route after signing in', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(undefined).mockResolvedValue(testUser);
    vi.mocked(api.signInAccount).mockResolvedValue({$id: 'session-1'} as Awaited<ReturnType<typeof api.signInAccount>>);
    renderApp('/create-post');
    await user.type(await screen.findByLabelText('Username'), 'testuser');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', {name: 'Log in'}));
    expect(await screen.findByRole('heading', {name: 'Create Post'})).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/create-post');
  });

  it('preserves sign-in fields if session verification fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(api.signInAccount).mockResolvedValue({$id: 'session-1'} as Awaited<ReturnType<typeof api.signInAccount>>);
    renderApp('/sign-in');
    await user.type(await screen.findByLabelText('Username'), 'testuser');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', {name: 'Log in'}));
    expect(await screen.findByText('You signed in, but your profile could not load. Please try again.')).toBeTruthy();
    expect(screen.getByDisplayValue('testuser')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/sign-in');
  });

  it.each([
    [401,'Incorrect username or password. Please try again.'],
    [429,'Too many sign-in attempts. Please wait a few minutes and try again.'],
    [503,'Sign-in service is temporarily unavailable. Please try again shortly.'],
  ])('shows a useful sign-in error for status %s',async(code,message)=>{
    const user=userEvent.setup();
    vi.mocked(api.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(api.signInAccount).mockRejectedValue({code});
    renderApp('/sign-in');
    await user.type(await screen.findByLabelText('Username'),'testuser');
    await user.type(screen.getByLabelText('Password'),'password123');
    await user.click(screen.getByRole('button',{name:'Log in'}));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByDisplayValue('testuser')).toBeTruthy();
  });

  it('does not sign in when account creation returns an error', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(api.createUserAccount).mockResolvedValue(new Error('Unavailable project'));
    renderApp('/sign-up');
    await user.type(await screen.findByLabelText('Username'), 'testuser');
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');
    await user.click(screen.getByRole('button', {name: 'Sign up'}));
    expect(await screen.findByText('Sign up failed. Please try again')).toBeTruthy();
    expect(api.signInAccount).not.toHaveBeenCalled();
  });

  it('opens the liked-posts tab directly', async () => {
    renderApp('/profile/user-1/liked-posts');
    expect(await screen.findByText('No liked posts')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/profile/user-1/liked-posts');
  });

  it('prevents editing another user\'s profile', async () => {
    vi.mocked(api.getUserById).mockResolvedValue(document({...testUser, $id: 'someone-else'}));
    renderApp('/update-profile/someone-else');
    expect(await screen.findByText('You can only edit your own profile.')).toBeTruthy();
    expect(api.updateUser).not.toHaveBeenCalled();
  });

  it('opens your own profile from the header while the feed shows another creator', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getRecentPosts).mockResolvedValue({total:1,documents:[document({...testPost,
      caption:'Demo Avengers fan art',creator:document({...testUser,$id:'demo-creator',name:'Reel Club (Demo)'})})]});
    renderApp('/');
    expect(await screen.findByText('Demo Avengers fan art')).toBeTruthy();
    await user.click(within(screen.getByRole('banner')).getByRole('link',{name:'Your profile'}));
    expect(await screen.findByRole('heading',{name:testUser.name})).toBeTruthy();
    expect(api.getUserById).toHaveBeenCalledWith(testUser.$id);
    expect(screen.queryByText('Demo Avengers fan art')).toBeNull();
  });
});

describe('PostIt signup', () => {
  beforeEach(() => vi.mocked(api.getCurrentUser).mockResolvedValue(undefined));

  it('shows username, recovery email, and password fields with the requested copy', async () => {
    const user = userEvent.setup();
    renderApp('/sign-up');
    const username = await screen.findByPlaceholderText('Enter username');
    expect(screen.getByText('To use PostIt, Account first Posts Next')).toBeTruthy();
    expect(screen.getByRole('img',{name:'PostIt'})).toBeTruthy();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.getByLabelText('Email').getAttribute('type')).toBe('email');
    expect(screen.getByLabelText('Confirm password')).toBeTruthy();
    await user.type(username,'new_user');
    expect((username as HTMLInputElement).value).toBe('new_user');
  });

  it('toggles each password independently without submitting the form', async () => {
    const user = userEvent.setup();
    renderApp('/sign-up');
    const password = await screen.findByLabelText('Password',{exact:true});
    const confirmation = screen.getByLabelText('Confirm password',{exact:true});
    await user.type(password,'password123');
    await user.type(confirmation,'password123');
    expect(password.getAttribute('type')).toBe('password');
    await user.click(screen.getByRole('button',{name:'Show password',exact:true}));
    expect(password.getAttribute('type')).toBe('text');
    expect(confirmation.getAttribute('type')).toBe('password');
    await user.click(screen.getByRole('button',{name:'Show confirm password',exact:true}));
    expect(confirmation.getAttribute('type')).toBe('text');
    await user.click(screen.getByRole('button',{name:'Hide password',exact:true}));
    expect(password.getAttribute('type')).toBe('password');
    expect(api.createUserAccount).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords before calling Appwrite', async () => {
    const user = userEvent.setup();
    renderApp('/sign-up');
    await user.type(await screen.findByLabelText('Username'),'new_user');
    await user.type(screen.getByLabelText('Email'),'new@example.com');
    await user.type(screen.getByLabelText('Password',{exact:true}),'password123');
    await user.type(screen.getByLabelText('Confirm password',{exact:true}),'different123');
    await user.click(screen.getByRole('button',{name:'Sign up',exact:true}));
    expect(await screen.findByText('Passwords do not match.')).toBeTruthy();
    expect(api.createUserAccount).not.toHaveBeenCalled();
  });

  it('submits normalized credentials without sending confirm password', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createUserAccount).mockResolvedValue(new Error('Unavailable project'));
    renderApp('/sign-up');
    await user.type(await screen.findByLabelText('Username'),'New_User');
    await user.type(screen.getByLabelText('Email'),'New@Example.com');
    await user.type(screen.getByLabelText('Password',{exact:true}),'password123');
    await user.type(screen.getByLabelText('Confirm password',{exact:true}),'password123');
    await user.click(screen.getByRole('button',{name:'Sign up',exact:true}));
    await waitFor(() => expect(api.createUserAccount).toHaveBeenCalledWith({username:'new_user',email:'new@example.com',password:'password123'}));
  });
});

describe('email password recovery', () => {
  beforeEach(() => vi.mocked(api.getCurrentUser).mockResolvedValue(undefined));

  it('keeps username login and links to email recovery', async () => {
    const user = userEvent.setup();
    renderApp('/sign-in');
    expect(await screen.findByLabelText('Username')).toBeTruthy();
    expect(screen.queryByLabelText('Email')).toBeNull();
    await user.click(screen.getByRole('link',{name:'Forgot password?'}));
    expect(await screen.findByRole('heading',{name:'Forgot password?'})).toBeTruthy();
  });
  it('requests recovery and displays a neutral confirmation', async () => {
    const user = userEvent.setup();
    renderApp('/forgot-password');
    await user.type(await screen.findByLabelText('Email'),'Owner@Example.com');
    await user.click(screen.getByRole('button',{name:'Send reset link'}));
    await waitFor(() => expect(api.requestPasswordRecovery).toHaveBeenCalledWith('owner@example.com'));
    expect((await screen.findByText(/If an account uses that email/)).getAttribute('role')).toBe('status');
  });
  it('removes recovery credentials from the URL and resets only matching passwords', async () => {
    const user = userEvent.setup();
    renderApp('/reset-password?userId=owner&secret=test-secret');
    const password = await screen.findByLabelText('New password');
    expect(screen.getByTestId('location').textContent).toBe('/reset-password');
    await user.type(password,'password123');
    await user.type(screen.getByLabelText('Confirm password'),'different123');
    await user.click(screen.getByRole('button',{name:'Reset password',exact:true}));
    expect(await screen.findByText('Passwords do not match.')).toBeTruthy();
    expect(api.resetPassword).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'),'password123');
    await user.click(screen.getByRole('button',{name:'Reset password',exact:true}));
    await waitFor(() => expect(api.resetPassword).toHaveBeenCalledWith('owner','test-secret','password123'));
    expect(await screen.findByText(/Your password has been reset/)).toBeTruthy();
  });
  it('handles incomplete and expired recovery links', async () => {
    const user = userEvent.setup();
    vi.mocked(api.resetPassword).mockRejectedValue(new Error('Expired'));
    const {unmount} = renderApp('/reset-password');
    expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('incomplete'));
    expect(screen.queryByRole('button',{name:'Reset password',exact:true})).toBeNull();
    unmount();
    renderApp('/reset-password?userId=owner&secret=expired');
    await user.type(await screen.findByLabelText('New password'),'password123');
    await user.type(screen.getByLabelText('Confirm password'),'password123');
    await user.click(screen.getByRole('button',{name:'Reset password',exact:true}));
    expect(await screen.findByText(/invalid or expired/)).toBeTruthy();
  });
});

describe('search and pagination', () => {
  it('renders matching search results after typing', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getSearchPosts).mockResolvedValue({total: 1, documents: [testPost]});
    renderApp('/explore');
    await user.type(await screen.findByRole('textbox', {name: 'Search posts'}), '  photo  ');
    await waitFor(() => expect(screen.getByRole('link', {name: 'post'}).getAttribute('href')).toBe('/posts/post-1'));
    expect(api.getSearchPosts).toHaveBeenLastCalledWith('photo');
  });

  it('shows search errors instead of an empty result or permanent spinner', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getSearchPosts).mockResolvedValue(undefined);
    renderApp('/explore');
    await user.type(await screen.findByRole('textbox', {name: 'Search posts'}), 'missing');
    expect(await screen.findByText('Unable to search posts. Please try again.')).toBeTruthy();
  });

  it('uses string cursors and stops when the final page is loaded', async () => {
    const firstPage = Array.from({length: 10}, (_, index) => document({$id: `post-${index}`}));
    vi.mocked(api.getInfinitePosts)
      .mockResolvedValueOnce({total: 11, documents: firstPage})
      .mockResolvedValueOnce({total: 11, documents: [document({$id: 'last-post'})]});
    const {result} = renderHook(useGetPosts, {wrapper: queryWrapper()});
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => {await result.current.fetchNextPage();});
    expect(api.getInfinitePosts).toHaveBeenNthCalledWith(1, {pageParam: undefined});
    expect(api.getInfinitePosts).toHaveBeenNthCalledWith(2, {pageParam: 'post-9'});
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });
});

describe('forms', () => {
  it('waits for an edit to finish and keeps the form open on failure', async () => {
    const user = userEvent.setup();
    let finish!: (value: undefined) => void;
    vi.mocked(api.UpdatePost).mockReturnValue(new Promise(resolve => {finish = resolve;}));
    renderApp('/update-post/post-1');
    await user.click(await screen.findByRole('button', {name: 'Update Post'}));
    await waitFor(() => expect(api.UpdatePost).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('location').textContent).toBe('/update-post/post-1');
    expect(screen.getByRole('button', {name: 'Saving...'}).hasAttribute('disabled')).toBe(true);
    await act(async () => finish(undefined));
    expect(await screen.findByText('Unable to update the post. Please try again.')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/update-post/post-1');
  });

  it('navigates to the post after a successful edit', async () => {
    const user = userEvent.setup();
    vi.mocked(api.UpdatePost).mockResolvedValue(testPost);
    renderApp('/update-post/post-1');
    await user.click(await screen.findByRole('button', {name: 'Update Post'}));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/posts/post-1'));
  });

  it('requires a photo when creating a post', async () => {
    const user = userEvent.setup();
    renderApp('/create-post');
    await user.type(await screen.findByLabelText('Caption'), 'A new photo');
    await user.type(screen.getByLabelText('Add Location'), 'Bengaluru');
    await user.click(screen.getByRole('button', {name: 'Create Post'}));
    expect(await screen.findByText('Please select a photo.')).toBeTruthy();
    expect(api.createPost).not.toHaveBeenCalled();
  });

  it('keeps new posts open when creation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createPost).mockResolvedValue(undefined);
    renderApp('/create-post');
    await user.type(await screen.findByLabelText('Caption'), 'A new photo');
    await user.type(screen.getByLabelText('Add Location'), 'Bengaluru');
    await user.upload(screen.getByLabelText('Upload post photo'), new File(['photo'], 'photo.png', {type: 'image/png'}));
    await user.click(screen.getByRole('button', {name: 'Create Post'}));
    expect(await screen.findByText('Unable to create the post. Please try again.')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/create-post');
  });

  it('cancels an edit without saving it', async () => {
    const user = userEvent.setup();
    renderApp('/update-post/post-1');
    await user.click(await screen.findByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/posts/post-1'));
    expect(api.UpdatePost).not.toHaveBeenCalled();
  });

  it('keeps profile editing open when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateUser).mockResolvedValue(undefined);
    renderApp('/update-profile/user-1');
    await user.click(await screen.findByRole('button', {name: 'Update Profile'}));
    expect(await screen.findByText('Update user failed. Please try again.')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/update-profile/user-1');
  });

  it('keeps an edit open when the save request rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(api.UpdatePost).mockRejectedValue(new Error('Request failed'));
    renderApp('/update-post/post-1');
    await user.click(await screen.findByRole('button', {name: 'Update Post'}));
    expect(await screen.findByText('Unable to save the post. Please try again.')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/update-post/post-1');
  });
});

describe('saved posts and likes', () => {
  it('preserves the original creator on saved posts and ignores removed posts', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(document({...testUser, save: [
      document({post: document({...testPost, creator: document({name: 'Original creator', imageUrl: '/original.png'})})}),
      document({post: null}),
    ]}));
    renderApp('/saved');
    expect(await screen.findByText('Original creator')).toBeTruthy();
    expect(screen.getByRole('img', {name: 'creator'}).getAttribute('src')).toBe('/original.png');
  });

  it('renders missing relationship arrays safely', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(document({...testUser, save: undefined}));
    const Wrapper = queryWrapper();
    render(<Wrapper><PostStats post={document({likes: undefined})} userId="user-1" /></Wrapper>);
    expect(screen.getByText('0')).toBeTruthy();
    await waitFor(() => expect(api.getCurrentUser).toHaveBeenCalled());
  });

  it('rolls back an optimistic like when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.likePost).mockResolvedValue(undefined);
    const Wrapper = queryWrapper();
    render(<Wrapper><PostStats post={testPost} userId="user-1" /></Wrapper>);
    await user.click(screen.getByRole('button', {name: 'Like post'}));
    await waitFor(() => expect(api.likePost).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', {name: 'Like post'}).getAttribute('aria-pressed')).toBe('false'));
    expect(screen.getByText('0')).toBeTruthy();
  });
});

describe('image upload', () => {
  it('does not submit the form when opening the file picker', async () => {
    const user = userEvent.setup();
    const submit = vi.fn(event => event.preventDefault());
    render(<form onSubmit={submit}><FileUploader id="photo" fieldChange={vi.fn()} /></form>);
    await user.click(screen.getByRole('button', {name: 'select from computer'}));
    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects unsupported files without changing the selected photo', async () => {
    const user = userEvent.setup({applyAccept: false});
    const change = vi.fn();
    render(<FileUploader id="photo" fieldChange={change} />);
    await user.upload(screen.getByLabelText('Upload post photo'), new File(['text'], 'file.txt', {type: 'text/plain'}));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(change).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('releases image previews on replacement and unmount', async () => {
    const user = userEvent.setup();
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    const {unmount} = render(<FileUploader id="photo" fieldChange={vi.fn()} />);
    await user.upload(screen.getByLabelText('Upload post photo'), new File(['first'], 'first.png', {type: 'image/png'}));
    await user.upload(screen.getByLabelText('Upload post photo'), new File(['second'], 'second.png', {type: 'image/png'}));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second');
  });
});
