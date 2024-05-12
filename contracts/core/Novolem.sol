// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import {SD59x18, sd, intoUint256} from "@prb/math/src/SD59x18.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {NovolemError} from "../library/Error.sol";
import {NovolemStructure} from "../library/Structure.sol";
import {TokenMath} from "../library/TokenMath.sol";
import "hardhat/console.sol";

contract Novolem is Context {
	bool public initialized;
	bool public paused;
	address public owner;
	bool public limitManagers;

	uint256 public bountyIdCounter;
	uint256 public emissionRate;
	uint256 public minimumManagerHolding;

	address public transactionToken;
	uint256 internal transactionTokenDecimals;

	address public novolemToken;
	uint256 internal novolemTokenDecimals;

	mapping(uint256 => NovolemStructure.Bounty) public bounties;
	address[10] public managers;

	event Paused();
	event Unpaused();
	event CreateBounty(
		uint256 indexed bountyId,
		address indexed creator,
		address indexed manager,
		string metadataUrl,
		uint256 reward,
		uint256 commission,
		uint256 emission
	);
	event ClaimBounty(uint256 indexed bountyId, address indexed winner);
	event RefundBounty(uint256 indexed bountyId);

	function initialize(
		address _transactionToken,
		address _novolemToken,
		uint256 _emissionRate,
		uint256 _minimumManagerHolding,
		address[10] calldata _managers
	) public {
		if (initialized) revert NovolemError.AlreadyInitialized();
		owner = _msgSender();
		transactionToken = _transactionToken;
		transactionTokenDecimals = ERC20(_transactionToken).decimals();
		novolemToken = _novolemToken;
		novolemTokenDecimals = ERC20(_novolemToken).decimals();
		emissionRate = _emissionRate;
		minimumManagerHolding = _minimumManagerHolding;
		initialized = true;
		limitManagers = true;
		managers = _managers;
	}

	function updateOwner(address _owner) public {
		if (_msgSender() != owner) revert NovolemError.NotOwner();
		if (_owner == address(0)) revert NovolemError.NotValidAddress();
		if (_owner == owner) revert NovolemError.NotValidAddress();
		owner = _owner;
	}
	function updateEmissionRate(uint256 _emissionRate) public {
		if (_msgSender() != owner) revert NovolemError.NotOwner();
		emissionRate = _emissionRate;
	}
	function updateMinimumManagerHolding(uint256 _minimumManagerHolding) public {
		if (_msgSender() != owner) revert NovolemError.NotOwner();
		minimumManagerHolding = _minimumManagerHolding;
	}
	function updateLimitManagers(bool _limitManagers) public {
		if (_msgSender() != owner) revert NovolemError.NotOwner();
		limitManagers = _limitManagers;
	}
	function updateNovolemToken(address _novolemToken) public {
		if (_msgSender() != owner) revert NovolemError.NotOwner();
		novolemToken = _novolemToken;
		novolemTokenDecimals = ERC20(_novolemToken).decimals();
	}
	function clawbackEmission() external {
		if (_msgSender() != owner) revert NovolemError.NotOwner();
		uint256 currentEmission = IERC20(novolemToken).balanceOf(address(this));
		IERC20(novolemToken).transfer(owner, currentEmission);
	}
	function setManagers(address[10] calldata _managers) public {
		if (_msgSender() != owner) revert NovolemError.NotOwner();
		managers = _managers;
	}
	function pause() public {
		if (_msgSender() != owner) revert NovolemError.NotOwner();
		paused = true;
		emit Paused();
	}
	function unpause() public {
		if (_msgSender() != owner) revert NovolemError.NotOwner();
		paused = false;
		emit Unpaused();
	}

	function createBounty(address _manager, string calldata _metadataUrl, uint256 _reward, uint256 _commission) external {
		if (!initialized) revert NovolemError.NotInitialized();
		if (paused) revert NovolemError.ContractPaused();
		if (_reward == 0) revert NovolemError.NotEnoughReward();
		if (_manager == address(0)) revert NovolemError.NotValidAddress();

		// Emission will be emission rate * reward
		uint256 emission = 0;
		if (_reward > 0 && emissionRate > 0) {
			SD59x18 rewardSD = TokenMath.toSD59x18(transactionTokenDecimals, _reward);
			SD59x18 emissionSD = rewardSD.mul(sd(int256(emissionRate)));
			emission = TokenMath.toUint256(novolemTokenDecimals, emissionSD);
			if (IERC20(novolemToken).balanceOf(address(this)) < emission) revert NovolemError.NotEnoughEmission();
		}

		// Manager holding check
		if (limitManagers) {
			// Check if manager is in the list
			bool isManager = false;
			for (uint256 i = 0; i < managers.length; i++) {
				if (managers[i] == _manager) {
					isManager = true;
					break;
				}
			}
			if (!isManager) revert NovolemError.NotValidManager();
		} else {
			if (minimumManagerHolding > 0) {
				if (IERC20(novolemToken).balanceOf(_manager) < minimumManagerHolding) revert NovolemError.NotEnoughManagerHolding();
			}
		}

		// Client holding check
		if (IERC20(transactionToken).balanceOf(_msgSender()) < _reward + _commission) revert NovolemError.NotEnoughClientHolding();
		if (IERC20(transactionToken).allowance(_msgSender(), address(this)) < _reward + _commission) revert NovolemError.NotEnoughAllowance();

		NovolemStructure.Bounty memory bounty = NovolemStructure.Bounty({
			id: bountyIdCounter++,
			creator: _msgSender(),
			manager: _manager,
			metadataUrl: _metadataUrl,
			reward: _reward,
			commission: _commission,
			emission: emission,
			winner: address(0),
			status: NovolemStructure.BountyStatus.ACTIVE
		});
		bounties[bounty.id] = bounty;

		// Transfer reward + commission
		IERC20(transactionToken).transferFrom(bounty.creator, address(this), _reward + _commission);

		emit CreateBounty(bounty.id, bounty.creator, bounty.manager, bounty.metadataUrl, bounty.reward, bounty.commission, emission);
	}

	function refundBounty(uint256 _bountyId) external {
		if (!initialized) revert NovolemError.NotInitialized();
		if (paused) revert NovolemError.ContractPaused();

		NovolemStructure.Bounty storage bounty = bounties[_bountyId];

		if (bounty.winner != address(0)) revert NovolemError.AlreadyClaimed();
		if (_msgSender() != bounty.manager) revert NovolemError.NotManager();
		if (bounty.status != NovolemStructure.BountyStatus.ACTIVE) revert NovolemError.NotActive();

		bounty.status = NovolemStructure.BountyStatus.REFUNDED;

		IERC20(transactionToken).transfer(bounty.creator, bounty.reward);
		IERC20(transactionToken).transfer(bounty.manager, bounty.commission);
		emit RefundBounty(_bountyId);
	}

	function claimBounty(uint256 _bountyId, address _winner) external {
		if (!initialized) revert NovolemError.NotInitialized();
		if (paused) revert NovolemError.ContractPaused();

		NovolemStructure.Bounty storage bounty = bounties[_bountyId];

		if (bounty.winner != address(0)) revert NovolemError.AlreadyClaimed();
		if (bounty.status != NovolemStructure.BountyStatus.ACTIVE) revert NovolemError.NotActive();
		if (_msgSender() != bounty.manager) revert NovolemError.NotManager();
		if (_winner == address(0)) revert NovolemError.NotValidAddress();

		bounty.winner = _winner;
		bounty.status = NovolemStructure.BountyStatus.CLAIMED;

		// Transfer reward
		IERC20(transactionToken).transfer(_winner, bounty.reward);

		// Transfer emission to manager & creator
		if (bounty.emission > 0) {
			IERC20(novolemToken).transfer(bounty.manager, bounty.emission);
			IERC20(novolemToken).transfer(bounty.creator, bounty.emission);
		}

		// Transfer commission to manager
		if (bounty.commission > 0) {
			IERC20(transactionToken).transfer(bounty.manager, bounty.commission);
		}

		emit ClaimBounty(_bountyId, bounty.winner);
	}

	// View functions
	function getBounty(uint256 _bountyId) external view returns (NovolemStructure.Bounty memory) {
		return bounties[_bountyId];
	}
	function getManagers() external view returns (address[10] memory) {
		return managers;
	}
	function getBountyCount() external view returns (uint256) {
		return bountyIdCounter;
	}
	function getOwner() external view returns (address) {
		return owner;
	}
	function getLimitManagers() external view returns (bool) {
		return limitManagers;
	}
	function getTransactionToken() external view returns (address) {
		return transactionToken;
	}
	function getNovolemToken() external view returns (address) {
		return novolemToken;
	}
	function getEmissionRate() external view returns (uint256) {
		return emissionRate;
	}
	function getMinimumManagerHolding() external view returns (uint256) {
		return minimumManagerHolding;
	}
	function getInitialized() external view returns (bool) {
		return initialized;
	}
	function getPaused() external view returns (bool) {
		return paused;
	}
}
