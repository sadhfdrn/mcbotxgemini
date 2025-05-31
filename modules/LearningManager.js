// LearningManager.js - AI Learning and Adaptation System
const fs = require('fs').promises;
const path = require('path');

class LearningManager {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.managers = null;
        
        // Learning data storage
        this.learningData = {
            missionAttempts: [],
            combatExperiences: [],
            navigationPatterns: [],
            playerInteractions: [],
            aiInteractions: [],
            successfulStrategies: [],
            failedStrategies: [],
            environmentalLearning: [],
            performanceMetrics: {
                totalMissions: 0,
                successfulMissions: 0,
                averageCompletionTime: 0,
                deathCount: 0,
                playersHelped: 0
            }
        };
        
        // Learning weights and preferences
        this.learningWeights = {
            combat: 0.3,
            navigation: 0.25,
            strategy: 0.3,
            social: 0.15
        };
        
        // Data file paths
        this.dataPath = path.join(process.cwd(), 'data');
        this.learningFile = path.join(this.dataPath, 'learning_data.json');
        this.strategiesFile = path.join(this.dataPath, 'strategies.json');
        
        this.initializeLearning();
    }

    setManagers(managers) {
        this.managers = managers;
    }

    async initializeLearning() {
        try {
            // Ensure data directory exists
            await fs.mkdir(this.dataPath, { recursive: true });
            
            // Load existing learning data
            await this.loadLearningData();
            
            console.log('🧠 Learning system initialized');
            console.log(`📊 Loaded ${this.learningData.missionAttempts.length} mission records`);
            
        } catch (error) {
            console.error('Learning initialization error:', error);
            // Continue with default empty data
        }
    }

    async loadLearningData() {
        try {
            const data = await fs.readFile(this.learningFile, 'utf8');
            const loadedData = JSON.parse(data);
            
            // Merge with defaults to handle new fields
            this.learningData = { ...this.learningData, ...loadedData };
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading learning data:', error);
            }
        }
    }

    async saveLearningData() {
        try {
            await fs.writeFile(
                this.learningFile, 
                JSON.stringify(this.learningData, null, 2)
            );
        } catch (error) {
            console.error('Error saving learning data:', error);
        }
    }

    async saveAllData() {
        await this.saveLearningData();
        await this.saveStrategies();
    }

    async saveStrategies() {
        try {
            const strategies = {
                successful: this.learningData.successfulStrategies,
                failed: this.learningData.failedStrategies,
                weights: this.learningWeights,
                lastUpdated: new Date().toISOString()
            };
            
            await fs.writeFile(
                this.strategiesFile,
                JSON.stringify(strategies, null, 2)
            );
        } catch (error) {
            console.error('Error saving strategies:', error);
        }
    }

    enhancePromptWithLearning(basePrompt, context = {}) {
        if (!this.config.learningEnabled) {
            return basePrompt;
        }

        let enhancement = basePrompt + '\n\n--- LEARNED CONTEXT ---\n';
        
        // Add mission experience
        if (this.learningData.missionAttempts.length > 0) {
            const recentAttempts = this.learningData.missionAttempts.slice(-5);
            enhancement += `Recent Mission Experience (${recentAttempts.length} attempts):\n`;
            
            recentAttempts.forEach((attempt, index) => {
                enhancement += `${index + 1}. ${attempt.outcome} - ${attempt.strategy} (${attempt.duration}ms)\n`;
            });
        }

        // Add successful strategies
        if (this.learningData.successfulStrategies.length > 0) {
            const topStrategies = this.learningData.successfulStrategies
                .sort((a, b) => b.successRate - a.successRate)
                .slice(0, 3);
                
            enhancement += '\nTop Successful Strategies:\n';
            topStrategies.forEach((strategy, index) => {
                enhancement += `${index + 1}. ${strategy.name} (${(strategy.successRate * 100).toFixed(1)}% success)\n`;
            });
        }

        // Add combat learning
        if (context.combatSituation && this.learningData.combatExperiences.length > 0) {
            const combatLearning = this.learningData.combatExperiences
                .filter(exp => exp.enemyType === context.enemyType)
                .slice(-3);
                
            if (combatLearning.length > 0) {
                enhancement += '\nCombat Experience:\n';
                combatLearning.forEach(exp => {
                    enhancement += `- ${exp.outcome}: ${exp.strategy} vs ${exp.enemyType}\n`;
                });
            }
        }

        // Add navigation patterns
        if (context.navigationTarget && this.learningData.navigationPatterns.length > 0) {
            const navPatterns = this.learningData.navigationPatterns
                .filter(pattern => pattern.targetType === context.navigationTarget)
                .slice(-2);
                
            if (navPatterns.length > 0) {
                enhancement += '\nNavigation Patterns:\n';
                navPatterns.forEach(pattern => {
                    enhancement += `- ${pattern.strategy}: ${pattern.success ? 'Success' : 'Failed'} (${pattern.time}ms)\n`;
                });
            }
        }

        enhancement += '\n--- END LEARNED CONTEXT ---\n';
        enhancement += 'Use this learned experience to make better decisions. Prioritize strategies that have worked before.';

        return enhancement;
    }

    recordAIInteraction(prompt, response, context) {
        if (!this.config.learningEnabled) return;

        const interaction = {
            timestamp: new Date().toISOString(),
            prompt: prompt.substring(0, 200), // Truncate for storage
            response: response.substring(0, 200),
            context: context,
            sessionId: this.bot.sessionStartTime
        };

        this.learningData.aiInteractions.push(interaction);
        
        // Keep only recent interactions
        if (this.learningData.aiInteractions.length > 1000) {
            this.learningData.aiInteractions = this.learningData.aiInteractions.slice(-500);
        }
    }

    learnFromMissionCompletion(missionData) {
        if (!this.config.learningEnabled) return;

        const attempt = {
            timestamp: new Date().toISOString(),
            outcome: missionData.success ? 'SUCCESS' : 'FAILED',
            strategy: missionData.strategy || 'unknown',
            duration: missionData.duration || 0,
            deaths: missionData.deaths || 0,
            playersInvolved: missionData.playersInvolved || 0,
            phase: missionData.phase || 'unknown',
            reason: missionData.failureReason || null
        };

        this.learningData.missionAttempts.push(attempt);
        this.learningData.performanceMetrics.totalMissions++;

        if (missionData.success) {
            this.learningData.performanceMetrics.successfulMissions++;
            this.recordSuccessfulStrategy(missionData.strategy, missionData);
        } else {
            this.recordFailedStrategy(missionData.strategy, missionData);
        }

        // Update average completion time
        const completedMissions = this.learningData.missionAttempts
            .filter(attempt => attempt.outcome === 'SUCCESS');
        
        if (completedMissions.length > 0) {
            this.learningData.performanceMetrics.averageCompletionTime = 
                completedMissions.reduce((sum, mission) => sum + mission.duration, 0) / completedMissions.length;
        }

        console.log(`📚 Learned from mission: ${attempt.outcome} using ${attempt.strategy}`);
        this.saveLearningData();
    }

    learnFromCombat(combatData) {
        if (!this.config.learningEnabled) return;

        const experience = {
            timestamp: new Date().toISOString(),
            enemyType: combatData.enemyType || 'unknown',
            outcome: combatData.outcome, // 'victory', 'defeat', 'escape'
            strategy: combatData.strategy || 'unknown',
            damage: combatData.damage || 0,
            duration: combatData.duration || 0,
            healthRemaining: combatData.healthRemaining || 0,
            weaponUsed: combatData.weaponUsed || 'unknown'
        };

        this.learningData.combatExperiences.push(experience);

        if (combatData.outcome === 'defeat') {
            this.learningData.performanceMetrics.deathCount++;
        }

        // Keep recent combat data
        if (this.learningData.combatExperiences.length > 500) {
            this.learningData.combatExperiences = this.learningData.combatExperiences.slice(-250);
        }

        console.log(`⚔️ Combat learning: ${experience.outcome} vs ${experience.enemyType}`);
    }

    learnFromNavigation(navData) {
        if (!this.config.learningEnabled) return;

        const pattern = {
            timestamp: new Date().toISOString(),
            targetType: navData.targetType || 'unknown',
            strategy: navData.strategy || 'unknown',
            success: navData.success || false,
            time: navData.time || 0,
            distance: navData.distance || 0,
            obstacles: navData.obstacles || 0,
            method: navData.method || 'walking'
        };

        this.learningData.navigationPatterns.push(pattern);

        // Keep recent navigation data
        if (this.learningData.navigationPatterns.length > 300) {
            this.learningData.navigationPatterns = this.learningData.navigationPatterns.slice(-150);
        }

        console.log(`🗺️ Navigation learning: ${pattern.success ? 'Success' : 'Failed'} to ${pattern.targetType}`);
    }

    learnFromPlayerInteraction(playerData) {
        if (!this.config.learningEnabled) return;

        const interaction = {
            timestamp: new Date().toISOString(),
            playerName: playerData.playerName,
            interactionType: playerData.type, // 'help_request', 'chat', 'follow', etc.
            response: playerData.response || 'unknown',
            outcome: playerData.outcome || 'unknown',
            satisfaction: playerData.satisfaction || 0 // 1-5 scale
        };

        this.learningData.playerInteractions.push(interaction);
        
        if (playerData.helped) {
            this.learningData.performanceMetrics.playersHelped++;
        }

        // Keep recent interactions
        if (this.learningData.playerInteractions.length > 200) {
            this.learningData.playerInteractions = this.learningData.playerInteractions.slice(-100);
        }

        console.log(`👥 Player interaction learning: ${interaction.interactionType} with ${interaction.playerName}`);
    }

    recordSuccessfulStrategy(strategyName, data) {
        let strategy = this.learningData.successfulStrategies
            .find(s => s.name === strategyName);

        if (!strategy) {
            strategy = {
                name: strategyName,
                uses: 0,
                successes: 0,
                successRate: 0,
                avgDuration: 0,
                bestTime: Infinity,
                contexts: []
            };
            this.learningData.successfulStrategies.push(strategy);
        }

        strategy.uses++;
        strategy.successes++;
        strategy.successRate = strategy.successes / strategy.uses;
        
        if (data.duration) {
            strategy.avgDuration = ((strategy.avgDuration * (strategy.successes - 1)) + data.duration) / strategy.successes;
            strategy.bestTime = Math.min(strategy.bestTime, data.duration);
        }

        // Store context for this success
        strategy.contexts.push({
            timestamp: new Date().toISOString(),
            phase: data.phase,
            playersInvolved: data.playersInvolved,
            conditions: data.conditions
        });

        // Keep only recent contexts
        if (strategy.contexts.length > 10) {
            strategy.contexts = strategy.contexts.slice(-5);
        }
    }

    recordFailedStrategy(strategyName, data) {
        let strategy = this.learningData.failedStrategies
            .find(s => s.name === strategyName);

        if (!strategy) {
            strategy = {
                name: strategyName,
                uses: 0,
                failures: 0,
                failureRate: 0,
                reasons: [],
                contexts: []
            };
            this.learningData.failedStrategies.push(strategy);
        }

        strategy.uses++;
        strategy.failures++;
        strategy.failureRate = strategy.failures / strategy.uses;

        if (data.failureReason) {
            strategy.reasons.push(data.failureReason);
        }

        strategy.contexts.push({
            timestamp: new Date().toISOString(),
            reason: data.failureReason,
            phase: data.phase,
            conditions: data.conditions
        });

        // Keep only recent data
        if (strategy.contexts.length > 10) {
            strategy.contexts = strategy.contexts.slice(-5);
        }
        if (strategy.reasons.length > 20) {
            strategy.reasons = strategy.reasons.slice(-10);
        }
    }

    getBestStrategyFor(context) {
        if (!this.config.learningEnabled || this.learningData.successfulStrategies.length === 0) {
            return null;
        }

        // Filter strategies by context
        let relevantStrategies = this.learningData.successfulStrategies
            .filter(strategy => strategy.successRate > 0.6); // Only consider strategies with >60% success

        if (context.phase) {
            relevantStrategies = relevantStrategies
                .filter(strategy => 
                    strategy.contexts.some(ctx => ctx.phase === context.phase)
                );
        }

        if (relevantStrategies.length === 0) {
            relevantStrategies = this.learningData.successfulStrategies;
        }

        // Sort by success rate and recent usage
        return relevantStrategies
            .sort((a, b) => {
                const aScore = a.successRate * 0.7 + (a.uses / 100) * 0.3;
                const bScore = b.successRate * 0.7 + (b.uses / 100) * 0.3;
                return bScore - aScore;
            })[0];
    }

    getWorstStrategiesFor(context) {
        if (!this.config.learningEnabled) {
            return [];
        }

        return this.learningData.failedStrategies
            .filter(strategy => strategy.failureRate > 0.7)
            .sort((a, b) => b.failureRate - a.failureRate)
            .slice(0, 3);
    }

    getStats() {
        return {
            enabled: this.config.learningEnabled,
            metrics: this.learningData.performanceMetrics,
            dataPoints: {
                missionAttempts: this.learningData.missionAttempts.length,
                combatExperiences: this.learningData.combatExperiences.length,
                navigationPatterns: this.learningData.navigationPatterns.length,
                playerInteractions: this.learningData.playerInteractions.length,
                successfulStrategies: this.learningData.successfulStrategies.length,
                failedStrategies: this.learningData.failedStrategies.length
            },
            topStrategies: this.learningData.successfulStrategies
                .sort((a, b) => b.successRate - a.successRate)
                .slice(0, 5)
                .map(s => ({ name: s.name, successRate: s.successRate, uses: s.uses }))
        };
    }

    async generateLearningReport() {
        const stats = this.getStats();
        const uptime = Date.now() - this.bot.sessionStartTime;
        
        const report = {
            generated: new Date().toISOString(),
            session: {
                uptime: uptime,
                performance: this.bot.getPerformanceStats()
            },
            learning: stats,
            insights: this.generateInsights()
        };

        try {
            const reportPath = path.join(this.dataPath, `learning_report_${Date.now()}.json`);
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`📋 Learning report saved: ${reportPath}`);
        } catch (error) {
            console.error('Error saving learning report:', error);
        }

        return report;
    }

    generateInsights() {
        const insights = [];

        // Mission success rate insight
        const successRate = this.learningData.performanceMetrics.totalMissions > 0 
            ? this.learningData.performanceMetrics.successfulMissions / this.learningData.performanceMetrics.totalMissions
            : 0;

        insights.push({
            type: 'mission_performance',
            message: `Mission success rate: ${(successRate * 100).toFixed(1)}%`,
            recommendation: successRate < 0.5 ? 'Focus on strategy improvement' : 'Maintain current approach'
        });

        // Combat performance insight
        if (this.learningData.combatExperiences.length > 10) {
            const victories = this.learningData.combatExperiences
                .filter(exp => exp.outcome === 'victory').length;
            const combatSuccessRate = victories / this.learningData.combatExperiences.length;
            
            insights.push({
                type: 'combat_performance',
                message: `Combat success rate: ${(combatSuccessRate * 100).toFixed(1)}%`,
                recommendation: combatSuccessRate < 0.6 ? 'Improve combat strategies' : 'Combat skills are effective'
            });
        }

        return insights;
    }
}

module.exports = LearningManager;