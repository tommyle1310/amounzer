import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string; name: string }) {
    return this.authService.register(body.email, body.password, body.name);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('verify-2fa')
  async verify2FA(@Body() body: { userId: string; code: string }) {
    return this.authService.verify2FA(body.userId, body.code);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  async enable2FA(@Request() req: { user: { sub: string } }) {
    return this.authService.enable2FA(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/confirm')
  async confirm2FA(
    @Request() req: { user: { sub: string } },
    @Body() body: { code: string },
  ) {
    return this.authService.confirm2FA(req.user.sub, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('companies')
  async getCompanies(@Request() req: { user: { sub: string } }) {
    return this.authService.getUserCompanies(req.user.sub);
  }
}
