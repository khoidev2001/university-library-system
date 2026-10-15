import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RejectNullBytePipe } from './common/pipes/reject-null-byte.pipe';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/books/catalog.module';
import { ExportsModule } from './modules/exports/exports.module';
import { HealthModule } from './modules/health/health.module';
import { CirculationModule } from './modules/loans/circulation.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Giới hạn chung 100 req/phút/IP; /auth/login siết 10/phút bằng @Throttle (NFR-SEC-05)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PoliciesModule,
    CatalogModule,
    CirculationModule,
    RecommendationsModule,
    ExportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Chặn ký tự NUL ở mọi body/query/param trước khi xuống Postgres (sẽ thành 500)
    { provide: APP_PIPE, useClass: RejectNullBytePipe },
  ],
})
export class AppModule {}
