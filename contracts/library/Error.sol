// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library NovolemError {
	error NotInitialized();
	error AlreadyInitialized();
	error NotOwner();
	error NotManager();
	error NotValidAddress();
	error ContractPaused();
	error NotEnoughReward();
	error NotEnoughEmission();
	error AlreadyClaimed();
	error NotActive();
	error NotEnoughManagerHolding();
	error NotEnoughClientHolding();
	error NotEnoughAllowance();
	error LimitManagers();
	error AlreadyManager();
	error NotValidManager();
}
