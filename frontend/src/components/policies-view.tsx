"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Presentation } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { LoanPolicy, MemberType } from "@/lib/types";
import { Reveal } from "./motion";
import { Button, Card, Field, PageHeading, Skeleton, inputClass } from "./ui";
import { useNotice } from "./admin/admin-ui";

const FIELDS = [
  { key: "maxBooks", label: "Số cuốn tối đa", hint: "Số sách được giữ cùng lúc", unit: "cuốn" },
  { key: "loanDays", label: "Số ngày mượn", hint: "Tính từ ngày mượn", unit: "ngày" },
  { key: "renewLimit", label: "Số lần gia hạn", hint: "Áp dụng cho mỗi phiếu", unit: "lần" },
  { key: "renewExtraDays", label: "Số ngày mỗi lần gia hạn", hint: "Cộng thêm vào hạn trả", unit: "ngày" },
  { key: "finePerDay", label: "Mức phạt mỗi ngày trễ", hint: "Đơn vị đồng", unit: "đồng" },
] as const;

export function PoliciesView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { show, node } = useNotice();

  const { data, isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => apiFetch<LoanPolicy[]>("/policies"),
  });

  return (
    <div>
      <PageHeading
        title="Chính sách mượn"
        description="Thay đổi áp dụng cho phiếu mượn tạo sau khi lưu. Phiếu đang mượn giữ nguyên hạn trả cũ."
      />
      {node}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {isLoading
          ? [0, 1].map((i) => <Skeleton key={i} className="h-[34rem] rounded-[1.25rem]" />)
          : (data ?? []).map((policy, index) => (
              <Reveal key={policy.id} delay={index * 80}>
                <PolicyCard
                  policy={policy}
                  token={token}
                  onDone={(message, tone) => {
                    show(tone, message);
                    queryClient.invalidateQueries({ queryKey: ["policies"] });
                  }}
                />
              </Reveal>
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

  const Icon = policy.memberType === "LECTURER" ? Presentation : GraduationCap;

  return (
    <Card className="h-full">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Icon size={22} />
        </span>
        <h2 className="text-lg font-bold">{label(policy.memberType)}</h2>
      </div>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(policy.memberType);
        }}
      >
        {FIELDS.map((field) => (
          <Field key={field.key} label={field.label} hint={field.hint} htmlFor={`${policy.memberType}-${field.key}`}>
            <div className="relative">
              <input
                id={`${policy.memberType}-${field.key}`}
                type="number"
                min={field.key === "renewLimit" || field.key === "finePerDay" ? 0 : 1}
                required
                value={form[field.key]}
                onChange={(event) => setForm((f) => ({ ...f, [field.key]: Number(event.target.value) }))}
                className={`${inputClass} pr-16 tabular-nums`}
              />
              <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                {field.unit}
              </span>
            </div>
          </Field>
        ))}
        <Button type="submit" disabled={save.isPending} className="w-full sm:col-span-2">
          {save.isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </form>
    </Card>
  );
}

function label(memberType: MemberType): string {
  return memberType === "LECTURER" ? "Giảng viên" : "Sinh viên";
}
