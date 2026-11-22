import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Models } from 'appwrite';
import { render } from '@testing-library/react';
import AuthProvider from '@/context/AuthContext';
import App from '@/App';

export function document(fields: Record<string, unknown> = {}): Models.Document {
  return {
    $id: 'post-1', $collectionId: 'test', $databaseId: 'test',
    $createdAt: '2026-11-22T10:00:00Z', $updatedAt: '2026-11-22T10:00:00Z',
    $permissions: [], ...fields,
  };
}

export const testUser = document({
  $id: 'user-1', accountId: 'account-1', name: 'Hemanth', username: 'hemanth',
  email: 'test@example.com', imageUrl: '/profile.png', bio: 'Hello',
  posts: [], liked: [], save: [],
});

export const testPost = document({
  caption: 'An existing photo', location: 'Bengaluru', tags: ['photo'],
  imageUrl: '/photo.png', imageId: 'image-1', creator: testUser, likes: [],
});

export function queryWrapper() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: 0}, mutations: {retry: false}}});
  return function Wrapper({ children }: {children: ReactNode}) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

export function renderApp(path: string) {
  const Wrapper = queryWrapper();
  return render(<Wrapper><MemoryRouter initialEntries={[path]} future={{v7_startTransition: true, v7_relativeSplatPath: true}}><AuthProvider><LocationProbe /><App /></AuthProvider></MemoryRouter></Wrapper>);
}
