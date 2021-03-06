// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/MathUint.sol";
import "../lib/OwnerManagable.sol";

import "../iface/PriceOracle.sol";

import "../base/DataStore.sol";


/// @title PriceCacheStore
contract PriceCacheStore is DataStore, PriceOracle, OwnerManagable
{
    using MathUint for uint;

    PriceOracle oracle;
    uint expiry;

    event PriceCached (
        address token,
        uint    amount,
        uint    value,
        uint    timestamp
    );

    struct TokenPrice
    {
        uint amount;
        uint value;
        uint timestamp;
    }

    mapping (address => TokenPrice) prices;

    constructor(
        PriceOracle _oracle,
        uint        _expiry
        )
        DataStore()
    {
        oracle = _oracle;
        expiry = _expiry;
    }

    function tokenValue(address token, uint amount)
        public
        view
        override
        returns (uint)
    {
        TokenPrice storage tp = prices[token];
        if (tp.timestamp > 0 && block.timestamp < tp.timestamp + expiry) {
            return tp.value.mul(amount) / tp.amount;
        } else {
            return 0;
        }
    }

    function updateTokenPrice(
        address token,
        uint    amount
        )
        external
        onlyManager
    {
        uint value = oracle.tokenValue(token, amount);
        if (value > 0) {
            cacheTokenPrice(token, amount, value);
        }
    }

    function setTokenPrice(
        address token,
        uint    amount,
        uint    value
        )
        external
        onlyManager
    {
        cacheTokenPrice(token, amount, value);
    }

    function setOracle(PriceOracle _oracle)
        external
        onlyManager
    {
        oracle = _oracle;
    }

    function cacheTokenPrice(
        address token,
        uint    amount,
        uint    value
        )
        internal
    {
        prices[token].amount = amount;
        prices[token].value = value;
        prices[token].timestamp = block.timestamp;
        emit PriceCached(token, amount, value, block.timestamp);
    }
}
