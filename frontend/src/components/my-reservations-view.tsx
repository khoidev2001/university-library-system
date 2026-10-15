"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { BookCover } from "./book-card";
import { Alert, Badge, Button, ButtonLink, EmptyState, PageHeading, Spinner } from "./ui";
import { ApiError, apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Reservation } from "@/lib/types";

export function MyReservationsView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const list = useQuery({
    queryKey: ["my-reservations"],
    queryFn: () => apiFetch<Reservation[]>("/reservations/me", { token }),
    enabled: !!token,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => apiFetch(`/reservations/${id}`, { method: "DELETE", token }),
    onSuccess: () => {
      setNotice({ tone: "good", text: "Đã huỷ đặt trước." });
      queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
    },
    onError: (error) =>
      setNotice({ tone: "bad", text: error instanceof ApiError ? error.friendlyMessage : "Không huỷ được." }),
  });

  if (list.isLoading) return <Spinner />;
  const items = list.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Tài khoản của tôi"
        title="Sách đã đặt trước"
        description="Khi có người trả, sách được giữ cho bạn 3 ngày. Hãy tới quầy thủ thư để mượn trong thời hạn đó."
        action={<ButtonLink href="/my/loans" variant="ghost">Sách đang mượn</ButtonLink>}
      />
      {notice && (
        <div className="mt-5">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <section className="mt-8">
        {items.length === 0 ? (
          <EmptyState
            title="Bạn chưa đặt trước cuốn nào"
            hint="Khi một cuốn đã hết bản trên kệ, mở trang sách và chọn Đặt trước."
            action={<ButtonLink href="/books">Tra cứu sách</ButtonLink>}
          />
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id}>
                <article className="flex gap-4 rounded-xl border border-line bg-white p-4 shadow-sm">
                  <Link href={`/books/${item.book.id}`} className="w-16 shrink-0 sm:w-20">
                    <div className="aspect-[2/3] overflow-hidden rounded-md border border-line bg-paper-2">
                      <BookCover title={item.book.title} coverUrl={item.book.coverUrl} />
                    </div>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-base font-bold leading-snug">
                      <Link href={`/books/${item.book.id}`} className="hover:underline">
                        {item.book.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-xs text-ink-faint">Đặt ngày {formatDate(item.createdAt)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {item.status === "READY" ? (
                        <>
                          <Badge tone="good">Sách đã sẵn sàng</Badge>
                          <span className="text-sm">
                            Giữ tới <strong>{item.expiresAt ? formatDate(item.expiresAt) : ""}</strong>
                            {item.copy?.shelfLocation ? `, kệ ${item.copy.shelfLocation}` : ""}
                          </span>
                        </>
                      ) : (
                        <Badge tone="warn">Đang xếp hàng, vị trí {item.queuePosition}</Badge>
                      )}
                      <Button
                        variant="ghost"
                        disabled={cancel.isPending}
                        onClick={() => {
                          if (window.confirm(`Huỷ đặt trước "${item.book.title}"?`)) cancel.mutate(item.id);
                        }}
                      >
                        Huỷ đặt trước
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
