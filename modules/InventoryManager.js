// modules/InventoryManager.js
class InventoryManager {
    constructor(bot) {
        this.bot = bot;
        
        // Initialize inventory
        this.inventory = {
            diamonds: 0,
            iron: 0,
            wood: 0,
            enderPearls: 0,
            blazeRods: 0,
            obsidian: 0,
            food: 0,
            arrows: 0,
            armor: 'none',
            weapons: [],
            tools: [],
            eyesOfEnder: 0,
            buildingBlocks: 0
        };
    }

    // Resource management methods
    addItem(item, quantity = 1) {
        if (this.inventory.hasOwnProperty(item)) {
            this.inventory[item] += quantity;
            return true;
        }
        return false;
    }

    removeItem(item, quantity = 1) {
        if (this.inventory.hasOwnProperty(item) && this.inventory[item] >= quantity) {
            this.inventory[item] -= quantity;
            return true;
        }
        return false;
    }

    hasItem(item, quantity = 1) {
        return this.inventory.hasOwnProperty(item) && this.inventory[item] >= quantity;
    }

    getItemCount(item) {
        return this.inventory[item] || 0;
    }

    addWeapon(weapon) {
        if (!this.inventory.weapons.includes(weapon)) {
            this.inventory.weapons.push(weapon);
            return true;
        }
        return false;
    }

    addTool(tool) {
        if (!this.inventory.tools.includes(tool)) {
            this.inventory.tools.push(tool);
            return true;
        }
        return false;
    }

    setArmor(armorType) {
        this.inventory.armor = armorType;
    }

    // Crafting methods
    async craftDiamondGear() {
        if (this.inventory.diamonds >= 8) {
            console.log('🔨 Crafting diamond equipment...');
            await this.bot.sendChat('🔨 Crafting diamond sword, pickaxe, and armor!');
            
            this.addWeapon('Diamond Sword');
            this.addTool('Diamond Pickaxe');
            this.setArmor('Diamond Armor Set');
            this.removeItem('diamonds', 8);
            
            await this.bot.sendChat('⚔️ Diamond gear crafted! Ready for serious adventuring!');
            this.bot.missionManager.logProgress('Diamond gear crafted successfully');
            return true;
        }
        return false;
    }

    async craftEyesOfEnder() {
        console.log('👁️ Crafting eyes of ender...');
        await this.bot.sendChat('👁️ Crafting eyes of ender for stronghold search!');
        
        const eyesCrafted = Math.min(this.inventory.enderPearls, this.inventory.blazeRods);
        if (eyesCrafted > 0) {
            this.removeItem('enderPearls', eyesCrafted);
            this.removeItem('blazeRods', eyesCrafted);
            this.addItem('eyesOfEnder', eyesCrafted);
            
            await this.bot.sendChat(`✅ Crafted ${eyesCrafted} eyes of ender! Time to find the stronghold!`);
            this.bot.missionManager.logProgress(`Crafted ${eyesCrafted} eyes of ender`);
            return eyesCrafted;
        }
        return 0;
    }

    // Resource gathering simulation
    async simulateMining(resource, minAmount = 1, maxAmount = 3, successRate = 0.7) {
        if (Math.random() <= successRate) {
            const found = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
            this.addItem(resource, found);
            return found;
        }
        return 0;
    }

    async simulateHunting(creature, dropItem, minAmount = 1, maxAmount = 2, successRate = 0.6) {
        if (Math.random() <= successRate) {
            const found = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
            this.addItem(dropItem, found);
            return found;
        }
        return 0;
    }

    // Resource requirement checking
    checkDiamondGearRequirements() {
        return this.inventory.diamonds >= 8;
    }

    checkNetherExpeditionRequirements() {
        return this.hasItem('obsidian', 10) && this.inventory.weapons.includes('Diamond Sword');
    }

    checkStrongholdSearchRequirements() {
        return this.inventory.blazeRods >= 7 && this.inventory.enderPearls >= 12;
    }

    checkEndFightRequirements() {
        return (
            this.inventory.weapons.includes('Diamond Sword') &&
            this.inventory.armor === 'Diamond Armor Set' &&
            this.inventory.food >= 20 &&
            this.inventory.arrows >= 64
        );
    }

    // Inventory reporting
    getInventoryReport() {
        return `📦 Key items: ${this.inventory.diamonds}💎 ${this.inventory.blazeRods}🔥 ${this.inventory.enderPearls}👁️ | Armor: ${this.inventory.armor}`;
    }

    getDetailedInventory() {
        const weapons = this.inventory.weapons.join(', ') || 'None';
        const tools = this.inventory.tools.join(', ') || 'None';
        
        return {
            resources: {
                diamonds: this.inventory.diamonds,
                iron: this.inventory.iron,
                obsidian: this.inventory.obsidian,
                enderPearls: this.inventory.enderPearls,
                blazeRods: this.inventory.blazeRods,
                eyesOfEnder: this.inventory.eyesOfEnder,
                food: this.inventory.food,
                arrows: this.inventory.arrows
            },
            equipment: {
                armor: this.inventory.armor,
                weapons: weapons,
                tools: tools
            }
        };
    }

    // Mission-specific inventory checks
    getMissingItems(phase) {
        const missing = [];
        
        switch (phase) {
            case 'preparation':
                if (this.inventory.diamonds < 8) missing.push(`${8 - this.inventory.diamonds} more diamonds`);
                if (this.inventory.iron < 10) missing.push(`${10 - this.inventory.iron} more iron`);
                break;
                
            case 'nether':
                if (this.inventory.obsidian < 10) missing.push(`${10 - this.inventory.obsidian} obsidian`);
                if (!this.inventory.weapons.includes('Diamond Sword')) missing.push('Diamond sword');
                break;
                
            case 'stronghold':
                if (this.inventory.blazeRods < 7) missing.push(`${7 - this.inventory.blazeRods} blaze rods`);
                if (this.inventory.enderPearls < 12) missing.push(`${12 - this.inventory.enderPearls} ender pearls`);
                break;
                
            case 'end_fight':
                if (this.inventory.food < 20) missing.push(`${20 - this.inventory.food} food items`);
                if (this.inventory.arrows < 64) missing.push(`${64 - this.inventory.arrows} arrows`);
                break;
        }
        
        return missing;
    }

    getInventoryStatus(phase) {
        const missing = this.getMissingItems(phase);
        if (missing.length === 0) {
            return `✅ All required items for ${phase} phase obtained!`;
        } else {
            return `⚠️ Still need: ${missing.join(', ')}`;
        }
    }

    // Resource priority suggestions
    getResourcePriority(phase) {
        const priorities = {
            'preparation': ['diamonds', 'iron', 'food'],
            'nether': ['obsidian', 'food', 'arrows'],
            'stronghold': ['blazeRods', 'enderPearls'],
            'end_fight': ['food', 'arrows', 'buildingBlocks']
        };
        
        return priorities[phase] || [];
    }
}

module.exports = InventoryManager;