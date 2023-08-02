const AccountHelper = require("./helpers/Helper");

const ERC20 = artifacts.require("ERC20PresetFixedSupply");
const DeVestFactory = artifacts.require("DeVestFactory");

contract('Functions accessability', (accounts) => {

    let vestingToken;
    let factory;
    let orderBook;


    before(async () => {
        vestingToken = await ERC20.deployed();
        factory = await DeVestFactory.deployed();
        await AccountHelper.setupAccountFunds(accounts, vestingToken, 40000000000);
        orderBook = await AccountHelper.createTangible(factory, vestingToken.address, "Example Pool", "EXP", 5000, 10, 0,  accounts[0]);
    });

    // check if functions are accessible while in created state (initialization should be the only one available)
    it('Check functions accessibility before initialization', async () => {
        // try calling purchase
        try {
            // allowence for account 2
            await vestingToken.approve(orderBook.address, Math.floor(100 * 100 * 1.1), { from: accounts[2] });
            await orderBook.purchase(100, { from: accounts[2] });
            assert(false, "Purchase should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // try calling buy
        try {
            await orderBook.buy(100, 100, { from: accounts[2] });
            assert(false, "Buy should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // try calling sell
        try {
            await orderBook.sell(100, 100, { from: accounts[0] });
            assert(false, "Sell should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // try calling initilize with account that is not owner
        try {
            await orderBook.initialize(100, 0, { from: accounts[2] });
            assert(false, "Initialize should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Owner: caller is not the owner", "Invalid error message");
        }

    });

    // check if functions are accessible while in initialized state
    it('Check functions accessibility after initialization', async () => {

        // initilize with account that is owner
        await orderBook.initialize(100, 0, { from: accounts[0] });

        // try calling initilize again
        try {
            await orderBook.initialize(100, 0, { from: accounts[0] });
            assert(false, "Initialize should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // try calling purchase
        try {
            // allowence for account 2
            await vestingToken.approve(orderBook.address, Math.floor(100 * 100 * 1.1), { from: accounts[2] });
            await orderBook.purchase(100, { from: accounts[2] });
            assert(false, "Purchase should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // allowence for account 2
        await vestingToken.approve(orderBook.address, Math.floor(100 * 100 * 1.1), { from: accounts[2] });
        // buy should be callable after initialization
        await orderBook.buy(100, 100, { from: accounts[2] });

        // sell should be callable after initialization
        await orderBook.sell(100, 100, { from: accounts[0] });
    
        // cancel should be callable after initialization
        await orderBook.cancel({ from: accounts[0] });

        // transfet should be callable after initialization
        await orderBook.transfer(accounts[7], 10, { from: accounts[0], value: 10000000 });

        // sell should be callable after initialization
        await orderBook.sell(100, 90, { from: accounts[0] });

        // allowence for account 2
        await vestingToken.approve(orderBook.address, Math.floor(100 * 100 * 1.1), { from: accounts[2] });
        // accept should be callable after initialization
        await orderBook.accept(accounts[0], 50, { from: accounts[2], value: 10000000 });

        // check account 2 balance
        const balance = (await orderBook.balanceOf.call(accounts[2])).toNumber();
        assert.equal(balance, 50, "Invalid amount of shares");

        // transfer should be callable after initialization
        await orderBook.transfer(accounts[3], balance, { from: accounts[2], value: 10000000 });

    });

    // check if functions are accessible after termination
    it('Check functions accessibility after termination', async () => {

        // try calling terminate with account that is not owner
        try {
            await orderBook.terminate({ from: accounts[2] });
            assert(false, "Terminate should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Owner: caller is not the owner", "Invalid error message");
        }

        // terminate with account that is owner
        await orderBook.terminate({ from: accounts[0] });

        // try calling terminate again
        try {
            await orderBook.terminate({ from: accounts[0] });
            assert(false, "Terminate should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }
        
        // try calling sell after termination
        try {
            await orderBook.sell(100, 100, { from: accounts[0] });
            assert(false, "Sell should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // try calling buy after termination
        try {
            await orderBook.buy(100, 100, { from: accounts[3] });
            assert(false, "Buy should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }
        
        // try calling purchase
        try {
            // allowence for account 2
            await orderBook.purchase(100, { from: accounts[2] });
            assert(false, "Purchase should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // cancel should be callable after termination
        await orderBook.cancel({ from: accounts[0] });

        // try calling transfer after termination
        await orderBook.transfer(accounts[7], 10, { from: accounts[0], value: 10000000 });

        // check account 7 balance
        const balance = (await orderBook.balanceOf.call(accounts[7])).toNumber();
        assert.equal(balance, 20, "Invalid amount of shares");

    });

});
