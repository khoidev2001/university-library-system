import type { NextConfig } from "next";

/**
 * Hai cách triển khai, cùng một mã nguồn:
 *
 * 1. docker compose: nginx gateway cùng origin định tuyến /api và /ai. Không đặt hai biến
 *    dưới, rewrite bị tắt.
 * 2. Vercel + Render: trình duyệt chỉ nói chuyện với origin của Vercel, nên Next.js phải
 *    chuyển tiếp /api và /ai sang Render. Đặt BACKEND_PUBLIC_URL và AI_PUBLIC_URL khi build.
 *
 * Nhờ vậy trình duyệt luôn gọi đường dẫn tương đối, không cần CORS và không lộ địa chỉ dịch vụ.
 */
const backendUrl = process.env.BACKEND_PUBLIC_URL?.replace(/\/$/, "");
const aiUrl = process.env.AI_PUBLIC_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  async rewrites() {
    const rules = [];
    if (backendUrl) rules.push({ source: "/api/:path*", destination: `${backendUrl}/api/:path*` });
    if (aiUrl) rules.push({ source: "/ai/:path*", destination: `${aiUrl}/:path*` });
    return rules;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
