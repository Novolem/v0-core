const hardhat = require("hardhat");
const { ethers } = hardhat;
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Init variables
const INVESTMENT_TOKEN_DECIMALS = 18;
const TRANSACTION_TOKEN_DECIMALS = 9;
const CLIENT_TRANSFER_AMOUNT = "100";
const CONTRACT_TRANSFER_AMOUNT = "10000";

const EMISSION_RATE_1 = "10";
const MINIMUM_MANAGER_HOLDING_1 = "100";
const BOUNTY_1_REWARD = "50";
const BOUNTY_1_COMMISSION = "1";

const EMISSION_RATE_2 = "0.1283917";
const MINIMUM_MANAGER_HOLDING_2 = "0";
const BOUNTY_2_REWARD = "17.0328288";
const BOUNTY_2_COMMISSION = "33.329827";

const EMISSION_RATE_3 = "0";
const MINIMUM_MANAGER_HOLDING_3 = "0.00077627";
const BOUNTY_3_REWARD = "30";
const BOUNTY_3_COMMISSION = "4.29017777";

const EMISSION_RATE_4 = "2.193719";
const MINIMUM_MANAGER_HOLDING_4 = "90";
const BOUNTY_4_REWARD = "100";
const BOUNTY_4_COMMISSION = "10";

// Fixture to deploy the necessary contracts
async function deployNovolemFixture() {
	const accounts = await ethers.getSigners();

	const ERC20 = await ethers.getContractFactory("TestERC20");

	const investmentToken = await ERC20.deploy("Investment Token", "INV", INVESTMENT_TOKEN_DECIMALS, ethers.parseUnits("100000", INVESTMENT_TOKEN_DECIMALS));
	await investmentToken.waitForDeployment();
	let investmentTokenAddress = await investmentToken.getAddress();

	const transactionToken = await ERC20.deploy(
		"Transaction Token",
		"TRX",
		TRANSACTION_TOKEN_DECIMALS,
		ethers.parseUnits("100000", TRANSACTION_TOKEN_DECIMALS)
	);
	await transactionToken.waitForDeployment();
	let transactionTokenAddress = await transactionToken.getAddress();

	// Link libraries
	const Novolem = await ethers.getContractFactory("Novolem");

	// Deploy the Novolem contract
	const novolem = await Novolem.deploy();
	let manager1Address = await accounts[accountMapping.manager1].getAddress();
	await novolem.initialize(
		transactionTokenAddress,
		investmentTokenAddress,
		ethers.parseEther(EMISSION_RATE_1),
		ethers.parseUnits(MINIMUM_MANAGER_HOLDING_1, INVESTMENT_TOKEN_DECIMALS),
		Array(10).fill(manager1Address)
	);

	// Transfer Novolem tokens to the first account
	const novolemAddress = await novolem.getAddress();
	await investmentToken.transfer(novolemAddress, ethers.parseUnits(CONTRACT_TRANSFER_AMOUNT, INVESTMENT_TOKEN_DECIMALS));

	return { investmentToken, transactionToken, novolem, accounts };
}

const accountMapping = {
	owner1: 0,
	owner2: 1,
	owner3: 2,

	client1: 5,
	client2: 6,
	client3: 7,
	client4: 8,

	manager1: 10,
	manager2: 11,
	manager3: 12,
	manager4: 13,

	worker1: 15,
	worker2: 16,
	worker3: 17,
	worker4: 18
};

describe("Novolem", function () {
	// Fixture to deploy the necessary contracts
	let deployedContracts;

	// Deploy contracts once and use them in multiple tests
	before(async function () {
		deployedContracts = await loadFixture(deployNovolemFixture);
	});

	describe("Deployment and Initialization", async function () {
		it("should deploy and initialize the Novolem contract correctly", async function () {
			const { novolem, investmentToken, transactionToken, accounts } = deployedContracts;

			let investmentTokenAddress = await investmentToken.getAddress();
			let transactionTokenAddress = await transactionToken.getAddress();
			expect(await novolem.getTransactionToken()).to.equal(transactionTokenAddress);
			expect(await novolem.getNovolemToken()).to.equal(investmentTokenAddress);

			// Check contract states
			const isPaused = await novolem.getPaused();
			expect(isPaused).to.equal(false);

			const owner = await novolem.getOwner();
			expect(owner).to.equal(await accounts[0].getAddress());

			const emissionRate = await novolem.getEmissionRate();
			expect(emissionRate).to.equal(ethers.parseEther(EMISSION_RATE_1));
		});
		it("Should not allow anyone to initialize the contract", async function () {
			const { novolem, accounts, investmentToken, transactionToken } = deployedContracts;
			const worker1 = accounts[accountMapping.worker1];
			const investmentTokenAddress = await investmentToken.getAddress();
			const transactionTokenAddress = await transactionToken.getAddress();
			await expect(
				novolem
					.connect(worker1)
					.initialize(
						transactionTokenAddress,
						investmentTokenAddress,
						ethers.parseEther(EMISSION_RATE_1),
						ethers.parseUnits(MINIMUM_MANAGER_HOLDING_1, INVESTMENT_TOKEN_DECIMALS),
						Array(10).fill(transactionTokenAddress)
					)
			).to.be.revertedWithCustomError(novolem, "AlreadyInitialized");
		});
		it("should not allow account to update limit manager bool", async function () {
			const { novolem, accounts } = deployedContracts;
			const worker1 = accounts[accountMapping.worker1];
			await expect(novolem.connect(worker1).updateLimitManagers(true)).to.be.revertedWithCustomError(novolem, "NotOwner");
		});
		it("should allow owner to update limit manager bool", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner = accounts[accountMapping.owner1];
			await novolem.connect(owner).updateLimitManagers(false);
			expect(await novolem.getLimitManagers()).to.equal(false);
		});
	});

	describe("Bounty creation and claiming error management", async function () {
		it("should fail to create bounty without reward", async function () {
			const { novolem, accounts } = deployedContracts;
			const client1 = accounts[accountMapping.client1];
			const manager1 = accounts[accountMapping.manager1];
			await expect(novolem.connect(client1).createBounty(manager1.address, "ipfs://bountyMetadata", 0, 0)).to.be.revertedWithCustomError(
				novolem,
				"NotEnoughReward"
			);
		});

		it("should fail to create bounty without emission", async function () {
			const { novolem, accounts, transactionToken } = deployedContracts;
			const client1 = accounts[accountMapping.client1];
			const client1Address = await client1.getAddress();
			const manager1 = accounts[accountMapping.manager1];

			// Transer 100 tokens to client1
			await transactionToken.transfer(client1Address, ethers.parseUnits(CLIENT_TRANSFER_AMOUNT, TRANSACTION_TOKEN_DECIMALS));

			await expect(
				novolem.connect(client1).createBounty(manager1.address, "ipfs://bountyMetadata", ethers.parseEther("100"), 0)
			).to.be.revertedWithCustomError(novolem, "NotEnoughEmission");
		});

		it("should fail to create bounty with insufficient manager holding", async function () {
			const { novolem, accounts } = deployedContracts;
			const client1 = accounts[accountMapping.client1];
			const manager1 = accounts[accountMapping.manager1];
			await expect(
				novolem.connect(client1).createBounty(manager1.address, "ipfs://bountyMetadata", ethers.parseUnits("1", TRANSACTION_TOKEN_DECIMALS), 0)
			).to.be.revertedWithCustomError(novolem, "NotEnoughManagerHolding");
		});

		it("should fail to create bounty without balance of client", async function () {
			const { novolem, accounts, investmentToken, transactionToken } = deployedContracts;
			const client1 = accounts[accountMapping.client1];
			const manager1 = accounts[accountMapping.manager1];
			const novolemAddress = await novolem.getAddress();

			// Give manager tokens to have sufficient balance
			let initialManagerBalance = await investmentToken.balanceOf(manager1.address);
			await investmentToken.transfer(manager1.address, ethers.parseUnits(MINIMUM_MANAGER_HOLDING_1, INVESTMENT_TOKEN_DECIMALS));
			expect(await investmentToken.balanceOf(manager1.address)).to.equal(
				initialManagerBalance + ethers.parseUnits(MINIMUM_MANAGER_HOLDING_1, INVESTMENT_TOKEN_DECIMALS)
			);

			// Approval error
			await expect(
				novolem.connect(client1).createBounty(manager1.address, "ipfs://bountyMetadata", ethers.parseUnits("1", TRANSACTION_TOKEN_DECIMALS), 0)
			).to.be.revertedWithCustomError(novolem, "NotEnoughAllowance");

			// Approve the contract to spend 100 tokens
			await transactionToken.connect(client1).approve(novolemAddress, ethers.parseUnits("101", TRANSACTION_TOKEN_DECIMALS));

			// Holder error
			await expect(
				novolem.connect(client1).createBounty(manager1.address, "ipfs://bountyMetadata", ethers.parseUnits("101", TRANSACTION_TOKEN_DECIMALS), 0)
			).to.be.revertedWithCustomError(novolem, "NotEnoughClientHolding");
		});
	});

	describe("Bounty creation and claiming", async function () {
		it("should create a bounty by client1, assign to manager1, and claim by worker1", async function () {
			const { novolem, transactionToken, accounts } = deployedContracts;

			const novolemAddress = await novolem.getAddress();

			const client1 = accounts[accountMapping.client1];
			const client1Address = await client1.getAddress();

			const manager1 = accounts[accountMapping.manager1];
			const manager1Address = await manager1.getAddress();

			const worker1 = accounts[accountMapping.worker1];
			const worker1Address = await worker1.getAddress();

			// Approve transaction token for client1
			await transactionToken
				.connect(client1)
				.approve(
					novolemAddress,
					ethers.parseUnits(BOUNTY_1_REWARD, TRANSACTION_TOKEN_DECIMALS) + ethers.parseUnits(BOUNTY_1_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
				);

			// Create bounty by client1
			const bountyMetadataUrl = "ipfs://bountyMetadata";
			const expectedEmission = ethers.parseUnits(String(EMISSION_RATE_1 * BOUNTY_1_REWARD), INVESTMENT_TOKEN_DECIMALS);
			await expect(
				novolem
					.connect(client1)
					.createBounty(
						manager1Address,
						bountyMetadataUrl,
						ethers.parseUnits(BOUNTY_1_REWARD, TRANSACTION_TOKEN_DECIMALS),
						ethers.parseUnits(BOUNTY_1_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
					)
			)
				.to.emit(novolem, "CreateBounty")
				.withArgs(
					0,
					client1Address,
					manager1Address,
					bountyMetadataUrl,
					ethers.parseUnits(BOUNTY_1_REWARD, TRANSACTION_TOKEN_DECIMALS),
					ethers.parseUnits(BOUNTY_1_COMMISSION, TRANSACTION_TOKEN_DECIMALS),
					expectedEmission
				); // Emission should be 10x reward

			// Check bounty details
			const bounty = await novolem.getBounty(0);
			expect(bounty.id).to.equal(0);
			expect(bounty.creator).to.equal(client1Address);
			expect(bounty.manager).to.equal(manager1Address);
			expect(bounty.metadataUrl).to.equal(bountyMetadataUrl);
			expect(bounty.reward).to.equal(ethers.parseUnits(BOUNTY_1_REWARD, TRANSACTION_TOKEN_DECIMALS));
			expect(bounty.commission).to.equal(ethers.parseUnits(BOUNTY_1_COMMISSION, TRANSACTION_TOKEN_DECIMALS));
			expect(bounty.emission).to.equal(expectedEmission);
			expect(bounty.winner).to.equal(ethers.ZeroAddress);
			expect(bounty.status).to.equal(0); // ACTIVE

			// Check balances after bounty creation
			expect(await transactionToken.balanceOf(client1Address)).to.equal(
				ethers.parseUnits(CLIENT_TRANSFER_AMOUNT, TRANSACTION_TOKEN_DECIMALS) -
					ethers.parseUnits(BOUNTY_1_REWARD, TRANSACTION_TOKEN_DECIMALS) -
					ethers.parseUnits(BOUNTY_1_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
			);
			expect(await transactionToken.balanceOf(novolemAddress)).to.equal(
				ethers.parseUnits(BOUNTY_1_REWARD, TRANSACTION_TOKEN_DECIMALS) + ethers.parseUnits(BOUNTY_1_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
			);

			// Claim bounty by manager1
			await expect(novolem.connect(manager1).claimBounty(0, worker1.address)).to.emit(novolem, "ClaimBounty").withArgs(0, worker1Address);

			// Check bounty status after claiming
			const claimedBounty = await novolem.getBounty(0);
			expect(claimedBounty.winner).to.equal(worker1Address);
			expect(claimedBounty.status).to.equal(1); // CLAIMED

			// Check balances after bounty claiming
			expect(await transactionToken.balanceOf(worker1Address)).to.equal(ethers.parseUnits(BOUNTY_1_REWARD, TRANSACTION_TOKEN_DECIMALS));
			expect(await transactionToken.balanceOf(manager1Address)).to.equal(ethers.parseUnits(BOUNTY_1_COMMISSION, TRANSACTION_TOKEN_DECIMALS));
		});

		it("should fail to claim an already claimed bounty", async function () {
			const { novolem, accounts } = deployedContracts;

			const manager1 = accounts[accountMapping.manager1];
			const worker2 = accounts[accountMapping.worker2];

			// Try to claim already claimed bounty
			await expect(novolem.connect(manager1).claimBounty(0, worker2.address)).to.be.revertedWithCustomError(novolem, "AlreadyClaimed");
		});

		it("should fail to create a bounty if the contract is paused", async function () {
			const { novolem, accounts } = deployedContracts;
			const client1 = accounts[accountMapping.client1];
			const client1Address = await client1.getAddress();
			await novolem.pause();
			await expect(
				novolem.connect(client1).createBounty(client1Address, "ipfs://bounty2Metadata", ethers.parseUnits("1", TRANSACTION_TOKEN_DECIMALS), 0)
			).to.be.revertedWithCustomError(novolem, "ContractPaused");
			await novolem.unpause();
		});

		it("should fail to claim a bounty by non-manager", async function () {
			const { novolem, accounts, transactionToken } = deployedContracts;
			const novolemAddress = await novolem.getAddress();
			const client1 = accounts[accountMapping.client1];
			const client1Address = await client1.getAddress();
			const worker1 = accounts[accountMapping.worker1];
			const worker1Address = await worker1.getAddress();

			// Create a new bounty
			const bountyReward = ethers.parseUnits("1", TRANSACTION_TOKEN_DECIMALS);
			await transactionToken.connect(client1).approve(novolemAddress, bountyReward);
			await novolem.connect(client1).createBounty(client1Address, "ipfs://bounty2Metadata", bountyReward, 0);

			// Try to claim bounty by non-manager
			await expect(novolem.connect(worker1).claimBounty(1, worker1Address)).to.be.revertedWithCustomError(novolem, "NotManager");
		});
	});

	describe("Contract state updates", async function () {
		it("should fail to pause the contract if not owner", async function () {
			const { novolem, accounts } = deployedContracts;
			const worker1 = accounts[accountMapping.worker1];
			await expect(novolem.connect(worker1).pause()).to.be.revertedWithCustomError(novolem, "NotOwner");
		});
		it("should fail to transfer the contract if not owner", async function () {
			const { novolem, accounts } = deployedContracts;
			const worker1 = accounts[accountMapping.worker1];
			const worker1Address = await worker1.getAddress();
			await expect(novolem.connect(worker1).updateOwner(worker1Address)).to.be.revertedWithCustomError(novolem, "NotOwner");
		});
		it("should successfully update the owner", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner2 = accounts[accountMapping.owner2];
			const owner2Address = await owner2.getAddress();
			await novolem.updateOwner(owner2Address);
			expect(await novolem.getOwner()).to.equal(owner2Address);
		});
		it("should fail to update the emission rate if not owner", async function () {
			const { novolem } = deployedContracts;
			await expect(novolem.updateEmissionRate(ethers.parseEther(EMISSION_RATE_2))).to.be.revertedWithCustomError(novolem, "NotOwner");
		});
		it("should successfully update the emission rate", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner2 = accounts[accountMapping.owner2];
			await novolem.connect(owner2).updateEmissionRate(ethers.parseEther(EMISSION_RATE_2));
			expect(await novolem.getEmissionRate()).to.equal(ethers.parseEther(EMISSION_RATE_2));
		});
		it("should fail to update the manager holding if not owner", async function () {
			const { novolem } = deployedContracts;
			await expect(novolem.updateMinimumManagerHolding(ethers.parseEther(EMISSION_RATE_2))).to.be.revertedWithCustomError(novolem, "NotOwner");
		});
		it("should successfully update the manager holding", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner2 = accounts[accountMapping.owner2];
			await novolem.connect(owner2).updateMinimumManagerHolding(ethers.parseUnits(MINIMUM_MANAGER_HOLDING_2, INVESTMENT_TOKEN_DECIMALS));
			expect(await novolem.getMinimumManagerHolding()).to.equal(ethers.parseUnits(MINIMUM_MANAGER_HOLDING_2, INVESTMENT_TOKEN_DECIMALS));
		});
	});

	describe("Bounty creation and claiming", async function () {
		it("should create a bounty by client2, assign to manager2, and claim by worker2", async function () {
			const { novolem, accounts, transactionToken, investmentToken } = deployedContracts;
			const novolemAddress = await novolem.getAddress();
			const client2 = accounts[accountMapping.client2];
			const client2Address = await client2.getAddress();
			const manager2 = accounts[accountMapping.manager2];
			const manager2Address = await manager2.getAddress();
			const worker2 = accounts[accountMapping.worker2];
			const worker2Address = await worker2.getAddress();

			const bountyReward = ethers.parseUnits(BOUNTY_2_REWARD, TRANSACTION_TOKEN_DECIMALS);
			const bountyCommission = ethers.parseUnits(BOUNTY_2_COMMISSION, TRANSACTION_TOKEN_DECIMALS);
			const expectedEmission = ethers.parseUnits(String(EMISSION_RATE_2 * BOUNTY_2_REWARD), INVESTMENT_TOKEN_DECIMALS);

			// Transfer holding to manager2
			await investmentToken.transfer(manager2Address, ethers.parseUnits(MINIMUM_MANAGER_HOLDING_2, INVESTMENT_TOKEN_DECIMALS));

			// Transfer tokens to client2
			await transactionToken.transfer(client2Address, bountyReward + bountyCommission);
			await investmentToken.transfer(novolemAddress, ethers.parseUnits(CONTRACT_TRANSFER_AMOUNT, INVESTMENT_TOKEN_DECIMALS));

			// Create a new bounty by client2
			await transactionToken.connect(client2).approve(novolemAddress, bountyReward + bountyCommission);
			await expect(novolem.connect(client2).createBounty(manager2Address, "ipfs://bounty2Metadata", bountyReward, bountyCommission)).to.emit(
				novolem,
				"CreateBounty"
			);

			// Check bounty details
			const bountyId = 2;
			const bounty = await novolem.getBounty(bountyId);
			expect(bounty.creator).to.equal(client2Address);
			expect(bounty.manager).to.equal(manager2Address);
			expect(bounty.reward).to.equal(bountyReward);
			expect(bounty.commission).to.equal(bountyCommission);
			expect(bounty.winner).to.equal(ethers.ZeroAddress);
			expect(bounty.status).to.equal(0); // BountyState.Open
			expect(bounty.emission).to.equal(expectedEmission);

			// Claim bounty by worker2
			await expect(novolem.connect(manager2).claimBounty(bountyId, worker2Address)).to.emit(novolem, "ClaimBounty");

			// Check updated bounty details
			const updatedBounty = await novolem.getBounty(bountyId);
			expect(updatedBounty.winner).to.equal(worker2Address);
			expect(updatedBounty.status).to.equal(1); // BountyState.Claimed

			// Check balances
			expect(await transactionToken.balanceOf(worker2Address)).to.equal(bountyReward);
			expect(await transactionToken.balanceOf(manager2Address)).to.equal(bountyCommission);
			expect(await transactionToken.balanceOf(client2Address)).to.equal(ethers.parseUnits("0", TRANSACTION_TOKEN_DECIMALS));
			expect(await investmentToken.balanceOf(client2Address)).to.equal(expectedEmission);
			expect(await investmentToken.balanceOf(manager2)).to.equal(ethers.parseUnits(String(MINIMUM_MANAGER_HOLDING_2), INVESTMENT_TOKEN_DECIMALS));
		});
	});

	describe("Contract state updates", async function () {
		it("should update the emission rate", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner2 = accounts[accountMapping.owner2];
			await novolem.connect(owner2).updateEmissionRate(ethers.parseEther(EMISSION_RATE_3));
			expect(await novolem.getEmissionRate()).to.equal(ethers.parseEther(EMISSION_RATE_3));
		});
		it("should update the manager holding", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner2 = accounts[accountMapping.owner2];
			await novolem.connect(owner2).updateMinimumManagerHolding(ethers.parseUnits(MINIMUM_MANAGER_HOLDING_3, INVESTMENT_TOKEN_DECIMALS));
			expect(await novolem.getMinimumManagerHolding()).to.equal(ethers.parseUnits(MINIMUM_MANAGER_HOLDING_3, INVESTMENT_TOKEN_DECIMALS));
		});
	});

	describe("Bounty creation and refunding", async function () {
		it("should create & refund a bounty", async function () {
			const { novolem, accounts, transactionToken, investmentToken } = deployedContracts;
			const novolemAddress = await novolem.getAddress();

			const client3 = accounts[accountMapping.client3];
			const client3Address = await client3.getAddress();
			const manager3 = accounts[accountMapping.manager3];
			const manager3Address = await manager3.getAddress();

			// Transfer holding to manager3
			await investmentToken.transfer(manager3Address, ethers.parseUnits(MINIMUM_MANAGER_HOLDING_3, INVESTMENT_TOKEN_DECIMALS));

			// Provide 100 tokens to client3
			await transactionToken.transfer(client3Address, ethers.parseUnits(CLIENT_TRANSFER_AMOUNT, TRANSACTION_TOKEN_DECIMALS));

			// Approve transaction token for client2
			await transactionToken
				.connect(client3)
				.approve(
					novolemAddress,
					ethers.parseUnits(BOUNTY_3_REWARD, TRANSACTION_TOKEN_DECIMALS) + ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
				);

			// Create a bounty by client2
			const bountyMetadataUrl2 = "ipfs://bounty2Metadata";
			await expect(
				novolem
					.connect(client3)
					.createBounty(
						manager3Address,
						bountyMetadataUrl2,
						ethers.parseUnits(BOUNTY_3_REWARD, TRANSACTION_TOKEN_DECIMALS),
						ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
					)
			)
				.to.emit(novolem, "CreateBounty")
				.withArgs(
					3,
					client3Address,
					manager3Address,
					bountyMetadataUrl2,
					ethers.parseUnits(BOUNTY_3_REWARD, TRANSACTION_TOKEN_DECIMALS),
					ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS),
					ethers.parseUnits(String(EMISSION_RATE_3 * BOUNTY_3_REWARD), INVESTMENT_TOKEN_DECIMALS)
				);

			// Check bounty details
			const bounty2 = await novolem.getBounty(3);
			expect(bounty2.id).to.equal(3);
			expect(bounty2.creator).to.equal(client3Address);
			expect(bounty2.manager).to.equal(manager3Address);
			expect(bounty2.metadataUrl).to.equal(bountyMetadataUrl2);
			expect(bounty2.reward).to.equal(ethers.parseUnits(BOUNTY_3_REWARD, TRANSACTION_TOKEN_DECIMALS));
			expect(bounty2.commission).to.equal(ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS));
			expect(bounty2.emission).to.equal(ethers.parseUnits(String(EMISSION_RATE_3 * BOUNTY_3_REWARD), INVESTMENT_TOKEN_DECIMALS));
			expect(bounty2.winner).to.equal(ethers.ZeroAddress);
			expect(bounty2.status).to.equal(0); // ACTIVE

			// Refund the bounty
			await expect(novolem.connect(manager3).refundBounty(3)).to.emit(novolem, "RefundBounty").withArgs(3);

			// Check updated bounty details
			const refundedBounty = await novolem.getBounty(3);
			expect(refundedBounty.status).to.equal(2); // REFUNDED

			// Check balances after refund
			expect(await transactionToken.balanceOf(client3Address)).to.equal(
				ethers.parseUnits(CLIENT_TRANSFER_AMOUNT, TRANSACTION_TOKEN_DECIMALS) - ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
			);
			expect(await transactionToken.balanceOf(manager3Address)).to.equal(ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS));
		});

		it("should fail to refund a bounty that is not open", async function () {
			const { novolem, accounts } = deployedContracts;
			const manager3 = accounts[accountMapping.manager3];
			await expect(novolem.connect(manager3).refundBounty(3)).to.be.revertedWithCustomError(novolem, "NotActive");
		});

		it("should fail to claim a bounty that is not open", async function () {
			const { novolem, accounts } = deployedContracts;
			const worker3 = accounts[accountMapping.worker3];
			const worker3Address = await worker3.getAddress();
			const manager3 = accounts[accountMapping.manager3];
			await expect(novolem.connect(manager3).claimBounty(3, worker3Address)).to.be.revertedWithCustomError(novolem, "NotActive");
		});

		it("should create a bounty by client3, assign to manager3, and claim by worker3", async function () {
			const { novolem, accounts, transactionToken, investmentToken } = deployedContracts;
			const novolemAddress = await novolem.getAddress();
			const client3 = accounts[accountMapping.client3];
			const client3Address = await client3.getAddress();
			const manager3 = accounts[accountMapping.manager3];
			const manager3Address = await manager3.getAddress();
			const worker3 = accounts[accountMapping.worker3];
			const worker3Address = await worker3.getAddress();
			const bountyMetadataUrl3 = "https://example.com/bounty3";

			// Approve transaction token for client3
			await transactionToken
				.connect(client3)
				.approve(
					novolemAddress,
					ethers.parseUnits(BOUNTY_3_REWARD, TRANSACTION_TOKEN_DECIMALS) + ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
				);

			const initialManagerBalance = await transactionToken.balanceOf(manager3Address);
			const initialManagerInvestmentBalance = await investmentToken.balanceOf(manager3Address);

			// Client creates a bounty
			await novolem
				.connect(client3)
				.createBounty(
					manager3Address,
					bountyMetadataUrl3,
					ethers.parseUnits(BOUNTY_3_REWARD, TRANSACTION_TOKEN_DECIMALS),
					ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
				);

			// Manager assigns the bounty to worker
			await expect(novolem.connect(manager3).claimBounty(4, worker3Address)).to.emit(novolem, "ClaimBounty").withArgs(4, worker3Address);

			// Check the bounty details after claiming
			const claimedBounty = await novolem.getBounty(4);
			expect(claimedBounty.winner).to.equal(worker3Address);
			expect(claimedBounty.status).to.equal(1); // CLAIMED

			// Check balances after claiming
			expect(await transactionToken.balanceOf(worker3Address)).to.equal(ethers.parseUnits(BOUNTY_3_REWARD, TRANSACTION_TOKEN_DECIMALS));
			expect(await transactionToken.balanceOf(manager3Address)).to.equal(
				ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS) + initialManagerBalance
			);
			expect(await transactionToken.balanceOf(client3Address)).to.equal(
				ethers.parseUnits(CLIENT_TRANSFER_AMOUNT, TRANSACTION_TOKEN_DECIMALS) -
					ethers.parseUnits(BOUNTY_3_REWARD, TRANSACTION_TOKEN_DECIMALS) -
					ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS) -
					ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
			);
			expect(await investmentToken.balanceOf(client3Address)).to.equal(
				ethers.parseUnits(String(EMISSION_RATE_3 * BOUNTY_3_REWARD), INVESTMENT_TOKEN_DECIMALS)
			);
			expect(await investmentToken.balanceOf(manager3Address)).to.equal(
				ethers.parseUnits(String(EMISSION_RATE_3 * BOUNTY_3_REWARD), INVESTMENT_TOKEN_DECIMALS) + initialManagerInvestmentBalance
			);
		});
	});

	describe("Contract state updates", async function () {
		it("should update the emission rate", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner2 = accounts[accountMapping.owner2];
			await novolem.connect(owner2).updateEmissionRate(ethers.parseEther(EMISSION_RATE_4));
			expect(await novolem.getEmissionRate()).to.equal(ethers.parseEther(EMISSION_RATE_4));
		});
		it("should update the manager holding", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner2 = accounts[accountMapping.owner2];
			await novolem.connect(owner2).updateMinimumManagerHolding(ethers.parseUnits(MINIMUM_MANAGER_HOLDING_4, INVESTMENT_TOKEN_DECIMALS));
			expect(await novolem.getMinimumManagerHolding()).to.equal(ethers.parseUnits(MINIMUM_MANAGER_HOLDING_4, INVESTMENT_TOKEN_DECIMALS));
		});
		it("should update limit managers", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner2 = accounts[accountMapping.owner2];
			await novolem.connect(owner2).updateLimitManagers(true);
			expect(await novolem.getLimitManagers()).to.equal(true);
		});
		it("should not allow not owner to update managers", async function () {
			const { novolem, accounts } = deployedContracts;
			const worker2 = accounts[accountMapping.worker2];
			const worker2Address = await worker2.getAddress();
			const managers = Array(10).fill(ethers.ZeroAddress);
			managers[0] = worker2Address;
			await expect(novolem.connect(worker2).setManagers(managers)).to.be.revertedWithCustomError(novolem, "NotOwner");
		});
		it("should not allow client to create bounty with invalid manager", async function () {
			const { novolem, accounts } = deployedContracts;
			const client2 = accounts[accountMapping.client2];
			const manager2 = accounts[accountMapping.manager2];
			const manager2Address = await manager2.getAddress();
			await expect(
				novolem
					.connect(client2)
					.createBounty(
						manager2Address,
						"ipfs://bounty2Metadata",
						ethers.parseUnits(BOUNTY_3_REWARD, TRANSACTION_TOKEN_DECIMALS),
						ethers.parseUnits(BOUNTY_3_COMMISSION, TRANSACTION_TOKEN_DECIMALS)
					)
			).to.be.revertedWithCustomError(novolem, "NotValidManager");
		});
		it("should allow owner to update managers", async function () {
			const { novolem, accounts } = deployedContracts;
			const owner2 = accounts[accountMapping.owner2];
			const manager4 = accounts[accountMapping.manager4];
			const manager4Address = await manager4.getAddress();
			const managerArray = Array(10).fill(ethers.ZeroAddress);
			managerArray[0] = manager4Address;
			await novolem.connect(owner2).setManagers(managerArray);
			expect(await novolem.getManagers()).to.deep.equal(managerArray);
		});
	});

	describe("Bounty creation and claiming", async function () {
		it("should create a bounty by client4, assign to manager4, and claim by worker4", async function () {
			const { novolem, accounts, transactionToken, investmentToken } = deployedContracts;
			const novolemAddress = await novolem.getAddress();
			const client4 = accounts[accountMapping.client4];
			const client4Address = await client4.getAddress();
			const manager4 = accounts[accountMapping.manager4];
			const manager4Address = await manager4.getAddress();
			const worker4 = accounts[accountMapping.worker4];
			const worker4Address = await worker4.getAddress();

			const bountyReward = ethers.parseUnits(BOUNTY_4_REWARD, TRANSACTION_TOKEN_DECIMALS);
			const bountyCommission = ethers.parseUnits(BOUNTY_4_COMMISSION, TRANSACTION_TOKEN_DECIMALS);
			const expectedEmission = ethers.parseUnits(String(EMISSION_RATE_4 * BOUNTY_4_REWARD), INVESTMENT_TOKEN_DECIMALS);

			// Don't Transfer holding to manager4 as it should allow it to create bounty given it is a limited manager

			// Transfer tokens to client4
			await transactionToken.transfer(client4Address, bountyReward + bountyCommission);
			await investmentToken.transfer(novolemAddress, ethers.parseUnits(CONTRACT_TRANSFER_AMOUNT, INVESTMENT_TOKEN_DECIMALS));

			// Create a new bounty by client4
			await transactionToken.connect(client4).approve(novolemAddress, bountyReward + bountyCommission);
			await expect(novolem.connect(client4).createBounty(manager4Address, "ipfs://bounty4Metadata", bountyReward, bountyCommission)).to.emit(
				novolem,
				"CreateBounty"
			);

			// Check bounty details
			const bountyId = 5;
			const bounty = await novolem.getBounty(bountyId);
			expect(bounty.creator).to.equal(client4Address);
			expect(bounty.manager).to.equal(manager4Address);
			expect(bounty.reward).to.equal(bountyReward);
			expect(bounty.commission).to.equal(bountyCommission);
			expect(bounty.winner).to.equal(ethers.ZeroAddress);
			expect(bounty.status).to.equal(0); // BountyState.Open
			expect(bounty.emission).to.equal(expectedEmission);

			// Claim bounty by worker4
			await expect(novolem.connect(manager4).claimBounty(bountyId, worker4Address)).to.emit(novolem, "ClaimBounty");

			// Check updated bounty details
			const updatedBounty = await novolem.getBounty(bountyId);
			expect(updatedBounty.winner).to.equal(worker4Address);
			expect(updatedBounty.status).to.equal(1); // BountyState.Claimed

			// Check balances
			expect(await transactionToken.balanceOf(worker4Address)).to.equal(bountyReward);
			expect(await transactionToken.balanceOf(manager4Address)).to.equal(bountyCommission);
			expect(await transactionToken.balanceOf(client4Address)).to.equal(ethers.parseUnits("0", TRANSACTION_TOKEN_DECIMALS));
			expect(await investmentToken.balanceOf(client4Address)).to.equal(expectedEmission);
		});
	});

	describe("Clawback & closing", async function () {
		it("should not allow non-owner to clawback the emission", async function () {
			const { novolem, accounts } = deployedContracts;
			const worker2 = accounts[accountMapping.worker2];
			await expect(novolem.connect(worker2).clawbackEmission()).to.be.revertedWithCustomError(novolem, "NotOwner");
		});
		it("should clawback the emission", async function () {
			const { novolem, accounts, investmentToken } = deployedContracts;
			const novolemAddress = await novolem.getAddress();
			const owner2 = accounts[accountMapping.owner2];
			let currentEmission = await investmentToken.balanceOf(novolemAddress);
			let currentEmissionOwner = await investmentToken.balanceOf(owner2);
			await novolem.connect(owner2).clawbackEmission();
			expect(await investmentToken.balanceOf(novolemAddress)).to.equal(0);
			expect(await investmentToken.balanceOf(owner2)).to.equal(currentEmissionOwner + currentEmission);
		});
	});
});
