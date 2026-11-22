import type { Models } from 'appwrite';

export type ProfileRecord = Models.Document & {
  accountId: string;
  name: string;
  username: string;
  bio?: string;
  imageUrl: string;
  imageId?: string;
};

export type PostRecord = Models.Document & {
  creator: string;
  caption: string;
  imageUrl: string;
  imageId: string;
  location?: string;
  tags?: string[];
};

export type InteractionRecord = Models.Document & { user: string; post: string };

export type HydratedPost = Models.Document & {
  caption: string;
  imageUrl: string;
  imageId: string;
  location?: string;
  tags: string[];
  creator: ProfileRecord | null;
  likes: { $id: string }[];
};
