/**
 * Mock PrismaService cho unit test: mỗi model là object các jest.fn().
 * `$transaction` chấp nhận mảng promise (batch) hoặc callback (interactive) — cả hai đều chạy thật
 * với các mock bên trong, nên test kiểm được thứ tự gọi.
 */
type Fn = jest.Mock;

export interface PrismaMock {
  user: Record<
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'count'
    | 'create'
    | 'update',
    Fn
  >;
  loanPolicy: Record<'findUnique' | 'findMany' | 'update' | 'upsert', Fn>;
  book: Record<
    'findUnique' | 'findMany' | 'count' | 'create' | 'update' | 'delete',
    Fn
  >;
  bookCopy: Record<
    'findUnique' | 'findMany' | 'create' | 'update' | 'groupBy' | 'deleteMany',
    Fn
  >;
  author: Record<
    | 'findUnique'
    | 'findFirst'
    | 'findMany'
    | 'count'
    | 'create'
    | 'update'
    | 'delete',
    Fn
  >;
  bookAuthor: Record<'count', Fn>;
  category: Record<
    | 'findUnique'
    | 'findFirst'
    | 'findMany'
    | 'create'
    | 'update'
    | 'delete'
    | 'upsert',
    Fn
  >;
  loan: Record<'count' | 'findUnique' | 'findMany' | 'create' | 'update', Fn>;
  fine: Record<'aggregate' | 'create' | 'findMany' | 'update', Fn>;
  rating: Record<'aggregate' | 'deleteMany' | 'upsert', Fn>;
  $transaction: Fn;
  $queryRaw: Fn;
}

function model<K extends string>(...keys: K[]): Record<K, Fn> {
  return Object.fromEntries(keys.map((k) => [k, jest.fn()])) as Record<K, Fn>;
}

export function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    user: model(
      'findUnique',
      'findUniqueOrThrow',
      'findMany',
      'count',
      'create',
      'update',
    ),
    loanPolicy: model('findUnique', 'findMany', 'update', 'upsert'),
    book: model(
      'findUnique',
      'findMany',
      'count',
      'create',
      'update',
      'delete',
    ),
    bookCopy: model(
      'findUnique',
      'findMany',
      'create',
      'update',
      'groupBy',
      'deleteMany',
    ),
    author: model(
      'findUnique',
      'findFirst',
      'findMany',
      'count',
      'create',
      'update',
      'delete',
    ),
    bookAuthor: model('count'),
    category: model(
      'findUnique',
      'findFirst',
      'findMany',
      'create',
      'update',
      'delete',
      'upsert',
    ),
    loan: model('count', 'findUnique', 'findMany', 'create', 'update'),
    fine: model('aggregate', 'create', 'findMany', 'update'),
    rating: model('aggregate', 'deleteMany', 'upsert'),
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function')
      return (arg as (tx: PrismaMock) => Promise<unknown>)(mock);
    return Promise.all(arg as Promise<unknown>[]);
  });
  return mock;
}
