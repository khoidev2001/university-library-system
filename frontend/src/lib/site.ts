export const SITE = {
  name: "Thư viện MUCE",
  shortName: "Thư viện MUCE",
  university: "Trường Đại học Xây dựng Miền Trung",
  description:
    "Tra cứu danh mục sách, kiểm tra sách còn trên kệ, mượn và gia hạn trực tuyến tại thư viện Trường Đại học Xây dựng Miền Trung.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:8080",
  address: "Số 24 Nguyễn Du, Phường 7, Tuy Hòa, Phú Yên",
  openingHours: "Thứ Hai đến Thứ Bảy, 7:00 - 21:00",
  email: "thuvien@muce.edu.vn",
  phone: "0257 3823 062",
} as const;
