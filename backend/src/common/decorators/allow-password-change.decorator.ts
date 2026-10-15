import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_KEY = 'allowWhenPasswordChangeRequired';
/**
 * Route vẫn gọi được khi tài khoản đang dùng mật khẩu tạm (mustChangePassword):
 * chỉ /auth/me và /auth/change-password. Mọi route khác trả 403 PASSWORD_CHANGE_REQUIRED.
 */
export const AllowWhenPasswordChangeRequired = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
