import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchSourceBytes } from './fetch-source-bytes.js';

describe('fetchSourceBytes', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    server = createServer((req, res) => {
      if (req.url === '/missing') {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' }).end(
        Buffer.from('<html><body>teszt</body></html>'),
      );
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
    const result = await fetchSourceBytes(`${baseUrl}/cikk`);

    expect(result.buffer.toString()).toBe('<html><body>teszt</body></html>');
    expect(() => new Date(result.fetchedAt).toISOString()).not.toThrow();
  });

  it('throws a human-readable error on a non-ok response', async () => {
    await expect(fetchSourceBytes(`${baseUrl}/missing`)).rejects.toThrow(
      /404/,
    );
  });
});
