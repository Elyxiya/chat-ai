import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        // #region debug log
        fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7dd50'},body:JSON.stringify({sessionId:'d7dd50',location:'auth.module.ts:15',message:'JwtModule config',data:{secretExists:!!secret,secretLength:secret?.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return {
          secret: secret || 'dev_fallback_jwt_secret_change_in_production',
          signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || '15m' },
        };
      },
      inject: [ConfigService],
    }),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService],
})
export class AuthModule {}
