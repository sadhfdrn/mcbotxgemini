// modules/GameplayManager.js
class GameplayManager {
    constructor(bot) {
        this.bot = bot;
        this.currentGameMode = 'unknown';
        this.difficulty = 'normal';
        this.adaptiveStrategies = new Map();
        this.performanceMetrics = {
            deathCount: 0,
            damageDealt: 0,
            damageTaken: 0,
            successfulActions: 0,
            failedActions: 0
        };
        this.learningModel = {
            actionOutcomes: [],
            environmentalFactors: [],
            playerCollaborationData: []
        };
        
        // Initialize game mode detection with delay to ensure other managers are ready
        this.setupAdaptiveStrategies();
        setTimeout(() => this.detectGameMode(), 2000); // Delay to ensure bot is fully initialized
    }

    async detectGameMode() {
        // Try to detect game mode through various methods
        try {
            // Method 1: Try to break a block (creative mode allows instant breaking)
            await this.testCreativeMode();
            
            // Method 2: Check health regeneration
            await this.testHealthRegeneration();
            
            // Method 3: Analyze player behavior patterns
            this.analyzePlayerPatterns();
            
        } catch (error) {
            console.log('🔍 Game mode detection in progress...');
            this.currentGameMode = 'survival'; // Default assumption
        }
        
        console.log(`🎮 Detected game mode: ${this.currentGameMode} (${this.difficulty})`);
        this.adaptStrategyToGameMode();
    }

    async testCreativeMode() {
        // This would require actual block interaction
        // For now, we'll use heuristics based on player behavior
        setTimeout(() => {
            if (this.bot.health === 20 && this.performanceMetrics.damageTaken === 0) {
                // Likely creative or peaceful
                this.currentGameMode = 'creative';
                this.difficulty = 'creative';
            }
        }, 5000);
    }

    async testHealthRegeneration() {
        const initialHealth = this.bot.health;
        
        setTimeout(() => {
            if (this.bot.health > initialHealth && this.bot.health === 20) {
                this.difficulty = 'peaceful';
            } else if (this.bot.health < 20) {
                this.difficulty = this.bot.health < 10 ? 'hard' : 'normal';
            }
            this.currentGameMode = 'survival';
        }, 10000);
    }

    analyzePlayerPatterns() {
        // Analyze player movement and behavior to infer game mode
        const playerBehaviors = this.bot.chatManager?.learningData?.playerBehaviors;
        if (playerBehaviors) {
            let creativeBehaviorCount = 0;
            let survivalBehaviorCount = 0;
            
            playerBehaviors.forEach(behavior => {
                if (behavior.topics.includes('building') || behavior.topics.includes('creative')) {
                    creativeBehaviorCount++;
                } else if (behavior.topics.includes('survival') || behavior.topics.includes('food')) {
                    survivalBehaviorCount++;
                }
            });
            
            if (creativeBehaviorCount > survivalBehaviorCount) {
                this.currentGameMode = 'creative';
            }
        }
    }

    setupAdaptiveStrategies() {
        // Define strategies for different game modes and difficulties
        this.adaptiveStrategies.set('creative', {
            dragonStrategy: 'aggressive_creative',
            preparation: 'minimal',
            riskTolerance: 'high',
            collaboration: 'building_focused'
        });

        this.adaptiveStrategies.set('survival_easy', {
            dragonStrategy: 'cautious_prepared',
            preparation: 'thorough',
            riskTolerance: 'moderate',
            collaboration: 'resource_sharing'
        });

        this.adaptiveStrategies.set('survival_normal', {
            dragonStrategy: 'balanced_tactical',
            preparation: 'comprehensive',
            riskTolerance: 'calculated',
            collaboration: 'coordinated_assault'
        });

        this.adaptiveStrategies.set('survival_hard', {
            dragonStrategy: 'ultra_cautious',
            preparation: 'extensive',
            riskTolerance: 'minimal',
            collaboration: 'highly_coordinated'
        });
    }

    adaptStrategyToGameMode() {
        const strategyKey = this.currentGameMode === 'creative' 
            ? 'creative' 
            : `survival_${this.difficulty}`;
            
        const currentStrategy = this.adaptiveStrategies.get(strategyKey);
        
        if (currentStrategy) {
            console.log(`🧠 Adapting strategy for ${strategyKey}:`, currentStrategy);
            this.applyStrategy(currentStrategy);
        }
    }

    async applyStrategy(strategy) {
        try {
            // Check if missionManager exists and has the updateStrategy method
            if (this.bot.missionManager && typeof this.bot.missionManager.updateStrategy === 'function') {
                await this.bot.missionManager.updateStrategy(strategy);
                console.log('✅ Strategy successfully applied to mission manager');
            } else {
                console.log('⚠️ MissionManager not ready yet, storing strategy for later application');
                // Store the strategy for later application
                this.pendingStrategy = strategy;
                
                // Try again after a delay
                setTimeout(() => {
                    if (this.bot.missionManager && typeof this.bot.missionManager.updateStrategy === 'function') {
                        this.bot.missionManager.updateStrategy(this.pendingStrategy);
                        console.log('✅ Delayed strategy application successful');
                        this.pendingStrategy = null;
                    }
                }, 5000);
            }
            
            // Adjust chat behavior if chat manager is available
            if (this.bot.chatManager && typeof this.bot.chatManager.broadcastToAllPlayers === 'function') {
                await this.bot.chatManager.broadcastToAllPlayers(
                    `🎯 Strategy adapted for ${this.currentGameMode} (${this.difficulty}): ${strategy.dragonStrategy}`
                );
            } else if (this.bot.sendChat && typeof this.bot.sendChat === 'function') {
                // Fallback to basic chat if available
                await this.bot.sendChat(`🎯 Strategy: ${strategy.dragonStrategy}`);
            } else {
                console.log('🤖 Strategy applied: ' + strategy.dragonStrategy);
            }
            
        } catch (error) {
            console.error('❌ Strategy application failed:', error);
            // Don't crash, just log the error and continue
        }
    }

    // Add method to manually apply pending strategy (useful for when managers come online)
    applyPendingStrategy() {
        if (this.pendingStrategy && this.bot.missionManager && typeof this.bot.missionManager.updateStrategy === 'function') {
            this.bot.missionManager.updateStrategy(this.pendingStrategy);
            console.log('✅ Pending strategy applied');
            this.pendingStrategy = null;
            return true;
        }
        return false;
    }

    // AI-powered decision making for combat scenarios
    async makeAICombatDecision(situation) {
        try {
            const prompt = this.createCombatPrompt(situation);
            const result = await this.bot.model.generateContent(prompt);
            const decision = result.response.text().trim();
            
            // Learn from this decision
            this.learningModel.actionOutcomes.push({
                situation: situation,
                decision: decision,
                timestamp: Date.now(),
                gameMode: this.currentGameMode
            });
            
            return this.parseAIDecision(decision);
            
        } catch (error) {
            console.error('❌ AI combat decision failed:', error);
            return this.getDefaultCombatAction(situation);
        }
    }

    createCombatPrompt(situation) {
        return `You are an expert Minecraft combat AI controlling DragonSlayerBot. Analyze this situation and provide the BEST action.

CURRENT SITUATION:
- Game Mode: ${this.currentGameMode}
- Difficulty: ${this.difficulty}  
- Bot Health: ${this.bot.health}/20
- Enemy: ${situation.enemy || 'Unknown'}
- Enemy Health: ${situation.enemyHealth || 'Unknown'}
- Distance: ${situation.distance || 'Unknown'}
- Environment: ${situation.environment || 'Unknown'}
- Available Items: ${situation.availableItems || 'Unknown'}
- Player Allies: ${this.bot.players?.size || 0}

PERFORMANCE HISTORY:
- Deaths: ${this.performanceMetrics.deathCount}
- Damage Dealt: ${this.performanceMetrics.damageDealt}
- Damage Taken: ${this.performanceMetrics.damageTaken}
- Success Rate: ${this.calculateSuccessRate()}%

PAST SUCCESSFUL ACTIONS:
${this.getSuccessfulActions()}

Choose ONE action and explain briefly:
1. ATTACK_MELEE - Close combat with sword/axe
2. ATTACK_RANGED - Bow/crossbow attack
3. RETREAT - Move away from danger
4. HEAL - Use food/potions
5. BLOCK - Use shield/defensive stance
6. SPECIAL - Use special items (ender pearls, potions)
7. COORDINATE - Call for player help

Format: ACTION_NAME: Brief reason (max 50 chars)`;
    }

    parseAIDecision(decision) {
        const actions = ['ATTACK_MELEE', 'ATTACK_RANGED', 'RETREAT', 'HEAL', 'BLOCK', 'SPECIAL', 'COORDINATE'];
        
        for (const action of actions) {
            if (decision.toUpperCase().includes(action)) {
                return {
                    action: action,
                    reasoning: decision.split(':')[1]?.trim() || 'AI recommended',
                    confidence: this.calculateActionConfidence(action)
                };
            }
        }
        
        // Default fallback
        return { action: 'RETREAT', reasoning: 'Uncertain situation', confidence: 0.3 };
    }

    getDefaultCombatAction(situation) {
        // Simple rule-based fallback
        if (this.bot.health < 6) return { action: 'HEAL', reasoning: 'Low health' };
        if (situation.distance > 10) return { action: 'ATTACK_RANGED', reasoning: 'Long range' };
        if (this.difficulty === 'hard') return { action: 'BLOCK', reasoning: 'Hard mode caution' };
        return { action: 'ATTACK_MELEE', reasoning: 'Standard combat' };
    }

    calculateSuccessRate() {
        const total = this.performanceMetrics.successfulActions + this.performanceMetrics.failedActions;
        return total > 0 ? Math.round((this.performanceMetrics.successfulActions / total) * 100) : 50;
    }

    calculateActionConfidence(action) {
        const successfulActions = this.learningModel.actionOutcomes.filter(
            outcome => outcome.decision.includes(action) && outcome.success
        );
        const totalActions = this.learningModel.actionOutcomes.filter(
            outcome => outcome.decision.includes(action)
        );
        
        return totalActions.length > 0 ? successfulActions.length / totalActions.length : 0.5;
    }

    getSuccessfulActions() {
        return this.learningModel.actionOutcomes
            .filter(outcome => outcome.success)
            .slice(-5)
            .map(outcome => `${outcome.decision} (${outcome.gameMode})`)
            .join(', ') || 'None yet';
    }

    // Learn from action outcomes
    recordActionOutcome(action, success, context = {}) {
        this.learningModel.actionOutcomes.push({
            action: action,
            success: success,
            context: context,
            timestamp: Date.now(),
            gameMode: this.currentGameMode,
            difficulty: this.difficulty
        });

        // Update performance metrics
        if (success) {
            this.performanceMetrics.successfulActions++;
        } else {
            this.performanceMetrics.failedActions++;
        }

        // Adapt strategy based on learning
        this.adaptBasedOnLearning();
        
        // Keep learning data manageable
        if (this.learningModel.actionOutcomes.length > 100) {
            this.learningModel.actionOutcomes.shift();
        }
    }

    adaptBasedOnLearning() {
        const recentOutcomes = this.learningModel.actionOutcomes.slice(-10);
        const successRate = recentOutcomes.filter(o => o.success).length / recentOutcomes.length;
        
        if (successRate < 0.3) {
            // Low success rate - become more cautious
            const currentStrategy = this.adaptiveStrategies.get(`${this.currentGameMode}_${this.difficulty}`);
            if (currentStrategy) {
                currentStrategy.riskTolerance = 'minimal';
                console.log('🛡️ Adapting to more cautious strategy due to low success rate');
            }
        } else if (successRate > 0.8) {
            // High success rate - can be more aggressive
            const currentStrategy = this.adaptiveStrategies.get(`${this.currentGameMode}_${this.difficulty}`);
            if (currentStrategy) {
                currentStrategy.riskTolerance = 'high';
                console.log('⚔️ Adapting to more aggressive strategy due to high success rate');
            }
        }
    }

    // Environmental analysis for better decision making
    analyzeEnvironment(position, surroundings) {
        const environmentalFactors = {
            terrain: 'unknown',
            hazards: [],
            advantages: [],
            visibility: 'good'
        };

        // This would analyze the actual world data in a real implementation
        // For now, we'll store the analysis for learning
        this.learningModel.environmentalFactors.push({
            position: position,
            factors: environmentalFactors,
            timestamp: Date.now()
        });

        return environmentalFactors;
    }

    // Get current strategy for other modules
    getCurrentStrategy() {
        const strategyKey = this.currentGameMode === 'creative' 
            ? 'creative' 
            : `survival_${this.difficulty}`;
        return this.adaptiveStrategies.get(strategyKey) || this.adaptiveStrategies.get('survival_normal');
    }

    // Update health and track damage
    updateHealth(newHealth) {
        const oldHealth = this.bot.health || 20;
        this.bot.health = newHealth;
        
        if (newHealth < oldHealth) {
            this.performanceMetrics.damageTaken += (oldHealth - newHealth);
            console.log(`💔 Health: ${newHealth}/20 (took ${oldHealth - newHealth} damage)`);
        } else if (newHealth > oldHealth) {
            console.log(`💚 Health: ${newHealth}/20 (healed ${newHealth - oldHealth})`);
        }
        
        if (newHealth === 0) {
            this.performanceMetrics.deathCount++;
            console.log('💀 Bot died! Learning from this experience...');
            this.recordActionOutcome('death', false, { health: oldHealth });
        }
    }

    // Get status for other modules
    getGameplayStatus() {
        return {
            gameMode: this.currentGameMode,
            difficulty: this.difficulty,
            health: this.bot.health,
            strategy: this.getCurrentStrategy(),
            performance: this.performanceMetrics,
            successRate: this.calculateSuccessRate(),
            hasPendingStrategy: !!this.pendingStrategy
        };
    }

    // Add missing methods that might be called by MissionManager
    async beginResourceGathering() {
        console.log('⛏️ Beginning resource gathering phase...');
        try {
            if (this.bot.sendChat) {
                await this.bot.sendChat('⛏️ Starting resource gathering! Looking for diamonds and iron!');
            }
            // Implementation would go here
        } catch (error) {
            console.error('❌ Resource gathering initialization failed:', error);
        }
    }

    async startNetherExpedition() {
        console.log('🔥 Starting Nether expedition...');
        try {
            if (this.bot.sendChat) {
                await this.bot.sendChat('🔥 Entering the Nether! Time to hunt blazes and gather materials!');
            }
            // Implementation would go here
        } catch (error) {
            console.error('❌ Nether expedition initialization failed:', error);
        }
    }

    async searchForStronghold() {
        console.log('🏰 Searching for stronghold...');
        try {
            if (this.bot.sendChat) {
                await this.bot.sendChat('🏰 Searching for the stronghold! The End Portal awaits!');
            }
            // Implementation would go here
        } catch (error) {
            console.error('❌ Stronghold search initialization failed:', error);
        }
    }

    async enterTheEnd() {
        console.log('🌌 Entering The End...');
        try {
            if (this.bot.sendChat) {
                await this.bot.sendChat('🌌 Entering The End! The final battle begins!');
            }
            // Implementation would go here
        } catch (error) {
            console.error('❌ End entry initialization failed:', error);
        }
    }
}

module.exports = GameplayManager;