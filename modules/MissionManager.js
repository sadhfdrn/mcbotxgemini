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
        
        this.setupGeminiContext();
    }

    setupGeminiContext() {
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

Current strategy: ${this.research.currentStrategy}

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
        if (!this.missionStarted && this.bot.players.size === 1) {
            await this.startEnderDragonMission();
        } else if (this.missionActive) {
            await this.bot.sendChat(`Welcome ${playerName}! Join my quest to defeat the Ender Dragon! 🐉⚔️`);
            await this.briefNewPlayer(playerName);
        }
    }

    handlePlayerLeave(playerName) {
        if (this.bot.players.size === 0 && this.missionActive) {
            this.bot.sendChat('🤖 Continuing the dragon mission solo! The quest must go on!');
        }
    }

    async startEnderDragonMission() {
        if (this.missionStarted) return;
        
        this.missionStarted = true;
        this.missionActive = true;
        this.currentPhase = 'research';
        
        console.log('🚀 ENDER DRAGON MISSION INITIATED!');
        await this.bot.sendChat('🐉 MISSION START! Time to defeat the Ender Dragon! Let me research our strategy...');
        
        this.logProgress('Mission initiated - Beginning research phase');
        await this.conductEnderDragonResearch();
    }

    async conductEnderDragonResearch() {
        console.log('🔬 Conducting Ender Dragon research...');
        await this.bot.sendChat('📚 Researching Ender Dragon tactics... Give me a moment!');
        
        try {
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
            await this.bot.sendChat('🧠 Research complete! I now have a strategy to defeat the dragon!');
            
            this.logProgress('Research phase completed');
            await this.startPreparationPhase();
            
        } catch (error) {
            console.error('❌ Research failed:', error);
            await this.bot.sendChat('🤔 Research hit a snag, but I know the basics! Let\'s start preparing!');
            await this.setBasicStrategy();
            await this.startPreparationPhase();
        }
    }

    async parseResearchForStrategy(research) {
        try {
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
        await this.bot.sendChat(`🎯 Phase 1: Preparation! Goal: ${this.research.currentGoal}`);
        
        console.log('📋 Required items:', this.research.requiredItems);
        console.log('🎯 Current goal:', this.research.currentGoal);
        
        this.logProgress(`Preparation phase started - Goal: ${this.research.currentGoal}`);
        
        // Delegate to gameplay manager
        await this.bot.gameplayManager.beginResourceGathering();
    }

    async advanceMissionPhase(newPhase) {
        this.currentPhase = newPhase;
        this.setupGeminiContext(); // Update context with new phase
        
        switch (newPhase) {
            case 'nether':
                await this.bot.gameplayManager.startNetherExpedition();
                break;
            case 'stronghold':
                await this.bot.gameplayManager.searchForStronghold();
                break;
            case 'end_fight':
                await this.bot.gameplayManager.enterTheEnd();
                break;
            case 'victory':
                await this.celebrateVictory();
                break;
        }
    }

    async celebrateVictory() {
        console.log('🏆 ENDER DRAGON DEFEATED!');
        await this.bot.sendChat('🏆 THE ENDER DRAGON IS DEFEATED! MISSION ACCOMPLISHED!');
        
        await this.bot.delay(2000);
        await this.bot.sendChat('🎉 Victory! The realm is safe! XP and dragon egg claimed!');
        
        this.logProgress('MISSION COMPLETED: Ender Dragon defeated successfully!');
        this.currentPhase = 'victory';
        this.currentTask = 'celebrating';
        
        await this.bot.delay(3000);
        await this.bot.sendChat('🐉➡️💀 From zero to dragon slayer! What an epic journey!');
        
        this.printMissionSummary();
        
        setTimeout(() => {
            this.bot.sendChat('🚀 Ready for another adventure? Type "!restart" for a new mission!');
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
        await this.bot.sendChat('🔄 Restarting dragon mission! Back to the beginning!');
        this.missionStarted = false;
        this.missionActive = false;
        this.currentPhase = 'waiting';
        this.currentTask = null;
        this.progressLog = [];
        
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
        await this.bot.sendChat(`${playerName}: I'm on an epic quest to defeat the Ender Dragon! 🐉`);
        await this.bot.delay(2000);
        await this.bot.sendChat(`Current phase: ${this.currentPhase} | Join the adventure! 🗡️`);
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
}

module.exports = MissionManager;