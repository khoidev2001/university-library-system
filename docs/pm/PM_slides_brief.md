# Hướng dẫn làm slide bảo vệ Kế hoạch Quản lý Dự án (15 phút)

Dùng file này để tự làm slide bằng công cụ khác (PowerPoint, Canva, hoặc AI tạo slide). Mọi con số lấy từ báo cáo `PM_Report.docx` và file `ULS_PM_Plan.xlsx`; hình lấy trong thư mục `docs/pm/figures/`.

**Tiêu chí chấm của đề:** nội dung đầy đủ 60% (đặc biệt WBS, sơ đồ mạng và đường găng, rủi ro), hợp lý và chính xác 20%, hình thức và thuyết trình 20% (bảo vệ được các quyết định quản lý). Vì vậy dành thời gian nhiều nhất cho WBS, đường găng, rủi ro và EVA.

**Nguyên tắc trình bày:** mỗi slide một thông điệp, tối đa 5 dòng chữ, ưu tiên hình. Chữ tối thiểu 20 pt. Không dùng dấu gạch ngang dài. Nói trung thực: EVA và tài chính là mô phỏng.

## Phân bổ thời gian

| Slide | Nội dung | Thời gian |
|---|---|---|
| 1 | Tên đề tài, nhóm, phân công | 0:30 |
| 2 | Bài toán và mục tiêu SMART | 1:00 |
| 3 | Phạm vi, bên liên quan | 1:00 |
| 4 | WBS và ước lượng | 1:30 |
| 5 | Lịch, sơ đồ mạng và đường găng | 2:00 |
| 6 | PERT và Gantt: xác suất đúng hạn | 1:00 |
| 7 | Rủi ro | 1:30 |
| 8 | Nguồn lực, RACI | 1:00 |
| 9 | Chất lượng và kiểm thử | 1:00 |
| 10 | Tài chính: NPV, ROI | 1:00 |
| 11 | EVA | 2:00 |
| 12 | Kết luận, bài học, demo | 1:30 |
| Tổng | | 15:00 |

## Nội dung từng slide

### Slide 1. Tiêu đề (0:30)

- Kế hoạch quản lý dự án: Phần mềm Quản lý Thư viện Trường Đại học (Đề tài 8).
- Nhóm 3, lớp D23CTC2. Trần Đình Khôi (nhóm trưởng), Nguyễn Như Quỳnh. GVHD: TS. Lê Tỷ Khánh.
- Một dòng phân công: Khôi phụ trách SOW, WBS, lịch và đường găng, EVA; Quỳnh phụ trách rủi ro, nguồn lực và RACI, chất lượng, tài chính.
- **Lời nói:** giới thiệu ngắn, nói rõ dự án mô phỏng 16 tuần, 4 vai trò; sản phẩm phần mềm có thật đã chạy trên cloud.

### Slide 2. Bài toán và mục tiêu SMART (1:00)

- Vấn đề: thư viện ghi sổ tay, thủ thư mất thời gian, tính phạt dễ sai, bạn đọc không biết sách còn không.
- Giải pháp: web quản lý sách, bạn đọc, mượn trả, tìm kiếm, báo cáo, cộng gợi ý sách và dự báo trả trễ.
- 7 mục tiêu SMART (chọn 3 nêu miệng): giảm 3 phút xuống 1 phút mỗi lượt mượn trả; coverage từ 80%; hoàn thành đúng 16 tuần trong ngân sách.
- **Hình:** không bắt buộc; có thể dùng ảnh trang chủ hệ thống thật (`docs/report/screenshots/11-live-vercel.jpg`).

### Slide 3. Phạm vi và bên liên quan (1:00)

- Trong phạm vi: 5 module (sách, bạn đọc, mượn trả, tìm kiếm, báo cáo) cộng AI, quản trị, triển khai.
- Ngoài phạm vi: đặt trước, email nhắc hạn, thanh toán, di động.
- **Hình:** `stakeholders.png` (ma trận quyền lực và quan tâm). Nhấn mạnh Ban giám đốc thư viện là Product Owner.
- Giả định và ràng buộc quan trọng nhất: 16 tuần cứng, 4 người bán thời gian 16 giờ/tuần, 50.000 đ/giờ, hạ tầng miễn phí.

### Slide 4. WBS và ước lượng (1:30)

- 7 pha, 42 gói công việc (Work Package), 566 giờ kỳ vọng, BAC 28,30 triệu đồng, dự phòng 10% (2,83 triệu).
- Phát triển 44% công sức, kiểm thử 13%.
- Ước lượng 3 điểm PERT: E = (O + 4M + P) / 6. Kiểm tra chéo bằng điểm chức năng: khoảng 288 FP, sai lệch dưới 10%.
- **Hình:** `wbs.png`.
- **Câu cần nói:** năng suất giả định 2,1 giờ/FP thấp hơn mức ngành vì dùng khung có sẵn; đó là rủi ro R6 đã có dự phòng.

### Slide 5. Sơ đồ mạng và đường găng (2:00)

- 19 hoạt động, phụ thuộc FS, SS, FF, SF có độ trễ; thời gian dự án 16 tuần.
- 14 trên 19 hoạt động là găng, có 3 đường găng song song. Hoạt động có dự trữ: B, G, N, Q, R.
- Đường găng chính: Khảo sát, SRS, Thiết kế, Backend nền, Backend mượn trả, AI, Tích hợp, UAT, Triển khai, Nghiệm thu.
- **Hình:** `network.png` (chiếu to, chỉ vào đường đỏ). Chỉ cho giảng viên một dòng tính: ES, EF, LS, LF, Slack = LS − ES.
- **Ý chính:** mạng "chặt" vì làm song song nhiều luồng nên mọi trễ đều đẩy ngày kết thúc.

### Slide 6. Gantt và xác suất đúng hạn (1:00)

- **Hình:** `gantt.png` với 8 mốc M1 đến M8.
- PERT: kỳ vọng 16,96 tuần, độ lệch chuẩn 1,24; xác suất xong trong 16 tuần chỉ 22%, trong 17 tuần 51%, trong 18 tuần 80%.
- Quyết định quản lý: giữ dự phòng tiền, cho phép làm thêm giờ có kiểm soát, giữ danh sách cắt giảm phạm vi.

### Slide 7. Rủi ro (1:30)

- 11 rủi ro (4 nhóm: Con người, Tiến trình, Sản phẩm, Công nghệ), 2 mức Cao: R1 hạ tầng miễn phí ngủ khi demo, R5 phình phạm vi.
- **Hình:** `risk_matrix.png`.
- Mỗi rủi ro có chiến lược, ứng phó, dấu hiệu kích hoạt, chủ sở hữu. Tổng EMV 2,82 triệu, gần bằng dự phòng 2,83 triệu.
- **Điểm mạnh nên nêu:** nhiều rủi ro đã xảy ra thật và đã xử lý: Render ngủ (fallback), Google Books giới hạn (đổi nguồn dữ liệu), lỗi tính phạt (sửa theo ngày lịch).

### Slide 8. Nguồn lực và RACI (1:00)

- **Hình:** `org.png` (4 vai trò, 2 thành viên thật, 2 nhân sự giả định).
- RACI 25 hạng mục, mỗi hạng mục đúng một A (đã kiểm tra tự động trong Excel).
- Tải đỉnh nhóm 60 giờ ở tuần 8 trên năng lực 64 giờ/tuần. Có thể kèm `resource.png`.

### Slide 9. Chất lượng và kiểm thử (1:00)

- 4 tầng: đơn vị, tích hợp (DB thật), hệ thống, UAT; CI chặn mọi Pull Request.
- Kết quả thật: 160 test đạt 100%; coverage Backend 98,75% dòng; AI 93,6%; Precision@5 = 0,309; ROC-AUC = 0,76.
- Quản lý cấu hình: nhánh `main` được bảo vệ, Pull Request có rà soát và CI xanh.
- Trung thực: chưa đo p95 bằng công cụ tải.

### Slide 10. Tài chính (1:00)

- Vốn đầu tư 31,13 triệu (BAC cộng dự phòng); lợi ích đầy đủ 78,36 triệu/năm; vận hành 12 triệu/năm; chiết khấu 10%.
- NPV 3 năm 112,5 triệu đồng; ROI 464%; hoàn vốn khoảng 9 tháng.
- **Hình:** `cashflow.png`.
- Độ nhạy: hoà vốn khi lợi ích chỉ đạt khoảng 35% kế hoạch. Nói rõ các số là giả định, rủi ro chính là thủ thư không dùng hệ thống (R8).

### Slide 11. EVA (2:00)

- 4 mốc: tuần 4, 8, 12, 16. Bảng nhỏ: PV, EV, AC, SPI, CPI.
  - Tuần 4: SPI 0,960, CPI 0,962 (xanh).
  - Tuần 8: SPI 0,868, CPI 0,924 (vàng), điểm xấu nhất.
  - Tuần 12: SPI 0,944, CPI 0,918.
  - Tuần 16: SPI 1,000, CPI 0,926; chi phí thực tế 30,56 triệu, vượt BAC 8%, dùng 80% dự phòng.
- **Hình:** `eva_curves.png` rồi `eva_indices.png`.
- Giải thích tuần 8: Google Books giới hạn tần suất nên đổi nguồn dữ liệu; hành động khắc phục: làm song song Frontend và Backend, làm thêm giờ, hoãn nhập ISBN.
- **Nói thật:** EV và AC là số mô phỏng có kiểm soát gắn với sự kiện thật; giờ công thật của nhóm (63 giờ) không cùng quy mô nên không dùng làm AC.

### Slide 12. Kết luận và demo (1:30)

- Ba bài học: (1) có nguồn dữ liệu dự phòng ngay từ đầu; (2) theo dõi SPI hằng tuần thay vì mỗi 4 tuần; (3) chạy thật luồng liên quan tiền, không chỉ test có mock.
- Hạn chế: EV, AC và tài chính là mô phỏng; 2 nhân sự là giả định; chưa đo p95.
- Demo 30 giây (nếu có thời gian): mở địa chỉ trực tuyến, đăng nhập thủ thư, mượn và trả một cuốn, xem bảng điều khiển quản trị.
- Địa chỉ web: https://uls-library.vercel.app. Mã nguồn: https://github.com/khoidev2001/university-library-system.

## Câu hỏi giảng viên có thể hỏi và gợi ý trả lời

1. **Vì sao đường găng có tới 3 đường song song?** Vì nhóm nhỏ làm nhiều luồng cùng lúc và các luồng đều phải xong trước tích hợp; hệ quả là dự án nhạy với mọi trễ, nên dùng EVA theo dõi và giữ dự phòng.
2. **Xác suất đúng hạn chỉ 22%, sao vẫn cam kết 16 tuần?** Hạn là cứng nên kế hoạch bù bằng làm thêm giờ có kiểm soát, chạy song song và danh sách cắt phạm vi; EVA tuần 8 cho thấy đúng kịch bản đó và đã phục hồi.
3. **Sao năng suất 2,1 giờ/FP thấp hơn mức ngành?** Vì dùng NestJS, Prisma, Next.js sinh sẵn nhiều khung; đây là giả định rủi ro cao đã ghi là R6 và bù bằng dự phòng 10%.
4. **EVA có phải số thật không?** Không. Là mô phỏng có kiểm soát, gắn với sự kiện thật. Giờ công thật chỉ 63 giờ cho 1 đến 2 người nên không cùng quy mô với dự án mô phỏng 566 giờ.
5. **Lợi ích tài chính lấy ở đâu?** Từ giả định: 5.000 bạn đọc, 8 lượt mượn mỗi người mỗi năm, tiết kiệm 2 phút mỗi lượt, đơn giá thủ thư 35.000 đ/giờ; có bảng độ nhạy và điểm hoà vốn 35%.
6. **Dự phòng 10% có đủ không?** Vừa đủ che EMV 2,82 triệu; dự án thật dùng 80%; với rủi ro ước lượng cao nên dùng 15%.
7. **Thay đổi phạm vi được kiểm soát thế nào?** Phiếu Change Request, duyệt theo ngưỡng 8 giờ; ví dụ thật: sửa phạt theo ngày lịch (6 giờ), trang quản trị (30 giờ), đổi nguồn dữ liệu (8 giờ), chỉ trang quản trị (30 giờ) được khách hàng cấp ngân sách riêng; hai việc còn lại (14 giờ) đã nằm trong mức vượt chi phí của EVA nên không cộng lần hai vào dự phòng.
