import type { Response } from 'express';
import { PassThrough } from 'stream';
import { streamDataset } from './export-streamer';
import type { Dataset } from './exports.service';

function fakeResponse() {
  const stream = new PassThrough();
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  const res = Object.assign(stream, {
    headersSent: false,
    statusCode: 0,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    flushHeaders() {
      res.headersSent = true;
    },
  });
  return {
    res: res as unknown as Response,
    headers,
    text: () => Buffer.concat(chunks).toString('utf8'),
    raw: res,
  };
}

interface Row {
  id: number;
  name: string;
}

function dataset(total: number, failAfterBatch?: number): Dataset<Row> {
  return {
    title: 'Thử nghiệm',
    sheetName: 'Thử',
    total,
    columns: [
      { header: 'Mã', width: 5, type: 'int', value: (r) => r.id },
      { header: 'Tên', width: 5, type: 'text', value: (r) => r.name },
    ],
    // eslint-disable-next-line @typescript-eslint/require-await
    async *batches() {
      let id = 1;
      let batch = 0;
      while (id <= total) {
        if (failAfterBatch !== undefined && batch === failAfterBatch)
          throw new Error('DB chết giữa chừng');
        const rows: Row[] = [];
        for (let i = 0; i < 4 && id <= total; i++, id++)
          rows.push({ id, name: `n${id}` });
        batch++;
        yield rows;
      }
    },
  };
}

describe('streamDataset', () => {
  it('ghi BOM + tiêu đề + đủ dòng, header X-Total-Count', async () => {
    const out = fakeResponse();
    await streamDataset(out.res, 'csv', dataset(9));
    const lines = out.text().replace('﻿', '').trimEnd().split('\r\n');
    expect(lines[0]).toBe('Mã,Tên');
    expect(lines).toHaveLength(10);
    expect(out.text().startsWith('﻿')).toBe(true);
    expect(out.headers['x-total-count']).toBe('9');
    expect(out.headers['x-export-truncated']).toBe('false');
  });

  it('vượt trần số dòng: cắt đúng trần (kể cả giữa một lô) và báo X-Export-Truncated', async () => {
    const out = fakeResponse();
    await streamDataset(out.res, 'csv', dataset(30), 10);
    const lines = out.text().trimEnd().split('\r\n');
    expect(lines).toHaveLength(11); // tiêu đề + 10 dòng; lô 4+4+2
    expect(lines[10]).toBe('10,n10');
    expect(out.headers['x-total-count']).toBe('30');
    expect(out.headers['x-export-truncated']).toBe('true');
  });

  it('lỗi ở lô đầu khi chưa gửi header → ném ra cho bộ lọc lỗi trả JSON, chưa ghi byte nào', async () => {
    const out = fakeResponse();
    await expect(streamDataset(out.res, 'csv', dataset(20, 0))).rejects.toThrow(
      'DB chết giữa chừng',
    );
    expect(out.text()).toBe('');
    expect(out.raw.headersSent).toBe(false);
  });

  it('lỗi giữa chừng khi đã gửi header → cắt kết nối, không giả vờ hoàn tất', async () => {
    const out = fakeResponse();
    const destroy = jest.spyOn(out.raw, 'destroy');
    await streamDataset(out.res, 'csv', dataset(20, 1));
    expect(destroy).toHaveBeenCalled();
  });
});
