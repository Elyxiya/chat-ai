export type UserOverrides = Partial<{
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  nickname: string | null;
  avatarUrl: string | null;
  bio: string | null;
  userType: string;
  status: string;
  lastSeenAt: Date | null;
  createdAt: Date;
}>;

export function makeUser(overrides: UserOverrides = {}): any {
  const now = new Date();
  return {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '$2a$12$hashedpassword',
    nickname: 'Test User',
    avatarUrl: null,
    bio: null,
    userType: 'human',
    status: 'offline',
    lastSeenAt: null,
    createdAt: now,
    ...overrides,
  };
}

export type SessionOverrides = Partial<{
  id: string;
  sessionType: string;
  name: string | null;
  description: string | null;
  ownerId: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  members: any[];
  owner: any;
}>;

export function makeSession(overrides: SessionOverrides = {}): any {
  const now = new Date();
  return {
    id: 'session-1',
    sessionType: 'private',
    name: null,
    description: null,
    ownerId: 'user-1',
    isPublic: false,
    createdAt: now,
    updatedAt: now,
    members: [],
    owner: null,
    ...overrides,
  };
}

export type MessageOverrides = Partial<{
  id: string;
  sessionId: string;
  senderId: string | null;
  content: string;
  contentType: string;
  metadata: Record<string, any> | null;
  isRecalled: boolean;
  recalledAt: Date | null;
  recalledById: string | null;
  replyToId: string | null;
  isPinned: boolean;
  createdAt: Date;
  sender: any;
  reactions: any[];
}>;

export function makeMessage(overrides: MessageOverrides = {}): any {
  const now = new Date();
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    senderId: 'user-1',
    content: 'Hello world',
    contentType: 'text',
    metadata: null,
    isRecalled: false,
    recalledAt: null,
    recalledById: null,
    replyToId: null,
    isPinned: false,
    createdAt: now,
    sender: { id: 'user-1', username: 'testuser', avatarUrl: null, nickname: null },
    reactions: [],
    ...overrides,
  };
}

export type SessionMemberOverrides = Partial<{
  sessionId: string;
  userId: string;
  role: string;
  nickname: string | null;
  joinedAt: Date;
  lastReadAt: Date | null;
  user: any;
}>;

export function makeSessionMember(overrides: SessionMemberOverrides = {}): any {
  const now = new Date();
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    role: 'owner',
    nickname: null,
    joinedAt: now,
    lastReadAt: null,
    user: makeUser(),
    ...overrides,
  };
}

export type NotificationOverrides = Partial<{
  id: string;
  userId: string;
  type: string;
  title: string | null;
  content: string | null;
  data: Record<string, any> | null;
  isRead: boolean;
  createdAt: Date;
}>;

export function makeNotification(overrides: NotificationOverrides = {}): any {
  const now = new Date();
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'system',
    title: 'Test Notification',
    content: 'This is a test',
    data: null,
    isRead: false,
    createdAt: now,
    ...overrides,
  };
}

export type KnowledgeBaseOverrides = Partial<{
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isPublic: boolean;
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  createdAt: Date;
  updatedAt: Date;
  owner: any;
  _count: any;
}>;

export function makeKnowledgeBase(overrides: KnowledgeBaseOverrides = {}): any {
  const now = new Date();
  return {
    id: 'kb-1',
    name: 'Test Knowledge Base',
    description: null,
    ownerId: 'user-1',
    isPublic: false,
    chunkSize: 500,
    chunkOverlap: 50,
    embeddingModel: 'deepseek-embed',
    createdAt: now,
    updatedAt: now,
    owner: { id: 'user-1', username: 'testuser', avatarUrl: null },
    _count: { documents: 0, chunks: 0 },
    ...overrides,
  };
}

export type KnowledgeDocumentOverrides = Partial<{
  id: string;
  kbId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: string;
  totalChunks: number;
  processedChunks: number;
  createdAt: Date;
}>;

export function makeKnowledgeDocument(overrides: KnowledgeDocumentOverrides = {}): any {
  const now = new Date();
  return {
    id: 'doc-1',
    kbId: 'kb-1',
    fileName: 'test.txt',
    fileSize: 1024,
    fileType: 'text/plain',
    status: 'completed',
    totalChunks: 3,
    processedChunks: 3,
    createdAt: now,
    ...overrides,
  };
}

export type AgentMemoryOverrides = Partial<{
  id: string;
  userId: string;
  sessionId: string | null;
  memoryType: string;
  content: any;
  importanceScore: number;
  accessCount: number;
  createdAt: Date;
  expiresAt: Date | null;
}>;

export function makeAgentMemory(overrides: AgentMemoryOverrides = {}): any {
  const now = new Date();
  return {
    id: 'mem-1',
    userId: 'user-1',
    sessionId: null,
    memoryType: 'episodic',
    content: { summary: 'Test memory' },
    importanceScore: 0.7,
    accessCount: 0,
    createdAt: now,
    expiresAt: null,
    ...overrides,
  };
}

export type RefreshTokenOverrides = Partial<{
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  user: any;
}>;

export function makeRefreshToken(overrides: RefreshTokenOverrides = {}): any {
  const now = new Date();
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    id: 'token-1',
    userId: 'user-1',
    tokenHash: 'hashed-token',
    expiresAt: futureDate,
    revokedAt: null,
    createdAt: now,
    user: makeUser(),
    ...overrides,
  };
}

export type FriendshipOverrides = Partial<{
  id: string;
  userId: string;
  friendId: string;
  status: string;
  createdAt: Date;
  user: any;
  friend: any;
}>;

export function makeFriendship(overrides: FriendshipOverrides = {}): any {
  const now = new Date();
  return {
    id: 'friend-1',
    userId: 'user-1',
    friendId: 'user-2',
    status: 'pending',
    createdAt: now,
    user: makeUser({ id: 'user-1', username: 'testuser' }),
    friend: makeUser({ id: 'user-2', username: 'frienduser' }),
    ...overrides,
  };
}
