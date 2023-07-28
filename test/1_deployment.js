const AccountHelper = require("./helpers/Helper");
const DvOrderBook = artifacts.require("DvOrderBook");
const DeVestFactory = artifacts.require("DeVestFactory");

const ERC20 = artifacts.require("ERC20PresetFixedSupply");

var devestDAOAddress = null;
var exampleModelAddress = null;

contract('Testing Deployments', (accounts) => {

    it('Verify root (DeVest) DAO was deployed', async () => {
        const deVestFactory = await DeVestFactory.deployed();
        const devestDAOAddress = await deVestFactory.getFee.call();

        const devestDAO = await DvOrderBook.at(devestDAOAddress[1]);
        const symbol = await devestDAO.symbol.call();

        assert.equal(symbol, "% DeVest DAO", "Failed to issue DeVest DAO Contract");
    });

    it('Deploy DvOrderBook as DAO (Token)', async () => {
        const modelOneFactory = await DeVestFactory.deployed();
        const erc20Token = await ERC20.deployed();

        const exampleOneContract = await modelOneFactory.issue(erc20Token.address, "Example", "EXP", { value: 100000000 });
        exampleModelAddress = exampleOneContract.logs[0].args[1];

        const devestDAO = await DvOrderBook.at(exampleModelAddress);
        const symbol = await devestDAO.symbol.call();

        assert.equal(symbol, "% EXP", "Failed to issue Example Contract");
    });


    it('Check DvStakeToken', async () => {
        const devestOne = await DvOrderBook.at(exampleModelAddress);

        // check if variables set
        const name = await devestOne.name.call();
        assert(name, "Example", "Invalid name on TST");

        try {
            await devestOne.initialize(10, 2, { from: accounts[0] });
        } catch (e) {
            console.log(e);
        }

        const value = (await devestOne.totalSupply.call()).toNumber();
        assert.equal(value, 10000, "Invalid price on initialized tangible");
    });

    it('Check DvStakeToken Detach', async () => {
        const deVestFactory = await DeVestFactory.deployed();
        const erc20Token = await ERC20.deployed();

        // devest shares
        const devestDAOAddress = await deVestFactory.getFee.call();
        const DeVestDAO = await DvOrderBook.at(devestDAOAddress[1]);

        // issue new product
        const exampleOneContract = await deVestFactory.issue(erc20Token.address, "Example", "EXP", { from: accounts[0], value: 100000000 });
        exampleModelAddress = exampleOneContract.logs[0].args[1];
        const subjectContract = await DvOrderBook.at(exampleModelAddress);
        await subjectContract.initialize(10, 0, { from: accounts[0] });

        const balanceBefore = await web3.eth.getBalance(DeVestDAO.address);
        assert.equal(balanceBefore, 20000000, "Invalid balance on DeVest before DAO");
    });

    it('Check DvStakeToken Termination before Initialization', async () => {
        const deVestFactory = await DeVestFactory.deployed();
        const erc20Token = await ERC20.deployed();

        // devest shares
        const devestDAOAddress = await deVestFactory.getFee.call();
        const DeVestDAO = await DvOrderBook.at(devestDAOAddress[1]);

        // issue new product
        const exampleOneContract = await deVestFactory.issue(erc20Token.address, "Example", "EXP", { from: accounts[0], value: 100000000 });
        exampleModelAddress = exampleOneContract.logs[0].args[1];
        const subjectContract = await DvOrderBook.at(exampleModelAddress);

        let token = await AccountHelper.createERCToken("ERC20 Token #1", "TK1",
            1000000000, "0xECF5A576A949aEE5915Afb60E0e62D09825Cd61B", accounts[0]);

        // Get balances of first and second account after the transactions.
        let accountBalance1 = (await token.balanceOf.call(accounts[0])).toNumber();

        assert.equal(accountBalance1, 1000000000, "Token balance invalid");

        await subjectContract.terminate({ from: accounts[0] });

        accountBalance1 = (await token.balanceOf.call(accounts[0])).toNumber();
        assert.equal(accountBalance1, 1000000000, "Tokens should be returned after termination before initialization");
    });

});
