// Enhanced Main bot file - EnderDragonBot.js
require('dotenv').config();
const bedrock = require('bedrock-protocol');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const EventEmitter = require('events');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

// Import modular components
const MissionManager = require('./modules/MissionManager');
const InventoryManager = require('./modules/InventoryManager');
const ChatManager = require('./modules/ChatManager');
const GameplayManager = require('./modules/GameplayManager');
const LearningManager = require('./modules/LearningManager');
const NavigationManager = require('./modules/NavigationManager');
const CombatManager = require('./modules/CombatManager');
const ConfigManager = require('./modules/ConfigManager');
const EventManager = require('./modules/EventManager');

// Global bot instance for API access
let bot = null;

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// API Routes
app.get('/', (req, res) => {
    res.json({
        status: '✅ Ender Dragon Mission Bot is running!',
        mission: 'Defeat the Ender Dragon',
        gameMode: bot?.gameplayManager?.currentGameMode || 'unknown',
        playersOnline: bot?.players?.size || 0,
        missionStatus: bot?.missionManager?.getCurrentStatus() || 'waiting',
        learningEnabled: bot?.config?.learningEnabled || false,
        uptime: bot ? Math.floor((Date.now() - bot.sessionStartTime) / 1000) : 0
    });
});

app.get('/status', (req, res) => {
    if (!bot) {
        return res.json({ error: 'Bot not initialized' });
    }
    
    res.json({
        connected: bot.connected,
        health: bot.health,
        position: bot.position,
        players: Array.from(bot.players.values()),
        mission: bot.missionManager?.getCurrentStatus(),
        gameplay: bot.gameplayManager?.getGameplayStatus(),
        learning: bot.learningManager?.getStats(),
        navigation: bot.navigationManager?.getCurrentTarget(),
        combat: bot.combatManager?.getCombatStatus(),
        inventory: bot.inventoryManager?.getInventoryStatus()
    });
});

app.get('/config', (req, res) => {
    if (!bot) {
        return res.json({ error: 'Bot not initialized' });
    }
    
    res.json(bot.configManager.getPublicConfig());
});

app.post('/config', (req, res) => {
    if (!bot) {
        return res.json({ error: 'Bot not initialized' });
    }
    
    try {
        bot.configManager.updateConfig(req.body);
        res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/mission/:action', (req, res) => {
    if (!bot) {
        return res.json({ error: 'Bot not initialized' });
    }
    
    const { action } = req.params;
    try {
        switch (action) {
            case 'start':
                bot.missionManager.startMission();
                break;
            case 'pause':
                bot.missionManager.pauseMission();
                break;
            case 'reset':
                bot.missionManager.resetMission();
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        res.json({ success: true, action });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Express server listening on port ${PORT}`);
});

class EnderDragonMissionBot extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Initialize configuration manager first
        this.configManager = new ConfigManager(options);
        this.config = null; // Will be set after async initialization
        
        // Core bot state
        this.client = null;
        this.connected = false;
        this.position = { x: 0, y: 64, z: 0 };
        this.health = 20;
        this.maxHealth = 20;
        this.food = 20;
        this.experience = 0;
        this.players = new Map();
        this.entities = new Map();
        this.chatHistory = [];
        this.lastResponse = Date.now();
        this.sessionStartTime = Date.now();
        
        // Performance monitoring
        this.performance = {
            packetsReceived: 0,
            packetsSent: 0,
            errorCount: 0,
            lastError: null,
            averageResponseTime: 0,
            responseTimes: []
        };
        
        // Will be initialized after config is loaded
        this.genAI = null;
        this.model = null;
    }

    async initialize() {
        console.log('🔧 Initializing configuration...');
        
        // Initialize config manager and get config
        this.config = await this.configManager.initialize();
        
        // Validate critical configuration
        if (!this.config.geminiApiKey) {
            console.error('❌ GEMINI_API_KEY is required! Please set it in your environment variables.');
            throw new Error('GEMINI_API_KEY is required');
        }

        console.log('✅ Configuration loaded successfully');

        // Initialize Gemini AI with enhanced configuration
        this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
        this.model = this.genAI.getGenerativeModel({ 
            model: this.config.geminiModel,
            generationConfig: {
                maxOutputTokens: this.config.maxTokens,
                temperature: this.config.aiTemperature,
                topP: this.config.aiTopP,
                topK: this.config.aiTopK
            }
        });
        
        // Initialize all managers
        this.initializeManagers();
        
        // Setup cross-manager communication
        this.setupManagerCommunication();
        
        // Setup event system
        this.setupEventSystem();

        if (this.config.debugMode) {
            console.log('🐛 Debug mode enabled');
            console.log('📊 Config loaded:', { ...this.config, geminiApiKey: '***hidden***' });
        }

        console.log('✅ Bot initialization complete');
    }

    initializeManagers() {
        console.log('🔧 Initializing managers...');
        
        // Core managers
        this.eventManager = new EventManager(this);
        this.learningManager = new LearningManager(this);
        this.navigationManager = new NavigationManager(this);
        this.combatManager = new CombatManager(this);
        
        // Game managers
        this.gameplayManager = new GameplayManager(this);
        this.missionManager = new MissionManager(this);
        this.inventoryManager = new InventoryManager(this);
        this.chatManager = new ChatManager(this);
        
        console.log('✅ All managers initialized');
    }

    setupManagerCommunication() {
        // Create a registry for manager cross-communication
        const managers = {
            event: this.eventManager,
            learning: this.learningManager,
            navigation: this.navigationManager,
            combat: this.combatManager,
            gameplay: this.gameplayManager,
            mission: this.missionManager,
            inventory: this.inventoryManager,
            chat: this.chatManager,
            config: this.configManager
        };

        // Give each manager access to others
        Object.values(managers).forEach(manager => {
            if (manager && typeof manager.setManagers === 'function') {
                manager.setManagers(managers);
            }
        });
        
        console.log('🔗 Manager communication established');
    }

    setupEventSystem() {
        // Setup centralized event handling
        this.eventManager.registerEventHandlers();
        
        // Performance monitoring events
        this.on('packet_received', () => this.performance.packetsReceived++);
        this.on('packet_sent', () => this.performance.packetsSent++);
        this.on('error', (error) => {
            this.performance.errorCount++;
            this.performance.lastError = error;
        });
        
        // Learning events
        this.on('mission_complete', (data) => this.learningManager.learnFromMissionCompletion(data));
        this.on('player_interaction', (data) => this.learningManager.learnFromPlayerInteraction(data));
        this.on('combat_outcome', (data) => this.learningManager.learnFromCombat(data));
        this.on('navigation_success', (data) => this.learningManager.learnFromNavigation(data));
        
        console.log('📡 Event system configured');
    }

    async connect() {
        console.log(`🐉 Connecting ${this.config.username} to ${this.config.host}:${this.config.port}`);
        console.log('🎯 Mission: Defeat the Ender Dragon!');
        console.log(`🧠 AI Brain: ${this.config.geminiModel}`);
        console.log(`📚 Learning: ${this.config.learningEnabled ? 'Enabled' : 'Disabled'}`);
        
        // Reset session data
        this.sessionStartTime = Date.now();
        this.performance = {
            packetsReceived: 0,
            packetsSent: 0,
            errorCount: 0,
            lastError: null,
            averageResponseTime: 0,
            responseTimes: []
        };
        
        try {
            this.client = bedrock.createClient({
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                version: this.config.version,
                skipPing: this.config.skipPing,
                offline: this.config.offlineMode
            });

            this.setupEventHandlers();
            
        } catch (error) {
            console.error('❌ Connection failed:', error.message);
            this.emit('error', error);
            
            if (this.config.simulationMode) {
                console.log('🎭 Falling back to simulation mode');
                this.simulateConnection();
            } else {
                throw error;
            }
        }
    }

    setupEventHandlers() {
        this.client.on('spawn', async () => {
            console.log('✅ DragonSlayerBot spawned successfully!');
            this.connected = true;
            this.emit('connected');
            
            await this.sendChat('🐉 DragonSlayerBot online! Enhanced AI with learning capabilities active!');
            
            // Initialize managers that need connection
            await this.missionManager.onConnect();
            await this.navigationManager.onConnect();
            await this.combatManager.onConnect();
        });

        this.client.on('text', (packet) => {
            this.emit('packet_received');
            this.chatManager.handleChatMessage(packet);
        });

        this.client.on('add_player', async (packet) => {
            this.emit('packet_received');
            this.players.set(packet.runtime_id, {
                name: packet.username,
                uuid: packet.uuid,
                position: packet.position,
                joinTime: Date.now()
            });
            
            console.log(`👋 Player joined: ${packet.username}`);
            this.emit('player_joined', packet);
            
            await this.missionManager.handlePlayerJoin(packet.username);
        });

        this.client.on('remove_player', (packet) => {
            this.emit('packet_received');
            const player = this.players.get(packet.runtime_id);
            if (player) {
                console.log(`👋 Player left: ${player.name}`);
                this.emit('player_left', player);
                this.players.delete(packet.runtime_id);
                this.missionManager.handlePlayerLeave(player.name);
            }
        });

        this.client.on('move_player', (packet) => {
            this.emit('packet_received');
            if (packet.runtime_id === this.runtimeId) {
                this.position = packet.position;
                this.emit('position_update', packet.position);
            }
        });

        this.client.on('update_attributes', (packet) => {
            this.emit('packet_received');
            if (packet.runtime_id === this.runtimeId) {
                packet.attributes.forEach(attr => {
                    switch (attr.name) {
                        case 'minecraft:health':
                            this.health = attr.current;
                            this.maxHealth = attr.max;
                            break;
                        case 'minecraft:player.hunger':
                            this.food = attr.current;
                            break;
                        case 'minecraft:player.experience':
                            this.experience = attr.current;
                            break;
                    }
                });
                this.emit('stats_update', { health: this.health, food: this.food, experience: this.experience });
            }
        });

        this.client.on('add_entity', (packet) => {
            this.emit('packet_received');
            this.entities.set(packet.runtime_id, packet);
            this.emit('entity_spawned', packet);
        });

        this.client.on('remove_entity', (packet) => {
            this.emit('packet_received');
            const entity = this.entities.get(packet.runtime_id);
            if (entity) {
                this.emit('entity_removed', entity);
                this.entities.delete(packet.runtime_id);
            }
        });

        this.client.on('disconnect', (reason) => {
            console.log('⚠️ Disconnected:', reason);
            this.connected = false;
            this.emit('disconnected', reason);
        });

        this.client.on('error', (error) => {
            console.error('❌ Client error:', error);
            this.emit('error', error);
        });

        // Setup packet monitoring
        this.setupPacketMonitoring();
    }

    setupPacketMonitoring() {
        if (this.config.debugMode) {
            this.client.on('packet', (data, meta) => {
                if (this.config.logPackets) {
                    console.log(`📦 ${meta.name}:`, data);
                }
            });
        }
    }

    simulateConnection() {
        this.connected = true;
        this.emit('connected');
        console.log('🎭 Simulation mode active - Dragon mission ready!');
        
        // Simulate a player joining to start mission
        setTimeout(async () => {
            const simulatedPlayer = {
                runtime_id: 1,
                username: 'Steve',
                uuid: 'simulation-uuid',
                position: { x: 10, y: 64, z: 10 }
            };
            
            this.players.set(1, {
                ...simulatedPlayer,
                joinTime: Date.now()
            });
            
            console.log('👋 Player joined: Steve (simulated)');
            this.emit('player_joined', simulatedPlayer);
            await this.missionManager.handlePlayerJoin('Steve');
        }, 2000);
    }

    async sendChat(message) {
        const startTime = Date.now();
        
        if (this.connected && this.client) {
            try {
                this.client.write('text', {
                    type: 'chat',
                    needs_translation: false,
                    source_name: this.config.username,
                    xuid: '',
                    platform_chat_id: '',
                    message: message
                });
                this.emit('packet_sent');
            } catch (error) {
                console.error('Failed to send chat:', error);
                this.emit('error', error);
            }
        }
        
        // Track response time
        const responseTime = Date.now() - startTime;
        this.performance.responseTimes.push(responseTime);
        if (this.performance.responseTimes.length > 100) {
            this.performance.responseTimes.shift();
        }
        this.performance.averageResponseTime = 
            this.performance.responseTimes.reduce((a, b) => a + b, 0) / this.performance.responseTimes.length;
        
        console.log(`🤖 Bot: ${message}`);
        this.emit('chat_sent', message);
    }

    async generateAIResponse(prompt, context = {}) {
        try {
            const enhancedPrompt = this.learningManager.enhancePromptWithLearning(prompt, context);
            
            const result = await this.model.generateContent(enhancedPrompt);
            const response = result.response.text();
            
            // Learn from this interaction
            this.learningManager.recordAIInteraction(prompt, response, context);
            
            return response;
        } catch (error) {
            console.error('AI generation error:', error);
            this.emit('error', error);
            return "I'm having trouble processing that request right now.";
        }
    }

    getPerformanceStats() {
        return {
            ...this.performance,
            uptime: Date.now() - this.sessionStartTime,
            memoryUsage: process.memoryUsage(),
            playersOnline: this.players.size,
            entitiesTracked: this.entities.size
        };
    }

    async shutdown() {
        console.log('🛑 Shutting down Ender Dragon Bot...');
        
        // Save learning data
        if (this.learningManager) {
            await this.learningManager.saveAllData();
        }
        
        // Disconnect client
        if (this.client && this.connected) {
            await this.sendChat('🐉 DragonSlayerBot shutting down. Dragon mission paused...');
            this.client.disconnect();
        }
        
        console.log('✅ Shutdown complete');
        this.emit('shutdown');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize and start the bot
async function startBot() {
    console.log('🐉 Initializing Enhanced Ender Dragon Mission Bot...');
    
    try {
        bot = new EnderDragonMissionBot();
        
        // Initialize the bot configuration and AI
        await bot.initialize();
        
        bot.on('connected', () => {
            console.log('✅ Bot connected and enhanced mission systems ready!');
        });
        
        bot.on('error', (error) => {
            console.error('🚨 Bot error:', error);
        });
        
        // Connect to server
        await bot.connect();
        
        // Setup graceful shutdown
        process.on('SIGINT', async () => {
            await bot.shutdown();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            await bot.shutdown();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the bot
if (require.main === module) {
    startBot().catch(console.error);
}

module.exports = { EnderDragonMissionBot };