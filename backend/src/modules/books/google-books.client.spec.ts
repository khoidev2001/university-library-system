import { ConfigService } from '@nestjs/config';
import { GoogleBooksClient } from './google-books.client';

function client(apiKey = ''): GoogleBooksClient {
  const config = {
    get: jest.fn((key: string, def?: string) =>
      key === 'GOOGLE_BOOKS_API_KEY' ? apiKey : def,
    ),
  } as unknown as ConfigService;
  return new GoogleBooksClient(config);
}

const volume = {
  totalItems: 1,
  items: [
    {
      volumeInfo: {
        title: 'Dune',
        authors: ['Frank Herbert'],
        description: 'Sand.',
        publisher: 'Ace',
        publishedDate: '1965-08-01',
        categories: ['Fiction / Science Fiction'],
        pageCount: 412,
        imageLinks: { thumbnail: 'http://books.google.com/x.jpg' },
      },
    },
  ],
};

describe('GoogleBooksClient', () => {
  it('maps a volume to BookInfo, cleans the ISBN and upgrades the cover to https', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => volume });
    const info = await client('KEY').lookup(
      '978-0-441-01359-3',
      fetchMock as unknown as typeof fetch,
    );

    expect(info).toMatchObject({
      isbn: '9780441013593',
      title: 'Dune',
      authors: ['Frank Herbert'],
      publishedYear: 1965,
      categories: ['Fiction / Science Fiction'],
      coverUrl: 'https://books.google.com/x.jpg',
      pageCount: 412,
    });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.searchParams.get('q')).toBe('isbn:9780441013593');
    expect(url.searchParams.get('key')).toBe('KEY');
  });

  it('omits the key param when not configured', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => volume });
    await client().lookup(
      '9780441013593',
      fetchMock as unknown as typeof fetch,
    );
    expect((fetchMock.mock.calls[0][0] as URL).searchParams.has('key')).toBe(
      false,
    );
  });

  it('returns null on no items, non-OK status or network error', async () => {
    const empty = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ totalItems: 0 }) });
    expect(
      await client().lookup('1', empty as unknown as typeof fetch),
    ).toBeNull();

    const notOk = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    expect(
      await client().lookup('1', notOk as unknown as typeof fetch),
    ).toBeNull();

    const boom = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    expect(
      await client().lookup('1', boom as unknown as typeof fetch),
    ).toBeNull();
  });

  it('tolerates a missing publishedDate', async () => {
    const noDate = { totalItems: 1, items: [{ volumeInfo: { title: 'X' } }] };
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => noDate });
    const info = await client().lookup(
      '1',
      fetchMock as unknown as typeof fetch,
    );
    expect(info).toMatchObject({ title: 'X', authors: [], categories: [] });
    expect(info?.publishedYear).toBeUndefined();
  });
});
