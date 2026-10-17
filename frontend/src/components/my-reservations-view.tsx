"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkCheck, Hourglass } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BookCover } from "./book-card";
import { Reveal } from "./motion";
import { MyReservationsSkeleton } from "./public/reader-skeletons";
import { Alert, Badge, Button, ButtonLink, EmptyState, PageHeading } from "./ui";
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

  if (list.isLoading) return <MyReservationsSkeleton />;
  const items = list.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading
        title="Sách đã đặt trước"
        description="Khi có người trả, sách được giữ cho bạn 3 ngày. Hãy tới quầy thủ thư để mượn trong thời hạn đó."
        action={<ButtonLink href="/my/loans" variant="ghost">Sách đang mượn</ButtonLink>}
      />
      {notice && (
        <div className="mt-5">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <section className="mt-8" aria-label="Danh sách đặt trước">
        {items.length === 0 ? (
          <EmptyState
            title="Chưa có cuốn nào chờ bạn"
            hint="Khi một cuốn đã hết bản trên kệ, mở trang sách và chọn Đặt trước để được giữ sách ngay khi có người trả."
            action={<ButtonLink href="/books">Tra cứu sách</ButtonLink>}
          />
        ) : (
          <ul className="space-y-4">
            {items.map((item, index) => {
              const ready = item.status === "READY";
              return (
                <li key={item.id}>
                  <Reveal delay={index * 40}>
                    <article
                      className={`flex gap-4 rounded-[1.25rem] border p-4 shadow-[var(--shadow-card)] sm:gap-5 sm:p-5 ${
                        ready ? "border-leaf/25 bg-leaf-soft" : "border-line bg-white"
                      }`}
                    >
                      <Link href={`/books/${item.book.id}`} className="w-20 shrink-0 rounded-xl sm:w-24">
                        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-paper-2 shadow-[0_12px_22px_-14px_rgb(21_26_51/0.6)]">
                          <BookCover title={item.book.title} coverUrl={item.book.coverUrl} />
                        </div>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold leading-snug sm:text-lg">
                          <Link href={`/books/${item.book.id}`} className="hover:text-primary">
                            {item.book.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-xs text-ink-faint">Đặt ngày {formatDate(item.createdAt)}</p>

                        <div className="mt-4 flex items-start gap-3">
                          <span
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                              ready ? "bg-white text-leaf" : "bg-amber-soft text-amber"
                            }`}
                            aria-hidden="true"
                          >
                            {ready ? <BookmarkCheck size={18} /> : <Hourglass size={18} />}
                          </span>
                          <div className="min-w-0 text-sm">
                            {ready ? (
                              <>
                                <Badge tone="good">Sách đã sẵn sàng</Badge>
                                <p className="mt-1.5">
                                  Giữ tới <strong>{item.expiresAt ? formatDate(item.expiresAt) : ""}</strong>
                                  {item.copy?.shelfLocation ? `, kệ ${item.copy.shelfLocation}` : ""}
                                </p>
                              </>
                            ) : (
                              <>
                                <Badge tone="warn">Đang xếp hàng</Badge>
                                <p className="mt-1.5">
                                  Bạn đứng thứ <strong className="tabular-nums">{item.queuePosition}</strong> trong hàng đợi.
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
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
                  </Reveal>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
