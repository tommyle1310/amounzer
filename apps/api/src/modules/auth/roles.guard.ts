import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value);
    } else {
      Reflect.defineMetadata(ROLES_KEY, roles, target);
    }
    return descriptor ?? target;
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.headers['x-company-id'] as string;

    if (!user || !companyId) {
      throw new ForbiddenException('Missing authentication or company context');
    }

    const companyUser = await this.prisma.companyUser.findUnique({
      where: {
        userId_companyId: { userId: user.sub, companyId },
      },
    });

    if (!companyUser || !companyUser.isActive) {
      throw new ForbiddenException('No access to this company');
    }

    if (!requiredRoles.includes(companyUser.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    request.companyId = companyId;
    request.userRole = companyUser.role;

    return true;
  }
}
