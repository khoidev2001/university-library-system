import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { contentDisposition } from '../../common/http/content-disposition';
import { MAX_EXPORT_ROWS } from './dto/exports.dto';
import {
  CSV_CONTENT_TYPE,
  ExportFormat,
  XLSX_CONTENT_TYPE,
  fileStamp,
} from './export-format';
import { CsvSink, ExportAborted, ExportSink, XlsxSink } from './export-sinks';
import type { Dataset } from './exports.service';

const logger = new Logger('ExportStreamer');

/**
 * Ghi một bộ dữ liệu ra HTTP response theo từng lô, không dựng cả mảng trong bộ nhớ.
 *
 * Lô đầu được đọc TRƯỚC khi gửi header: lỗi DB lúc đó vẫn trả về 500 JSON bình thường. Sau khi đã
 * gửi header mà lỗi giữa chừng thì chỉ còn cách cắt kết nối (trình duyệt thấy tải thất bại thay vì
 * nhận một file cụt trông như đầy đủ).
 */
export async function streamDataset<T>(
  res: Response,
  format: ExportFormat,
  dataset: Dataset<T>,
  maxRows: number = MAX_EXPORT_ROWS,
): Promise<void> {
  const iterator = dataset.batches()[Symbol.asyncIterator]();
  try {
    const first = await iterator.next();

    const filename = `${dataset.title} ${fileStamp()}.${format}`;
    res.status(200);
    res.setHeader(
      'Content-Type',
      format === 'xlsx' ? XLSX_CONTENT_TYPE : CSV_CONTENT_TYPE,
    );
    res.setHeader('Content-Disposition', contentDisposition(filename));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Total-Count', String(dataset.total));
    res.setHeader('X-Export-Truncated', String(dataset.total > maxRows));
    res.flushHeaders();

    const sink: ExportSink =
      format === 'xlsx'
        ? new XlsxSink(res, dataset.sheetName)
        : new CsvSink(res);
    await sink.start(
      dataset.columns.map((c) => c.header),
      dataset.columns.map((c) => c.type),
      dataset.columns.map((c) => c.width),
    );

    let remaining = maxRows;
    let step = first;
    while (!step.done && remaining > 0) {
      for (const row of step.value) {
        if (remaining-- <= 0) break;
        await sink.row(dataset.columns.map((c) => c.value(row)));
      }
      if (remaining <= 0) break;
      step = await iterator.next();
    }
    await sink.finish();
  } catch (error) {
    if (error instanceof ExportAborted) return; // người dùng đóng tab / huỷ tải
    if (!res.headersSent) throw error; // chưa gửi gì: để bộ lọc lỗi trả JSON
    logger.error(`Xuất dữ liệu thất bại giữa chừng: ${String(error)}`);
    res.destroy(); // không truyền lỗi: tránh sự kiện error không ai bắt làm sập tiến trình
  } finally {
    await iterator.return?.(undefined);
  }
}
