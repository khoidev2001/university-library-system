import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Route không cần JWT (đăng ký, đăng nhập, tra cứu sách...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
