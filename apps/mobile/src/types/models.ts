export type MiniappUser = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  gender: "private" | "male" | "female" | null;
  status: "active" | "disabled";
  createdAt: string;
};

export type MiniappProfile = MiniappUser & {
  stats: { followingCount: number; followerCount: number; receivedLikeCount: number };
  isSelf: boolean;
  isFollowing: boolean;
  nicknameChange?: { remaining: number; resetAt: string | null };
};

export type Post = {
  id: string;
  user: { id: string; nickname: string; avatarUrl: string | null };
  circle: { id: string; name: string };
  category: { id: string; name: string; code: string };
  contentType: "TEXT" | "IMAGE_TEXT" | "VIDEO";
  content: string;
  status: "published" | "hidden";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  media: { id: string; type: "IMAGE" | "VIDEO"; url: string; sortOrder: number }[];
};

export type Comment = {
  id: string;
  post: { id: string; content: string; circleName: string };
  user: { id: string; nickname: string; avatarUrl: string | null };
  content: string;
  status: "published" | "hidden";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Category = { id: string; name: string; code: string; sortOrder: number };
export type Paginated<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type DemoLoginResponse = { accessToken: string; expiresIn: number; user: MiniappUser };
