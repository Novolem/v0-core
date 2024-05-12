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

interface INovolem {
	function initialize(address _transactionToken, address _novolemToken, uint256 _emissionRate) external;

	function updateOwner(address _owner) external;
	function updateEmissionRate(uint256 _emissionRate) external;
	function updateMinimumManagerHolding(uint256 _minimumManagerHolding) external;
	function updateLimitManagers(bool _limitManagers) external;
	function updateNovolemToken(address _novolemToken) external;
	function clawbackEmission() external;
	function setManagers(address[10] calldata _managers) external;
	function pause() external;
	function unpause() external;

	function createBounty(address _manager, string calldata _metadataUrl, uint256 _reward, uint256 _commission) external;
	function refundBounty(uint256 _bountyId) external;
	function claimBounty(uint256 _bountyId, address _winner) external;

	function getBounty(uint256 _bountyId) external view returns (NovolemStructure.Bounty memory);
	function getBountyCount() external view returns (uint256);
	function getOwner() external view returns (address);
	function getTransactionToken() external view returns (address);
	function getNovolemToken() external view returns (address);
	function getEmissionRate() external view returns (uint256);
	function getMinimumManagerHolding() external view returns (uint256);
	function getInitialized() external view returns (bool);
	function getPaused() external view returns (bool);
	function getLimitManagers() external view returns (bool);
	function getManagers() external view returns (address[10] memory);
}
