import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';

interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    // #region debug log
    fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7dd50'},body:JSON.stringify({sessionId:'d7dd50',location:'jwt.strategy.ts:14',message:'JwtStrategy init',data:{secretExists:!!secret,secretLength:secret?.length,secretFirst16:secret?.substring(0,16)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'fallback_dev_secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        userType: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
