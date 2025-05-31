// modules/ConfigManager.js - Fixed for async environment loading
const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
    constructor(initialOptions = {}) {
        this.configPath = path.join(__dirname, '../config/bot-config.json');
        this.config = {};
        this.watchers = new Map();
        this.isInitialized = false;
        
        // Don't initialize immediately - let the caller do it
        this.initialOptions = initialOptions;
    }

    async initialize() {
        if (this.isInitialized) return this.config;
        
        // Load dotenv first
        await this.loadDotenv();
        
        // Wait a moment for environment to settle
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now initialize config
        this.defaultConfig = this.getDefaultConfig();
        this.validationRules = this.getValidationRules();
        
        await this.initializeConfig(this.initialOptions);
        this.isInitialized = true;
        
        return this.config;
    }

    async loadDotenv() {
        try {
            // Always try to load dotenv
            require('dotenv').config();
            console.log('📁 Loaded .env file');
            
            // Debug what we got
            console.log('🔍 Post-dotenv Environment Check:');
            const criticalVars = ['GEMINI_API_KEY', 'MINECRAFT_HOST', 'BOT_USERNAME', 'MINECRAFT_PORT'];
            criticalVars.forEach(varName => {
                const value = process.env[varName];
                const status = value && value.trim() ? '✅' : '❌';
                let display;
                
                if (varName.includes('KEY')) {
                    display = value ? `[${value.length} chars]` : 'MISSING';
                } else {
                    display = value || 'MISSING';
                }
                console.log(`   ${status} ${varName}: ${display}`);
            });
            
        } catch (error) {
            console.log('⚠️ dotenv not available:', error.message);
        }
    }

    getDefaultConfig() {
        // Helper function with better error handling
        const getEnv = (key, defaultValue = undefined, type = 'string') => {
            let value = process.env[key];
            
            // Handle empty strings as undefined
            if (value === undefined || value === null || value === '' || value === 'undefined') {
                if (defaultValue !== undefined) {
                    console.log(`⚠️ ${key} is empty, using default: ${defaultValue}`);
                }
                return defaultValue;
            }
            
            switch (type) {
                case 'number':
                    const num = parseFloat(value);
                    return isNaN(num) ? defaultValue : num;
                case 'boolean':
                    return value.toLowerCase() === 'true';
                case 'int':
                    const int = parseInt(value);
                    return isNaN(int) ? defaultValue : int;
                default:
                    return value.trim(); // Always trim strings
            }
        };

        const config = {
            // Connection settings
            host: getEnv('MINECRAFT_HOST', 'localhost'),
            port: getEnv('MINECRAFT_PORT', 19132, 'int'),
            username: getEnv('BOT_USERNAME', 'DragonSlayerBot'),
            version: getEnv('MINECRAFT_VERSION', '1.20.0'),
            skipPing: true,
            offlineMode: false,
            
            // AI Configuration - Multiple fallbacks for API key
            geminiApiKey: getEnv('GEMINI_API_KEY') || 
                         getEnv('GEMINI_KEY') || 
                         getEnv('API_KEY') || 
                         getEnv('GOOGLE_API_KEY'),
            geminiModel: getEnv('GEMINI_MODEL', 'gemini-1.5-flash'),
            maxTokens: getEnv('MAX_TOKENS', 1000, 'int'),
            aiTemperature: getEnv('AI_TEMPERATURE', 0.7, 'number'),
            aiTopP: getEnv('AI_TOP_P', 0.9, 'number'),
            aiTopK: getEnv('AI_TOP_K', 40, 'int'),
            
            // Bot Behavior
            chatCooldown: getEnv('CHAT_COOLDOWN', 2000, 'int'),
            autoResponse: getEnv('AUTO_RESPONSE', true, 'boolean'),
            learningEnabled: getEnv('LEARNING_ENABLED', true, 'boolean'),
            aggressiveMode: getEnv('AGGRESSIVE_MODE', false, 'boolean'),
            helpfulMode: getEnv('HELPFUL_MODE', true, 'boolean'),
            
            // Mission Settings
            missionTimeout: getEnv('MISSION_TIMEOUT', 1800000, 'int'),
            autoStartMission: getEnv('AUTO_START_MISSION', false, 'boolean'),
            teamMode: getEnv('TEAM_MODE', true, 'boolean'),
            maxTeamSize: getEnv('MAX_TEAM_SIZE', 4, 'int'),
            
            // Combat Settings
            combatDistance: getEnv('COMBAT_DISTANCE', 3.0, 'number'),
            fleeThreshold: getEnv('FLEE_THRESHOLD', 0.3, 'number'),
            combatStrategy: getEnv('COMBAT_STRATEGY', 'balanced'),
            
            // Navigation Settings
            pathfindingTimeout: getEnv('PATHFINDING_TIMEOUT', 10000, 'int'),
            movementSpeed: getEnv('MOVEMENT_SPEED', 4.317, 'number'),
            jumpHeight: getEnv('JUMP_HEIGHT', 1.25, 'number'),
            
            // Inventory Settings
            autoManageInventory: getEnv('AUTO_MANAGE_INVENTORY', true, 'boolean'),
            keepEssentialItems: getEnv('KEEP_ESSENTIAL_ITEMS', true, 'boolean'),
            craftingEnabled: getEnv('CRAFTING_ENABLED', true, 'boolean'),
            
            // Debug and Monitoring
            debugMode: getEnv('DEBUG_MODE', false, 'boolean'),
            logLevel: getEnv('LOG_LEVEL', 'info'),
            logPackets: getEnv('LOG_PACKETS', false, 'boolean'),
            simulationMode: getEnv('SIMULATION_MODE', false, 'boolean'),
            
            // Performance Settings
            tickRate: getEnv('TICK_RATE', 20, 'int'),
            maxMemoryUsage: getEnv('MAX_MEMORY_MB', 512, 'int'),
            gcInterval: getEnv('GC_INTERVAL', 60000, 'int'),
            
            // Learning System
            learningDataPath: getEnv('LEARNING_DATA_PATH', './data/learning'),
            maxLearningEntries: getEnv('MAX_LEARNING_ENTRIES', 10000, 'int'),
            learningDecayRate: getEnv('LEARNING_DECAY_RATE', 0.1, 'number'),
            
            // Security Settings
            allowedCommands: getEnv('ALLOWED_COMMANDS') ? getEnv('ALLOWED_COMMANDS').split(',') : ['help', 'status', 'mission'],
            adminUsers: getEnv('ADMIN_USERS') ? getEnv('ADMIN_USERS').split(',') : [],
            rateLimitEnabled: getEnv('RATE_LIMIT_ENABLED', true, 'boolean'),
            maxRequestsPerMinute: getEnv('MAX_REQUESTS_PER_MINUTE', 30, 'int'),
            
            // Advanced Features
            multiServerMode: getEnv('MULTI_SERVER_MODE', false, 'boolean'),
            backupEnabled: getEnv('BACKUP_ENABLED', true, 'boolean'),
            metricsEnabled: getEnv('METRICS_ENABLED', false, 'boolean'),
            webhookUrl: getEnv('WEBHOOK_URL'),
            
            // Experimental Features
            experimentalFeatures: {
                advancedAI: getEnv('EXPERIMENTAL_ADVANCED_AI', false, 'boolean'),
                predictiveNavigation: getEnv('EXPERIMENTAL_PREDICTIVE_NAV', false, 'boolean'),
                dynamicDifficulty: getEnv('EXPERIMENTAL_DYNAMIC_DIFFICULTY', false, 'boolean'),
                socialLearning: getEnv('EXPERIMENTAL_SOCIAL_LEARNING', false, 'boolean')
            }
        };

        // Debug the critical values
        console.log('🔧 Configuration values loaded:');
        console.log(`   geminiApiKey: ${config.geminiApiKey ? `[${config.geminiApiKey.length} chars]` : 'MISSING'}`);
        console.log(`   host: ${config.host}`);
        console.log(`   username: ${config.username}`);
        console.log(`   port: ${config.port}`);

        return config;
    }

    getValidationRules() {
        return {
            host: { type: 'string', required: true, minLength: 1 },
            port: { type: 'number', min: 1, max: 65535 },
            username: { type: 'string', required: true, minLength: 1, maxLength: 16 },
            geminiApiKey: { type: 'string', required: true, minLength: 1 },
            maxTokens: { type: 'number', min: 1, max: 8192 },
            aiTemperature: { type: 'number', min: 0, max: 2 },
            aiTopP: { type: 'number', min: 0, max: 1 },
            aiTopK: { type: 'number', min: 1, max: 100 },
            chatCooldown: { type: 'number', min: 0, max: 10000 },
            missionTimeout: { type: 'number', min: 60000, max: 7200000 },
            maxTeamSize: { type: 'number', min: 1, max: 20 },
            combatDistance: { type: 'number', min: 1, max: 10 },
            fleeThreshold: { type: 'number', min: 0.1, max: 0.9 },
            pathfindingTimeout: { type: 'number', min: 1000, max: 60000 },
            tickRate: { type: 'number', min: 1, max: 100 },
            maxMemoryUsage: { type: 'number', min: 128, max: 4096 },
            maxLearningEntries: { type: 'number', min: 100, max: 100000 },
            maxRequestsPerMinute: { type: 'number', min: 1, max: 1000 },
            logLevel: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] },
            combatStrategy: { type: 'string', enum: ['aggressive', 'defensive', 'balanced'] }
        };
    }

    async initializeConfig(initialOptions) {
        try {
            // Load config from file if it exists
            const fileConfig = await this.loadConfigFromFile();
            
            // Merge configurations in priority order:
            // 1. Initial options (highest priority)
            // 2. File config
            // 3. Default config (lowest priority)
            this.config = {
                ...this.defaultConfig,
                ...fileConfig,
                ...initialOptions
            };
            
            // Validate the merged configuration
            this.validateConfig();
            
            // Save the current config to file for future reference
            await this.saveConfigToFile();
            
            console.log('✅ Configuration initialized successfully');
            
        } catch (error) {
            console.error('❌ Config initialization failed:', error);
            
            // Fallback to default config if initialization fails
            this.config = { ...this.defaultConfig, ...initialOptions };
            console.log('⚠️ Using default configuration as fallback');
        }
    }

    async loadConfigFromFile() {
        try {
            // Ensure config directory exists
            const configDir = path.dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });
            
            // Check if config file exists
            await fs.access(this.configPath);
            
            // Read and parse config file
            const configData = await fs.readFile(this.configPath, 'utf8');
            const fileConfig = JSON.parse(configData);
            
            console.log('📄 Configuration loaded from file');
            return fileConfig;
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('📄 No config file found, using defaults');
            } else {
                console.warn('⚠️ Error loading config file:', error.message);
            }
            return {};
        }
    }

    async saveConfigToFile() {
        try {
            // Ensure config directory exists
            const configDir = path.dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });
            
            // Create a sanitized version for saving (hide sensitive data)
            const sanitizedConfig = { ...this.config };
            if (sanitizedConfig.geminiApiKey) {
                sanitizedConfig.geminiApiKey = `[${sanitizedConfig.geminiApiKey.length} chars hidden]`;
            }
            
            // Write config to file with pretty formatting
            await fs.writeFile(
                this.configPath, 
                JSON.stringify(sanitizedConfig, null, 2),
                'utf8'
            );
            
            console.log('📄 Configuration saved to file');
            
        } catch (error) {
            console.warn('⚠️ Error saving config file:', error.message);
        }
    }

    validateConfig() {
        const errors = [];
        
        Object.entries(this.validationRules).forEach(([key, rules]) => {
            const value = this.config[key];
            
            // Check required fields
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${key} is required but missing or empty`);
                return;
            }
            
            // Skip further validation if value is undefined and not required
            if (value === undefined || value === null) return;
            
            // Type validation
            if (rules.type) {
                const actualType = typeof value;
                if (rules.type === 'number' && actualType !== 'number') {
                    errors.push(`${key} must be a number, got ${actualType}`);
                    return;
                }
                if (rules.type === 'string' && actualType !== 'string') {
                    errors.push(`${key} must be a string, got ${actualType}`);
                    return;
                }
                if (rules.type === 'boolean' && actualType !== 'boolean') {
                    errors.push(`${key} must be a boolean, got ${actualType}`);
                    return;
                }
            }
            
            // Numeric range validation
            if (typeof value === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`${key} must be at least ${rules.min}, got ${value}`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`${key} must be at most ${rules.max}, got ${value}`);
                }
            }
            
            // String length validation
            if (typeof value === 'string') {
                if (rules.minLength !== undefined && value.length < rules.minLength) {
                    errors.push(`${key} must be at least ${rules.minLength} characters, got ${value.length}`);
                }
                if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                    errors.push(`${key} must be at most ${rules.maxLength} characters, got ${value.length}`);
                }
            }
            
            // Enum validation
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(`${key} must be one of [${rules.enum.join(', ')}], got "${value}"`);
            }
        });
        
        if (errors.length > 0) {
            console.error('❌ Configuration validation errors:');
            errors.forEach(error => console.error(`   • ${error}`));
            throw new Error(`Configuration validation failed: ${errors.length} error(s)`);
        }
        
        console.log('✅ Configuration validation passed');
    }

    updateConfig(updates) {
        const oldConfig = { ...this.config };
        
        try {
            // Apply updates
            Object.assign(this.config, updates);
            
            // Validate the updated configuration
            this.validateConfig();
            
            // Save to file
            this.saveConfigToFile().catch(error => {
                console.warn('⚠️ Failed to save updated config:', error.message);
            });
            
            // Emit change events for watchers
            this.notifyWatchers(updates);
            
            console.log('✅ Configuration updated successfully');
            
        } catch (error) {
            // Rollback on validation failure
            this.config = oldConfig;
            throw error;
        }
    }

    watchConfig(key, callback) {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, new Set());
        }
        this.watchers.get(key).add(callback);
        
        // Return unwatch function
        return () => {
            const callbacks = this.watchers.get(key);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.watchers.delete(key);
                }
            }
        };
    }

    notifyWatchers(changes) {
        Object.keys(changes).forEach(key => {
            const callbacks = this.watchers.get(key);
            if (callbacks) {
                callbacks.forEach(callback => {
                    try {
                        callback(this.config[key], changes[key]);
                    } catch (error) {
                        console.error(`❌ Config watcher error for ${key}:`, error);
                    }
                });
            }
        });
    }

    getConfig(key) {
        if (key) {
            return this.config[key];
        }
        return { ...this.config }; // Return copy to prevent external modification
    }

    getPublicConfig() {
        // Return config without sensitive information
        const publicConfig = { ...this.config };
        
        // Hide sensitive keys
        const sensitiveKeys = ['geminiApiKey', 'webhookUrl'];
        sensitiveKeys.forEach(key => {
            if (publicConfig[key]) {
                publicConfig[key] = '[HIDDEN]';
            }
        });
        
        return publicConfig;
    }

    async resetToDefaults() {
        this.config = { ...this.defaultConfig };
        await this.saveConfigToFile();
        this.notifyWatchers(this.config);
        console.log('🔄 Configuration reset to defaults');
    }

    async backup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = this.configPath.replace('.json', `-backup-${timestamp}.json`);
            
            await fs.writeFile(
                backupPath,
                JSON.stringify(this.config, null, 2),
                'utf8'
            );
            
            console.log(`💾 Configuration backed up to: ${backupPath}`);
            return backupPath;
            
        } catch (error) {
            console.error('❌ Config backup failed:', error);
            throw error;
        }
    }

    destroy() {
        // Clear all watchers
        this.watchers.clear();
        this.isInitialized = false;
        console.log('🧹 ConfigManager destroyed');
    }
}

module.exports = ConfigManager;