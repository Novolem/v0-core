// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {SD59x18, sd, intoUint256} from "@prb/math/src/SD59x18.sol";

library TokenMath {
	function toSD59x18(uint256 _decimals, uint256 _amount) internal pure returns (SD59x18) {
		return sd(int256(_amount)).div(sd(int256(10 ** _decimals)));
	}

	function toUint256(uint256 _decimals, SD59x18 _amount) internal pure returns (uint256) {
		return _amount.mul(sd(int256(10 ** _decimals))).intoUint256();
	}
}
