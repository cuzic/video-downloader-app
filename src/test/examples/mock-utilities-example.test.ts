import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockWithMethods,
  createPartialMock,
  createDeepMock,
  createChainableMock,
  createPropertyMock,
} from '../utils/mock-factory';
import {
  expectMockCalled,
  expectMockCalledTimes,
  expectLastMockCall,
  expectNthMockCall,
  expectMockNotCalled,
  expectMockCalledWithPartial,
  getMockCallArgs,
  getAllMockCallArgs,
} from '../utils/mock-assertions';
import {
  RepositoryMockBuilder,
  DatabaseRepositoryMockBuilder,
} from '../builders/repository-mock.builder';
import { mockElectron } from '../mocks/electron';
import {
  setupMocks,
  setupWithTimers,
  captureConsole,
  expectError,
  createDeferred,
} from '../utils/setup';

// Example interfaces for demonstration
interface UserRepository {
  findById(id: string): Promise<User | null>;
  create(data: CreateUserDto): Promise<string>;
  update(id: string, data: UpdateUserDto): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  findAll(): Promise<User[]>;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserDto {
  name: string;
  email: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
}

interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, error?: Error): void;
  warn(message: string): void;
  debug(message: string): void;
}

interface QueryBuilder {
  select(fields: string[]): QueryBuilder;
  from(table: string): QueryBuilder;
  where(condition: string): QueryBuilder;
  orderBy(field: string): QueryBuilder;
  limit(count: number): QueryBuilder;
  execute(): Promise<any[]>;
}

describe('Mock Factory Examples', () => {
  setupMocks();

  describe('createMockWithMethods', () => {
    it('creates a mock with specified methods', () => {
      const mockLogger = createMockWithMethods<Logger>(['info', 'error', 'warn', 'debug']);

      mockLogger.info('Test message');
      mockLogger.error('Error message', new Error('Test error'));

      expectMockCalled(mockLogger.info, 'Test message');
      expectMockCalled(mockLogger.error, 'Error message', expect.any(Error));
    });
  });

  describe('createPartialMock', () => {
    it('creates a partial mock with custom implementations', () => {
      const mockLogger = createPartialMock<Logger>({
        info: vi.fn().mockImplementation((msg) => console.log(`INFO: ${msg}`)),
        error: vi.fn().mockReturnValue(undefined),
      });

      mockLogger.info('Test');

      expectMockCalled(mockLogger.info, 'Test');
    });
  });

  describe('createDeepMock', () => {
    it('creates a deep mock of nested objects', () => {
      const mockConfig = createDeepMock({
        database: {
          host: 'localhost',
          port: 5432,
          connect: 'function',
          disconnect: 'function',
        },
        logger: {
          level: 'info',
          log: 'function',
        },
      });

      expect(mockConfig.database.host).toBe('localhost');
      expect(mockConfig.database.connect).toBeDefined();
      expectMockNotCalled(mockConfig.database.connect);

      mockConfig.database.connect();
      expectMockCalledTimes(mockConfig.database.connect, 1);
    });
  });

  describe('createChainableMock', () => {
    it('creates a mock with chainable methods', () => {
      const mockQuery = createChainableMock<QueryBuilder>([
        'select',
        'from',
        'where',
        'orderBy',
        'limit',
        'execute',
      ]);

      const result = mockQuery
        .select(['id', 'name'])
        .from('users')
        .where('active = true')
        .orderBy('name')
        .limit(10);

      expect(result).toBe(mockQuery);
      expectMockCalled(mockQuery.select, ['id', 'name']);
      expectMockCalled(mockQuery.from, 'users');
      expectMockCalled(mockQuery.where, 'active = true');
    });
  });

  describe('createPropertyMock', () => {
    it('creates a mock with tracked property access', () => {
      const mockConfig = createPropertyMock({
        apiUrl: 'https://api.example.com',
        timeout: 5000,
        retries: 3,
      });

      const url = mockConfig.apiUrl;
      const timeout = mockConfig.timeout;

      expect(url).toBe('https://api.example.com');
      expect(timeout).toBe(5000);
      expectMockCalledTimes(mockConfig.__getters.get('apiUrl')!, 1);
      expectMockCalledTimes(mockConfig.__getters.get('timeout')!, 1);
    });
  });
});

describe('Repository Mock Builder Examples', () => {
  setupMocks();

  describe('RepositoryMockBuilder', () => {
    it('builds a repository mock with fluent API', () => {
      const mockUserRepo = new RepositoryMockBuilder<UserRepository>()
        .withAsyncMethod('findById', { id: '123', name: 'John', email: 'john@example.com' })
        .withAsyncMethod('create', 'user-123')
        .withAsyncMethod('update', true)
        .withAsyncMethod('delete', true)
        .withAsyncMethod('findAll', [])
        .build();

      return mockUserRepo.findById('123').then((user) => {
        expect(user).toEqual({ id: '123', name: 'John', email: 'john@example.com' });
        expectMockCalled(mockUserRepo.findById, '123');
      });
    });

    it('builds a mock with rejected methods', async () => {
      const mockUserRepo = new RepositoryMockBuilder<UserRepository>()
        .withRejectedMethod('findById', new Error('User not found'))
        .build();

      await expectError(() => mockUserRepo.findById('999'), Error, 'User not found');
    });
  });

  describe('DatabaseRepositoryMockBuilder', () => {
    it('creates a mock with standard CRUD methods', () => {
      const mockRepo = new DatabaseRepositoryMockBuilder<any>()
        .withCrudMethods('user')
        .withPaginationMethods()
        .withTransactionMethods()
        .build();

      return Promise.all([
        mockRepo.create({ name: 'John' }).then((id) => expect(id).toBe('user-id')),
        mockRepo.findPaginated(1, 10).then((result) => expect(result.items).toEqual([])),
        mockRepo.beginTransaction().then(() => expect(true).toBe(true)),
      ]);
    });
  });
});

describe('Mock Assertion Examples', () => {
  setupMocks();

  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockWithMethods<Logger>(['info', 'error', 'warn', 'debug']);
  });

  it('uses various assertion helpers', () => {
    mockLogger.info('First message');
    mockLogger.info('Second message', { meta: 'data' });
    mockLogger.error('Error message', new Error('Test'));

    // Check specific calls
    expectMockCalled(mockLogger.info, 'First message');
    expectMockCalledTimes(mockLogger.info, 2);
    expectLastMockCall(mockLogger.info, 'Second message', { meta: 'data' });
    expectNthMockCall(mockLogger.info, 1, 'First message');

    // Get call arguments
    const firstCallArgs = getMockCallArgs(mockLogger.info, 0);
    expect(firstCallArgs).toEqual(['First message']);

    const allInfoCalls = getAllMockCallArgs(mockLogger.info);
    expect(allInfoCalls).toHaveLength(2);

    // Check with partial matching
    expectMockCalledWithPartial(mockLogger.error, 'Error message');
  });
});

describe('Electron Mock Examples', () => {
  it('uses Electron mocks', () => {
    const electron = mockElectron();

    // Use app mocks
    expect(electron.app.getVersion()).toBe('1.0.0-test');
    expectMockCalled(electron.app.getVersion);

    // Use dialog mocks
    electron.dialog.showErrorBox('Error', 'Something went wrong');
    expectMockCalled(electron.dialog.showErrorBox, 'Error', 'Something went wrong');

    // Use IPC mocks
    const handler = vi.fn();
    electron.ipcMain.handle('test-channel', handler);
    expect(electron.ipcMain.__handlers.get('test-channel')).toBe(handler);
  });
});

describe('Setup Helper Examples', () => {
  describe('setupWithTimers', () => {
    setupWithTimers();

    it('uses fake timers automatically', () => {
      const callback = vi.fn();
      setTimeout(callback, 1000);

      expectMockNotCalled(callback);
      vi.advanceTimersByTime(1000);
      expectMockCalledTimes(callback, 1);
    });
  });

  describe('captureConsole', () => {
    const console = captureConsole();

    it('captures console output', () => {
      console.log('Test log');
      console.error('Test error');
      console.warn('Test warning');

      expect(console.getLogs()).toContain('Test log');
      expect(console.getErrors()).toContain('Test error');
      expect(console.getWarnings()).toContain('Test warning');

      console.clearAll();
      expect(console.getLogs()).toHaveLength(0);
    });
  });

  describe('createDeferred', () => {
    it('creates a deferred promise', async () => {
      const deferred = createDeferred<string>();

      setTimeout(() => deferred.resolve('Success'), 100);

      const result = await deferred.promise;
      expect(result).toBe('Success');
    });
  });
});
