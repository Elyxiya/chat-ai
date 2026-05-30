export interface User {
  id: string;
  username: string;
  email: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  role?: string;
  userType: 'human' | 'bot' | 'agent';
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeenAt?: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  sessionType: 'private' | 'group' | 'channel' | 'agent';
  name?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  ownerId?: string | null;
  isPublic: boolean;
  myRole?: string;
  myNickname?: string | null;
  pinnedAt?: string | null;
  lastReadAt?: string | null;
  lastMessage?: ChatMessage | null;
  unreadCount: number;
  members: SessionMember[];
  _count?: { members: number; messages: number };
  createdAt: string;
  updatedAt: string;
}

export interface SessionMember {
  userId?: string;
  role: string;
  nickname?: string | null;
  user: Pick<User, 'id' | 'username' | 'avatarUrl' | 'status' | 'nickname'>;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string | null;
  content: string;
  contentType: MessageType;
  metadata: Record<string, any>;
  isRecalled: boolean;
  recalledAt?: string | null;
  replyToId?: string | null;
  isPinned: boolean;
  editCount?: number;
  createdAt: string;
  updatedAt: string;
  sender?: Pick<User, 'id' | 'username' | 'avatarUrl' | 'nickname'> | null;
  reactions?: MessageReaction[];
  replyTo?: Pick<ChatMessage, 'id' | 'content' | 'contentType' | 'sender'> | null;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'file'
  | 'audio'
  | 'video'
  | 'ai_response'
  | 'system'
  | 'emoji'
  | 'code';

export interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  messageId: string;
  createdAt: string;
}

export interface AgentMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  type: 'final' | 'reasoning' | 'error' | 'tool_call' | 'max_steps';
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  success?: boolean;
  error?: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string | null;
  ownerId?: string | null;
  isPublic: boolean;
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number; chunks: number };
}

export interface KnowledgeDocument {
  id: string;
  kbId: string;
  fileName: string;
  fileSize?: number | null;
  fileType?: string | null;
  fileUrl?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalChunks: number;
  processedChunks: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export enum WsMessageType {
  LOGIN = 0,
  PING = 1,
  TEXT = 2,
  IMAGE = 3,
  FILE = 4,
  AUDIO = 5,
  VIDEO = 6,
  RECALL = 7,
  TYPING = 8,
  AT = 9,
  READ = 10,
  NOTICE = 11,
  AI_CHAT = 12,
}

// ==================== WebRTC Call Types ====================

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected';

export type CallType = 'audio' | 'video';

export interface CallPeer {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

export interface CallOfferData {
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  sdp: any;
  callType: CallType;
}

export interface CallAnswerData {
  calleeId: string;
  calleeName: string;
  sdp: any;
}

export interface CallIceCandidateData {
  userId: string;
  candidate: any;
}

export interface CallEndedData {
  userId: string;
  reason: 'hangup' | 'reject' | 'offline';
}

export interface CallToggleData {
  userId: string;
  type: 'audio' | 'video';
  enabled: boolean;
}
