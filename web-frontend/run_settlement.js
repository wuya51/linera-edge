import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

class SettlementKeeper {
    constructor() {
        const chainId = process.env.VITE_CHAIN_ID;
        const appId = process.env.VITE_APP_ID;
        this.keeperAccount = appId.startsWith('0x') ? appId : `0x${appId}`;
        this.settlementInterval = parseInt(process.env.SETTLEMENT_INTERVAL || '60');
        this.graphqlEndpoint = `http://${process.env.VITE_HOST || 'localhost'}:${process.env.VITE_PORT || '8080'}/chains/${chainId}/applications/${appId}`;
        
        if (!chainId || !appId || !this.keeperAccount) {
            throw new Error('Missing required environment variables. Please check .env file.');
        }
        
        this.log('Settlement Keeper initialized');
        this.log(`GraphQL Endpoint: ${this.graphqlEndpoint}`);
        this.log(`Keeper Account: ${this.keeperAccount}`);
        this.log(`Settlement Interval: ${this.settlementInterval} seconds`);
    }
    
    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        try {
            fs.appendFileSync('/root/linera-protocol/examples/Linera-edge/logs/settlement.log', `${logMessage}\n`);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    
    async sendSettlementRequest() {
        try {
            this.log('Sending settlement request...');
            const mutation = `
            mutation($caller: AccountOwner!) {
                settle(caller: $caller)
            }
            `;
            
            const payload = {
                query: mutation,
                variables: {
                    caller: this.keeperAccount
                }
            };
            
            const headers = { 'Content-Type': 'application/json' };
            const response = await axios.post(
                this.graphqlEndpoint,
                payload,
                {
                    headers,
                    timeout: 30000
                }
            );
            
            const result = response.data;
            
            if (result.errors) {
                this.log(`Settlement failed with errors: ${JSON.stringify(result.errors)}`);
                return false;
            } else {
                this.log('Settlement completed successfully');
                return true;
            }
            
        } catch (error) {
            this.log(`Settlement request failed: ${error.message}`);
            return false;
        }
    }
    
    async runOnce() {
        this.log('Running settlement...');
        const success = await this.sendSettlementRequest();
        this.log(`Settlement run completed with status: ${success ? 'SUCCESS' : 'FAILED'}`);
        return success;
    }
    
    start() {
        const runAtExactMinute = () => {
            const now = new Date();
            const seconds = now.getSeconds();
            const milliseconds = now.getMilliseconds();
            
            const timeUntilNextMinute = (60 - seconds) * 1000 - milliseconds;
            
            this.log(`Current time: ${now.toLocaleString()}`);
            this.log(`Time until next minute: ${Math.round(timeUntilNextMinute / 1000)} seconds`);
            this.log(`Next settlement scheduled at: ${new Date(now.getTime() + timeUntilNextMinute).toLocaleString()}`);
            
            setTimeout(() => {
                this.log('Executing scheduled settlement...');
                this.runOnce();
                
                this.log('Setting up 1-minute settlement interval');
                setInterval(() => {
                    this.log('Executing 1-minute settlement...');
                    this.runOnce();
                }, 60000);
            }, timeUntilNextMinute);
        };
        
        runAtExactMinute();
    }
}

async function main() {
    try {
        console.log('Starting Settlement Keeper...');
        const keeper = new SettlementKeeper();
        
        const runOnce = process.argv.includes('--once');
        
        if (runOnce) {
            console.log('Running settlement once...');
            await keeper.runOnce();
            console.log('Settlement run completed. Exiting...');
        } else {
            console.log('Starting continuous settlement mode...');
            keeper.start();
            console.log('Settlement Keeper started in continuous mode.');
        }
    } catch (error) {
        console.error('Error starting Settlement Keeper:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default SettlementKeeper;
