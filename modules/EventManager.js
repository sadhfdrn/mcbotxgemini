// EventManager.js - Centralized event handling for EnderDragonBot
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class EventManager extends EventEmitter {
    constructor(bot) {
        super();
        this.bot = bot;
        this.managers = {};
        
        // Event tracking and analytics
        this.eventStats = {
            totalEvents: 0,
            eventCounts: {},
            recentEvents: [],
            errorEvents: [],
            performanceMetrics: {}
        };
        
        // Event handlers registry
        this.handlers = new Map();
        this.middlewares = [];
        this.eventQueue = [];
        this.processing = false;
        
        // Configuration
        this.config = {
            maxRecentEvents: 100,
            maxErrorEvents: 50,
            enableEventLogging: bot.config?.debugMode || false,
            eventLogFile: './logs/events.log',
            queueProcessingInterval: 50, // ms
            enablePerformanceTracking: true
        };
        
        console.log('📡 EventManager initialized');
        this.setupBasicHandlers();
    }

    setManagers(managers) {
        this.managers = managers;
        console.log('🔗 EventManager connected to other managers');
    }

    setupBasicHandlers() {
        // Connection events
        this.registerHandler('connected', this.onConnected.bind(this));
        this.registerHandler('disconnected', this.onDisconnected.bind(this));
        
        // Player events
        this.registerHandler('player_joined', this.onPlayerJoined.bind(this));
        this.registerHandler('player_left', this.onPlayerLeft.bind(this));
        this.registerHandler('player_interaction', this.onPlayerInteraction.bind(this));
        
        // Chat events
        this.registerHandler('chat_received', this.onChatReceived.bind(this));
        this.registerHandler('chat_sent', this.onChatSent.bind(this));
        
        // Mission events
        this.registerHandler('mission_started', this.onMissionStarted.bind(this));
        this.registerHandler('mission_completed', this.onMissionCompleted.bind(this));
        this.registerHandler('mission_failed', this.onMissionFailed.bind(this));
        this.registerHandler('mission_paused', this.onMissionPaused.bind(this));
        
        // Combat events
        this.registerHandler('combat_started', this.onCombatStarted.bind(this));
        this.registerHandler('combat_ended', this.onCombatEnded.bind(this));
        this.registerHandler('entity_damaged', this.onEntityDamaged.bind(this));
        this.registerHandler('bot_damaged', this.onBotDamaged.bind(this));
        
        // Navigation events
        this.registerHandler('navigation_started', this.onNavigationStarted.bind(this));
        this.registerHandler('navigation_completed', this.onNavigationCompleted.bind(this));
        this.registerHandler('navigation_failed', this.onNavigationFailed.bind(this));
        this.registerHandler('position_update', this.onPositionUpdate.bind(this));
        
        // Inventory events
        this.registerHandler('item_collected', this.onItemCollected.bind(this));
        this.registerHandler('item_used', this.onItemUsed.bind(this));
        this.registerHandler('inventory_full', this.onInventoryFull.bind(this));
        
        // Entity events
        this.registerHandler('entity_spawned', this.onEntitySpawned.bind(this));
        this.registerHandler('entity_removed', this.onEntityRemoved.bind(this));
        this.registerHandler('ender_dragon_spotted', this.onEnderDragonSpotted.bind(this));
        
        // Learning events
        this.registerHandler('learning_updated', this.onLearningUpdated.bind(this));
        this.registerHandler('pattern_discovered', this.onPatternDiscovered.bind(this));
        
        // System events
        this.registerHandler('error', this.onError.bind(this));
        this.registerHandler('performance_warning', this.onPerformanceWarning.bind(this));
        this.registerHandler('config_updated', this.onConfigUpdated.bind(this));
        
        // Packet events
        this.registerHandler('packet_received', this.onPacketReceived.bind(this));
        this.registerHandler('packet_sent', this.onPacketSent.bind(this));
    }

    registerEventHandlers() {
        // Register all handlers with the bot's event system
        this.handlers.forEach((handler, eventName) => {
            this.bot.on(eventName, async (...args) => {
                await this.processEvent(eventName, args, handler);
            });
        });
        
        // Start event queue processing
        this.startEventQueueProcessing();
        
        console.log(`📡 Registered ${this.handlers.size} event handlers`);
    }

    registerHandler(eventName, handler) {
        if (typeof handler !== 'function') {
            throw new Error(`Handler for ${eventName} must be a function`);
        }
        
        this.handlers.set(eventName, handler);
    }

    addMiddleware(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        this.middlewares.push(middleware);
    }

    async processEvent(eventName, args, handler) {
        const startTime = Date.now();
        
        try {
            // Update statistics
            this.eventStats.totalEvents++;
            this.eventStats.eventCounts[eventName] = (this.eventStats.eventCounts[eventName] || 0) + 1;
            
            // Create event object
            const eventData = {
                name: eventName,
                args: args,
                timestamp: Date.now(),
                id: this.generateEventId()
            };
            
            // Add to recent events
            this.eventStats.recentEvents.push(eventData);
            if (this.eventStats.recentEvents.length > this.config.maxRecentEvents) {
                this.eventStats.recentEvents.shift();
            }
            
            // Process through middlewares
            for (const middleware of this.middlewares) {
                try {
                    await middleware(eventData);
                } catch (error) {
                    console.error(`Middleware error for ${eventName}:`, error);
                }
            }
            
            // Execute main handler
            if (handler) {
                await handler(...args);
            }
            
            // Track performance
            if (this.config.enablePerformanceTracking) {
                const processingTime = Date.now() - startTime;
                this.trackEventPerformance(eventName, processingTime);
            }
            
            // Log event if enabled
            if (this.config.enableEventLogging) {
                await this.logEvent(eventData, processingTime);
            }
            
        } catch (error) {
            console.error(`Event handler error for ${eventName}:`, error);
            this.recordError(eventName, error, args);
        }
    }

    // Connection Event Handlers
    async onConnected() {
        console.log('📡 EventManager: Bot connected');
        await this.notifyManagers('connected');
    }

    async onDisconnected(reason) {
        console.log('📡 EventManager: Bot disconnected -', reason);
        await this.notifyManagers('disconnected', { reason });
    }

    // Player Event Handlers
    async onPlayerJoined(player) {
        console.log(`📡 EventManager: Player joined - ${player.username}`);
        
        // Notify relevant managers
        if (this.managers.mission) {
            await this.managers.mission.handlePlayerJoin(player.username);
        }
        
        if (this.managers.chat) {
            await this.managers.chat.welcomePlayer(player.username);
        }
        
        // Record interaction for learning
        this.bot.emit('player_interaction', {
            type: 'join',
            player: player.username,
            timestamp: Date.now()
        });
    }

    async onPlayerLeft(player) {
        console.log(`📡 EventManager: Player left - ${player.name}`);
        
        if (this.managers.mission) {
            await this.managers.mission.handlePlayerLeave(player.name);
        }
        
        // Record interaction for learning
        this.bot.emit('player_interaction', {
            type: 'leave',
            player: player.name,
            timestamp: Date.now()
        });
    }

    async onPlayerInteraction(data) {
        if (this.managers.learning) {
            await this.managers.learning.learnFromPlayerInteraction(data);
        }
    }

    // Chat Event Handlers
    async onChatReceived(message) {
        console.log(`📡 EventManager: Chat received - ${message.username}: ${message.message}`);
        
        // Process through chat manager
        if (this.managers.chat) {
            await this.managers.chat.handleIncomingChat(message);
        }
    }

    async onChatSent(message) {
        console.log(`📡 EventManager: Chat sent - ${message}`);
    }

    // Mission Event Handlers
    async onMissionStarted(missionData) {
        console.log('📡 EventManager: Mission started -', missionData.type);
        
        // Notify all relevant managers
        await this.notifyManagers('mission_started', missionData);
        
        // Update bot status
        await this.bot.sendChat(`🐉 Mission started: ${missionData.type}`);
    }

    async onMissionCompleted(missionData) {
        console.log('📡 EventManager: Mission completed!');
        
        // Celebrate success
        await this.bot.sendChat('🎉 Mission completed successfully!');
        
        // Learn from success
        if (this.managers.learning) {
            await this.managers.learning.learnFromMissionCompletion(missionData);
        }
        
        await this.notifyManagers('mission_completed', missionData);
    }

    async onMissionFailed(failureData) {
        console.log('📡 EventManager: Mission failed -', failureData.reason);
        
        await this.bot.sendChat(`💀 Mission failed: ${failureData.reason}`);
        
        // Learn from failure
        if (this.managers.learning) {
            await this.managers.learning.learnFromFailure(failureData);
        }
    }

    async onMissionPaused() {
        console.log('📡 EventManager: Mission paused');
        await this.bot.sendChat('⏸️ Mission paused');
    }

    // Combat Event Handlers
    async onCombatStarted(combatData) {
        console.log('📡 EventManager: Combat started with', combatData.target);
        
        if (this.managers.combat) {
            await this.managers.combat.handleCombatStart(combatData);
        }
        
        await this.bot.sendChat(`⚔️ Engaging ${combatData.target}!`);
    }

    async onCombatEnded(combatResult) {
        console.log('📡 EventManager: Combat ended -', combatResult.outcome);
        
        // Learn from combat
        if (this.managers.learning) {
            await this.managers.learning.learnFromCombat(combatResult);
        }
        
        const message = combatResult.outcome === 'victory' ? 
            `✅ Defeated ${combatResult.target}!` : 
            `💀 Combat lost against ${combatResult.target}`;
            
        await this.bot.sendChat(message);
    }

    async onEntityDamaged(damageData) {
        if (this.managers.combat) {
            await this.managers.combat.handleEntityDamage(damageData);
        }
    }

    async onBotDamaged(damageData) {
        console.log('📡 EventManager: Bot took damage -', damageData.amount);
        
        if (this.managers.combat) {
            await this.managers.combat.handleBotDamage(damageData);
        }
        
        // Emergency healing if health is low
        if (this.bot.health < 6 && this.managers.inventory) {
            await this.managers.inventory.useHealingItem();
        }
    }

    // Navigation Event Handlers
    async onNavigationStarted(target) {
        console.log('📡 EventManager: Navigation started to', target);
    }

    async onNavigationCompleted(navigationData) {
        console.log('📡 EventManager: Navigation completed');
        
        if (this.managers.learning) {
            await this.managers.learning.learnFromNavigation(navigationData);
        }
    }

    async onNavigationFailed(failureData) {
        console.log('📡 EventManager: Navigation failed -', failureData.reason);
        
        if (this.managers.navigation) {
            await this.managers.navigation.handleNavigationFailure(failureData);
        }
    }

    async onPositionUpdate(position) {
        // Only log significant position changes to avoid spam
        if (this.shouldLogPositionUpdate(position)) {
            console.log(`📡 EventManager: Position updated - X:${Math.round(position.x)} Y:${Math.round(position.y)} Z:${Math.round(position.z)}`);
        }
    }

    // Inventory Event Handlers
    async onItemCollected(item) {
        console.log('📡 EventManager: Item collected -', item.name);
        
        if (this.managers.inventory) {
            await this.managers.inventory.processCollectedItem(item);
        }
    }

    async onItemUsed(item) {
        console.log('📡 EventManager: Item used -', item.name);
    }

    async onInventoryFull() {
        console.log('📡 EventManager: Inventory is full!');
        await this.bot.sendChat('🎒 My inventory is full! Need to organize items.');
        
        if (this.managers.inventory) {
            await this.managers.inventory.organizeInventory();
        }
    }

    // Entity Event Handlers
    async onEntitySpawned(entity) {
        if (entity.type === 'ender_dragon') {
            this.bot.emit('ender_dragon_spotted', entity);
        }
        
        if (this.managers.combat && this.isHostileEntity(entity)) {
            await this.managers.combat.handleHostileEntitySpawn(entity);
        }
    }

    async onEntityRemoved(entity) {
        if (this.managers.combat) {
            await this.managers.combat.handleEntityRemoval(entity);
        }
    }

    async onEnderDragonSpotted(dragon) {
        console.log('🐉 EventManager: ENDER DRAGON SPOTTED!');
        await this.bot.sendChat('🐉 ENDER DRAGON DETECTED! Beginning final assault!');
        
        if (this.managers.mission) {
            await this.managers.mission.handleEnderDragonSpotted(dragon);
        }
        
        if (this.managers.combat) {
            await this.managers.combat.engageEnderDragon(dragon);
        }
    }

    // Learning Event Handlers
    async onLearningUpdated(learningData) {
        console.log('📡 EventManager: Learning system updated');
    }

    async onPatternDiscovered(pattern) {
        console.log('📡 EventManager: New pattern discovered -', pattern.type);
        await this.bot.sendChat(`🧠 I've learned something new about ${pattern.type}!`);
    }

    // System Event Handlers
    async onError(error) {
        console.error('📡 EventManager: System error -', error.message);
        this.recordError('system_error', error);
        
        // Attempt recovery based on error type
        await this.attemptErrorRecovery(error);
    }

    async onPerformanceWarning(warning) {
        console.warn('📡 EventManager: Performance warning -', warning);
    }

    async onConfigUpdated(config) {
        console.log('📡 EventManager: Configuration updated');
        this.config = { ...this.config, ...config };
    }

    // Packet Event Handlers
    async onPacketReceived() {
        // Increment packet counter (handled by main bot)
    }

    async onPacketSent() {
        // Increment packet counter (handled by main bot)
    }

    // Utility Methods
    async notifyManagers(eventType, data = {}) {
        const notifications = [];
        
        Object.entries(this.managers).forEach(([name, manager]) => {
            if (manager && typeof manager.handleEvent === 'function') {
                notifications.push(manager.handleEvent(eventType, data));
            }
        });
        
        await Promise.allSettled(notifications);
    }

    shouldLogPositionUpdate(position) {
        if (!this.lastLoggedPosition) {
            this.lastLoggedPosition = position;
            return true;
        }
        
        const distance = Math.sqrt(
            Math.pow(position.x - this.lastLoggedPosition.x, 2) +
            Math.pow(position.y - this.lastLoggedPosition.y, 2) +
            Math.pow(position.z - this.lastLoggedPosition.z, 2)
        );
        
        if (distance > 5) { // Log every 5 blocks
            this.lastLoggedPosition = position;
            return true;
        }
        
        return false;
    }

    isHostileEntity(entity) {
        const hostileTypes = [
            'zombie', 'skeleton', 'creeper', 'spider', 'enderman',
            'witch', 'blaze', 'ghast', 'ender_dragon', 'wither'
        ];
        return hostileTypes.includes(entity.type);
    }

    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    trackEventPerformance(eventName, processingTime) {
        if (!this.eventStats.performanceMetrics[eventName]) {
            this.eventStats.performanceMetrics[eventName] = {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                maxTime: 0,
                minTime: Infinity
            };
        }
        
        const metrics = this.eventStats.performanceMetrics[eventName];
        metrics.count++;
        metrics.totalTime += processingTime;
        metrics.averageTime = metrics.totalTime / metrics.count;
        metrics.maxTime = Math.max(metrics.maxTime, processingTime);
        metrics.minTime = Math.min(metrics.minTime, processingTime);
        
        // Warn about slow events
        if (processingTime > 1000) { // 1 second
            this.bot.emit('performance_warning', {
                event: eventName,
                processingTime,
                message: `Slow event processing: ${eventName} took ${processingTime}ms`
            });
        }
    }

    recordError(eventName, error, args = []) {
        const errorRecord = {
            event: eventName,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            args: args,
            timestamp: Date.now()
        };
        
        this.eventStats.errorEvents.push(errorRecord);
        if (this.eventStats.errorEvents.length > this.config.maxErrorEvents) {
            this.eventStats.errorEvents.shift();
        }
    }

    async attemptErrorRecovery(error) {
        // Basic error recovery strategies
        if (error.message.includes('connection')) {
            console.log('📡 EventManager: Attempting connection recovery...');
            // Could trigger reconnection logic here
        } else if (error.message.includes('timeout')) {
            console.log('📡 EventManager: Handling timeout error...');
            // Could implement timeout recovery
        }
    }

    async logEvent(eventData, processingTime) {
        try {
            const logDir = path.dirname(this.config.eventLogFile);
            await fs.mkdir(logDir, { recursive: true });
            
            const logEntry = {
                ...eventData,
                processingTime,
                botState: {
                    position: this.bot.position,
                    health: this.bot.health,
                    connected: this.bot.connected
                }
            };
            
            await fs.appendFile(
                this.config.eventLogFile,
                JSON.stringify(logEntry) + '\n'
            );
        } catch (error) {
            console.error('Failed to log event:', error);
        }
    }

    startEventQueueProcessing() {
        setInterval(() => {
            this.processEventQueue();
        }, this.config.queueProcessingInterval);
    }

    async processEventQueue() {
        if (this.processing || this.eventQueue.length === 0) {
            return;
        }
        
        this.processing = true;
        
        try {
            while (this.eventQueue.length > 0) {
                const queuedEvent = this.eventQueue.shift();
                await this.processEvent(
                    queuedEvent.name,
                    queuedEvent.args,
                    queuedEvent.handler
                );
            }
        } catch (error) {
            console.error('Event queue processing error:', error);
        } finally {
            this.processing = false;
        }
    }

    // Public API Methods
    getEventStats() {
        return {
            ...this.eventStats,
            queueLength: this.eventQueue.length,
            handlersRegistered: this.handlers.size,
            middlewareCount: this.middlewares.length
        };
    }

    getRecentEvents(limit = 10) {
        return this.eventStats.recentEvents.slice(-limit);
    }

    getEventPerformance() {
        return this.eventStats.performanceMetrics;
    }

    getErrorHistory() {
        return this.eventStats.errorEvents;
    }

    clearEventHistory() {
        this.eventStats.recentEvents = [];
        this.eventStats.errorEvents = [];
        this.eventStats.eventCounts = {};
        this.eventStats.performanceMetrics = {};
        console.log('📡 EventManager: Event history cleared');
    }
}

module.exports = EventManager;