require("dotenv").config();
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const INVESTMENT_TOKEN_DECIMALS = 18;
const TRANSACTION_TOKEN_DECIMALS = 9;

module.exports = buildModule("NovolemModule", (m) => {
	const investmentToken = m.contract("TestERC20", ["Investment Token", "INV", INVESTMENT_TOKEN_DECIMALS, ethers.parseEther("10000")], { id: "INV" });
	const transactionToken = m.contract("TestERC20", ["Transaction Token", "TRX", TRANSACTION_TOKEN_DECIMALS, ethers.parseEther("10000")], { id: "TRX" });
	const Novolem = m.contract("Novolem");
	const managers = Array(10).fill(ethers.ZeroAddress);
	managers[0] = process.env.MANAGER_1_PUBLIC_KEY;
	m.call(Novolem, "initialize", [transactionToken, investmentToken, ethers.parseEther("1"), ethers.parseEther("0"), managers]);
	return {
		Novolem
	};
});
