// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeVest.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VestingToken.sol";

// DeVest Investment Model One
// Bid & Offer
contract DvOrderBook is ReentrancyGuard, Context, DeVest, VestingToken {

    // ---------------------------- EVENTS ------------------------------------

    // When an shareholder exchanged his shares
    event Trade(address indexed from, address indexed to, uint256 quantity, uint256 price);

    // ---------------------------- ERRORS --------------------------------

    // ---------------------------- STORAGE ----------------------------------

    enum States {
        Created,
        Presale,
        Trading,
        Terminated
    }

    States public state = States.Created;

    uint256 public presalePrice = 0;    // price per share
    uint256 public presaleShares = 0;   // total shares available for presale
    uint256 public presaleStart = 0;    // start date of presale
    uint256 public presaleEnd = 0;      // end date of presale

    /**
      *  Order struct
      *  @param index - index of the order
      *  @param price - price of the order
      *  @param amount - amount of shares
      *  @param escrow - amount in escrow
      *  @param bid - true = buy | false = sell
      */
    struct Order {
        uint256 index;
        uint256 price;
        uint256 amount;
        uint256 escrow;
        bool bid; // buy = true | sell = false
    }
    mapping (address => Order) public orders;  // all orders
    address[] public orderAddresses;       // all order addresses

    uint256 public lastPrice = 0;      // last trading price

    // Total amount in escrow
    uint256 public escrow;

    // Stakes
    address[] internal shareholders;                                // all current shareholders
    mapping (address => uint256) internal shares;                   // shares of shareholder

    // metadata
    string internal _name;           // name of the tangible
    string internal _symbol;         // symbol of the tangible
    uint8 internal _decimals;        // decimals of the tangible
    uint256 internal _totalSupply;   // total supply of shares (10^decimals)

    // Set owner and DI OriToken
    constructor(address _tokenAddress, string memory __name, string memory __symbol, address _factory, address _owner)
        DeVest(_owner, _factory)
        VestingToken(_tokenAddress) {

        _symbol = string(abi.encodePacked("% ", __symbol));
        _name = __name;
    }

    // ----------------------------------------------------------------------------------------------------------
    // ----------------------------------------------- MODIFIERS ------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    /**
    *  Verify required state
    *
    */
    modifier atState(States _state) {
        require(state == _state, "Not available in current state");
        _;
    }

    modifier notState(States _state) {
        require(state != _state, "Not available in current state");
        _;
    }


    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------ INTERNAL ------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    /**
    *  Update stored bids, if bid was spend, remove from list
    */
    function _removeOrder(address orderOwner) internal {
        uint256 index = orders[orderOwner].index;
        orderAddresses[index] = orderAddresses[orderAddresses.length-1];
        orders[orderAddresses[orderAddresses.length-1]].index = index;
        delete orders[orderOwner];
        orderAddresses.pop();
    }

    function swapShares(address to, address from, uint256 amount) virtual internal {
        require(getShares(from) >= amount, "Insufficient shares");
        require(from != to, "Can't transfer to yourself");

        // if shareholder has no shares add him as new
        if (shares[to] == 0) {
            shareholders.push(to);
        }

        shares[to] += amount;
        shares[from] -= amount;

        // remove shareholder without shares
        if (shares[from] == 0){
            shareholders.pop();
        }
    }

    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------- PUBLIC -------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    /**
     *  Initialize TST as tangible
     */
    function initialize(uint tax, uint8 decimal) public onlyOwner atState(States.Created) nonReentrant virtual{
        require(tax >= 0 && tax <= 1000, 'Invalid tax value');
        require(decimal >= 0 && decimal <= 10, 'Max 10 decimals');

        // set attributes
        _decimals = decimal += 2;
        _setRoyalties(tax, owner());

        // assign to publisher all shares
        _totalSupply = (10 ** _decimals);
        shares[_msgSender()] = _totalSupply;

        // Initialize owner as only shareholder
        shareholders.push(_msgSender());

        // start trading
        state = States.Trading;
    }

    /**
      * optional initialization will not assign 100% to the owner, rather allow a kind of presale in which
      * the owner can sell a certain amount of shares to a certain price and after all shares are sold
      * the contract will be initialized.
      */
    function initializePresale(uint tax, uint8 decimal, uint256 price, uint256 start, uint256 end) public onlyOwner atState(States.Created) nonReentrant virtual {
        require(tax >= 0 && tax <= 1000, 'Invalid tax value');
        require(decimal >= 0 && decimal <= 10, 'Max 10 decimals');

        // set attributes
        _decimals = decimal += 2;
        _setRoyalties(tax, owner());
        _totalSupply = (10 ** _decimals);

        state = States.Presale;
        presalePrice = price;
        presaleStart = start;
        presaleEnd = end;
    }

    function purchase(uint256 amount) public payable atState(States.Presale) nonReentrant virtual{
        require(block.timestamp >= presaleStart && block.timestamp <= presaleEnd, 'PreSale didn\'t start yet or ended already');
        require(amount > 0 && amount <= _totalSupply, 'Invalid amount submitted');
        require(presaleShares + amount <= _totalSupply, 'Not enough shares left to purchase');

        // check if enough escrow allowed and pick the cash
        __allowance(_msgSender(), amount * presalePrice);
        __transferFrom(_msgSender(), address(this), amount * presalePrice);

        // check if sender is already in shareholders
        if (shares[_msgSender()] == 0){
            shareholders.push(_msgSender());
        }

        // assign bought shares to buyer
        shares[_msgSender()] += amount;

        presaleShares += amount;
        if (presaleShares >= _totalSupply) {
            state = States.Trading;
            __transfer(owner(), __balanceOf(address(this)));
        }
    }

    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------ TRADING -------------------------------------------------

    /**
    * Swap shares between owners,
    * Check for same level of disburse !!
    */
    function transfer(address recipient, uint256 amount) virtual external payable takeFee nonReentrant notState(States.Created) notState(States.Presale) {
        require(amount > 0 && amount <= _totalSupply, 'Invalid amount submitted');
        swapShares(recipient, _msgSender(), amount);
    }

    /**
    *  Buy Order
    *  _price: price for the amount of shares
    *  amount: amount
    */
    function buy(uint256 _price, uint256 amount) public payable nonReentrant atState(States.Trading) {
        require(amount > 0 && amount <= _totalSupply, 'Invalid amount submitted');
        require(_price > 0, 'Invalid price submitted');
        require(orders[_msgSender()].amount == 0, 'Active buy order, cancel first');

        // add tax to escrow
        uint256 _escrow = (_price * amount) + (_price * amount * getRoyalty()) / 1000;

        // check if enough escrow allowed
        __allowance(_msgSender(), _escrow);

        // store bid
        orders[_msgSender()] = Order(orderAddresses.length, _price, amount, _escrow, true);
        orderAddresses.push(_msgSender());

        // pull escrow
        __transferFrom(_msgSender(), address(this), _escrow);
        escrow += _escrow;
    }

    /**
     *  Sell order
     */
    function sell(uint256 _price, uint256 amount) public payable nonReentrant atState(States.Trading) {
        require(amount > 0 && amount <= _totalSupply, 'Invalid amount submitted');
        require(_price > 0, 'Invalid price submitted');
        require(shares[_msgSender()]  > 0, 'Insufficient shares');
        require(orders[_msgSender()].amount == 0, 'Active order, cancel first');
        require(amount <= shares[_msgSender()], 'Invalid amount submitted');

        // store bid
        orders[_msgSender()] = Order(orderAddresses.length, _price, amount, 0, false);
        orderAddresses.push(_msgSender());
    }

    /**
     *  Accept order
     */
    function accept(address orderOwner, uint256 amount) virtual external payable nonReentrant atState(States.Trading) takeFee {
        require(amount > 0, "Invalid amount submitted");
        require(orders[orderOwner].amount >= amount, "Invalid order");
        require(_msgSender() != orderOwner, "Can't accept your own order");

        Order memory order = orders[orderOwner];

        // calculate taxes
        uint256 cost = order.price * amount;
        uint256 tax = (cost * getRoyalty()) / 1000;
        uint256 totalCost = cost + tax;

        // deduct amount from order
        orders[orderOwner].amount -= amount;

        // accepting on bid order
        if (order.bid == true) {
            _acceptBidOrder(orderOwner, cost, totalCost, amount, order.price);
        } else {
            _acceptAskOrder(orderOwner, cost, totalCost, amount, order.price);
        }

        // set the last price
        lastPrice = order.price;

        // pay royalty
        __transfer(owner(), tax);
    }

    /**
     * accepting bid order
     * so caller is accepting to sell his share to order owner
     * -> escrow from order can be transferred to owner
     */
    function _acceptBidOrder(address orderOwner, uint256 cost, uint256 totalCost, uint256 amount, uint256 price) internal {
        require(shares[_msgSender()] >= amount,"Insufficient shares");

        __transfer(_msgSender(), cost);
        swapShares(orderOwner, _msgSender(), amount);
        emit Trade(orderOwner, _msgSender(), amount, price);

        orders[orderOwner].escrow -= totalCost;
        escrow -= totalCost; // deduct from total escrow

        if (orders[orderOwner].amount == 0)
            _removeOrder(orderOwner);
    }


    function _acceptAskOrder(address orderOwner, uint256 cost, uint256 totalCost, uint256 amount, uint256 price) internal {
        require(shares[orderOwner] >= amount, "Insufficient shares");

        __transferFrom(_msgSender(), address(this), totalCost);
        __transfer(orderOwner, cost);
        swapShares(_msgSender(), orderOwner, amount);
        emit Trade(_msgSender(), orderOwner, amount, price);

        // update offer
        if (orders[orderOwner].amount == 0)
            _removeOrder(orderOwner);
    }

    // Cancel order and return escrow
    function cancel() public virtual notState(States.Presale) nonReentrant {
        require(orders[_msgSender()].amount > 0, 'Invalid order');

        Order memory _order = orders[_msgSender()];
        // return escrow leftover
        if (_order.bid) {
            __transfer(_msgSender(), _order.escrow);
            escrow -= _order.escrow;
        }

        // update bids
        _removeOrder(_msgSender());
    }

    // Terminate this contract, and pay-out all remaining investors
    function terminate() public virtual onlyOwner notState(States.Terminated) {
        state = States.Terminated;
    }

    // Withdraw funds from contract if presell failed
    function withdraw() public virtual payable nonReentrant atState(States.Terminated) {
        require(shares[_msgSender()] > 0, "No shares available");
        require(presaleShares < _totalSupply, "Presale already finished");

        uint256 amount = (__balanceOf(address(this)) * shares[_msgSender()]) / presaleShares;
        __transfer(_msgSender(), amount);
        
        shares[_msgSender()] = 0;
    }


    // ----------------------------------------------------------------------------------------------------------
    // -------------------------------------------- PUBLIC GETTERS ----------------------------------------------
    // ----------------------------------------------------------------------------------------------------------


    function getOrders() external view returns (address[] memory) {
        return orderAddresses;
    }

    function getOrderCount() public view returns (uint256){
        return orderAddresses.length;
    }

    // Get shares of one investor
    function balanceOf(address _owner) public view returns (uint256) {
        return getShares(_owner);
    }

    // Get shares of one investor
    function getShares(address _owner) public view returns (uint256) {
        if (orders[_owner].amount > 0 && !orders[_owner].bid){
            return shares[_owner] - orders[_owner].amount;
        } else
            return shares[_owner];
    }

    // Get shareholder addresses
    function getShareholders() public view returns (address[] memory) {
        return shareholders;
    }

    /**
    * @dev Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view returns (uint8) {
        return _decimals;
    }


    // Function to receive Ether only allowed when contract Native Token
    receive() virtual external payable {}

}
