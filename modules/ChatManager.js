// modules/ChatManager.js - Fixed version to resolve string buffer errors
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
        
        // Add message validation and formatting
        this.maxMessageLength = 100; // Minecraft chat limit
        this.messageQueue = [];
        this.isProcessingQueue = false;
    }

    // Fixed method to safely send chat messages
    async sendChatSafely(message) {
        try {
            // Validate and sanitize the message
            if (!message || typeof message !== 'string') {
                console.warn('⚠️ Invalid message provided to sendChatSafely:', typeof message, message);
                return false;
            }

            // Clean the message of problematic characters
            let cleanMessage = message
                .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
                .replace(/[^\x00-\x7F]/g, (char) => { // Handle non-ASCII characters
                    // Convert common Unicode characters to ASCII equivalents
                    const unicodeMap = {
                        '🤖': '[Bot]',
                        '🐉': '[Dragon]',
                        '⚔️': '[Combat]',
                        '🎯': '[Target]',
                        '📢': '[Alert]',
                        '✅': '[OK]',
                        '❌': '[Error]',
                        '💀': '[Death]',
                        '🎉': '[Success]',
                        '⏸️': '[Pause]',
                        '🎒': '[Inventory]',
                        '🧠': '[AI]',
                        '👋': '[Wave]'
                    };
                    return unicodeMap[char] || '';
                })
                .trim();

            // Ensure message isn't empty after cleaning
            if (!cleanMessage) {
                console.warn('⚠️ Message became empty after cleaning');
                return false;
            }

            // Truncate if too long
            if (cleanMessage.length > this.maxMessageLength) {
                cleanMessage = cleanMessage.substring(0, this.maxMessageLength - 3) + '...';
            }

            // Use the bot's native chat method with error handling
            if (this.bot && typeof this.bot.chat === 'function') {
                await this.bot.chat(cleanMessage);
                console.log(`💬 Chat sent: ${cleanMessage}`);
                
                // Emit event for tracking
                if (this.bot.emit) {
                    this.bot.emit('chat_sent', cleanMessage);
                }
                
                return true;
            } else {
                console.error('❌ Bot chat method not available');
                return false;
            }

        } catch (error) {
            console.error('❌ Failed to send chat message:', error);
            console.error('❌ Message that failed:', message);
            
            // Try a fallback simple message
            try {
                if (this.bot && typeof this.bot.chat === 'function') {
                    await this.bot.chat('Bot message failed to send properly');
                }
            } catch (fallbackError) {
                console.error('❌ Even fallback message failed:', fallbackError);
            }
            
            return false;
        }
    }

    async handleChatMessage(packet) {
        try {
            const { message, source_name: playerName, type } = packet;
            
            // Validate packet data
            if (!playerName || !message) {
                console.warn('⚠️ Invalid chat packet received:', packet);
                return;
            }
            
            // Skip if it's the bot's own message
            if (playerName === this.bot.config?.username) return;
            
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
        } catch (error) {
            console.error('❌ Error handling chat message:', error);
        }
    }

    addToHistory(playerName, message) {
        try {
            this.chatHistory.push({
                timestamp: Date.now(),
                player: playerName,
                message: message
            });
            
            // Keep history manageable
            if (this.chatHistory.length > this.maxHistoryLength) {
                this.chatHistory.shift();
            }
        } catch (error) {
            console.error('❌ Error adding to chat history:', error);
        }
    }

    shouldRespond(message, playerName) {
        try {
            const now = Date.now();
            
            // Don't spam responses
            if (now - this.lastAIResponse < this.aiCooldown) return false;
            
            const lowerMessage = message.toLowerCase();
            
            // Respond to direct mentions or dragon-related queries
            const triggers = [
                this.bot.config?.username?.toLowerCase() || 'dragonslayerbot',
                'dragon', 'ender', 'end', 'portal',
                'help', 'strategy', 'plan', 'ready',
                'items', 'gear', 'preparation', 'bot'
            ];
            
            return triggers.some(trigger => lowerMessage.includes(trigger));
        } catch (error) {
            console.error('❌ Error in shouldRespond:', error);
            return false;
        }
    }

    async generateAIResponse(playerName, message) {
        try {
            this.lastAIResponse = Date.now();
            
            const context = this.buildContext(playerName, message);
            
            // Create a simpler, more reliable response system
            const response = this.generateSimpleResponse(playerName, message, context);
            
            if (this.bot.config?.debugMode) {
                console.log('🧠 Generated response:', response);
            }
            
            // Send the response using our safe method
            const success = await this.sendChatSafely(response);
            
            if (success) {
                // Learn from the response
                this.learnFromInteraction(playerName, message, response);
            }
            
        } catch (error) {
            console.error('❌ AI response generation failed:', error);
            // Fallback response without emojis
            await this.sendChatSafely("Processing your request. Let me think about our dragon strategy!");
        }
    }

    generateSimpleResponse(playerName, message, context) {
        const lowerMessage = message.toLowerCase();
        
        // Simple response logic without complex AI
        if (lowerMessage.includes('help')) {
            return `Hi ${playerName}! I'm here to help defeat the Ender Dragon. Need gear or strategy tips?`;
        }
        
        if (lowerMessage.includes('ready') || lowerMessage.includes('go')) {
            return `Great ${playerName}! Let's prepare for the End. Do we have eyes of ender and good gear?`;
        }
        
        if (lowerMessage.includes('dragon') || lowerMessage.includes('end')) {
            return `The Ender Dragon awaits! We need: Eyes of Ender, diamond gear, bows, and food. Ready to go?`;
        }
        
        if (lowerMessage.includes('strategy') || lowerMessage.includes('plan')) {
            return `Strategy: Find stronghold, enter End, destroy crystals, then attack dragon. Team up!`;
        }
        
        if (lowerMessage.includes('gear') || lowerMessage.includes('items')) {
            return `Essential gear: Diamond armor, bow with arrows, food, blocks, and eyes of ender!`;
        }
        
        // Default response
        return `Hello ${playerName}! I'm DragonSlayerBot. Ask me about dragon strategy, gear, or say 'help'!`;
    }

    buildContext(playerName, message) {
        try {
            return {
                playerName,
                message,
                missionStatus: this.bot.missionManager?.getCurrentStatus() || 'preparing',
                inventory: this.bot.inventoryManager?.getInventoryStatus() || 'unknown',
                gameMode: this.bot.gameplayManager?.currentGameMode || 'survival',
                playerCount: this.bot.players?.size || 1,
                recentChat: this.chatHistory.slice(-5),
                learningData: this.learningData
            };
        } catch (error) {
            console.error('❌ Error building context:', error);
            return {
                playerName,
                message,
                missionStatus: 'preparing',
                inventory: 'unknown',
                gameMode: 'survival',
                playerCount: 1,
                recentChat: [],
                learningData: this.learningData
            };
        }
    }

    analyzePlayerBehavior(playerName, message) {
        try {
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
        } catch (error) {
            console.error('❌ Error analyzing player behavior:', error);
        }
    }

    learnFromInteraction(playerName, playerMessage, botResponse) {
        try {
            // Store this interaction for future learning
            this.learningData.successfulStrategies.push({
                context: playerMessage,
                response: botResponse,
                timestamp: Date.now(),
                gameMode: this.bot.gameplayManager?.currentGameMode || 'unknown'
            });
            
            // Keep learning data manageable
            if (this.learningData.successfulStrategies.length > 20) {
                this.learningData.successfulStrategies.shift();
            }
        } catch (error) {
            console.error('❌ Error in learning from interaction:', error);
        }
    }

    // Called by other modules to report strategy outcomes
    reportStrategyOutcome(strategy, success) {
        try {
            if (success) {
                this.learningData.successfulStrategies.push({
                    strategy: strategy,
                    timestamp: Date.now(),
                    gameMode: this.bot.gameplayManager?.currentGameMode || 'unknown'
                });
            } else {
                this.learningData.failedStrategies.push({
                    strategy: strategy,
                    timestamp: Date.now(),
                    gameMode: this.bot.gameplayManager?.currentGameMode || 'unknown'
                });
            }
        } catch (error) {
            console.error('❌ Error reporting strategy outcome:', error);
        }
    }

    // Get chat summary for other modules
    getChatSummary() {
        try {
            const recentChats = this.chatHistory.slice(-10);
            return {
                recentMessages: recentChats,
                activePlayers: [...new Set(recentChats.map(chat => chat.player))],
                topics: this.extractTopics(recentChats)
            };
        } catch (error) {
            console.error('❌ Error getting chat summary:', error);
            return {
                recentMessages: [],
                activePlayers: [],
                topics: []
            };
        }
    }

    extractTopics(chats) {
        try {
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
        } catch (error) {
            console.error('❌ Error extracting topics:', error);
            return [];
        }
    }

    // Emergency broadcast method with better error handling
    async broadcastToAllPlayers(message) {
        console.log(`📢 Broadcasting: ${message}`);
        return await this.sendChatSafely(message);
    }

    // Welcome player method referenced in EventManager
    async welcomePlayer(playerName) {
        const welcomeMessage = `Welcome ${playerName}! I'm DragonSlayerBot. Ready to hunt the Ender Dragon together?`;
        return await this.sendChatSafely(welcomeMessage);
    }

    // Handle incoming chat method for EventManager
    async handleIncomingChat(message) {
        return await this.handleChatMessage(message);
    }
}

module.exports = ChatManager;