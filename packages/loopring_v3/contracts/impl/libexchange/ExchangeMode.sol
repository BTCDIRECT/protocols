/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity 0.5.7;

import "../../lib/MathUint.sol";

import "./ExchangeData.sol";


/// @title IManagingMode.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeMode
{
    using MathUint  for uint;

    function isInWithdrawalMode(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool result)
    {
        result = false;
        ExchangeData.Block storage currentBlock = S.blocks[S.blocks.length - 1];

        // Check if there's a deposit request that's too old
        if (currentBlock.numDepositRequestsCommitted < S.depositChain.length) {
            uint32 requestTimestamp = S.depositChain[currentBlock.numDepositRequestsCommitted].timestamp;

            result = requestTimestamp < now.sub(ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE());
        }

        // Check if there's a withdrawal request that's too old
        if (result == false && currentBlock.numWithdrawalRequestsCommitted < S.withdrawalChain.length) {
            uint32 requestTimestamp = S.withdrawalChain[currentBlock.numWithdrawalRequestsCommitted].timestamp;

            result = requestTimestamp < now.sub(ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE());
        }

        // Check if there's an unfinalized block that's too old
        if (result == false) {
            result = isAnyUnfinalizedBlockTooOld(S);
        }

        // Check if we're longer in a non-initial state while shutdown than allowed
        if (result == false && isShutdown(S) && !isInInitialState(S)) {
            // The max amount of time an exchange can be in shutdown is
            // MAX_TIME_IN_SHUTDOWN_BASE + (accounts.length * MAX_TIME_IN_SHUTDOWN_DELTA)
            uint maxTimeInShutdown = ExchangeData.MAX_TIME_IN_SHUTDOWN_BASE();
            maxTimeInShutdown = maxTimeInShutdown.add(S.accounts.length.mul(ExchangeData.MAX_TIME_IN_SHUTDOWN_DELTA()));
            result = now > S.shutdownStartTime.add(maxTimeInShutdown);
        }
    }

    function isShutdown(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        return S.shutdownStartTime > 0;
    }

    function isInInitialState(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        ExchangeData.Block storage firstBlock = S.blocks[0];
        ExchangeData.Block storage lastBlock = S.blocks[S.blocks.length - 1];
        return (lastBlock.state == ExchangeData.BlockState.FINALIZED) &&
            (lastBlock.numDepositRequestsCommitted == S.depositChain.length) &&
            (lastBlock.merkleRoot == firstBlock.merkleRoot);
    }

    function areUserRequestsEnabled(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        // Users requests are possible when the exchange is not in maintenance mode
        // and the exchange hasn't been shutdown
        return (now >= S.disableUserRequestsUntil) && !isShutdown(S);
    }

    function isAnyUnfinalizedBlockTooOld(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        if (S.numBlocksFinalized < S.blocks.length) {
            uint32 blockTimestamp = S.blocks[S.numBlocksFinalized].timestamp;
            return blockTimestamp < now.sub(ExchangeData.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE());
        } else {
            return false;
        }
    }
}