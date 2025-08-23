// Error type definitions

export enum ErrorCode {
  // Network errors (1xxx)
  NETWORK_ERROR = 'E1000',
  TIMEOUT = 'E1001',
  CONNECTION_REFUSED = 'E1002',
  DNS_LOOKUP_FAILED = 'E1003',
  
  // File system errors (2xxx)
  FILE_NOT_FOUND = 'E2000',
  PERMISSION_DENIED = 'E2001',
  DISK_FULL = 'E2002',
  PATH_TOO_LONG = 'E2003',
  
  // Download errors (3xxx)
  INVALID_URL = 'E3000',
  UNSUPPORTED_PROTOCOL = 'E3001',
  DRM_PROTECTED = 'E3002',
  LIVE_STREAM = 'E3003',
  
  // Application errors (4xxx)
  INVALID_ARGUMENT = 'E4000',
  TASK_NOT_FOUND = 'E4001',
  ALREADY_EXISTS = 'E4002',
  OPERATION_CANCELLED = 'E4003',
}

export interface SerializedError {
  code?: ErrorCode | string;
  name?: string;
  message: string;
  stack?: string;
  details?: any;
}