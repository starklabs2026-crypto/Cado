
// Error logger to suppress known non-critical errors
const MUTED_MESSAGES = [
  'AsyncStorageError',
  'Native module is null',
  '[Theme] Error loading theme',
  '[Theme] Error saving theme',
  'SecureStore',
  'getValueWithKeyAsync',
  'getItemAsync',
  'Failed to download remote update',
  'kCFStreamErrorDomain',
  'NSURLConnection',
  'NSURLSessionTask',
  'SSL_ERROR',
  'ERR_SSL',
  'SSL_PROTOCOL_ERROR',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  '[API] Error loading',
  'Authentication token not found',
  'Please sign in',
  'Packager is not running',
  'Metro',
  'bundler',
  'Unable to connect to Metro',
  'Could not connect to development server',
  'Connection to Metro bundler',
  'Metro Bundler',
  'DevServer',
  'dev server',
  'Signup already in progress',
  'Failed to load resource',
  'execute.a.v1/signup',
  'Received unexpected stream_message event',
];

function shouldMuteMessage(message: string): boolean {
  if (!message) return false;
  const messageStr = String(message);
  return MUTED_MESSAGES.some(muted => messageStr.includes(muted));
}

// Override console methods to mute specific messages
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = (...args: any[]) => {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  if (!shouldMuteMessage(message)) {
    originalConsoleError(...args);
  }
};

console.warn = (...args: any[]) => {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  if (!shouldMuteMessage(message)) {
    originalConsoleWarn(...args);
  }
};

console.log = (...args: any[]) => {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  if (!shouldMuteMessage(message)) {
    originalConsoleLog(...args);
  }
};

export { shouldMuteMessage };
