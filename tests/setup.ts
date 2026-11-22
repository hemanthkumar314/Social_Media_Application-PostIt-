import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Exercise the prepared email-auth UI without deploying its Appwrite function.
vi.mock('@/lib/appwrite/features', () => ({emailAuthEnabled:true}));

// Every backend operation is mocked. These tests never use the old Appwrite project.
vi.mock('@/lib/appwrite/api', () => ({
  createPost: vi.fn(), createUserAccount: vi.fn(), deletePost: vi.fn(),
  deleteSavedPost: vi.fn(), getCurrentUser: vi.fn(), getInfinitePosts: vi.fn(),
  getPostbyId: vi.fn(), getRecentPosts: vi.fn(), getSearchPosts: vi.fn(),
  getUserById: vi.fn(), likePost: vi.fn(), savePost: vi.fn(),
  signInAccount: vi.fn(), signOutAccount: vi.fn(), UpdatePost: vi.fn(), updateUser: vi.fn(),
  requestPasswordRecovery: vi.fn(), resetPassword: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Unexpected network request in frontend test'))));
  URL.createObjectURL = vi.fn(() => 'blob:test-image');
  URL.revokeObjectURL = vi.fn();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
