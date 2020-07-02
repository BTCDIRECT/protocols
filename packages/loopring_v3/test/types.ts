import BN = require("bn.js");
import { BlockType, Signature } from "loopringV3.js";

export interface OrderInfo {
  owner?: string;
  tokenS?: string;
  tokenB?: string;
  amountS: BN;
  amountB: BN;

  exchangeID?: number;
  accountID?: number;
  orderID?: number;

  tokenIdS?: number;
  tokenIdB?: number;

  allOrNone?: boolean;
  validSince?: number;
  validUntil?: number;
  maxFeeBips?: number;
  buy?: boolean;

  feeBips?: number;
  rebateBips?: number;

  transferAmountTrade?: BN;
  reduceOnly?: boolean;
  triggerPrice?: BN;

  transferAmount?: BN;
  transferFee?: BN;

  balanceS?: BN;
  balanceB?: BN;

  hash?: string;
  signature?: Signature;

  [key: string]: any;
}

export interface OrderExpectation {
  filledFraction: number;
  spread?: BN;
}

export interface RingExpectation {
  orderA?: OrderExpectation;
  orderB?: OrderExpectation;
}

// Transactions

export interface Noop {
  txType?: "Noop";
}

export interface SpotTrade {
  txType?: "SpotTrade";

  orderA: OrderInfo;
  orderB: OrderInfo;

  tokenID?: number;
  fee?: BN;

  expected?: RingExpectation;
}

export interface Deposit {
  txType?: "Deposit";
  owner: string;
  accountID: number;
  tokenID: number;
  amount: BN;
  index: BN;

  fee: BN;
  token: string;
  timestamp?: number;
  transactionHash?: string;
}

export interface PublicKeyUpdate {
  txType?: "PublicKeyUpdate";
  owner: string;
  accountID: number;
  nonce: number;
  publicKeyX: string;
  publicKeyY: string;
  walletHash: string;
  feeTokenID: number;
  fee: BN;

  onchainSignature?: any;
}

export class Transfer {
  txType?: "Transfer";

  type: number;

  accountFromID: number;
  accountToID: number;

  tokenID: number;
  amount: BN;

  feeTokenID: number;
  fee: BN;

  ownerFrom: string;
  ownerTo: string;

  validUntil: number;

  dualAuthorX: string;
  dualAuthorY: string;
  payerAccountToID: number;
  payerOwnerTo: string;
  payeeAccountToID: number;

  nonce: number;

  dualSecretKey?: string;

  signature?: Signature;
  dualSignature?: Signature;

  onchainSignature?: any;
}

export interface WithdrawalRequest {
  txType?: "Withdraw";

  type: number;

  owner: string;
  accountID: number;
  nonce: number;
  tokenID: number;
  amount: BN;

  feeTokenID?: number;
  fee?: BN;

  to: string;

  withdrawalFee?: BN;

  signature?: Signature;
  onchainSignature?: any;

  timestamp?: number;
  transactionHash?: string;
}

export interface NewAccount {
  txType?: "NewAccount";
  payerAccountID: number;
  feeTokenID: number;
  fee: BN;
  nonce: number;

  newAccountID: number;
  newOwner: string;
  newPublicKeyX: string;
  newPublicKeyY: string;
  newWalletHash: string;

  signature?: any;
}

export interface OwnerChange {
  txType?: "OwnerChange";
  owner: string;
  accountID: number;
  feeTokenID: number;
  fee: BN;
  nonce: number;
  walletHash: string;
  newOwner: string;
  walletAddress: string;
  walletDataHash: string;
  walletCalldata: string;

  onchainSignatureOldOwner?: any;
  onchainSignatureNewOwner?: any;
}

// Blocks

export interface TxBlock {
  transactions: any[];
  protocolTakerFeeBips?: number;
  protocolMakerFeeBips?: number;

  onchainDataAvailability?: boolean;
  timestamp?: number;
  exchangeID?: number;
  operatorAccountID?: number;

  signature?: Signature;
}

export interface Block {
  blockIdx: number;
  filename: string;
  blockType: BlockType;
  blockSize: number;
  blockVersion: number;
  operator: string;
  origin: string;
  operatorId: number;
  merkleRoot: string;
  data: string;
  auxiliaryData: string;
  offchainData: string;
  compressedData: string;
  publicDataHash: string;
  publicInput: string;
  proof?: string[];
  blockFeeRewarded?: BN;
  blockFeeFined?: BN;
  timestamp: number;
  transactionHash: string;
  internalBlock: TxBlock;
  shutdown?: boolean;
}

export interface Account {
  accountID: number;
  owner: string;
  publicKeyX: string;
  publicKeyY: string;
  secretKey: string;
  wallet?: Wallet;
  nonce: number;
}

// Wallet

export interface Guardian {
  addr: string;
  group: number;
}

export interface Wallet {
  accountID: number;
  guardians: Guardian[];
  inheritor: string;
  inheritableSince: number;
}

export interface PermissionData {
  signers: string[];
  signatures: string[];
}