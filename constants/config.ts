/**
 * Application configuration with default values.
 * These settings can be overridden by user preferences stored in LocalStorage.
 */

export interface AppConfig {
  processing: {
    concurrency: number;
    retryAttempts: number;
    retryDelayMs: number;
  };
  caching: {
    episodeStalenessThresholdDays: number | null;
    maxWeeklyCacheEntries: number;
    enableWeeklyAggregationCache: boolean;
  };
  features: {
    enableAIExecutiveSummary: boolean;
    enableDetailedProgress: boolean;
    enableCacheAnalytics: boolean;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: AppConfig = {
  processing: {
    concurrency: 10,
    retryAttempts: 3,
    retryDelayMs: 1000
  },
  caching: {
    episodeStalenessThresholdDays: null, // null = disabled, 30 = reprocess after 30 days
    maxWeeklyCacheEntries: 52,
    enableWeeklyAggregationCache: true
  },
  features: {
    enableAIExecutiveSummary: false, // Disabled by default (faster processing)
    enableDetailedProgress: true,
    enableCacheAnalytics: false
  }
};

const CONFIG_STORAGE_KEY = 'hcr_app_config';

/**
 * Loads configuration from LocalStorage, merging with defaults
 */
export function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_CONFIG };
    }

    const parsed = JSON.parse(stored) as Partial<AppConfig>;

    // Deep merge with defaults to handle missing fields
    return {
      processing: {
        ...DEFAULT_CONFIG.processing,
        ...parsed.processing
      },
      caching: {
        ...DEFAULT_CONFIG.caching,
        ...parsed.caching
      },
      features: {
        ...DEFAULT_CONFIG.features,
        ...parsed.features
      }
    };
  } catch (error) {
    console.error('Error loading config from LocalStorage, using defaults:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Saves configuration to LocalStorage
 */
export function saveConfig(config: AppConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    console.log('Configuration saved to LocalStorage');
  } catch (error) {
    console.error('Error saving config to LocalStorage:', error);
  }
}

/**
 * Updates a specific config value and saves to LocalStorage
 */
export function updateConfig<K extends keyof AppConfig>(
  section: K,
  key: keyof AppConfig[K],
  value: any
): AppConfig {
  const config = loadConfig();
  (config[section] as any)[key] = value;
  saveConfig(config);
  return config;
}

/**
 * Resets configuration to default values
 */
export function resetConfig(): AppConfig {
  const config = { ...DEFAULT_CONFIG };
  saveConfig(config);
  return config;
}

/**
 * Validates configuration values
 */
export function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate processing settings
  if (config.processing.concurrency < 1 || config.processing.concurrency > 20) {
    errors.push('Concurrency must be between 1 and 20');
  }
  if (config.processing.retryAttempts < 0 || config.processing.retryAttempts > 10) {
    errors.push('Retry attempts must be between 0 and 10');
  }
  if (config.processing.retryDelayMs < 0 || config.processing.retryDelayMs > 10000) {
    errors.push('Retry delay must be between 0 and 10000ms');
  }

  // Validate caching settings
  if (
    config.caching.episodeStalenessThresholdDays !== null &&
    (config.caching.episodeStalenessThresholdDays < 1 || config.caching.episodeStalenessThresholdDays > 365)
  ) {
    errors.push('Episode staleness threshold must be null or between 1 and 365 days');
  }
  if (config.caching.maxWeeklyCacheEntries < 1 || config.caching.maxWeeklyCacheEntries > 104) {
    errors.push('Max weekly cache entries must be between 1 and 104 (2 years)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get current configuration (singleton pattern)
 */
let currentConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!currentConfig) {
    currentConfig = loadConfig();
  }
  return currentConfig;
}

/**
 * Refresh configuration from LocalStorage
 */
export function refreshConfig(): AppConfig {
  currentConfig = loadConfig();
  return currentConfig;
}
