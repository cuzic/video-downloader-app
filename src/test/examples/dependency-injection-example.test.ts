import { describe, it, expect, beforeEach } from 'vitest';
import { RepositoryMockBuilder } from '../builders/repository-mock.builder';
import { expectMockCalled, expectMockCalledTimes } from '../utils/mock-assertions';
import { setupMocks } from '../utils/setup';

// Example: Service with proper dependency injection
interface ILogger {
  info(message: string, meta?: any): void;
  error(message: string, error?: Error): void;
}

interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(data: CreateUserDto): Promise<string>;
  update(id: string, data: UpdateUserDto): Promise<boolean>;
}

interface IEmailService {
  sendWelcomeEmail(email: string, name: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface CreateUserDto {
  name: string;
  email: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
}

// Service with proper dependency injection
class UserService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly logger: ILogger
  ) {}

  async createUser(data: CreateUserDto): Promise<string> {
    try {
      this.logger.info('Creating user', { email: data.email });

      // Check if user already exists
      const existingUser = await this.userRepo.findById(data.email);
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Create user
      const userId = await this.userRepo.create(data);

      // Send welcome email
      await this.emailService.sendWelcomeEmail(data.email, data.name);

      this.logger.info('User created successfully', { userId });
      return userId;
    } catch (error) {
      this.logger.error('Failed to create user', error as Error);
      throw error;
    }
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<void> {
    try {
      this.logger.info('Updating user', { id });

      const user = await this.userRepo.findById(id);
      if (!user) {
        throw new Error('User not found');
      }

      await this.userRepo.update(id, data);

      this.logger.info('User updated successfully', { id });
    } catch (error) {
      this.logger.error('Failed to update user', error as Error);
      throw error;
    }
  }
}

describe('UserService with Dependency Injection', () => {
  setupMocks();

  let userService: UserService;
  let mockUserRepo: IUserRepository;
  let mockEmailService: IEmailService;
  let mockLogger: ILogger;

  beforeEach(() => {
    // Create mocks using the builder pattern
    mockUserRepo = new RepositoryMockBuilder<IUserRepository>()
      .withAsyncMethod('findById', null)
      .withAsyncMethod('create', 'user-123')
      .withAsyncMethod('update', true)
      .build();

    mockEmailService = new RepositoryMockBuilder<IEmailService>()
      .withAsyncMethod('sendWelcomeEmail')
      .withAsyncMethod('sendPasswordResetEmail')
      .build();

    mockLogger = new RepositoryMockBuilder<ILogger>()
      .withMethod('info')
      .withMethod('error')
      .build();

    // Inject mocks into the service
    userService = new UserService(mockUserRepo, mockEmailService, mockLogger);
  });

  describe('createUser', () => {
    it('should create a new user and send welcome email', async () => {
      const userData: CreateUserDto = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const userId = await userService.createUser(userData);

      // Verify the result
      expect(userId).toBe('user-123');

      // Verify all dependencies were called correctly
      expectMockCalled(mockUserRepo.findById, userData.email);
      expectMockCalled(mockUserRepo.create, userData);
      expectMockCalled(mockEmailService.sendWelcomeEmail, userData.email, userData.name);

      // Verify logging
      expectMockCalledTimes(mockLogger.info, 2);
      expectMockCalled(mockLogger.info, 'Creating user', { email: userData.email });
      expectMockCalled(mockLogger.info, 'User created successfully', { userId: 'user-123' });
    });

    it('should throw error if user already exists', async () => {
      // Setup mock to return existing user
      mockUserRepo = new RepositoryMockBuilder<IUserRepository>()
        .withAsyncMethod('findById', {
          id: '123',
          name: 'Existing User',
          email: 'john@example.com',
          createdAt: new Date(),
        })
        .build();

      userService = new UserService(mockUserRepo, mockEmailService, mockLogger);

      const userData: CreateUserDto = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      // Verify it throws
      await expect(userService.createUser(userData)).rejects.toThrow('User already exists');

      // Verify email was not sent
      expectMockCalledTimes(mockEmailService.sendWelcomeEmail, 0);

      // Verify error was logged
      expectMockCalled(mockLogger.error, 'Failed to create user', expect.any(Error));
    });

    it('should handle email service failure', async () => {
      // Setup email service to fail
      mockEmailService = new RepositoryMockBuilder<IEmailService>()
        .withRejectedMethod('sendWelcomeEmail', new Error('Email service down'))
        .build();

      userService = new UserService(mockUserRepo, mockEmailService, mockLogger);

      const userData: CreateUserDto = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      // Verify it throws the email error
      await expect(userService.createUser(userData)).rejects.toThrow('Email service down');

      // Verify user was created before the email failure
      expectMockCalled(mockUserRepo.create, userData);

      // Verify error was logged
      expectMockCalled(mockLogger.error, 'Failed to create user', expect.any(Error));
    });
  });

  describe('updateUser', () => {
    it('should update an existing user', async () => {
      // Setup mock to return existing user
      mockUserRepo = new RepositoryMockBuilder<IUserRepository>()
        .withAsyncMethod('findById', {
          id: 'user-123',
          name: 'John Doe',
          email: 'john@example.com',
          createdAt: new Date(),
        })
        .withAsyncMethod('update', true)
        .build();

      userService = new UserService(mockUserRepo, mockEmailService, mockLogger);

      const updateData: UpdateUserDto = {
        name: 'John Smith',
      };

      await userService.updateUser('user-123', updateData);

      // Verify all dependencies were called correctly
      expectMockCalled(mockUserRepo.findById, 'user-123');
      expectMockCalled(mockUserRepo.update, 'user-123', updateData);

      // Verify logging
      expectMockCalledTimes(mockLogger.info, 2);
      expectMockCalled(mockLogger.info, 'Updating user', { id: 'user-123' });
      expectMockCalled(mockLogger.info, 'User updated successfully', { id: 'user-123' });
    });

    it('should throw error if user not found', async () => {
      const updateData: UpdateUserDto = {
        name: 'John Smith',
      };

      await expect(userService.updateUser('non-existent', updateData)).rejects.toThrow(
        'User not found'
      );

      // Verify update was not called
      expectMockCalledTimes(mockUserRepo.update, 0);

      // Verify error was logged
      expectMockCalled(mockLogger.error, 'Failed to update user', expect.any(Error));
    });
  });
});

/**
 * Example: How to refactor existing code for better testability
 *
 * BEFORE (Hard to test):
 * ```typescript
 * class TaskRepository {
 *   private auditLogRepo: AuditLogRepository;
 *
 *   constructor() {
 *     this.auditLogRepo = new AuditLogRepository(); // Hard-coded dependency
 *   }
 * }
 * ```
 *
 * AFTER (Easy to test):
 * ```typescript
 * class TaskRepository {
 *   constructor(
 *     private readonly auditLogRepo: IAuditLogRepository // Injected dependency
 *   ) {}
 * }
 * ```
 *
 * Benefits:
 * 1. Easy to mock dependencies
 * 2. No need for complex vi.mock() setups
 * 3. Type-safe mocking
 * 4. Clear separation of concerns
 * 5. Better testability
 */
