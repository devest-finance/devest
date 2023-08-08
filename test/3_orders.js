const AccountHelper = require("./helpers/Helper");

const ERC20 = artifacts.require("ERC20PresetFixedSupply");
const DeVestFactory = artifacts.require("DeVestFactory");

contract('Functions accessability', (accounts) => {

    let vestingToken;
    let factory;
    let orderBook;

    const decimals = 3;


    before(async () => {
        vestingToken = await ERC20.deployed();
        factory = await DeVestFactory.deployed();
        await AccountHelper.setupAccountFunds(accounts, vestingToken, 40000000000);
        orderBook = await AccountHelper.createTangible(factory, vestingToken.address, "Example Pool", "EXP", 5000, 10, 0,  accounts[0]);

        // initialaze order book - 10% tax
        // initilize with account that is owner
        await orderBook.initialize(100, decimals, { from: accounts[0] });
    });

    // check last trading price
    it("Check last trading price", async () => {
        const lastPrice = await orderBook.lastPrice.call();
        assert.equal(lastPrice.toNumber(), 0, "Last price should be 0");
    });

    // make sell orders
    it("Owner make sell orders", async () => {
        const shares = 50 * Math.pow(10, decimals);
        // account 0 make sell order for 50% of shares
        await orderBook.sell(5000, shares, {from: accounts[0]});
        // account 0 can't make more sell orders
        try {
            await orderBook.sell(5000, 50, {from: accounts[0]});
            assert.fail("Expected error not received");
        }
        catch (error) {
            assert.equal(error.reason, "Active order, cancel first", "Expected error not received")
        }
    });

    // check that account 3 can't make sell order
    it("Account 3 can't make sell order", async () => {
        try {
            await orderBook.sell(50, 50, {from: accounts[3]});
            assert.fail("Expected error not received");
        }
        catch (error) {
            assert.equal(error.reason, "Insufficient shares", "Expected error not received")
        }
    });

    // account 2,3,4 accept sell order
    it("Account 2,3,4 accept sell order", async () => {
        const pricePerShare = 5000;

        const account2PurchaseShares = 10 * Math.pow(10, decimals);
        const account3PurchaseShares = 20 * Math.pow(10, decimals);
        const account4PurchaseShares = 20 * Math.pow(10, decimals);

        // allowance for account 2,3,4
        await vestingToken.approve(orderBook.address, (account2PurchaseShares * pricePerShare * 1.1).toFixed(0), {from: accounts[2]});
        await vestingToken.approve(orderBook.address, (account3PurchaseShares * pricePerShare * 1.1).toFixed(0), {from: accounts[3]});
        await vestingToken.approve(orderBook.address, (account4PurchaseShares * pricePerShare * 1.1).toFixed(0), {from: accounts[4]});

        // check owner balance before accept
        const balance0Before = await vestingToken.balanceOf.call(accounts[0]);

        await orderBook.accept(accounts[0], account2PurchaseShares, {from: accounts[2], value: 10000000});
        await orderBook.accept(accounts[0], account3PurchaseShares, {from: accounts[3], value: 10000000});
        await orderBook.accept(accounts[0], account4PurchaseShares, {from: accounts[4], value: 10000000});

        // check that owner got 10% tax on all purchases + pricePerShare * shares
        const balance0After = await vestingToken.balanceOf.call(accounts[0]);
        assert.equal(balance0After.toNumber(), balance0Before.toNumber() + account2PurchaseShares * pricePerShare + account3PurchaseShares * pricePerShare +
        account4PurchaseShares * pricePerShare + (account2PurchaseShares * pricePerShare * 0.1) + (account3PurchaseShares * pricePerShare * 0.1) + 
        (account4PurchaseShares * pricePerShare * 0.1), "Balance should be 1000 less");

        // check shares of account 0,2,3,4
        const shares0 = await orderBook.getShares.call(accounts[0]);
        const shares2 = await orderBook.getShares.call(accounts[2]);
        const shares3 = await orderBook.getShares.call(accounts[3]);
        const shares4 = await orderBook.getShares.call(accounts[4]);

        assert.equal(shares0.toNumber(), 50 * Math.pow(10, decimals), "Account 0 should have 50% shares");
        assert.equal(shares2.toNumber(), account2PurchaseShares, "Account 2 should have 10% shares");
        assert.equal(shares3.toNumber(), account3PurchaseShares, "Account 3 should have 20% shares");
        assert.equal(shares4.toNumber(), account4PurchaseShares, "Account 4 should have 20% shares");
    });

    // check last trading price
    it("Check last trading price", async () => {
        const lastPrice = await orderBook.lastPrice.call();
        assert.equal(lastPrice.toNumber(), 5000, "Last price should be 5000");
    });

    // check there are no active orders and owner can make sell order
    it("Check there are no active orders and owner can make sell order", async () => {
        const activeOrders = await orderBook.getOrders.call();
        assert.equal(activeOrders.length, 0, "Active orders should be 0");
        
        const shares = 30 * Math.pow(10, decimals);

        await orderBook.sell(5000, shares, {from: accounts[0]});

        // check there is active order
        const activeOrdersAfter = await orderBook.getOrders.call();
        assert.equal(activeOrdersAfter.length, 1, "Active orders should be 1");

        // check shares of account 0
        const shares0 = await orderBook.getShares.call(accounts[0]);
        assert.equal(shares0.toNumber(), 20 * Math.pow(10, decimals), "Account 0 should have 20% shares");
    });

    // account 6 makes buy order
    it("Account 6 makes buy order and cancels it", async () => {
        // check there is active order
        const activeOrders = await orderBook.getOrders.call();
        assert.equal(activeOrders.length, 1, "Active orders should be 1");

        // check balance before buy
        const balanceBefore = await vestingToken.balanceOf.call(accounts[6]);

        // check orderBook balance
        const orderBookBalance = await vestingToken.balanceOf.call(orderBook.address);

        // shares to buy
        const shares = 10 * Math.pow(10, decimals);
        const pricePerShare = 10;

        // orderBook takes 10% tax +  pricePerShare * shares
        const totalPayment = shares * pricePerShare + (shares * pricePerShare * 0.1);

        // allowance for account 6
        await vestingToken.approve(orderBook.address, totalPayment, {from: accounts[6]});

        await orderBook.buy(10, shares, {from: accounts[6]});

        // check there are two active orders
        const activeOrdersAfter = await orderBook.getOrders.call();
        assert.equal(activeOrdersAfter.length, 2, "Active orders should be 2");


        // check balance after buy
        const balanceAfter = await vestingToken.balanceOf.call(accounts[6]);
        assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() - totalPayment, "Balance should be 1000 less");

        // check orderBook balance after buy
        const orderBookBalanceAfter = await vestingToken.balanceOf.call(orderBook.address);
        assert.equal(orderBookBalanceAfter.toNumber(), orderBookBalance.toNumber() + totalPayment, "orderBook balance is not correct");

        // cancel order
        await orderBook.cancel({from: accounts[6]});

        // check orderBook balance after cancel
        const orderBookBalanceAfterCancel = await vestingToken.balanceOf.call(orderBook.address);
        assert.equal(orderBookBalanceAfterCancel.toNumber(), orderBookBalance.toNumber(), "orderBook balance is not correct");

        // check account 6 shares
        const shares6 = await orderBook.getShares.call(accounts[6]);
        assert.equal(shares6.toNumber(), 0, "Account 6 should have 0% shares");

        // check account 6 balance
        const balance6 = await vestingToken.balanceOf.call(accounts[6]);
        assert.equal(balance6.toNumber(), balanceBefore.toNumber(), "Account 6 balance should be the same");

        // check there is one active order
        const activeOrdersAfterCancel = await orderBook.getOrders.call();
        assert.equal(activeOrdersAfterCancel.length, 1, "Active orders should be 1");
    });

    // account 6 makes a buy order and account 3 partially accepts it
    it("Account 6 makes a buy order and account 3 partially accepts it", async () => {
        // account 3 makes sell order
        const sharesSell = 20 * Math.pow(10, decimals);
        await orderBook.sell(50, sharesSell, {from: accounts[3]});

        // check account 3 shares
        const shares3 = await orderBook.getShares.call(accounts[3]);
        assert.equal(shares3.toNumber(), 0, "Account 3 should have 20% shares");

        // check balance before buy
        const balanceBefore = await vestingToken.balanceOf.call(accounts[6]);
        
        // shares to buy
        const shares = 10 * Math.pow(10, decimals);
        const pricePerShare = 10;

        // orderBook takes 10% tax +  pricePerShare * shares
        const totalPayment = shares * pricePerShare + (shares * pricePerShare * 0.1);

        // allowance for account 6
        await vestingToken.approve(orderBook.address, totalPayment, {from: accounts[6]});

        await orderBook.buy(10, shares, {from: accounts[6]});

        // check there are two active orders
        const activeOrdersAfter = await orderBook.getOrders.call();
        assert.equal(activeOrdersAfter.length, 3, "Active orders should be 3");

        // check balance after buy
        const balanceAfter = await vestingToken.balanceOf.call(accounts[6]);
        assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() - totalPayment, "Balance should be 1000 less");

        // account 3 accepts order
        const sharesBuy = 5 * Math.pow(10, decimals);
        
        // account 3 has an active sell order for 20% shares
        // account 3 tries to accepts 5% of shares
        // accept order
        try {
            await orderBook.accept(accounts[6], sharesBuy, {from: accounts[3], value: 10000000});
        } catch (error) {
            assert.equal(error.reason, "Insufficient shares", "Expected error not received")
        }

        // account 3 cancels order
        await orderBook.cancel({from: accounts[3]});

        // check account 0 balance before buy
        const balance0Before = await vestingToken.balanceOf.call(accounts[0]);
        // check account 3 balance before buy
        const balance3Before = await vestingToken.balanceOf.call(accounts[3]);

        // account 3 accepts order
        await orderBook.accept(accounts[6], sharesBuy, {from: accounts[3], value: 10000000});

        // owner should get 10% tax
        const balance0After = await vestingToken.balanceOf.call(accounts[0]);
        assert.equal(balance0After.toNumber(), balance0Before.toNumber() + (sharesBuy * pricePerShare * 0.1), "Balance should be 1000 less");

        // check account 3 shares
        const shares3After = await orderBook.getShares.call(accounts[3]);
        assert.equal(shares3After.toNumber(), sharesSell - sharesBuy, "Account 3 should have 15% shares");

        // check account 3 balance after buy
        const balance3After = await vestingToken.balanceOf.call(accounts[3]);
        assert.equal(balance3After.toNumber(), balance3Before.toNumber() + (sharesBuy * pricePerShare), "Balance should be 1000 less");

        // check account 6 shares
        const shares6 = await orderBook.getShares.call(accounts[6]);
        assert.equal(shares6.toNumber(), sharesBuy, "Account 6 should have 5% shares");

        // check there is one active order
        const activeOrdersAfterCancel = await orderBook.getOrders.call();
        assert.equal(activeOrdersAfterCancel.length, 2, "Active orders should be 2");

        // account 6 cancels order
        await orderBook.cancel({from: accounts[6]});

        // check account 6 shares
        const shares6After = await orderBook.getShares.call(accounts[6]);
        assert.equal(shares6After.toNumber(), sharesBuy, "Account 6 should have 0% shares");

        // check account 6 balance
        const balance6 = await vestingToken.balanceOf.call(accounts[6]);
        assert.equal(balance6.toNumber(), balanceBefore.toNumber() - totalPayment/2, "Account 6 balance should be the same");
    });


    // check last trading price
    it("Check last trading price", async () => {
        const lastPrice = await orderBook.lastPrice.call();
        assert.equal(lastPrice.toNumber(), 10, "Last price should be 10");
    });

    // check payment for buy order
    it("Check payment for buy order", async () => {

        // account 6 makes buy order   
        // shares to buy
        const sharesBuy = 10 * Math.pow(10, decimals);
        const pricePerShareBuy = 10;

        // orderBook takes 10% tax +  pricePerShare * shares
        const totalPaymentBuy = sharesBuy * pricePerShareBuy + (sharesBuy * pricePerShareBuy * 0.1);

        // allowance for account 6
        await vestingToken.approve(orderBook.address, totalPaymentBuy, {from: accounts[6]});

        await orderBook.buy(10, sharesBuy, {from: accounts[6]});

        // check there is active order
        const activeOrders = await orderBook.getOrders.call();
        assert.equal(activeOrders.length, 2, "Active orders should be 2");

        // check account 2 balance before buy
        const balanceBefore = await vestingToken.balanceOf.call(accounts[2]);

        // check owner balance before buy
        const balance0Before = await vestingToken.balanceOf.call(accounts[0]);

        // shares to buy
        const shares = 5 * Math.pow(10, decimals);
        const pricePerShare = 10;

        // orderBook takes 10% tax +  pricePerShare * shares
        const totalPayment = shares * pricePerShare + (shares * pricePerShare * 0.1);

        // allowance for account 2
        await vestingToken.approve(orderBook.address, totalPayment, {from: accounts[2]});

        await orderBook.accept(accounts[6], shares, {from: accounts[2], value: 10000000});

        // check that account 2 got payment
        const balanceAfter = await vestingToken.balanceOf.call(accounts[2]);
        assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + shares * pricePerShare, "Balance should be 1000 less");

        // check that owner got 10% tax
        const balance0After = await vestingToken.balanceOf.call(accounts[0]);
        assert.equal(balance0After.toNumber(), balance0Before.toNumber() + (shares * pricePerShare * 0.1), "Balance should be 1000 less");

        // check orders
        const activeOrdersAfter = await orderBook.getOrders.call();
        assert.equal(activeOrdersAfter.length, 2, "Active orders should be 2");

    });

    // Check payment for sell order
    it("Check payment for sell order", async () => {
            // account 3 makes sell order
            const sharesSell = 10 * Math.pow(10, decimals);
            const priceSell = 50;
            await orderBook.sell(priceSell, sharesSell, {from: accounts[3]});
    
            // check there is active order
            const activeOrders = await orderBook.getOrders.call();
            assert.equal(activeOrders.length, 3, "Active orders should be 3");
    
            // check account 3 balance before buy
            const balanceBefore = await vestingToken.balanceOf.call(accounts[3]);
    
            // check owner balance before buy
            const balance0Before = await vestingToken.balanceOf.call(accounts[0]);
    
            // shares to buy
            const shares = 5 * Math.pow(10, decimals);
    
            // orderBook takes 10% tax +  priceSell * shares
            const totalPayment = shares * priceSell + (shares * priceSell * 0.1);
    
            // allowance for account 5
            await vestingToken.approve(orderBook.address, totalPayment, {from: accounts[5]});

            await orderBook.accept(accounts[3], shares, {from: accounts[5], value: 10000000});
    
            // check that account 3 got payment
            const balanceAfter = await vestingToken.balanceOf.call(accounts[3]);
            assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + shares * priceSell, "Balance should be 1000 less");
    
            // check that owner got 10% tax
            const balance0After = await vestingToken.balanceOf.call(accounts[0]);
            assert.equal(balance0After.toNumber(), balance0Before.toNumber() + (shares * priceSell * 0.1), "Balance should be 1000 less");
    });

});
