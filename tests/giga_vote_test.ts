import {
    Clarinet,
    Tx,
    Chain,
    Account,
    types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure can create poll and vote",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const voter1 = accounts.get('wallet_1')!;
        const voter2 = accounts.get('wallet_2')!;

        // Test poll creation
        let block = chain.mineBlock([
            Tx.contractCall('giga_vote', 'create-poll', [
                types.ascii("What's your favorite color?"),
                types.list([types.ascii("Red"), types.ascii("Blue"), types.ascii("Green")]),
                types.uint(100)  // Duration in blocks
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);  // First poll ID should be 1

        // Test voting
        let voteBlock = chain.mineBlock([
            Tx.contractCall('giga_vote', 'vote', [
                types.uint(1),  // Poll ID
                types.uint(0)   // Voting for first option (Red)
            ], voter1.address)
        ]);
        
        voteBlock.receipts[0].result.expectOk().expectBool(true);

        // Verify vote was recorded
        let resultBlock = chain.mineBlock([
            Tx.contractCall('giga_vote', 'get-poll-results', [
                types.uint(1),  // Poll ID
                types.uint(0)   // First option
            ], deployer.address)
        ]);
        
        assertEquals(
            resultBlock.receipts[0].result,
            '(ok {votes: u1})'
        );
    }
});

Clarinet.test({
    name: "Ensure cannot vote twice",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const voter1 = accounts.get('wallet_1')!;

        // Create poll
        let block = chain.mineBlock([
            Tx.contractCall('giga_vote', 'create-poll', [
                types.ascii("Test poll"),
                types.list([types.ascii("Option 1"), types.ascii("Option 2")]),
                types.uint(100)
            ], deployer.address)
        ]);

        // Vote first time
        let vote1Block = chain.mineBlock([
            Tx.contractCall('giga_vote', 'vote', [
                types.uint(1),
                types.uint(0)
            ], voter1.address)
        ]);
        
        vote1Block.receipts[0].result.expectOk().expectBool(true);

        // Try to vote again
        let vote2Block = chain.mineBlock([
            Tx.contractCall('giga_vote', 'vote', [
                types.uint(1),
                types.uint(1)
            ], voter1.address)
        ]);
        
        vote2Block.receipts[0].result.expectErr().expectUint(102); // ERR_ALREADY_VOTED
    }
});

Clarinet.test({
    name: "Ensure cannot vote on expired poll",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const voter1 = accounts.get('wallet_1')!;

        // Create poll with short duration
        let block = chain.mineBlock([
            Tx.contractCall('giga_vote', 'create-poll', [
                types.ascii("Quick poll"),
                types.list([types.ascii("Yes"), types.ascii("No")]),
                types.uint(1)  // Very short duration
            ], deployer.address)
        ]);

        // Mine some blocks to make poll expire
        chain.mineEmptyBlock(2);

        // Try to vote on expired poll
        let voteBlock = chain.mineBlock([
            Tx.contractCall('giga_vote', 'vote', [
                types.uint(1),
                types.uint(0)
            ], voter1.address)
        ]);
        
        voteBlock.receipts[0].result.expectErr().expectUint(101); // ERR_POLL_EXPIRED
    }
});