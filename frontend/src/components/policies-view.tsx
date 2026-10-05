"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { LoanPolicy, MemberType } from "@/lib/types";
import { Alert, Button, Card, Field, PageHeading, Spinner, inputClass } from "./ui";

const FIELDS = [
  { key: "maxBooks", label: "Số cuốn tối đa", hint: "Số sách được giữ cùng lúc" },
  { key: "loanDays", label: "Số ngày mượn", hint: "Tính từ ngày mượn" },
  { key: "renewLimit", label: "Số lần gia hạn", hint: "Áp dụng cho mỗi phiếu" },
  { key: "renewExtraDays", label: "Số ngày mỗi lần gia hạn", hint: "Cộng thêm vào hạn trả" },
  { key: "finePerDay", label: "Mức phạt mỗi ngày trễ", hint: "Đơn vị đồng" },
] as const;

export function PoliciesView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => apiFetch<LoanPolicy[]>("/policies"),
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Quản trị"
        title="Chính sách mượn"
        description="Thay đổi áp dụng cho phiếu mượn tạo sau khi lưu. Phiếu đang mượn giữ nguyên hạn trả cũ."
      />

      {notice && (
        <div className="mt-5">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {(data ?? []).map((policy) => (
          <PolicyCard
            key={policy.id}
            policy={policy}
            token={token}
            onDone={(message, tone) => {
              setNotice({ tone, text: message });
              queryClient.invalidateQueries({ queryKey: ["policies"] });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PolicyCard({
  policy,
  token,
  onDone,
}: {
  policy: LoanPolicy;
  token: string | null;
  onDone: (message: string, tone: "good" | "bad") => void;
}) {
  const [form, setForm] = useState(policy);
  useEffect(() => setForm(policy), [policy]);

  const save = useMutation({
    mutationFn: (memberType: MemberType) =>
      apiFetch<LoanPolicy>(`/policies/${memberType}`, {
        method: "PATCH",
        token,
        body: {
          maxBooks: form.maxBooks,
          loanDays: form.loanDays,
          renewLimit: form.renewLimit,
          renewExtraDays: form.renewExtraDays,
          finePerDay: form.finePerDay,
        },
      }),
    onSuccess: () => onDone(`Đã lưu chính sách cho ${label(policy.memberType)}.`, "good"),
    onError: (error) =>
      onDone(error instanceof ApiError ? error.friendlyMessage : "Không lưu được chính sách.", "bad"),
  });

  return (
    <Card>
      <h2 className="font-serif text-lg font-bold">{label(policy.memberType)}</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(policy.memberType);
        }}
      >
        {FIELDS.map((field) => (
          <Field key={field.key} label={field.label} hint={field.hint} htmlFor={`${policy.memberType}-${field.key}`}>
            <input
              id={`${policy.memberType}-${field.key}`}
              type="number"
              min={field.key === "renewLimit" || field.key === "finePerDay" ? 0 : 1}
              required
              value={form[field.key]}
              onChange={(event) => setForm((f) => ({ ...f, [field.key]: Number(event.target.value) }))}
              className={inputClass}
            />
          </Field>
        ))}
        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </form>
    </Card>
  );
}

function label(memberType: MemberType): string {
  return memberType === "LECTURER" ? "Giảng viên" : "Sinh viên";
}
