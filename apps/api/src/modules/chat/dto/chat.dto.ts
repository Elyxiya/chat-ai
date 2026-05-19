import { IsString, IsOptional, IsArray, IsEnum, IsBoolean, IsNumber, IsObject, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSessionDto {
  @ApiProperty({ enum: ['private', 'group', 'channel', 'agent'] })
  @IsEnum(['private', 'group', 'channel', 'agent'])
  sessionType: 'private' | 'group' | 'channel' | 'agent';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  memberIds?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class UpdateSessionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(10000, { message: 'Message content exceeds maximum length of 10000 characters' })
  content: string;

  @ApiPropertyOptional({ enum: ['text', 'image', 'file', 'audio', 'video', 'ai_response', 'system'] })
  @IsEnum(['text', 'image', 'file', 'audio', 'video', 'ai_response', 'system'])
  @IsOptional()
  contentType?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentions?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  replyToId?: string;
}

export class RecallMessageDto {
  @ApiProperty()
  @IsString()
  messageId: string;
}

export class ReadReceiptDto {
  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsString()
  lastMessageId: string;
}

export class QueryMessagesDto {
  @ApiPropertyOptional({ default: 50 })
  @IsNumber()
  @Min(1)
  @Max(200)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  before?: string;
}

export class AddMembersDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}

export interface MessageWithSender {
  id: string;
  sessionId: string;
  senderId: string | null;
  content: string;
  contentType: string;
  metadata: Record<string, any> | null;
  isRecalled: boolean;
  recalledAt: Date | null;
  replyToId: string | null;
  isPinned: boolean;
  createdAt: Date;
  sender: { id: string; username: string; avatarUrl?: string | null; nickname?: string | null } | null;
  reactions: Array<{ id: string; emoji: string; userId: string }>;
}

export interface SessionWithMembers {
  id: string;
  sessionType: string;
  name: string | null;
  avatarUrl: string | null;
  ownerId: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    user: { id: string; username: string; avatarUrl?: string | null; status: string };
    role: string;
    nickname?: string | null;
  }>;
  lastMessage?: MessageWithSender | null;
  unreadCount: number;
}
