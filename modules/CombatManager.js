// CombatManager.js - Advanced AI-Powered Combat System
const EventEmitter = require('events');

class CombatManager extends EventEmitter {
    constructor(bot) {
        super();
        this.bot = bot;
        this.managers = null;
        
        // Combat state
        this.inCombat = false;
        this.currentTarget = null;
        this.combatHistory = [];
        this.lastAttackTime = 0;
        this.lastDamageTime = 0;
        this.combatStartTime = 0;
        this.threatLevel = 'NONE'; // NONE, LOW, MEDIUM, HIGH, CRITICAL
        
        // Combat statistics
        this.combatStats = {
            totalFights: 0,
            wins: 0,
            losses: 0,
            escapes: 0,
            damageDealt: 0,
            damageTaken: 0,
            totalCombatTime: 0,
            averageFightDuration: 0,
            killStreak: 0,
            bestKillStreak: 0
        };
        
        // Combat configuration
        this.config = {
            attackCooldown: 600, // milliseconds
            criticalHealthThreshold: 6, // hearts
            fleeHealthThreshold: 4, // hearts
            maxCombatRange: 20, // blocks
            optimalCombatRange: 3, // blocks
            retreatDistance: 15, // blocks
            
            // AI decision thresholds
            aggressionLevel: 0.7, // 0.0 to 1.0
            riskTolerance: 0.5, // 0.0 to 1.0
            strategicThinking: true,
            useConsumables: true,
            teamworkEnabled: true,
            
            // Combat priorities
            priorityTargets: [
                'minecraft:ender_dragon',
                'minecraft:wither',
                'minecraft:elder_guardian',
                'minecraft:blaze',
                'minecraft:enderman',
                'minecraft:creeper',
                'minecraft:zombie',
                'minecraft:skeleton',
                'minecraft:spider'
            ]
        };
        
        // Combat patterns and strategies
        this.combatPatterns = new Map();
        this.entityWeaknesses = new Map();
        this.loadCombatKnowledge();
        
        // AI consultation cache
        this.aiDecisionCache = new Map();
        this.lastAIConsultation = 0;
        this.aiConsultationCooldown = 5000; // 5 seconds
        
        // Combat monitoring
        this.setupCombatMonitoring();
        
        console.log('⚔️ Advanced Combat Manager initialized');
    }

    setManagers(managers) {
        this.managers = managers;
    }

    async onConnect() {
        console.log('⚔️ Combat systems online - Ready for battle!');
        this.setupCombatEventHandlers();
    }

    setupCombatEventHandlers() {
        // Health monitoring
        this.bot.on('stats_update', (stats) => {
            this.handleHealthUpdate(stats);
        });

        // Entity tracking for combat
        this.bot.on('entity_spawned', (entity) => {
            this.evaluateNewThreat(entity);
        });

        this.bot.on('entity_removed', (entity) => {
            this.handleEntityRemoved(entity);
        });

        // Damage events
        this.bot.on('damage_taken', (damage) => {
            this.handleDamageTaken(damage);
        });

        // Combat events
        this.on('combat_start', (target) => {
            console.log(`⚔️ Combat initiated with ${target.type || 'unknown entity'}`);
            this.recordCombatStart(target);
        });

        this.on('combat_end', (result) => {
            console.log(`⚔️ Combat ended: ${result.outcome}`);
            this.recordCombatEnd(result);
        });
    }

    setupCombatMonitoring() {
        // Continuous threat assessment
        setInterval(() => {
            if (this.bot.connected) {
                this.assessThreatLevel();
                this.updateCombatStrategy();
            }
        }, 1000);

        // Combat state machine
        setInterval(() => {
            if (this.bot.connected) {
                this.processCombatStateMachine();
            }
        }, 100); // High frequency for responsive combat
    }

    async assessThreatLevel() {
        const nearbyEntities = this.getNearbyHostileEntities();
        let maxThreat = 0;
        let primaryThreat = null;

        for (const entity of nearbyEntities) {
            const threatValue = this.calculateEntityThreat(entity);
            if (threatValue > maxThreat) {
                maxThreat = threatValue;
                primaryThreat = entity;
            }
        }

        const newThreatLevel = this.determineThreatLevel(maxThreat);
        
        if (newThreatLevel !== this.threatLevel) {
            const oldLevel = this.threatLevel;
            this.threatLevel = newThreatLevel;
            this.emit('threat_level_changed', { old: oldLevel, new: newThreatLevel, entity: primaryThreat });
            
            if (this.bot.config.debugMode) {
                console.log(`🚨 Threat level changed: ${oldLevel} → ${newThreatLevel}`);
            }
        }
    }

    getNearbyHostileEntities() {
        const entities = [];
        const botPos = this.bot.position;
        
        for (const [id, entity] of this.bot.entities) {
            if (this.isHostileEntity(entity)) {
                const distance = this.calculateDistance(botPos, entity.position || entity);
                if (distance <= this.config.maxCombatRange) {
                    entities.push({
                        ...entity,
                        id,
                        distance,
                        threat: this.calculateEntityThreat(entity)
                    });
                }
            }
        }
        
        return entities.sort((a, b) => b.threat - a.threat);
    }

    isHostileEntity(entity) {
        if (!entity.type) return false;
        
        const hostileTypes = [
            'minecraft:zombie', 'minecraft:skeleton', 'minecraft:creeper', 'minecraft:spider',
            'minecraft:enderman', 'minecraft:blaze', 'minecraft:ghast', 'minecraft:witch',
            'minecraft:ender_dragon', 'minecraft:wither', 'minecraft:elder_guardian',
            'minecraft:guardian', 'minecraft:shulker', 'minecraft:phantom'
        ];
        
        return hostileTypes.includes(entity.type);
    }

    calculateEntityThreat(entity) {
        let threat = 0;
        
        // Base threat by entity type
        const baseThreat = {
            'minecraft:ender_dragon': 100,
            'minecraft:wither': 90,
            'minecraft:elder_guardian': 80,
            'minecraft:blaze': 70,
            'minecraft:creeper': 60,
            'minecraft:enderman': 50,
            'minecraft:skeleton': 40,
            'minecraft:zombie': 30,
            'minecraft:spider': 25,
            'minecraft:phantom': 45
        };
        
        threat = baseThreat[entity.type] || 20;
        
        // Distance factor (closer = more threatening)
        if (entity.distance) {
            const distanceFactor = Math.max(0.1, 1 - (entity.distance / this.config.maxCombatRange));
            threat *= distanceFactor;
        }
        
        // Health factor (lower bot health = higher perceived threat)
        const healthFactor = 1 + (1 - (this.bot.health / this.bot.maxHealth));
        threat *= healthFactor;
        
        return Math.round(threat);
    }

    determineThreatLevel(maxThreat) {
        if (maxThreat >= 80) return 'CRITICAL';
        if (maxThreat >= 60) return 'HIGH';
        if (maxThreat >= 40) return 'MEDIUM';
        if (maxThreat >= 20) return 'LOW';
        return 'NONE';
    }

    async processCombatStateMachine() {
        if (!this.inCombat && this.threatLevel !== 'NONE') {
            await this.initiateCombat();
        } else if (this.inCombat) {
            await this.processCombatActions();
        }
    }

    async initiateCombat() {
        const target = this.selectOptimalTarget();
        if (!target) return;
        
        this.inCombat = true;
        this.currentTarget = target;
        this.combatStartTime = Date.now();
        
        // Consult AI for combat strategy
        const strategy = await this.consultAIForCombatStrategy(target);
        this.currentStrategy = strategy;
        
        this.emit('combat_start', target);
        
        await this.bot.sendChat(`⚔️ Engaging ${target.type}! Strategy: ${strategy.approach}`);
    }

    selectOptimalTarget() {
        const nearbyEntities = this.getNearbyHostileEntities();
        if (nearbyEntities.length === 0) return null;
        
        // Priority-based target selection
        for (const priorityType of this.config.priorityTargets) {
            const priorityTarget = nearbyEntities.find(e => e.type === priorityType);
            if (priorityTarget) return priorityTarget;
        }
        
        // Default to highest threat
        return nearbyEntities[0];
    }

    async consultAIForCombatStrategy(target) {
        // Check cooldown and cache
        const now = Date.now();
        const cacheKey = `${target.type}_${this.bot.health}_${target.distance}`;
        
        if (now - this.lastAIConsultation < this.aiConsultationCooldown) {
            return this.aiDecisionCache.get(cacheKey) || this.getDefaultStrategy(target);
        }
        
        this.lastAIConsultation = now;
        
        try {
            const context = this.buildCombatContext(target);
            const prompt = this.buildCombatStrategyPrompt(target, context);
            
            const aiResponse = await this.bot.generateAIResponse(prompt, context);
            const strategy = this.parseCombatStrategy(aiResponse, target);
            
            // Cache the decision
            this.aiDecisionCache.set(cacheKey, strategy);
            
            if (this.bot.config.debugMode) {
                console.log('🧠 AI Combat Strategy:', strategy);
            }
            
            return strategy;
            
        } catch (error) {
            console.error('❌ AI consultation failed, using default strategy:', error);
            return this.getDefaultStrategy(target);
        }
    }

    buildCombatContext(target) {
        return {
            botHealth: this.bot.health,
            botMaxHealth: this.bot.maxHealth,
            botPosition: this.bot.position,
            targetType: target.type,
            targetDistance: target.distance,
            threatLevel: this.threatLevel,
            inventory: this.managers?.inventory?.getInventoryStatus() || {},
            nearbyAllies: Array.from(this.bot.players.values()),
            combatHistory: this.combatHistory.slice(-5), // Last 5 combat encounters
            currentStats: this.combatStats,
            environment: this.assessEnvironment()
        };
    }

    buildCombatStrategyPrompt(target, context) {
        return `
COMBAT SITUATION ANALYSIS:
You are an expert Minecraft combat strategist controlling a bot. Analyze this combat scenario and provide optimal strategy.

CURRENT SITUATION:
- Bot Health: ${context.botHealth}/${context.botMaxHealth} hearts
- Target: ${context.targetType} at ${context.targetDistance} blocks
- Threat Level: ${context.threatLevel}
- Environment: ${context.environment.type}
- Allies Present: ${context.nearbyAllies.length}

AVAILABLE RESOURCES:
- Weapons: ${context.inventory.weapons || 'Basic tools'}
- Armor: ${context.inventory.armor || 'Basic/None'}
- Consumables: ${context.inventory.consumables || 'Limited'}

COMBAT HISTORY:
Recent Performance: ${context.currentStats.wins}W-${context.currentStats.losses}L
Kill Streak: ${context.currentStats.killStreak}

PROVIDE STRATEGIC RECOMMENDATION:
1. Primary Approach (AGGRESSIVE/DEFENSIVE/BALANCED/RETREAT)
2. Combat Tactics (specific actions to take)
3. Risk Assessment (LOW/MEDIUM/HIGH)
4. Expected Outcome (WIN/LOSS/UNCERTAIN)
5. Backup Plan if things go wrong

Focus on: Survival, efficiency, and adapting to the specific enemy type.
Consider: Entity behavior patterns, optimal range, timing, and resource management.

Respond in concise tactical format.
        `;
    }

    parseCombatStrategy(aiResponse, target) {
        const defaultStrategy = this.getDefaultStrategy(target);
        
        try {
            const lines = aiResponse.toLowerCase().split('\n');
            let approach = 'BALANCED';
            let tactics = [];
            let risk = 'MEDIUM';
            let outcome = 'UNCERTAIN';
            let backup = 'RETREAT';
            
            for (const line of lines) {
                if (line.includes('approach') || line.includes('primary')) {
                    if (line.includes('aggressive')) approach = 'AGGRESSIVE';
                    else if (line.includes('defensive')) approach = 'DEFENSIVE';
                    else if (line.includes('retreat')) approach = 'RETREAT';
                    else if (line.includes('balanced')) approach = 'BALANCED';
                }
                
                if (line.includes('risk')) {
                    if (line.includes('low')) risk = 'LOW';
                    else if (line.includes('high')) risk = 'HIGH';
                    else risk = 'MEDIUM';
                }
                
                if (line.includes('outcome') || line.includes('expected')) {
                    if (line.includes('win')) outcome = 'WIN';
                    else if (line.includes('loss')) outcome = 'LOSS';
                    else outcome = 'UNCERTAIN';
                }
                
                if (line.includes('tactic') || line.includes('action')) {
                    tactics.push(line.trim());
                }
            }
            
            return {
                approach,
                tactics,
                risk,
                expectedOutcome: outcome,
                backup,
                confidence: 0.8,
                aiGenerated: true
            };
            
        } catch (error) {
            console.error('Failed to parse AI strategy:', error);
            return defaultStrategy;
        }
    }

    getDefaultStrategy(target) {
        const strategies = {
            'minecraft:ender_dragon': {
                approach: 'AGGRESSIVE',
                tactics: ['maintain_distance', 'target_crystals', 'dodge_breath'],
                risk: 'HIGH',
                expectedOutcome: 'UNCERTAIN',
                backup: 'RETREAT'
            },
            'minecraft:creeper': {
                approach: 'DEFENSIVE',
                tactics: ['maintain_distance', 'hit_and_run', 'prevent_explosion'],
                risk: 'HIGH',
                expectedOutcome: 'WIN',
                backup: 'RETREAT'
            },
            'minecraft:enderman': {
                approach: 'BALANCED',
                tactics: ['avoid_eye_contact', 'use_projectiles', 'height_advantage'],
                risk: 'MEDIUM',
                expectedOutcome: 'WIN',
                backup: 'RETREAT'
            },
            'default': {
                approach: 'BALANCED',
                tactics: ['optimal_range', 'timing_attacks', 'health_monitor'],
                risk: 'MEDIUM',
                expectedOutcome: 'WIN',
                backup: 'RETREAT'
            }
        };
        
        return strategies[target.type] || strategies['default'];
    }

    async processCombatActions() {
        if (!this.currentTarget || !this.inCombat) return;
        
        const target = this.currentTarget;
        const strategy = this.currentStrategy;
        
        // Check if target still exists and is in range
        if (!this.isTargetValid(target)) {
            await this.endCombat('TARGET_LOST');
            return;
        }
        
        // Health check - retreat if critical
        if (this.bot.health <= this.config.fleeHealthThreshold) {
            await this.executeRetreat('LOW_HEALTH');
            return;
        }
        
        // Execute strategy-based actions
        await this.executeStrategyActions(strategy, target);
    }

    async executeStrategyActions(strategy, target) {
        const now = Date.now();
        
        switch (strategy.approach) {
            case 'AGGRESSIVE':
                await this.executeAggressiveStrategy(target);
                break;
            case 'DEFENSIVE':
                await this.executeDefensiveStrategy(target);
                break;
            case 'BALANCED':
                await this.executeBalancedStrategy(target);
                break;
            case 'RETREAT':
                await this.executeRetreat('STRATEGIC');
                break;
        }
        
        // Execute specific tactics
        for (const tactic of strategy.tactics) {
            await this.executeTactic(tactic, target);
        }
    }

    async executeAggressiveStrategy(target) {
        // Close distance and attack frequently
        if (target.distance > this.config.optimalCombatRange) {
            await this.moveTowardsTarget(target);
        }
        
        if (this.canAttack()) {
            await this.attackTarget(target);
        }
    }

    async executeDefensiveStrategy(target) {
        // Maintain safe distance, time attacks carefully
        const safeDistance = this.config.optimalCombatRange * 1.5;
        
        if (target.distance < safeDistance) {
            await this.moveAwayFromTarget(target);
        } else if (target.distance > this.config.maxCombatRange * 0.8) {
            await this.moveTowardsTarget(target);
        }
        
        if (this.canAttack() && this.isOptimalAttackTiming(target)) {
            await this.attackTarget(target);
        }
    }

    async executeBalancedStrategy(target) {
        // Optimal positioning and measured attacks
        if (target.distance < this.config.optimalCombatRange * 0.8) {
            await this.moveAwayFromTarget(target);
        } else if (target.distance > this.config.optimalCombatRange * 1.2) {
            await this.moveTowardsTarget(target);
        }
        
        if (this.canAttack()) {
            await this.attackTarget(target);
        }
    }

    async executeTactic(tactic, target) {
        switch (tactic) {
            case 'maintain_distance':
                await this.maintainOptimalDistance(target);
                break;
            case 'hit_and_run':
                await this.executeHitAndRun(target);
                break;
            case 'dodge_breath':
                await this.dodgeDragonBreath();
                break;
            case 'target_crystals':
                await this.targetEnderCrystals();
                break;
            case 'use_consumables':
                await this.useConsumables();
                break;
        }
    }

    canAttack() {
        return Date.now() - this.lastAttackTime >= this.config.attackCooldown;
    }

    isOptimalAttackTiming(target) {
        // More sophisticated timing logic based on entity behavior
        const timeSinceLastAttack = Date.now() - this.lastAttackTime;
        const minimumInterval = this.config.attackCooldown * 1.5;
        
        return timeSinceLastAttack >= minimumInterval;
    }

    async attackTarget(target) {
        if (!this.canAttack()) return;
        
        try {
            // Send attack packet (implementation depends on bedrock protocol)
            if (this.bot.client && this.bot.connected) {
                // This would need actual bedrock protocol implementation
                console.log(`⚔️ Attacking ${target.type}`);
                this.lastAttackTime = Date.now();
                this.combatStats.damageDealt += this.estimateAttackDamage();
                
                this.emit('attack_executed', { target, damage: this.estimateAttackDamage() });
            }
        } catch (error) {
            console.error('Attack failed:', error);
        }
    }

    async moveTowardsTarget(target) {
        if (this.managers?.navigation) {
            const targetPos = target.position || { x: target.x, y: target.y, z: target.z };
            await this.managers.navigation.moveToPosition(targetPos, this.config.optimalCombatRange);
        }
    }

    async moveAwayFromTarget(target) {
        if (this.managers?.navigation) {
            const targetPos = target.position || { x: target.x, y: target.y, z: target.z };
            const retreatPos = this.calculateRetreatPosition(targetPos);
            await this.managers.navigation.moveToPosition(retreatPos);
        }
    }

    calculateRetreatPosition(targetPos) {
        const botPos = this.bot.position;
        const dx = botPos.x - targetPos.x;
        const dz = botPos.z - targetPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance === 0) {
            return { x: botPos.x + 10, y: botPos.y, z: botPos.z };
        }
        
        const normalizedDx = dx / distance;
        const normalizedDz = dz / distance;
        
        return {
            x: botPos.x + normalizedDx * this.config.retreatDistance,
            y: botPos.y,
            z: botPos.z + normalizedDz * this.config.retreatDistance
        };
    }

    async executeRetreat(reason) {
        console.log(`🏃 Retreating from combat: ${reason}`);
        
        if (this.managers?.navigation) {
            const safePos = this.findSafePosition();
            await this.managers.navigation.moveToPosition(safePos);
        }
        
        await this.endCombat('RETREAT');
        await this.bot.sendChat(`🏃 Strategic retreat executed: ${reason}`);
    }

    findSafePosition() {
        const botPos = this.bot.position;
        // Simple safe position calculation - could be enhanced
        return {
            x: botPos.x + (Math.random() - 0.5) * 30,
            y: botPos.y + 5,
            z: botPos.z + (Math.random() - 0.5) * 30
        };
    }

    async useConsumables() {
        if (!this.config.useConsumables) return;
        
        // Use healing items if health is low
        if (this.bot.health < this.bot.maxHealth * 0.7) {
            await this.useHealingItem();
        }
        
        // Use buff items if available
        await this.useBuffItems();
    }

    async useHealingItem() {
        // Implementation would depend on inventory manager
        if (this.managers?.inventory) {
            await this.managers.inventory.useHealingItem();
        }
    }

    async useBuffItems() {
        // Implementation would depend on inventory manager
        if (this.managers?.inventory) {
            await this.managers.inventory.useBuffItems();
        }
    }

    isTargetValid(target) {
        const entity = this.bot.entities.get(target.id);
        if (!entity) return false;
        
        const distance = this.calculateDistance(this.bot.position, entity.position || entity);
        return distance <= this.config.maxCombatRange;
    }

    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    estimateAttackDamage() {
        // Base damage estimation - would be enhanced with actual weapon data
        return Math.floor(Math.random() * 4) + 2; // 2-6 damage
    }

    assessEnvironment() {
        // Simple environment assessment
        const y = this.bot.position.y;
        
        if (y < 10) return { type: 'UNDERGROUND', advantages: ['cover'], disadvantages: ['confined'] };
        if (y > 100) return { type: 'HIGH_ALTITUDE', advantages: ['visibility'], disadvantages: ['fall_risk'] };
        return { type: 'SURFACE', advantages: ['mobility'], disadvantages: [] };
    }

    handleHealthUpdate(stats) {
        if (stats.health < this.config.criticalHealthThreshold) {
            this.emit('critical_health', stats);
            
            if (this.inCombat && stats.health <= this.config.fleeHealthThreshold) {
                this.executeRetreat('CRITICAL_HEALTH');
            }
        }
    }

    handleDamageTaken(damage) {
        this.lastDamageTime = Date.now();
        this.combatStats.damageTaken += damage.amount || 1;
        
        this.emit('damage_taken', damage);
        
        // Reactive strategy adjustment
        if (this.inCombat && this.currentStrategy) {
            this.adjustStrategyForDamage(damage);
        }
    }

    adjustStrategyForDamage(damage) {
        // Make strategy more defensive after taking damage
        if (this.currentStrategy.approach === 'AGGRESSIVE') {
            this.currentStrategy.approach = 'BALANCED';
            console.log('⚔️ Adjusting strategy to BALANCED after taking damage');
        } else if (this.currentStrategy.approach === 'BALANCED') {
            this.currentStrategy.approach = 'DEFENSIVE';
            console.log('⚔️ Adjusting strategy to DEFENSIVE after taking damage');
        }
    }

    evaluateNewThreat(entity) {
        if (this.isHostileEntity(entity)) {
            const threat = this.calculateEntityThreat(entity);
            if (threat > 50 && !this.inCombat) {
                console.log(`⚠️ High threat entity detected: ${entity.type} (threat: ${threat})`);
                this.emit('high_threat_detected', entity);
            }
        }
    }

    handleEntityRemoved(entity) {
        if (this.currentTarget && entity.id === this.currentTarget.id) {
            this.endCombat('TARGET_DEFEATED');
        }
    }

    recordCombatStart(target) {
        this.combatHistory.push({
            startTime: Date.now(),
            target: target.type,
            botHealthStart: this.bot.health,
            strategy: this.currentStrategy?.approach || 'UNKNOWN'
        });
    }

    async endCombat(outcome) {
        if (!this.inCombat) return;
        
        this.inCombat = false;
        const combatDuration = Date.now() - this.combatStartTime;
        
        // Update statistics
        this.combatStats.totalFights++;
        this.combatStats.totalCombatTime += combatDuration;
        this.combatStats.averageFightDuration = this.combatStats.totalCombatTime / this.combatStats.totalFights;
        
        switch (outcome) {
            case 'TARGET_DEFEATED':
                this.combatStats.wins++;
                this.combatStats.killStreak++;
                if (this.combatStats.killStreak > this.combatStats.bestKillStreak) {
                    this.combatStats.bestKillStreak = this.combatStats.killStreak;
                }
                break;
            case 'RETREAT':
                this.combatStats.escapes++;
                this.combatStats.killStreak = 0;
                break;
            default:
                this.combatStats.losses++;
                this.combatStats.killStreak = 0;
        }
        
        // Update combat history
        if (this.combatHistory.length > 0) {
            const lastCombat = this.combatHistory[this.combatHistory.length - 1];
            lastCombat.endTime = Date.now();
            lastCombat.duration = combatDuration;
            lastCombat.outcome = outcome;
            lastCombat.botHealthEnd = this.bot.health;
        }
        
        this.currentTarget = null;
        this.currentStrategy = null;
        
        this.emit('combat_end', { outcome, duration: combatDuration, stats: this.combatStats });
        
        // Learn from combat outcome
        if (this.managers?.learning) {
            this.managers.learning.learnFromCombat({
                outcome,
                duration: combatDuration,
                target: this.combatHistory[this.combatHistory.length - 1]?.target,
                strategy: this.combatHistory[this.combatHistory.length - 1]?.strategy
            });
        }
    }

    loadCombatKnowledge() {
        // Load entity-specific combat patterns and weaknesses
        this.entityWeaknesses.set('minecraft:creeper', {
            weakness: 'explosion_timer',
            optimalRange: 8,
            avoidActions: ['close_combat'],
            preferredActions: ['hit_and_run', 'ranged_combat']
        });
        
        this.entityWeaknesses.set('minecraft:enderman', {
            weakness: 'water_damage',
            optimalRange: 15,
            avoidActions: ['eye_contact'],
            preferredActions: ['ranged_combat', 'height_advantage']
        });
        
        this.entityWeaknesses.set('minecraft:ender_dragon', {
            weakness: 'end_crystals',
            optimalRange: 20,
            avoidActions: ['breath_attack_area'],
            preferredActions: ['crystal_destruction', 'ground_combat']
        });
    }

    getCombatStatus() {
        return {
            inCombat: this.inCombat,
            currentTarget: this.currentTarget ? {
                type: this.currentTarget.type,
                distance: this.currentTarget.distance,
                threat: this.currentTarget.threat
            } : null,
            threatLevel: this.threatLevel,
            combatDuration: this.inCombat ? Date.now() - this.combatStartTime : 0,
            currentStrategy: this.currentStrategy,
            stats: this.combatStats,
            recentCombats: this.combatHistory.slice(-3)
        };
    }

    updateCombatStrategy() {
        if (!this.inCombat) return;
        
        // Periodically re-evaluate strategy during long combats
        const combatDuration = Date.now() - this.combatStartTime;
        const shouldReassess = combatDuration > 10000 && combatDuration % 5000 < 100; // Every 5s after 10s
        
        if (shouldReassess) {
            this.reassessCombatStrategy();
        }
    }

    async reassessCombatStrategy() {
        if (!this.currentTarget) return;
        
        const newStrategy = await this.consultAIForCombatStrategy(this.currentTarget);
        const oldApproach = this.currentStrategy?.approach;
        
        if (newStrategy.approach !== oldApproach) {
            console.log(`⚔️ Strategy updated: ${oldApproach} → ${newStrategy.approach}`);
            this.currentStrategy = newStrategy;
            this.emit('strategy_changed', { old: oldApproach, new: newStrategy.approach });
        }
    }

    // Battle Decision Engine - Core logic for when to fight or flee
    shouldEngageInBattle(target) {
        const riskFactors = this.calculateRiskFactors(target);
        const successProbability = this.calculateSuccessProbability(target);
        const strategicValue = this.calculateStrategicValue(target);
        
        // Decision matrix
        const engagementScore = (successProbability * 0.4) + (strategicValue * 0.3) - (riskFactors * 0.3);
        
        // Adjust based on bot's current state
        const stateModifier = this.getStateModifier();
        const finalScore = engagementScore + stateModifier;
        
        const decision = {
            engage: finalScore > 0.5,
            confidence: Math.abs(finalScore - 0.5) * 2,
            reasoning: this.buildDecisionReasoning(riskFactors, successProbability, strategicValue, finalScore),
            recommendedAction: this.getRecommendedAction(finalScore)
        };
        
        if (this.bot.config.debugMode) {
            console.log('🤔 Battle Decision Analysis:', decision);
        }
        
        return decision;
    }

    calculateRiskFactors(target) {
        let risk = 0;
        
        // Health risk
        const healthRatio = this.bot.health / this.bot.maxHealth;
        risk += (1 - healthRatio) * 0.4;
        
        // Target difficulty
        const targetThreat = this.calculateEntityThreat(target) / 100;
        risk += targetThreat * 0.3;
        
        // Environmental risks
        const envRisk = this.assessEnvironmentalRisks();
        risk += envRisk * 0.2;
        
        // Resource availability
        const resourceRisk = this.assessResourceRisks();
        risk += resourceRisk * 0.1;
        
        return Math.min(1, risk);
    }

    calculateSuccessProbability(target) {
        let probability = 0.5; // Base 50% chance
        
        // Historical performance against this entity type
        const history = this.getEntityCombatHistory(target.type);
        if (history.fights > 0) {
            probability = (probability + (history.wins / history.fights)) / 2;
        }
        
        // Equipment advantage
        const equipmentBonus = this.assessEquipmentAdvantage(target);
        probability += equipmentBonus * 0.2;
        
        // Health advantage
        const healthRatio = this.bot.health / this.bot.maxHealth;
        probability += (healthRatio - 0.5) * 0.3;
        
        // Distance advantage
        const optimalDistance = this.entityWeaknesses.get(target.type)?.optimalRange || this.config.optimalCombatRange;
        const distanceScore = Math.max(0, 1 - Math.abs(target.distance - optimalDistance) / optimalDistance);
        probability += distanceScore * 0.1;
        
        return Math.max(0.1, Math.min(0.9, probability));
    }

    calculateStrategicValue(target) {
        let value = 0;
        
        // Priority target bonus
        const priorityIndex = this.config.priorityTargets.indexOf(target.type);
        if (priorityIndex !== -1) {
            value += (this.config.priorityTargets.length - priorityIndex) / this.config.priorityTargets.length * 0.4;
        }
        
        // XP/loot value estimation
        const lootValue = this.estimateLootValue(target.type);
        value += lootValue * 0.3;
        
        // Threat elimination value (removing dangerous entities)
        const threatElimination = this.calculateEntityThreat(target) / 100 * 0.3;
        value += threatElimination;
        
        return Math.min(1, value);
    }

    getStateModifier() {
        let modifier = 0;
        
        // Aggression level
        modifier += (this.config.aggressionLevel - 0.5) * 0.2;
        
        // Kill streak bonus
        if (this.combatStats.killStreak > 3) {
            modifier += 0.1;
        }
        
        // Recent losses penalty
        const recentLosses = this.combatHistory.slice(-5).filter(c => c.outcome === 'RETREAT' || c.outcome === 'DEFEAT').length;
        modifier -= recentLosses * 0.05;
        
        // Time of day consideration (if bot has fatigue system)
        const timeBonus = this.getTimeOfDayModifier();
        modifier += timeBonus;
        
        return modifier;
    }

    getTimeOfDayModifier() {
        // Simple day/night cycle consideration
        if (this.bot.time && this.bot.time.day) {
            const timeOfDay = this.bot.time.day % 24000;
            if (timeOfDay > 12000 && timeOfDay < 23000) { // Night time
                return -0.1; // Slightly more cautious at night
            }
        }
        return 0;
    }

    assessEnvironmentalRisks() {
        let risk = 0;
        const env = this.assessEnvironment();
        
        if (env.disadvantages.includes('confined')) risk += 0.3;
        if (env.disadvantages.includes('fall_risk')) risk += 0.2;
        
        // Check for lava/water nearby
        if (this.isHazardousEnvironment()) risk += 0.4;
        
        return Math.min(1, risk);
    }

    assessResourceRisks() {
        let risk = 0;
        
        // Low durability weapons
        if (this.managers?.inventory) {
            const weaponDurability = this.managers.inventory.getWeaponDurability();
            if (weaponDurability < 0.3) risk += 0.4;
        }
        
        // No healing items
        const hasHealing = this.managers?.inventory?.hasHealingItems() || false;
        if (!hasHealing) risk += 0.3;
        
        // Low food
        if (this.bot.food < 10) risk += 0.2;
        
        return Math.min(1, risk);
    }

    getEntityCombatHistory(entityType) {
        const relevant = this.combatHistory.filter(combat => combat.target === entityType);
        return {
            fights: relevant.length,
            wins: relevant.filter(c => c.outcome === 'TARGET_DEFEATED').length,
            avgDuration: relevant.reduce((sum, c) => sum + (c.duration || 0), 0) / relevant.length || 0
        };
    }

    assessEquipmentAdvantage(target) {
        // Simplified equipment assessment
        let advantage = 0;
        
        // Weapon effectiveness against target type
        const weaponBonus = this.getWeaponEffectiveness(target.type);
        advantage += weaponBonus;
        
        // Armor protection
        const armorBonus = this.getArmorProtection();
        advantage += armorBonus;
        
        return Math.min(1, advantage);
    }

    getWeaponEffectiveness(entityType) {
        // This would be enhanced with actual inventory data
        const weaponEffectiveness = {
            'minecraft:undead': 0.8, // Smite enchantment
            'minecraft:spider': 0.7, // Bane of arthropods
            'minecraft:enderman': 0.3, // Avoid melee
        };
        
        return weaponEffectiveness[entityType] || 0.5;
    }

    getArmorProtection() {
        // Simplified armor assessment
        return this.managers?.inventory?.getArmorLevel() || 0.3;
    }

    estimateLootValue(entityType) {
        const lootValues = {
            'minecraft:ender_dragon': 1.0,
            'minecraft:wither': 0.9,
            'minecraft:blaze': 0.7,
            'minecraft:enderman': 0.6,
            'minecraft:creeper': 0.4,
            'minecraft:zombie': 0.3,
            'minecraft:skeleton': 0.3,
            'minecraft:spider': 0.2
        };
        
        return lootValues[entityType] || 0.2;
    }

    buildDecisionReasoning(risk, success, value, finalScore) {
        const reasons = [];
        
        if (risk > 0.7) reasons.push(`High risk (${(risk * 100).toFixed(0)}%)`);
        if (success > 0.7) reasons.push(`High success chance (${(success * 100).toFixed(0)}%)`);
        if (value > 0.6) reasons.push(`Valuable target`);
        if (this.bot.health < this.bot.maxHealth * 0.5) reasons.push(`Low health`);
        if (this.combatStats.killStreak > 2) reasons.push(`Kill streak active`);
        
        return reasons.join(', ') || 'Standard assessment';
    }

    getRecommendedAction(score) {
        if (score > 0.8) return 'AGGRESSIVE_ENGAGE';
        if (score > 0.6) return 'CAUTIOUS_ENGAGE';
        if (score > 0.4) return 'DEFENSIVE_ENGAGE';
        if (score > 0.2) return 'MONITOR';
        return 'RETREAT';
    }

    isHazardousEnvironment() {
        // Check for environmental hazards
        // This would need actual world scanning implementation
        return false; // Placeholder
    }

    // Advanced retreat logic
    async executeSmartRetreat(reason, target = null) {
        console.log(`🧠 Executing smart retreat: ${reason}`);
        
        const retreatOptions = this.analyzeRetreatOptions(target);
        const bestRetreat = retreatOptions.reduce((best, option) => 
            option.safety > best.safety ? option : best
        );
        
        // Execute the retreat
        if (this.managers?.navigation) {
            await this.managers.navigation.moveToPosition(bestRetreat.position);
        }
        
        // Set appropriate cooldown before re-engaging
        this.setRetreatCooldown(reason);
        
        await this.endCombat('SMART_RETREAT');
        await this.bot.sendChat(`🧠 Strategic withdrawal: ${reason} (Safety: ${bestRetreat.safety})`);
    }

    analyzeRetreatOptions(target) {
        const botPos = this.bot.position;
        const options = [];
        
        // Generate multiple retreat positions
        for (let angle = 0; angle < 360; angle += 45) {
            const rad = (angle * Math.PI) / 180;
            const distance = this.config.retreatDistance;
            
            const position = {
                x: botPos.x + Math.cos(rad) * distance,
                y: botPos.y,
                z: botPos.z + Math.sin(rad) * distance
            };
            
            const safety = this.calculatePositionSafety(position, target);
            options.push({ position, safety, angle });
        }
        
        return options;
    }

    calculatePositionSafety(position, target) {
        let safety = 0.5;
        
        // Distance from current target
        if (target) {
            const targetPos = target.position || target;
            const distance = this.calculateDistance(position, targetPos);
            safety += Math.min(0.3, distance / this.config.maxCombatRange);
        }
        
        // Distance from other threats
        const nearbyThreats = this.getNearbyHostileEntities();
        for (const threat of nearbyThreats) {
            const distance = this.calculateDistance(position, threat.position || threat);
            safety += Math.min(0.1, distance / this.config.maxCombatRange * 0.5);
        }
        
        // Environmental safety (avoid hazards)
        if (position.y < 10) safety -= 0.2; // Underground penalty
        if (position.y > 100) safety -= 0.1; // Height penalty
        
        return Math.max(0.1, Math.min(1, safety));
    }

    setRetreatCooldown(reason) {
        const cooldowns = {
            'LOW_HEALTH': 30000,      // 30 seconds
            'CRITICAL_HEALTH': 60000, // 1 minute
            'STRATEGIC': 15000,       // 15 seconds
            'SMART_RETREAT': 20000    // 20 seconds
        };
        
        this.retreatCooldownEnd = Date.now() + (cooldowns[reason] || 20000);
    }

    canEngageInCombat() {
        // Check if retreat cooldown is active
        if (this.retreatCooldownEnd && Date.now() < this.retreatCooldownEnd) {
            return false;
        }
        
        // Other engagement checks
        return this.bot.health > this.config.fleeHealthThreshold && 
               this.threatLevel !== 'NONE' && 
               !this.inCombat;
    }

    // Public method to get battle recommendations
    getBattleRecommendation(target) {
        if (!this.canEngageInCombat()) {
            return {
                recommendation: 'WAIT',
                reason: 'Cooldown active or not ready',
                confidence: 1.0
            };
        }
        
        const decision = this.shouldEngageInBattle(target);
        return {
            recommendation: decision.engage ? 'ENGAGE' : 'AVOID',
            action: decision.recommendedAction,
            confidence: decision.confidence,
            reason: decision.reasoning
        };
    }
}

module.exports = CombatManager;