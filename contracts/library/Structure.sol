// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library NovolemStructure {
	enum BountyStatus {
		ACTIVE,
		CLAIMED,
		REFUNDED
	}
	struct Bounty {
		uint256 id;
		address creator;
		address manager;
		string metadataUrl;
		uint256 reward;
		uint256 commission;
		uint256 emission;
		address winner;
		BountyStatus status;
	}
}
