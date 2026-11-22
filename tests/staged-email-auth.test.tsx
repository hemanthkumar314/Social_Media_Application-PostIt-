import {screen} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import * as api from '@/lib/appwrite/api';
import {renderApp} from './helpers';

vi.mock('@/lib/appwrite/features', () => ({emailAuthEnabled:false}));
beforeEach(() => vi.mocked(api.getCurrentUser).mockResolvedValue(undefined));

it('keeps existing username login visible while recovery is not deployed', async () => {
  renderApp('/sign-in');
  expect(await screen.findByLabelText('Username')).toBeTruthy();
  expect(screen.getByLabelText('Password')).toBeTruthy();
  expect(screen.queryByRole('link',{name:'Forgot password?'})).toBeNull();
  expect(screen.queryByLabelText('Email')).toBeNull();
});

it('does not create an email account before username authentication is deployed', async () => {
  renderApp('/sign-up');
  const button = await screen.findByRole('button',{name:'Email signup is not available yet'});
  expect(button.hasAttribute('disabled')).toBe(true);
  expect(screen.getByLabelText('Email')).toBeTruthy();
  expect(api.createUserAccount).not.toHaveBeenCalled();
});
