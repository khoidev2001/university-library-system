"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ButtonLink } from "../ui";

/** Nút hành động ở phần giới thiệu: khách thì mời đăng nhập, bạn đọc thì dẫn tới việc hay làm nhất. */
export function HomeActions() {
  const { user, loading } = useAuth();

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-3">
      {!loading && !user && (
        <div className="anim-rise">
          <ButtonLink href="/login">Đăng nhập để mượn sách</ButtonLink>
        </div>
      )}
      {!loading && user?.role === "READER" && (
        <div className="anim-rise">
          <ButtonLink href="/my/loans">Sách tôi đang mượn</ButtonLink>
        </div>
      )}
      {!loading && user && user.role !== "READER" && (
        <div className="anim-rise">
          <ButtonLink href="/librarian/desk">Mở quầy mượn trả</ButtonLink>
        </div>
      )}
      <ButtonLink href="/books" variant="ghost">
        Duyệt danh mục
      </ButtonLink>
      <Link
        href="/quy-dinh"
        className="link-underline inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft hover:text-ink"
      >
        Quy định mượn trả
      </Link>
    </div>
  );
}

/** Ô mời gọi cuối khối số liệu: nội dung đổi theo trạng thái đăng nhập. */
export function HomeCtaTile() {
  const { user, loading } = useAuth();
  const signedIn = !loading && !!user;
  const isReader = user?.role === "READER";

  return (
    <>
      <p className="text-xl font-bold leading-snug sm:text-2xl">
        {signedIn ? `Chào ${user!.fullName.split(" ").slice(-1)[0]}, hôm nay đọc gì?` : "Mượn sách chỉ mất vài bước"}
      </p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
        {signedIn
          ? "Xem hạn trả, gia hạn trực tuyến và nhận gợi ý chọn riêng theo những cuốn bạn đã đọc."
          : "Đăng nhập bằng tài khoản bạn đọc để theo dõi sách đang mượn, hạn trả và nhận gợi ý chọn riêng cho bạn."}
      </p>
      <div className="mt-5 flex min-h-11 flex-wrap gap-3">
        {!loading && !user && <ButtonLink href="/login">Đăng nhập</ButtonLink>}
        {!loading && isReader && <ButtonLink href="/recommendations">Xem gợi ý cho bạn</ButtonLink>}
        {!loading && user && !isReader && <ButtonLink href="/librarian/desk">Mở quầy mượn trả</ButtonLink>}
        {!loading && !user && (
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/10"
          >
            Tạo tài khoản
          </Link>
        )}
      </div>
    </>
  );
}
