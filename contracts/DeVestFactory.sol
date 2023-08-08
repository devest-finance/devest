// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./src/DvOrderBook.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./src/DvFactory.sol";

contract DeVestFactory is DvFactory {

    /**
     * @dev detach a token from this factory
     */
    function detach(address payable _tokenAddress) external payable onlyOwner {
        DvOrderBook token = DvOrderBook(_tokenAddress);
        token.detach();
    }

    function issue(address tradingTokenAddress, string memory name, string memory symbol) public payable isActive returns (address)
    {
        // take royalty
        require(msg.value >= _issueFee, "Please provide enough fee");
        if (_issueFee > 0)
            payable(_feeRecipient).transfer(_issueFee);

        // issue token
        DvOrderBook token = new DvOrderBook(tradingTokenAddress, name, symbol, address(this), _msgSender());

        emit deployed(_msgSender(), address(token));
        return address(token);
    }

}
