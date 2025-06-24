export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  windowMs?: number; // sliding window in milliseconds
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly requestCount: Map<string, number> = new Map();
  private readonly windowMs: number;

  constructor(config: RateLimitConfig) {
    this.maxTokens = config.maxTokens;
    this.refillRate = config.refillRate;
    this.windowMs = config.windowMs || 60000; // 1 minute default
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  checkLimit(clientId: string = 'default', cost: number = 1): { allowed: boolean; retryAfter?: number; remaining: number } {
    this.refillTokens();
    
    // Clean old window data
    const now = Date.now();
    const windowKey = `${clientId}:${Math.floor(now / this.windowMs)}`;
    
    // Clean up old entries
    for (const [key] of this.requestCount.entries()) {
      const [, timestamp] = key.split(':');
      if (parseInt(timestamp) < Math.floor((now - this.windowMs) / this.windowMs)) {
        this.requestCount.delete(key);
      }
    }
    
    if (this.tokens >= cost) {
      this.tokens -= cost;
      
      // Track request count for this window
      const currentCount = this.requestCount.get(windowKey) || 0;
      this.requestCount.set(windowKey, currentCount + 1);
      
      return {
        allowed: true,
        remaining: Math.floor(this.tokens)
      };
    } else {
      const retryAfter = Math.ceil((cost - this.tokens) / this.refillRate * 1000); // milliseconds
      return {
        allowed: false,
        retryAfter,
        remaining: Math.floor(this.tokens)
      };
    }
  }

  getStats(clientId: string = 'default'): { 
    currentTokens: number; 
    maxTokens: number; 
    refillRate: number;
    requestsInWindow: number;
  } {
    this.refillTokens();
    
    const now = Date.now();
    const windowKey = `${clientId}:${Math.floor(now / this.windowMs)}`;
    const requestsInWindow = this.requestCount.get(windowKey) || 0;
    
    return {
      currentTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
      requestsInWindow
    };
  }
}

export class RateLimitManager {
  private limiters: Map<string, TokenBucketRateLimiter> = new Map();
  private readonly defaultConfig: RateLimitConfig;

  constructor(defaultConfig: RateLimitConfig = { 
    maxTokens: 100, 
    refillRate: 10, 
    windowMs: 60000 
  }) {
    this.defaultConfig = defaultConfig;
  }

  addLimiter(name: string, config: RateLimitConfig): void {
    this.limiters.set(name, new TokenBucketRateLimiter(config));
  }

  checkLimit(limiterName: string, clientId: string = 'default', cost: number = 1): { 
    allowed: boolean; 
    retryAfter?: number; 
    remaining: number;
    limiter: string;
  } {
    let limiter = this.limiters.get(limiterName);
    
    if (!limiter) {
      limiter = new TokenBucketRateLimiter(this.defaultConfig);
      this.limiters.set(limiterName, limiter);
    }
    
    const result = limiter.checkLimit(clientId, cost);
    
    return {
      ...result,
      limiter: limiterName
    };
  }

  getStats(limiterName: string, clientId: string = 'default'): any {
    const limiter = this.limiters.get(limiterName);
    if (!limiter) return null;
    
    return {
      limiter: limiterName,
      client: clientId,
      ...limiter.getStats(clientId)
    };
  }
}