import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches, ValidationOptions, registerDecorator } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message: 'Password must contain at least 8 characters, including uppercase, lowercase, and numbers',
        ...validationOptions,
      },
      validator: {
        validate(value: string) {
          return (
            typeof value === 'string' &&
            value.length >= 8 &&
            /[A-Z]/.test(value) &&
            /[a-z]/.test(value) &&
            /[0-9]/.test(value)
          );
        },
      },
    });
  };
}

export class RegisterDto {
  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  nickname?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'john_doe or user@example.com' })
  @IsString()
  identifier: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class SendCodeDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: UserPayload;
}

export interface UserPayload {
  id: string;
  username: string;
  email: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  userType: string;
}
