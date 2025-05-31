// modules/ChatManager.js
class ChatManager {
    constructor(bot) {
        this.bot = bot;
        this.chatHistory = [];
        this.maxHistoryLength = 50;
        this.lastAIResponse = Date.now();
        this.aiCooldown = 3000; // 3 seconds between AI responses
        this.learningData = {
            playerBehaviors: new Map(),
            successfulStrategies: [],
            failedStrategies: [],
            gameMode: 'unknown'
        };
    }

    async handleChatMessage(packet) {
        const { message, source_name: playerName, type } = packet;
        
        // Skip if it's the bot's own message
        if (playerName === this.bot.config.username) return;
        
        // Store chat in history
        this.addToHistory(playerName, message);
        
        // Log the message
        console.log(`💬 ${playerName}: ${message}`);
        
        // Analyze player behavior for learning
        this.analyzePlayerBehavior(playerName, message);
        
        // Check if bot should respond
        if (this.shouldRespond(message, playerName)) {
            await this.generateAIResponse(playerName, message);
        }
    }

    addToHistory(playerName, message) {
        this.chatHistory.push({
            timestamp: Date.now(),
            player: playerName,
            message: message
        });
        
        // Keep history manageable
        if (this.chatHistory.length > this.maxHistoryLength) {
            this.chatHistory.shift();
        }
    }

    shouldRespond(message, playerName) {
        const now = Date.now();
        
        // Don't spam responses
        if (now - this.lastAIResponse < this.aiCooldown) return false;
        
        const lowerMessage = message.toLowerCase();
        
        // Respond to direct mentions or dragon-related queries
        const triggers = [
            this.bot.config.username.toLowerCase(),
            'dragon', 'ender', 'end', 'portal',
            'help', 'strategy', 'plan', 'ready',
            'items', 'gear', 'preparation'
        ];
        
        return triggers.some(trigger => lowerMessage.includes(trigger));
    }

    async generateAIResponse(playerName, message) {
        try {
            this.lastAIResponse = Date.now();
            
            const context = this.buildContext(playerName, message);
            const prompt = this.createAIPrompt(context);
            
            if (this.bot.config.debugMode) {
                console.log('🧠 Generating AI response with context:', context);
            }
            
            const result = await this.bot.model.generateContent(prompt);
            const response = result.response.text().trim();
            
            // Learn from the response
            this.learnFromInteraction(playerName, message, response);
            
            // Send the response
            await this.bot.sendChat(response);
            
        } catch (error) {
            console.error('❌ AI response generation failed:', error);
            // Fallback response
            await this.bot.sendChat("I'm processing that... Let me think about our dragon strategy! 🐉");
        }
    }

    buildContext(playerName, message) {
        const missionStatus = this.bot.missionManager.getCurrentStatus();
        const inventory = this.bot.inventoryManager.getInventoryStatus();
        const gameMode = this.bot.gameplayManager.currentGameMode;
        
        return {
            playerName,
            message,
            missionStatus,
            inventory,
            gameMode,
            playerCount: this.bot.players.size,
            recentChat: this.chatHistory.slice(-5),
            learningData: this.learningData
        };
    }

    createAIPrompt(context) {
        return `You are DragonSlayerBot, an expert Minecraft bot whose mission is to defeat the Ender Dragon. You're intelligent, strategic, and adaptive.

CURRENT SITUATION:
- Game Mode: ${context.gameMode}
- Mission Status: ${context.missionStatus}
- Player talking: ${context.playerName}
- Their message: "${context.message}"
- Players online: ${context.playerCount}
- Inventory status: ${context.inventory}

RECENT CHAT HISTORY:
${context.recentChat.map(chat => `${chat.player}: ${chat.message}`).join('\n')}

LEARNING DATA:
- Successful strategies: ${context.learningData.successfulStrategies.join(', ')}
- Failed strategies: ${context.learningData.failedStrategies.join(', ')}

PERSONALITY & RESPONSE GUIDELINES:
- Be enthusiastic about the dragon mission but strategic
- Adapt your advice based on game mode difficulty
- Reference past successes/failures when relevant
- Keep responses under 100 characters for chat
- Use emojis sparingly (1-2 max)
- Be helpful and collaborative

Respond as DragonSlayerBot would in this situation:`;
    }

    analyzePlayerBehavior(playerName, message) {
        if (!this.learningData.playerBehaviors.has(playerName)) {
            this.learningData.playerBehaviors.set(playerName, {
                messageCount: 0,
                topics: [],
                helpfulness: 0,
                lastSeen: Date.now()
            });
        }
        
        const playerData = this.learningData.playerBehaviors.get(playerName);
        playerData.messageCount++;
        playerData.lastSeen = Date.now();
        
        // Analyze message topics
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
            playerData.topics.push('seeking_help');
        }
        if (lowerMessage.includes('dragon') || lowerMessage.includes('end')) {
            playerData.topics.push('mission_focused');
        }
        if (lowerMessage.includes('ready') || lowerMessage.includes('go')) {
            playerData.topics.push('action_oriented');
        }
    }

    learnFromInteraction(playerName, playerMessage, botResponse) {
        // Store this interaction for future learning
        this.learningData.successfulStrategies.push({
            context: playerMessage,
            response: botResponse,
            timestamp: Date.now(),
            gameMode: this.bot.gameplayManager.currentGameMode
        });
        
        // Keep learning data manageable
        if (this.learningData.successfulStrategies.length > 20) {
            this.learningData.successfulStrategies.shift();
        }
    }

    // Called by other modules to report strategy outcomes
    reportStrategyOutcome(strategy, success) {
        if (success) {
            this.learningData.successfulStrategies.push({
                strategy: strategy,
                timestamp: Date.now(),
                gameMode: this.bot.gameplayManager.currentGameMode
            });
        } else {
            this.learningData.failedStrategies.push({
                strategy: strategy,
                timestamp: Date.now(),
                gameMode: this.bot.gameplayManager.currentGameMode
            });
        }
    }

    // Get chat summary for other modules
    getChatSummary() {
        const recentChats = this.chatHistory.slice(-10);
        return {
            recentMessages: recentChats,
            activePlayers: [...new Set(recentChats.map(chat => chat.player))],
            topics: this.extractTopics(recentChats)
        };
    }

    extractTopics(chats) {
        const topics = [];
        const keywords = {
            preparation: ['gear', 'items', 'prepare', 'ready'],
            strategy: ['plan', 'strategy', 'how', 'when'],
            dragon: ['dragon', 'ender', 'end', 'portal'],
            help: ['help', 'assist', 'guide']
        };
        
        chats.forEach(chat => {
            const message = chat.message.toLowerCase();
            Object.entries(keywords).forEach(([topic, words]) => {
                if (words.some(word => message.includes(word))) {
                    topics.push(topic);
                }
            });
        });
        
        return [...new Set(topics)];
    }

    // Emergency broadcast method
    async broadcastToAllPlayers(message) {
        console.log(`📢 Broadcasting: ${message}`);
        await this.bot.sendChat(message);
    }
}

module.exports = ChatManager;