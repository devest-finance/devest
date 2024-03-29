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

    // Check account 2 can withdraw
    it("Check account 2 can withdraw", async () => {
        const balanceBefore = (await vestingToken.balanceOf(accounts[2])).toNumber();

        // withdraw
        await orderBook.withdraw({ from: accounts[2] });

        // check contract balance
        const contractBalance = (await vestingToken.balanceOf(orderBook.address)).toNumber();
        assert.equal(contractBalance, 0, "Contract should have no funds");

        const balanceAfter = (await vestingToken.balanceOf(accounts[2])).toNumber();
        assert.equal(balanceAfter, balanceBefore + 50 * Math.pow(10, decimals) * price, "Account 2 should have all funds");

    });

});
