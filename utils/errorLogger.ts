
const MUTED_MESSAGES = [
  'Require cycle:',
  'VirtualizedLists should never be nested',
  'Sending `onAnimatedValueUpdate` with no listeners registered',
  'Non-serializable values were found in the navigation state',
  'AsyncStorageError',
  'Native module is null',
  '[Theme] Error loading theme',
  '[Theme] Error saving theme',
  'SecureStore',
  'java.io.IOException: Failed to download remote update',
  'Request timed out',
  'SSL',
  'certificate',
  'handshake',
  'TLS',
  'CERT',
  'Failed to fetch',
  'network error',
  'NSURLSession',
  'NSError',
  'CFNetwork',
  'kCFStreamErrorDomainSSL',
  'kCFStreamErrorDomain',
  'NSURLConnection',
  'NSURLSessionTask',
  'SSL_ERROR',
  'ERR_SSL',
  'SSL_PROTOCOL_ERROR',
  'Connection security error',
  'Unable to connect to server',
  'Cloudflare',
  'Connection error',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
];

export function shouldMuteMessage(message: string): boolean {
  if (!message) return false;
  const lowerMessage = message.toLowerCase();
  return MUTED_MESSAGES.some(muted => lowerMessage.includes(muted.toLowerCase()));
}

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = (...args: any[]) => {
  const message = args.join(' ');
  if (!shouldMuteMessage(message)) {
    originalConsoleError(...args);
  }
};

console.warn = (...args: any[]) => {
  const message = args.join(' ');
  if (!shouldMuteMessage(message)) {
    originalConsoleWarn(...args);
  }
};

console.log = (...args: any[]) => {
  const message = args.join(' ');
  if (!shouldMuteMessage(message)) {
    originalConsoleLog(...args);
  }
};

export default {
  shouldMuteMessage,
};
