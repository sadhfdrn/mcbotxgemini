// modules/MissionManager.js
class MissionManager {
    constructor(bot) {
        this.bot = bot;
        
        // Mission state
        this.missionActive = false;
        this.missionStarted = false;
        this.currentPhase = 'waiting'; // waiting, research, preparation, nether, stronghold, end_fight
        this.currentTask = null;
        this.progressLog = [];
        
        // Research data
        this.research = {
            enderDragonKnowledge: '',
            currentStrategy: '',
            requiredItems: [],
            currentGoal: ''
        };
        
        // Strategy state
        this.adaptiveStrategy = null;
        
        this.setupGeminiContext();
    }

    // ADD MISSING METHOD: getCurrentStatus
    getCurrentStatus() {
        return {
            missionActive: this.missionActive,
            missionStarted: this.missionStarted,
            currentPhase: this.currentPhase,
            currentTask: this.currentTask,
            currentGoal: this.research.currentGoal || 'Waiting for mission start',
            strategy: this.research.currentStrategy || 'No strategy set',
            adaptiveStrategy: this.adaptiveStrategy,
            progressCount: this.progressLog.length,
            lastProgress: this.progressLog.length > 0 ? this.progressLog[this.progressLog.length - 1] : null
        };
    }

    // ADD MISSING METHOD: onConnect
    async onConnect() {
        console.log('🔗 MissionManager: Bot connected, initializing mission system...');
        
        // Initialize mission state on connection
        if (!this.missionStarted && this.bot.players && Object.keys(this.bot.players).length > 0) {
            console.log('🎯 Players detected, starting mission...');
            await this.startEnderDragonMission();
        } else {
            console.log('⏳ Waiting for players to join before starting mission...');
            // Send a safe welcome message
            try {
                await this.bot.sendChat('🤖 DragonSlayerBot connected! Ready to hunt the Ender Dragon!');
            } catch (error) {
                console.error('Failed to send welcome message:', error);
            }
        }
    }

    // FIXED: updateStrategy method with better error handling
    async updateStrategy(strategy) {
        try {
            this.adaptiveStrategy = strategy;
            console.log('📋 Mission strategy updated:', strategy);
            
            // Update the research strategy based on the adaptive strategy
            if (strategy.dragonStrategy) {
                this.research.currentStrategy = `${strategy.dragonStrategy} approach with ${strategy.preparation} preparation`;
            }
            
            // Adjust current goal based on strategy
            if (this.currentPhase === 'preparation') {
                switch (strategy.preparation) {
                    case 'minimal':
                        this.research.currentGoal = 'Quick resource gathering - basic gear only';
                        break;
                    case 'comprehensive':
                        this.research.currentGoal = 'Thorough preparation - full diamond gear, food, and extras';
                        break;
                    case 'extensive':
                        this.research.currentGoal = 'Maximum preparation - backup gear, potions, and safety items';
                        break;
                    default:
                        this.research.currentGoal = 'Standard resource gathering and preparation';
                }
            }
            
            // Update system prompt context
            this.setupGeminiContext();
            
            return true;
        } catch (error) {
            console.error('❌ Strategy update failed:', error);
            return false;
        }
    }

    // Get current adaptive strategy
    getAdaptiveStrategy() {
        return this.adaptiveStrategy || {
            dragonStrategy: 'balanced_tactical',
            preparation: 'comprehensive',
            riskTolerance: 'calculated',
            collaboration: 'coordinated_assault'
        };
    }

    setupGeminiContext() {
        const adaptiveStrategy = this.getAdaptiveStrategy();
        this.systemPrompt = `You are DragonSlayerBot, an AI assistant in Minecraft Bedrock Edition with ONE ULTIMATE MISSION: Defeat the Ender Dragon!

Your personality:
- Determined and focused on the Ender Dragon mission
- Strategic and analytical about planning
- Excited about progress towards the goal
- Helpful to players but always keeping the mission in mind
- Research-oriented and knowledge-seeking

Mission Status: ${this.missionActive ? 'ACTIVE' : 'WAITING FOR PLAYERS'}
Current Phase: ${this.currentPhase}
Current Goal: ${this.research.currentGoal || 'Waiting for mission start'}

Current strategy: ${this.research.currentStrategy || 'Strategy pending'}
Adaptive Strategy: ${adaptiveStrategy.dragonStrategy} with ${adaptiveStrategy.riskTolerance} risk tolerance

Available actions you can take:
- Research and plan strategies
- Mine for resources (diamonds, iron, obsidian)
- Hunt for ender pearls and blaze rods
- Craft weapons, armor, and tools
- Build farms and structures
- Navigate to the Nether
- Find strongholds and End portals
- Fight the Ender Dragon

Always respond with determination and focus on the mission. Keep responses under 150 characters for chat.`;
    }

    async handlePlayerJoin(playerName) {
        console.log(`🎮 Player joined: ${playerName}`);
        
        if (!this.missionStarted && this.bot.players && Object.keys(this.bot.players).length === 1) {
            await this.startEnderDragonMission();
        } else if (this.missionActive) {
            try {
                await this.bot.sendChat(`Welcome ${playerName}! Join my quest to defeat the Ender Dragon! 🐉⚔️`);
                await this.briefNewPlayer(playerName);
            } catch (error) {
                console.error('Failed to send player join message:', error);
            }
        }
    }

    handlePlayerLeave(playerName) {
        console.log(`🚪 Player left: ${playerName}`);
        
        if (this.bot.players && Object.keys(this.bot.players).length === 0 && this.missionActive) {
            try {
                this.bot.sendChat('🤖 Continuing the dragon mission solo! The quest must go on!');
            } catch (error) {
                console.error('Failed to send player leave message:', error);
            }
        }
    }

    // FIXED: Added better error handling for chat messages
    async safeSendChat(message) {
        try {
            if (message && typeof message === 'string' && message.trim().length > 0) {
                await this.bot.sendChat(message);
            } else {
                console.warn('Attempted to send invalid chat message:', message);
            }
        } catch (error) {
            console.error('Failed to send chat message:', error);
        }
    }

    async startEnderDragonMission() {
        if (this.missionStarted) return;
        
        this.missionStarted = true;
        this.missionActive = true;
        this.currentPhase = 'research';
        
        console.log('🚀 ENDER DRAGON MISSION INITIATED!');
        await this.safeSendChat('🐉 MISSION START! Time to defeat the Ender Dragon! Let me research our strategy...');
        
        this.logProgress('Mission initiated - Beginning research phase');
        await this.conductEnderDragonResearch();
    }

    async conductEnderDragonResearch() {
        console.log('🔬 Conducting Ender Dragon research...');
        await this.safeSendChat('📚 Researching Ender Dragon tactics... Give me a moment!');
        
        try {
            // Check if bot has AI model available
            if (!this.bot.model) {
                console.log('⚠️ AI model not available, using basic strategy');
                await this.setBasicStrategy();
                await this.startPreparationPhase();
                return;
            }

            const researchPrompt = `As an expert Minecraft player planning to defeat the Ender Dragon, provide a comprehensive strategy including:

1. Essential items needed (weapons, armor, food, building blocks, etc.)
2. Step-by-step preparation phases
3. Nether exploration requirements (blaze rods, ender pearls)
4. How to find and activate the End portal
5. Ender Dragon fight tactics and phases
6. Common mistakes to avoid
7. Estimated timeline for completion

Be specific about quantities and crafting recipes. This is for Minecraft Bedrock Edition.`;

            const result = await this.bot.model.generateContent(researchPrompt);
            const researchResponse = result.response.text();
            
            this.research.enderDragonKnowledge = researchResponse;
            await this.parseResearchForStrategy(researchResponse);
            
            console.log('✅ Research complete!');
            await this.safeSendChat('🧠 Research complete! I now have a strategy to defeat the dragon!');
            
            this.logProgress('Research phase completed');
            await this.startPreparationPhase();
            
        } catch (error) {
            console.error('❌ Research failed:', error);
            await this.safeSendChat('🤔 Research hit a snag, but I know the basics! Let\'s start preparing!');
            await this.setBasicStrategy();
            await this.startPreparationPhase();
        }
    }

    async parseResearchForStrategy(research) {
        try {
            if (!this.bot.model) {
                await this.setBasicStrategy();
                return;
            }

            const strategyPrompt = `Based on this Ender Dragon research, extract:
1. A prioritized list of items needed
2. The immediate next goal/action
3. A concise strategy summary (under 200 words)

Research: ${research}

Format as:
ITEMS: item1, item2, item3...
NEXT_GOAL: what to do immediately
STRATEGY: brief strategy summary`;

            const result = await this.bot.model.generateContent(strategyPrompt);
            const parsed = result.response.text();
            
            const lines = parsed.split('\n');
            for (const line of lines) {
                if (line.startsWith('ITEMS:')) {
                    this.research.requiredItems = line.replace('ITEMS:', '').split(',').map(item => item.trim());
                } else if (line.startsWith('NEXT_GOAL:')) {
                    this.research.currentGoal = line.replace('NEXT_GOAL:', '').trim();
                } else if (line.startsWith('STRATEGY:')) {
                    this.research.currentStrategy = line.replace('STRATEGY:', '').trim();
                }
            }
            
        } catch (error) {
            console.error('Strategy parsing failed:', error);
            await this.setBasicStrategy();
        }
    }

    async setBasicStrategy() {
        this.research.requiredItems = [
            'Diamond sword', 'Diamond pickaxe', 'Diamond armor set',
            'Bow and arrows', 'Ender pearls (12+)', 'Blaze rods (7+)',
            'Food (steak/bread)', 'Building blocks', 'Crafting table'
        ];
        this.research.currentGoal = 'Mine diamonds and gather basic resources';
        this.research.currentStrategy = 'Gather diamonds, create equipment, explore Nether for blaze rods and ender pearls, find stronghold, defeat dragon';
    }

    async startPreparationPhase() {
        this.currentPhase = 'preparation';
        await this.safeSendChat(`🎯 Phase 1: Preparation! Goal: ${this.research.currentGoal}`);
        
        console.log('📋 Required items:', this.research.requiredItems);
        console.log('🎯 Current goal:', this.research.currentGoal);
        
        this.logProgress(`Preparation phase started - Goal: ${this.research.currentGoal}`);
        
        // Delegate to gameplay manager
        if (this.bot.gameplayManager && typeof this.bot.gameplayManager.beginResourceGathering === 'function') {
            await this.bot.gameplayManager.beginResourceGathering();
        } else {
            console.log('⚠️ GameplayManager or beginResourceGathering method not available');
        }
    }

    async advanceMissionPhase(newPhase) {
        this.currentPhase = newPhase;
        this.setupGeminiContext(); // Update context with new phase
        
        switch (newPhase) {
            case 'nether':
                if (this.bot.gameplayManager && typeof this.bot.gameplayManager.startNetherExpedition === 'function') {
                    await this.bot.gameplayManager.startNetherExpedition();
                }
                break;
            case 'stronghold':
                if (this.bot.gameplayManager && typeof this.bot.gameplayManager.searchForStronghold === 'function') {
                    await this.bot.gameplayManager.searchForStronghold();
                }
                break;
            case 'end_fight':
                if (this.bot.gameplayManager && typeof this.bot.gameplayManager.enterTheEnd === 'function') {
                    await this.bot.gameplayManager.enterTheEnd();
                }
                break;
            case 'victory':
                await this.celebrateVictory();
                break;
        }
    }

    async celebrateVictory() {
        console.log('🏆 ENDER DRAGON DEFEATED!');
        await this.safeSendChat('🏆 THE ENDER DRAGON IS DEFEATED! MISSION ACCOMPLISHED!');
        
        await this.bot.delay(2000);
        await this.safeSendChat('🎉 Victory! The realm is safe! XP and dragon egg claimed!');
        
        this.logProgress('MISSION COMPLETED: Ender Dragon defeated successfully!');
        this.currentPhase = 'victory';
        this.currentTask = 'celebrating';
        
        await this.bot.delay(3000);
        await this.safeSendChat('🐉➡️💀 From zero to dragon slayer! What an epic journey!');
        
        this.printMissionSummary();
        
        setTimeout(() => {
            this.safeSendChat('🚀 Ready for another adventure? Type "!restart" for a new mission!');
        }, 5000);
    }

    printMissionSummary() {
        console.log('🎊 Mission Summary:');
        console.log('✅ Research completed');
        console.log('✅ Diamond gear crafted');
        console.log('✅ Nether expedition successful');
        console.log('✅ Stronghold found and portal activated');
        console.log('✅ Ender Dragon defeated');
        console.log('🏆 MISSION STATUS: COMPLETE!');
    }

    async restartMission() {
        await this.safeSendChat('🔄 Restarting dragon mission! Back to the beginning!');
        this.missionStarted = false;
        this.missionActive = false;
        this.currentPhase = 'waiting';
        this.currentTask = null;
        this.progressLog = [];
        this.adaptiveStrategy = null; // Reset adaptive strategy
        
        // Reset research
        this.research = {
            enderDragonKnowledge: '',
            currentStrategy: '',
            requiredItems: [],
            currentGoal: ''
        };
        
        setTimeout(() => this.startEnderDragonMission(), 2000);
    }

    async briefNewPlayer(playerName) {
        await this.bot.delay(1000);
        await this.safeSendChat(`${playerName}: I'm on an epic quest to defeat the Ender Dragon! 🐉`);
        await this.bot.delay(2000);
        await this.safeSendChat(`Current phase: ${this.currentPhase} | Join the adventure! 🗡️`);
    }

    logProgress(message) {
        const timestamp = new Date().toISOString();
        this.progressLog.push({ timestamp, message });
        console.log(`📊 Progress: ${message}`);
    }

    // Status reporting methods
    getStatus() {
        return `🤖 Status: ${this.currentPhase} | Goal: ${this.research.currentGoal || 'Dragon hunt!'}`;
    }

    getMissionProgress() {
        const phases = ['research', 'preparation', 'nether', 'stronghold', 'end_fight', 'victory'];
        const current = phases.indexOf(this.currentPhase);
        return `🐉 Mission: ${current + 1}/${phases.length} phases complete | Current: ${this.currentPhase}`;
    }

    getStrategy() {
        const strategy = this.research.currentStrategy || 'Gather resources, explore Nether, find stronghold, defeat dragon!';
        return `🧠 Strategy: ${strategy.substring(0, 120)}...`;
    }

    // ADD: Method to handle events from EventManager
    async handleEvent(eventType, data) {
        switch (eventType) {
            case 'connected':
                await this.onConnect();
                break;
            case 'mission_started':
                // Handle mission start events
                break;
            case 'mission_completed':
                // Handle mission completion events
                break;
            default:
                // Handle other events as needed
                break;
        }
    }

    // ADD: Method to handle Ender Dragon spotted
    async handleEnderDragonSpotted(dragon) {
        console.log('🐉 MissionManager: Ender Dragon spotted!');
        this.currentPhase = 'end_fight';
        this.currentTask = 'engaging_dragon';
        
        await this.safeSendChat('🐉 TARGET ACQUIRED! Engaging the Ender Dragon!');
        this.logProgress('Ender Dragon spotted - Final battle begins!');
    }
}

module.exports = MissionManager;