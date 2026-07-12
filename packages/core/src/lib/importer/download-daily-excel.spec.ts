import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { downloadDailyExcel } from './download-daily-excel.js';

describe('downloadDailyExcel', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    server = createServer((req, res) => {
      if (req.url === '/missing') {
        res.writeHead(404).end('not found');
        return;
      }
      res
        .writeHead(200, { 'content-type': 'application/octet-stream' })
        .end(Buffer.from('excel-bytes'));
    });
    await new Promise<void>((resolvePromise) =>
      server.listen(0, resolvePromise),
    );
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('nem sikerült elindítani a teszt-szervert');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolvePromise) =>
      server.close(() => resolvePromise()),
    );
  });

  it('returns the response body as a buffer', async () => {
    const result = await downloadDailyExcel(`${baseUrl}/daily.xlsx`);

    expect(result.buffer.toString()).toBe('excel-bytes');
    expect(() => new Date(result.downloadedAt).toISOString()).not.toThrow();
  });

  it('throws a human-readable error on a non-ok response', async () => {
    await expect(downloadDailyExcel(`${baseUrl}/missing`)).rejects.toThrow(
      /404/,
    );
  });
});
