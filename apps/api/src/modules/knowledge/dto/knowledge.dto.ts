import { IsString, IsOptional, IsBoolean, IsNumber, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKbDto {
  @ApiProperty({ example: 'Product Documentation' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ default: 500 })
  @IsNumber()
  @IsOptional()
  chunkSize?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsNumber()
  @IsOptional()
  chunkOverlap?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  embeddingModel?: string;
}

export class AddDocumentDto {
  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fileName?: string;
}

export class SearchKbDto {
  @ApiProperty()
  @IsString()
  query: string;

  @ApiPropertyOptional({ default: 5 })
  @IsNumber()
  @IsOptional()
  topK?: number;
}
