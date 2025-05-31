// NavigationManager.js - Handles bot movement and pathfinding
const EventEmitter = require('events');

class NavigationManager extends EventEmitter {
    constructor(bot) {
        super();
        this.bot = bot;
        this.managers = {};
        
        // Navigation state
        this.currentTarget = null;
        this.isNavigating = false;
        this.pathQueue = [];
        this.lastPosition = { x: 0, y: 0, z: 0 };
        this.stuckCounter = 0;
        this.maxStuckCount = 10;
        
        // Movement settings
        this.movementSpeed = 0.1;
        this.jumpHeight = 1.0;
        this.followDistance = 3.0;
        this.pathfindingEnabled = true;
        
        // Ender Dragon specific locations
        this.enderDragonLocations = {
            stronghold: null,
            endPortal: null,
            endDimension: { x: 0, y: 64, z: 0 },
            dragonPerch: { x: 0, y: 80, z: 0 },
            endCrystals: []
        };
        
        // Navigation history for learning
        this.navigationHistory = [];
        this.maxHistorySize = 100;
        
        console.log('🧭 NavigationManager initialized');
    }

    setManagers(managers) {
        this.managers = managers;
    }

    async onConnect() {
        this.startPositionTracking();
        console.log('🧭 Navigation system online');
    }

    startPositionTracking() {
        // Track position changes
        this.bot.on('position_update', (position) => {
            this.updatePosition(position);
        });

        // Check for stuck detection every 5 seconds
        setInterval(() => {
            this.checkIfStuck();
        }, 5000);
    }

    updatePosition(newPosition) {
        const oldPosition = { ...this.lastPosition };
        this.lastPosition = newPosition;
        
        // Calculate distance moved
        const distance = this.calculateDistance(oldPosition, newPosition);
        
        // Record successful movement
        if (distance > 0.1 && this.isNavigating) {
            this.stuckCounter = 0;
            this.recordNavigationSuccess(oldPosition, newPosition, distance);
        }

        this.emit('position_changed', { old: oldPosition, new: newPosition, distance });
    }

    checkIfStuck() {
        if (!this.isNavigating || !this.currentTarget) return;

        const distanceToTarget = this.calculateDistance(this.lastPosition, this.currentTarget);
        
        // If we haven't moved much toward our target
        if (distanceToTarget > this.followDistance) {
            this.stuckCounter++;
            
            if (this.stuckCounter >= this.maxStuckCount) {
                console.log('🚧 Bot appears stuck, attempting recovery');
                this.handleStuckSituation();
            }
        }
    }

    async handleStuckSituation() {
        this.stuckCounter = 0;
        
        // Try different recovery strategies
        const strategies = [
            () => this.jump(),
            () => this.moveRandom(),
            () => this.teleportToSafeLocation(),
            () => this.requestPlayerHelp()
        ];

        for (const strategy of strategies) {
            try {
                await strategy();
                await this.bot.delay(2000);
                
                // Check if we're still stuck
                if (!this.isStillStuck()) {
                    console.log('✅ Successfully recovered from stuck situation');
                    return;
                }
            } catch (error) {
                console.log('❌ Recovery strategy failed:', error.message);
            }
        }

        console.log('⚠️ All recovery strategies failed');
        this.emit('navigation_failed', { reason: 'stuck', position: this.lastPosition });
    }

    async navigateToTarget(target, options = {}) {
        if (!target) {
            throw new Error('Navigation target is required');
        }

        this.currentTarget = target;
        this.isNavigating = true;
        
        const config = {
            precision: options.precision || 2.0,
            timeout: options.timeout || 30000,
            avoidDanger: options.avoidDanger !== false,
            ...options
        };

        console.log(`🧭 Navigating to target: ${JSON.stringify(target)}`);
        this.emit('navigation_started', { target, config });

        try {
            await this.executeNavigation(target, config);
            console.log('✅ Navigation completed successfully');
            this.emit('navigation_completed', { target, success: true });
        } catch (error) {
            console.log('❌ Navigation failed:', error.message);
            this.emit('navigation_failed', { target, error: error.message });
        } finally {
            this.isNavigating = false;
            this.currentTarget = null;
        }
    }

    async executeNavigation(target, config) {
        const startTime = Date.now();
        const maxTime = config.timeout;

        while (this.isNavigating && (Date.now() - startTime) < maxTime) {
            const currentDistance = this.calculateDistance(this.lastPosition, target);
            
            if (currentDistance <= config.precision) {
                return; // Reached target
            }

            // Generate next movement step
            const nextStep = this.calculateNextStep(this.lastPosition, target);
            await this.moveToPosition(nextStep);
            
            await this.bot.delay(500); // Prevent spam
        }

        if ((Date.now() - startTime) >= maxTime) {
            throw new Error('Navigation timeout');
        }
    }

    calculateNextStep(current, target) {
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        const dz = target.z - current.z;
        
        // Normalize movement
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const stepSize = Math.min(this.movementSpeed, distance);
        
        if (distance === 0) return current;
        
        return {
            x: current.x + (dx / distance) * stepSize,
            y: current.y + (dy / distance) * stepSize,
            z: current.z + (dz / distance) * stepSize
        };
    }

    async moveToPosition(position) {
        if (!this.bot.client || !this.bot.connected) {
            throw new Error('Bot not connected');
        }

        try {
            // Send movement packet
            this.bot.client.write('move_player', {
                runtime_id: this.bot.runtimeId,
                position: position,
                pitch: 0,
                yaw: this.calculateYaw(this.lastPosition, position),
                head_yaw: 0,
                mode: 0,
                on_ground: true,
                ridden_runtime_id: 0,
                cause: {
                    type: 0,
                    entity_runtime_id: 0
                },
                tick: BigInt(Date.now())
            });

            this.bot.emit('packet_sent');
        } catch (error) {
            console.error('Movement failed:', error);
            throw error;
        }
    }

    calculateYaw(from, to) {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        return Math.atan2(dz, dx) * (180 / Math.PI);
    }

    async jump() {
        const jumpPosition = {
            ...this.lastPosition,
            y: this.lastPosition.y + this.jumpHeight
        };
        await this.moveToPosition(jumpPosition);
        console.log('🦘 Attempted jump');
    }

    async moveRandom() {
        const randomOffset = {
            x: (Math.random() - 0.5) * 4,
            y: 0,
            z: (Math.random() - 0.5) * 4
        };
        
        const randomPosition = {
            x: this.lastPosition.x + randomOffset.x,
            y: this.lastPosition.y,
            z: this.lastPosition.z + randomOffset.z
        };
        
        await this.moveToPosition(randomPosition);
        console.log('🎲 Attempted random movement');
    }

    async teleportToSafeLocation() {
        // Try to teleport to a known safe location
        const safeLocations = [
            { x: 0, y: 64, z: 0 }, // World spawn
            this.enderDragonLocations.endDimension,
            ...this.getRecentSuccessfulLocations()
        ];

        for (const location of safeLocations) {
            try {
                await this.bot.sendChat(`/tp ${this.bot.config.username} ${location.x} ${location.y} ${location.z}`);
                console.log('🌀 Attempted teleport to safe location');
                return;
            } catch (error) {
                continue;
            }
        }
    }

    async requestPlayerHelp() {
        const players = Array.from(this.bot.players.values());
        if (players.length > 0) {
            await this.bot.sendChat('🆘 I seem to be stuck! Could someone help me navigate?');
            console.log('🆘 Requested player assistance');
        }
    }

    // Ender Dragon specific navigation methods
    async navigateToStronghold() {
        if (!this.enderDragonLocations.stronghold) {
            await this.searchForStronghold();
        }
        
        if (this.enderDragonLocations.stronghold) {
            await this.navigateToTarget(this.enderDragonLocations.stronghold);
        } else {
            throw new Error('Stronghold location unknown');
        }
    }

    async navigateToEndPortal() {
        if (!this.enderDragonLocations.endPortal) {
            await this.searchForEndPortal();
        }
        
        if (this.enderDragonLocations.endPortal) {
            await this.navigateToTarget(this.enderDragonLocations.endPortal);
        } else {
            throw new Error('End portal location unknown');
        }
    }

    async navigateToEndDimension() {
        await this.navigateToTarget(this.enderDragonLocations.endDimension, {
            precision: 5.0,
            timeout: 60000
        });
    }

    async navigateToEndCrystal(crystalIndex = 0) {
        if (this.enderDragonLocations.endCrystals.length > crystalIndex) {
            const crystal = this.enderDragonLocations.endCrystals[crystalIndex];
            await this.navigateToTarget(crystal, { precision: 3.0 });
        } else {
            throw new Error('End crystal location unknown');
        }
    }

    async searchForStronghold() {
        // Use eye of ender or player guidance to find stronghold
        await this.bot.sendChat('🔍 Searching for stronghold... Does anyone know the location?');
        
        // Listen for player responses about stronghold location
        const listener = (message) => {
            const strongholdPattern = /stronghold.*?(-?\d+).*?(-?\d+).*?(-?\d+)/i;
            const match = message.match(strongholdPattern);
            
            if (match) {
                this.enderDragonLocations.stronghold = {
                    x: parseInt(match[1]),
                    y: parseInt(match[2]),
                    z: parseInt(match[3])
                };
                console.log('🏰 Stronghold location discovered:', this.enderDragonLocations.stronghold);
                this.bot.removeListener('chat_received', listener);
            }
        };
        
        this.bot.on('chat_received', listener);
        
        // Remove listener after timeout
        setTimeout(() => {
            this.bot.removeListener('chat_received', listener);
        }, 30000);
    }

    async searchForEndPortal() {
        await this.bot.sendChat('🌀 Searching for End Portal... Any coordinates?');
        // Similar implementation to stronghold search
    }

    // Follow player functionality
    async followPlayer(playerName) {
        const player = Array.from(this.bot.players.values())
            .find(p => p.name === playerName);
        
        if (!player) {
            throw new Error(`Player ${playerName} not found`);
        }

        this.isNavigating = true;
        console.log(`👥 Following player: ${playerName}`);
        
        const followLoop = async () => {
            while (this.isNavigating && this.bot.players.has(player.runtime_id)) {
                const currentPlayer = this.bot.players.get(player.runtime_id);
                const distance = this.calculateDistance(this.lastPosition, currentPlayer.position);
                
                if (distance > this.followDistance) {
                    await this.navigateToTarget(currentPlayer.position, { 
                        precision: this.followDistance,
                        timeout: 5000 
                    });
                }
                
                await this.bot.delay(2000);
            }
        };

        followLoop().catch(error => {
            console.log('❌ Follow player failed:', error.message);
            this.stopNavigation();
        });
    }

    stopNavigation() {
        this.isNavigating = false;
        this.currentTarget = null;
        console.log('⏹️ Navigation stopped');
        this.emit('navigation_stopped');
    }

    // Utility methods
    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    isStillStuck() {
        // Simple check - if we haven't moved significantly in the last few checks
        return this.stuckCounter > 3;
    }

    recordNavigationSuccess(from, to, distance) {
        const record = {
            timestamp: Date.now(),
            from: { ...from },
            to: { ...to },
            distance,
            duration: Date.now() - (this.navigationStartTime || Date.now())
        };

        this.navigationHistory.push(record);
        
        if (this.navigationHistory.length > this.maxHistorySize) {
            this.navigationHistory.shift();
        }

        // Emit for learning system
        this.bot.emit('navigation_success', record);
    }

    getRecentSuccessfulLocations() {
        return this.navigationHistory
            .slice(-10)
            .map(record => record.to);
    }

    getCurrentTarget() {
        return {
            target: this.currentTarget,
            isNavigating: this.isNavigating,
            distance: this.currentTarget ? 
                this.calculateDistance(this.lastPosition, this.currentTarget) : null,
            stuckCounter: this.stuckCounter
        };
    }

    getNavigationStats() {
        return {
            isNavigating: this.isNavigating,
            currentTarget: this.currentTarget,
            position: this.lastPosition,
            navigationHistory: this.navigationHistory.length,
            stuckCounter: this.stuckCounter,
            enderDragonLocations: this.enderDragonLocations
        };
    }

    // Update known locations
    updateStrongholdLocation(position) {
        this.enderDragonLocations.stronghold = position;
        console.log('🏰 Stronghold location updated:', position);
    }

    updateEndPortalLocation(position) {
        this.enderDragonLocations.endPortal = position;
        console.log('🌀 End Portal location updated:', position);
    }

    addEndCrystalLocation(position) {
        this.enderDragonLocations.endCrystals.push(position);
        console.log('💎 End Crystal location added:', position);
    }
}

module.exports = NavigationManager;