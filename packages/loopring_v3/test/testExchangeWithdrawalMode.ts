import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil, OnchainBlock } from "./testExchangeUtil";
import { SpotTrade } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopring: any;
  let exchangeID = 0;

  const checkWithdrawalMode = async (expectedInWithdrawalMode: boolean) => {
    const inWithdrawalMode = await exchange.isInWithdrawalMode();
    assert.equal(
      inWithdrawalMode,
      expectedInWithdrawalMode,
      "not in expected withdrawal mode state"
    );
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
    exchangeID = 1;
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  const withdrawFromMerkleTreeChecked = async (
    owner: string,
    token: string,
    expectedAmount: BN
  ) => {
    const recipient =
      owner === Constants.zeroAddress
        ? await loopring.protocolFeeVault()
        : owner;
    const balanceBefore = await exchangeTestUtil.getOnchainBalance(
      recipient,
      token
    );
    await exchangeTestUtil.withdrawFromMerkleTree(owner, token);
    const balanceAfter = await exchangeTestUtil.getOnchainBalance(
      recipient,
      token
    );
    // console.log("balanceBefore: " + balanceBefore.toString(10));
    // console.log("balanceAfter: " + balanceAfter.toString(10));
    // console.log("expectedAmount: " + expectedAmount.toString(10));
    assert(
      balanceAfter.eq(balanceBefore.add(expectedAmount)),
      "Balance withdrawn in withdrawal mode incorrect"
    );

    // Try to withdraw again
    await expectThrow(
      exchangeTestUtil.withdrawFromMerkleTree(owner, token),
      "WITHDRAWN_ALREADY"
    );
  };

  const withdrawFromDepositRequestChecked = async (
    owner: string,
    token: string,
    index: BN,
    expectedAmount: BN
  ) => {
    const balanceBefore = await exchangeTestUtil.getOnchainBalance(
      owner,
      token
    );
    await exchangeTestUtil.exchange.withdrawFromDepositRequest(owner, token, index);
    const balanceAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    assert(
      balanceAfter.eq(balanceBefore.add(expectedAmount)),
      "Balance withdrawn in withdrawal mode incorrect"
    );
  };

  describe("Withdrawal Mode", function() {
    this.timeout(0);

    it("should go into withdrawal mode when a deposit request isn't processed", async () => {
      await createExchange(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE * 2
      );
      // Do a deposit
      await exchangeTestUtil.doRandomDeposit();
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE - 10
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(20);
      // We should be in withdrawal mode
      await checkWithdrawalMode(true);
    });

    it("should go into withdrawal mode when a withdrawal request isn't processed", async () => {
      await createExchange(true);
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
      // Do a deposit
      const deposit = await exchangeTestUtil.doRandomDeposit();
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Commit the deposits
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE * 2
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Do an on-chain withdrawal
      await exchangeTestUtil.doRandomOnchainWithdrawal(deposit);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE - 10
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(20);
      // We should be in withdrawal mode
      await checkWithdrawalMode(true);
    });

    it("should go into withdrawal mode when shutdown without reverting to initial state", async () => {
      await createExchange(false);
      // Do a deposit
      const deposit = await exchangeTestUtil.doRandomDeposit();
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_FORCED * 2
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);

      // Shut down the exchange
      await exchange.shutdown({ from: exchangeTestUtil.exchangeOwner });

      // Calculate the time the exchange can stay in shutdown
      const numAccounts = (await exchange.getNumAccounts()).toNumber();
      const timeUntilWithdrawalMode =
        exchangeTestUtil.MAX_TIME_IN_SHUTDOWN_BASE +
        exchangeTestUtil.MAX_TIME_IN_SHUTDOWN_DELTA * numAccounts;
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        timeUntilWithdrawalMode - 10
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(20);
      // We should be in withdrawal mode
      await checkWithdrawalMode(true);
    });

    it("ERC20: withdraw from merkle tree", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("7.1", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );
      const accountID = deposit.accountID;

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(owner, token),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        balance,
        "ETH",
        new BN(0),
        2
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // Try to withdraw with an incorrect proof
      const proof = await exchangeTestUtil.createMerkleTreeInclusionProof(
        owner,
        token
      );
      proof.balance = proof.balance.mul(new BN(2));
      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTreeWithProof(proof),
        "INVALID_MERKLE_TREE_DATA"
      );

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      await withdrawFromMerkleTreeChecked(owner, token, balance);
    });

    it("ETH: withdraw from merkle tree", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("1.7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");

      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(owner, token),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Do another deposit with the same amount to the account and process it in a block
      await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      // (Only the first deposit was submitted, so only that amount can be withdrawn from the Merkle tree)
      await withdrawFromMerkleTreeChecked(owner, token, balance);
    });

    it("Withdraw from merkle tree (protocol fee account)", async () => {
      await createExchange();

      const protocolFees = await exchange.getProtocolFeeValues();

      // Ring with ETH and ERC20
      const ring: SpotTrade = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      // Expected protocol fees earned
      const protocolFeeA = ring.orderA.amountB
        .mul(protocolFees.takerFeeBips)
        .div(new BN(100000));
      const protocolFeeB = ring.orderB.amountB
        .mul(protocolFees.makerFeeBips)
        .div(new BN(100000));

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(
          Constants.zeroAddress,
          ring.orderA.tokenB
        ),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawal(
        Constants.zeroAddress,
        ring.orderA.tokenB,
        protocolFeeA.mul(new BN(2)),
        "ETH",
        new BN(0),
        2
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      await withdrawFromMerkleTreeChecked(
        Constants.zeroAddress,
        ring.orderA.tokenB,
        protocolFeeA
      );
      await withdrawFromMerkleTreeChecked(
        Constants.zeroAddress,
        ring.orderB.tokenB,
        protocolFeeB
      );
    });

    it("Withdraw from deposit block", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];

      const tokenA = "LRC";
      const balanceA = new BN(web3.utils.toWei("2300.7", "ether"));
      const tokenB = "ETH";
      const balanceB = new BN(web3.utils.toWei("2.8", "ether"));
      const tokenC = "ETH";
      const balanceC = new BN(web3.utils.toWei("1.7", "ether"));
      const tokenD = "WETH";
      const balanceD = new BN(web3.utils.toWei("23.7", "ether"));

      const depositA = await exchangeTestUtil.deposit(
        owner,
        owner,
        tokenA,
        balanceA
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      const depositB = await exchangeTestUtil.deposit(
        owner,
        owner,
        tokenB,
        balanceB
      );

      await exchangeTestUtil.submitTransactions();

      const depositC = await exchangeTestUtil.deposit(
        owner,
        owner,
        tokenC,
        balanceC
      );

      await exchangeTestUtil.submitTransactions();

      const depositD = await exchangeTestUtil.deposit(
        owner,
        owner,
        tokenD,
        balanceD
      );

      await expectThrow(
        exchangeTestUtil.exchange.withdrawFromDepositRequest(depositA.owner, depositA.token, depositA.index),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // We should be in withdrawal mode and able to withdraw from the pending deposits
      await withdrawFromDepositRequestChecked(
        depositB.owner,
        depositB.token,
        depositB.index,
        balanceB
      );
      await withdrawFromDepositRequestChecked(
        depositC.owner,
        depositC.token,
        depositC.index,
        balanceC
      );
      await withdrawFromDepositRequestChecked(
        depositD.owner,
        depositD.token,
        depositD.index,
        balanceC
      );

      // Try to withdraw again
      await expectThrow(
        withdrawFromDepositRequestChecked(
          depositC.owner,
          depositC.token,
          depositC.index,
          balanceC
        ),
        "WITHDRAWN_ALREADY"
      );
    });

    it("Should not be able to do any more block state changes", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("7.1", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );
      const accountID = deposit.accountID;

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        balance,
        "ETH",
        new BN(0),
        2
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // Try to shutdown the exchange
      await expectThrow(
        exchange.shutdown({ from: exchangeTestUtil.exchangeOwner }),
        "INVALID_MODE"
      );

      // Try to submit a block
      const block: OnchainBlock = {
        blockType: 0,
        blockSize: 1,
        blockVersion: 0,
        data: Constants.emptyBytes,
        proof: [0, 0, 0, 0, 0, 0, 0, 0],
        offchainData: Constants.emptyBytes,
        auxiliaryData: Constants.emptyBytes
      };
      // Try to submit a block
      await expectThrow(
        exchange.submitBlocks([block], exchangeTestUtil.exchangeOperator, {
          from: exchangeTestUtil.exchangeOperator
        }),
        "INVALID_MODE"
      );
    });
  });
});
