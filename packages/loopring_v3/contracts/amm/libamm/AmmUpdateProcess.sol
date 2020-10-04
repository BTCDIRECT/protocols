// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/transactions/TransactionReader.sol";
import "../../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "./AmmData.sol";


/// @title AmmUpdateProcess
library AmmUpdateProcess
{
    using TransactionReader for ExchangeData.Block;

    function approveAmmUpdates(
        AmmData.State      storage S,
        ExchangeData.Block memory  _block,
        AmmData.Context    memory  ctx,
        bool                       opening
        )
        internal
    {
        for (uint i = 0; i < ctx.size; i++) {
            // Check that the AMM update in the block matches the expected update
            AmmUpdateTransaction.AmmUpdate memory update = _block.readAmmUpdate(ctx.txIdx++);

            require(update.owner == address(this), "INVALID_TX_DATA");
            require(update.accountID == ctx.accountID, "INVALID_TX_DATA");
            require(update.tokenID == ctx.tokens[i].tokenID, "INVALID_TX_DATA");
            require(update.feeBips == S.feeBips, "INVALID_TX_DATA");
            require(update.tokenWeight == (opening ? 0 : ctx.tokens[i].weight), "INVALID_TX_DATA");

            // Now approve this AMM update
            update.validUntil = 0xffffffff;
            bytes32 txHash = AmmUpdateTransaction.hashTx(ctx.exchangeDomainSeparator, update);
            ctx.exchange.approveTransaction(address(this), txHash);

            if (opening) {
                ctx.tokenBalancesL2[i] = update.balance;
            } else {
                require(ctx.tokenBalancesL2[i] == update.balance, "UNEXPECTED_AMM_BALANCE");
            }
        }
    }
}
