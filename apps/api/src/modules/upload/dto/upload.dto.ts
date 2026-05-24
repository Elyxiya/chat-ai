import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
