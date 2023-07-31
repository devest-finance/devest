const AccountHelper = require("./helpers/Helper");

const ERC20 = artifacts.require("ERC20PresetFixedSupply");
const DeVestFactory = artifacts.require("DeVestFactory");

contract('Functions accessability', (accounts) => {

    let vestingToken;
    let factory;
    let orderBook;

    const decimals = 2;


    before(async () => {
        vestingToken = await ERC20.deployed();
        factory = await DeVestFactory.deployed();
        await AccountHelper.setupAccountFunds(accounts, vestingToken, 40000000000);
        orderBook = await AccountHelper.createTangible(factory, vestingToken.address, "Example Pool", "EXP", 5000, 10, 0,  accounts[0]);

        // initialaze order book - 10% tax
        // initilize with account that is owner
        await orderBook.initialize(100, decimals, { from: accounts[0] });
    });

    // Set Royalty and Recipient - only owner
    it("Set Royalty and Recipient - only owner", async () => {
        const royalty = await factory.getFee();
        assert.equal(royalty[0], 10000000, "Royalty should be 10000000");

        // set royalty
        await factory.setFee(10000000, 10000000, { from: accounts[0] });
        
        const royalty2 = await factory.getFee();
        assert.equal(royalty2[0], 10000000, "Royalty should be 10000000");
    });

    // DeVest Royalty on accepted offer
    it("DeVest Royalty on accepted offer", async () => {
        const royalty = await factory.getFee();
        assert.equal(royalty[0], 10000000, "Royalty should be 10000000");

        const shares = 10 * Math.pow(10, decimals);
        const price = 10;
        // make a sell order
        await orderBook.sell(price, shares, { from: accounts[0] });

        // account 1 buys the shares
        // allowance for account 1
        await vestingToken.approve(orderBook.address, Math.floor((shares * price * 1.1)).toString(), { from: accounts[2] });

        // check royalty recipient balance before
        const royaltyRecipientBalanceBefore = parseInt(await web3.eth.getBalance(royalty[1]));

        // try to accept the offer without paying the royalty
        try {
            await orderBook.accept(accounts[0], shares, { from: accounts[2], value: 5000000 });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert.equal(error.reason, "Please provide enough fee", "Expected revert not received");
        }

        // accept the offer
        await orderBook.accept(accounts[0], shares, { from: accounts[2], value: 10000000 });

        // check if royalty is in the devest dao
        const devestDAO = parseInt(await web3.eth.getBalance(royalty[1]));
        assert.equal(devestDAO, royaltyRecipientBalanceBefore + 10000000, "DeVest DAO should have 10000000");
    });

    // DeVest Royalty on transfer
    it("DeVest Royalty on transfer", async () => {
        const royalty = await factory.getFee();
        assert.equal(royalty[0], 10000000, "Royalty should be 10000000");

        // check royalty recipient balance before
        const royaltyRecipientBalanceBefore = parseInt(await web3.eth.getBalance(royalty[1]));

        // transfet shares to account 1
        const shares = 10 * Math.pow(10, decimals);
        await orderBook.transfer(accounts[2], shares, { from: accounts[0], value: 10000000 });

        // check if royalty is in the devest dao
        const devestDAO = parseInt(await web3.eth.getBalance(royalty[1]));
        assert.equal(devestDAO, royaltyRecipientBalanceBefore + 10000000, "DeVest Factory should have 40000000");
    })

});
