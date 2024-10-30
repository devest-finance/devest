// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VestingToken {

    using SafeERC20 for IERC20;

    address internal _vestingToken;

    constructor(address tokenAddress){
        _vestingToken = tokenAddress;
    }

    /**
     *  Internal token transfer
     */
    function __transfer(address receiver, uint256 amount) internal {
        if (_vestingToken == address(0)){
            (bool success, ) = receiver.call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20 _token = IERC20(_vestingToken);
            _token.safeTransfer(receiver, amount);
        }
    }

    /**
     *  Internal token transferFrom
     */
    function __transferFrom(address sender, address receiver, uint256 amount) internal {
        if (_vestingToken == address(0)){
            require(msg.value >= (amount), "Insufficient funds provided (value)");
        } else {
            IERC20 _token = IERC20(_vestingToken);
            _token.safeTransferFrom(sender, receiver, amount);
        }
    }

    /**
     *  Internal token balance
    */
    function __balanceOf(address account) internal view returns (uint256) {
        if (_vestingToken == address(0)){
            return address(account).balance;
        } else {
            IERC20 _token = IERC20(_vestingToken);
            return _token.balanceOf(account);
        }
    }

    /**
     *  Internal token allowance
     */
    function __allowance(address account, uint256 amount) internal {
        if (_vestingToken == address(0)){
            require(account != address(0), 'Invalid sender');
            require(msg.value >= amount, 'Insufficient token submitted');
        } else {
            IERC20 _token = IERC20(_vestingToken);
            require(_token.allowance(account, address(this)) >= amount, 'Insufficient allowance provided');
        }
    }

}
