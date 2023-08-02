const AccountHelper = require("./helpers/Helper");

const ERC20 = artifacts.require("ERC20PresetFixedSupply");
const DeVestFactory = artifacts.require("DeVestFactory");

contract('Functions accessability', (accounts) => {

    let vestingToken;
    let factory;
    let orderBook;

    let ownerBlanace;

    const decimals = 2;

    // presale variables
    const price = 10;
    const start = new Date();
    start.setHours(start.getHours() - 10);
    const end = new Date(start);
    end.setHours(start.getHours() + 20);

    before(async () => {
        vestingToken = await ERC20.deployed();
        factory = await DeVestFactory.deployed();
        await AccountHelper.setupAccountFunds(accounts, vestingToken, 40000000000);
        orderBook = await AccountHelper.createTangible(factory, vestingToken.address, "Example Pool", "EXP", 5000, 10, 0,  accounts[0]);

        ownerBlanace = (await vestingToken.balanceOf(accounts[0])).toNumber();

        // initialaze order book - 10% tax
        // initilize with account that is owner
        await orderBook.initializePresale(100, decimals, price, parseInt(start.getTime() / 1000), parseInt(end.getTime() / 1000),  { from: accounts[0] });
    });

    // Check that order book can not be initialized twice
    it("Check that order book can not be initialized twice", async () => {
        // try to initialize again
        try {
            await orderBook.initializePresale(100, decimals, price, parseInt(start.getTime() / 1000), parseInt(end.getTime() / 1000),  { from: accounts[0] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert.equal(error.reason, "Not available in current state", "Expected revert not received");
        }
    });


    // Check that presale is initialized and there are no shares distributed
    it("Check that presale is initialized and there are no shares distributed", async () => {
        // get shareholders
        const shareholders = await orderBook.getShareholders();
        assert.equal(shareholders.length, 0, "There should be no shareholders");
    });

    // Purchase 50% of shares
    it("Purchase 50% of shares", async () => {
        const shares = 50 * Math.pow(10, decimals);

        // allowance for account 2
        await vestingToken.approve(orderBook.address, Math.floor((shares * price * 1.1)).toString(), { from: accounts[2] });

        // buy 50% of shares
        await orderBook.purchase(shares, { from: accounts[2] });

        // get shareholders
        const shareholders = await orderBook.getShareholders();
        assert.equal(shareholders.length, 1, "There should be 1 shareholder");
        assert.equal(shareholders[0], accounts[2], "Shareholder should be account 2");

        // get shares of account 2
        const sharesOfAccount2 = await orderBook.getShares(accounts[2]);
        assert.equal(sharesOfAccount2, shares, "Account 2 should have 50 shares");
        
        // get total shares
        const totalShares = await orderBook.presaleShares.call();
        assert.equal(totalShares, shares, "Presale shares should be 50%");
    });

    // Check that buy, sell are not available
    it("Check that buy, sell and transfer are not available", async () => {
        const shares = 10 * Math.pow(10, decimals);

        // allowance for account 2
        await vestingToken.approve(orderBook.address, Math.floor((shares * price * 1.1)).toString(), { from: accounts[2] });

        // try to buy
        try {
            await orderBook.buy(price, shares, { from: accounts[2] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert.equal(error.reason, "Not available in current state", "Expected revert not received");
        }

        // try to sell
        try {
            await orderBook.sell(price, shares, { from: accounts[2] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert.equal(error.reason, "Not available in current state", "Expected revert not received");
        }

        // try to transfer
        try {
            await orderBook.transfer(accounts[3], shares, { from: accounts[2], value: 10000000 });
            assert.fail("Expected revert not received");
        }
        catch (error) {
            assert.equal(error.reason, "Not available in current state", "Expected revert not received");
        }
    });

    // Purchase 50% of shares
    it("Purchase 50% of shares", async () => {
        const shares = 50 * Math.pow(10, decimals);

        // allowance for account 3
        await vestingToken.approve(orderBook.address, Math.floor((shares * price * 1.1)).toString(), { from: accounts[3] });

        // buy 50% of shares
        await orderBook.purchase(shares, { from: accounts[3] });

        // get shareholders
        const shareholders = await orderBook.getShareholders();
        assert.equal(shareholders.length, 2, "There should be 2 shareholder");
        assert.equal(shareholders[1], accounts[3], "Shareholder should be account 3");

        // get shares of account 3
        const sharesOfAccount2 = await orderBook.getShares(accounts[3]);
        assert.equal(sharesOfAccount2, shares, "Account 3 should have 50 shares");
        
        // get total shares
        const totalShares = (await orderBook.presaleShares.call()).toNumber();
        assert.equal(totalShares, 100 * Math.pow(10, decimals), "Presale shares should be 50%");
    });

    // check that purchase is not available
    it("Check that purchase is not available", async () => {
        const shares = 10 * Math.pow(10, decimals);

        // allowance for account 2
        await vestingToken.approve(orderBook.address, Math.floor((shares * price * 1.1)).toString(), { from: accounts[2] });

        // try to buy
        try {
            await orderBook.purchase(shares, { from: accounts[2] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert.equal(error.reason, "Not available in current state", "Expected revert not received");
        }
    });

    // check that buy and sell are available
    it("Check that buy and sell are available", async () => {
        const shares = 10 * Math.pow(10, decimals);

        // sell order for account 2 shares
        await orderBook.sell(price, shares, { from: accounts[2], value: 1000000 });

        // allowence for account 3
        await vestingToken.approve(orderBook.address, Math.floor((shares * price * 1.1)).toString(), { from: accounts[3] });
        // buy order for account 3 shares
        await orderBook.buy(price, shares, { from: accounts[3], value: 1000000 });

        // check orders
        const orders = await orderBook.getOrders();
        assert.equal(orders.length, 2, "There should be 2 orders");
    });

    // Check that owner got paid
    it("Check that owner got paid", async () => {
        const shares = 100 * Math.pow(10, decimals);

        // get balance of account 0
        const balance = (await vestingToken.balanceOf(accounts[0])).toNumber();
        assert.equal(balance, ownerBlanace + shares * price, "Account 0 should have 1000 tokens");
    });

    // Terminate presale
    it("Terminate presale", async () => {
        // try terminate presale from account 2
        try {
            await orderBook.terminate({ from: accounts[2] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert.equal(error.reason, "Owner: caller is not the owner", "Expected revert not received");
        }

        // terminate presale
        await orderBook.terminate({ from: accounts[0] });
    });

    // Check that purchase is not available
    it("Check that purchase is not available", async () => {
        const shares = 10 * Math.pow(10, decimals);

        // allowance for account 2
        await vestingToken.approve(orderBook.address, Math.floor((shares * price * 1.1)).toString(), { from: accounts[2] });

        // try to buy
        try {
            await orderBook.purchase(shares, { from: accounts[2] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert.equal(error.reason, "Not available in current state", "Expected revert not received");
        }
    });

    // Check that withdraw is not available
    it("Check that withdraw is not available", async () => {
        // try withdraw
        try {
            await orderBook.withdraw({ from: accounts[2] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert.equal(error.reason, "Presale already finished", "Expected revert not received");
        }
    });

});
