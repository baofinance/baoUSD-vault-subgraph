/* eslint-disable prefer-const */ // to satisfy AS compiler

// For each division by 10, add one to exponent to truncate one significant figure
import { Address, BigDecimal, BigInt, Bytes, log } from '@graphprotocol/graph-ts/index'
import { Comptroller, Market } from '../types/schema'
// PriceOracle is valid from Comptroller deployment until block 8498421
import { PriceOracle } from '../types/bdUSD/PriceOracle'
// PriceOracle2 is valid from 8498422 until present block (until another proxy upgrade)
import { CToken } from '../types/bdUSD/CToken'
import { ERC20 } from '../types/bdUSD/ERC20'
import { PriceOracle2 } from '../types/bdUSD/PriceOracle2'

import {
  cTokenDecimalsBD,
  exponentToBigDecimal,
  mantissaFactor,
  mantissaFactorBD,
  zeroBD,
} from './helpers'

let cUSDCAddress = '0xcaad85c5a9f31c679742ea6f8654c3b53b4c6d7d'
let cETHAddress = '0xd4e71a9d982b74110cc3307d7d296927b3afbbdc'
let daiAddress = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'

// Used for all cERC20 contracts
function getTokenPrice(
  blockNumber: i32,
  eventAddress: Address,
  underlyingAddress: Address,
  underlyingDecimals: i32,
): BigDecimal {
  let comptroller = Comptroller.load('1')
  if (comptroller == null) {
    throw new Error("Comptroller does not exist.");
  }
  
  let oracleAddress = comptroller.priceOracle as Address
  let underlyingPrice: BigDecimal

  let mantissaDecimalFactor = 18 - underlyingDecimals + 18
  let bdFactor = exponentToBigDecimal(mantissaDecimalFactor)
  let oracle2 = PriceOracle2.bind(oracleAddress)
  underlyingPrice = oracle2
    .getUnderlyingPrice(eventAddress)
    .toBigDecimal()
    .div(bdFactor)
  return underlyingPrice
}

// Returns the price of USDC in eth. i.e. 0.005 would mean ETH is $200
function getUSDCpriceETH(blockNumber: i32): BigDecimal {
  let comptroller = Comptroller.load('1')
  if (comptroller == null) {
    throw new Error("Comptroller does not exist.");
  }
  let oracleAddress = comptroller.priceOracle as Address
  let priceOracle1Address = Address.fromString(
    '0xebdc2d2a203c17895be0dacdf539eefc710eafd8',
  )
  let USDCAddress = '0x1c648c939578a4da0d7fb2384ddb3fce9439d28d'
  let usdPrice: BigDecimal

  // See notes on block number if statement in getTokenPrices()
  if (blockNumber > 7715908) {
    let oracle2 = PriceOracle2.bind(oracleAddress)
    let mantissaDecimalFactorUSDC = 18 - 6 + 18
    let bdFactorUSDC = exponentToBigDecimal(mantissaDecimalFactorUSDC)
    usdPrice = oracle2
      .getUnderlyingPrice(Address.fromString(USDCAddress))
      .toBigDecimal()
      .div(bdFactorUSDC)
  } else {
    let oracle1 = PriceOracle.bind(priceOracle1Address)
    let mantissaFactorBD = exponentToBigDecimal(18)
    usdPrice = oracle1
      .getUnderlyingPrice(Address.fromString(USDCAddress))
      .toBigDecimal()
      .div(mantissaFactorBD)
  }

  return usdPrice
}

export function createMarket(marketAddress: string): Market {
  let market: Market
  let contract = CToken.bind(Address.fromString(marketAddress))

  if (marketAddress == cETHAddress) {
    market = new Market(marketAddress)
    market.underlyingAddress = Address.fromString(
      '0x0000000000000000000000000000000000000000',
    )
    market.underlyingDecimals = 18
    market.underlyingPrice = BigDecimal.fromString('1')
    market.underlyingName = 'Ether'
    market.underlyingSymbol = 'ETH'
  } else {
    market = new Market(marketAddress)
    let underlyingResult = contract.try_underlying()

    if (!underlyingResult.reverted) {
      market.underlyingAddress = underlyingResult.value
      let underlyingContract = ERC20.bind(
        Address.fromBytes(
          Address.fromHexString(market.underlyingAddress.toHexString()) as Bytes,
        ) as Address,
      )

      market.underlyingDecimals = underlyingContract.decimals()

      if (market.underlyingAddress.toHexString() != daiAddress) {
        market.underlyingName = underlyingContract.name()
        market.underlyingSymbol = underlyingContract.symbol()
      } else {
        market.underlyingName = 'Dai Stablecoin v1.0 (DAI)'
        market.underlyingSymbol = 'DAI'
      }

      if (marketAddress == cUSDCAddress) {
        market.underlyingPriceUSD = BigDecimal.fromString('1')
      }
    } else {
      log.info('***CALL REVERTED*** : Comptroller createMarket() reverted', [])
    }
  }

  market.borrowRate = zeroBD
  market.cash = zeroBD
  market.collateralFactor = zeroBD
  market.exchangeRate = zeroBD
  market.interestRateModelAddress = Address.fromString(
    '0x0000000000000000000000000000000000000000',
  )
  market.name = contract.try_name().value
  market.numberOfBorrowers = 0
  market.numberOfSuppliers = 0
  market.reserves = zeroBD
  market.supplyRate = zeroBD
  market.symbol = contract.try_symbol().value
  market.totalBorrows = zeroBD
  market.totalSupply = zeroBD
  market.underlyingPrice = zeroBD
  market.accrualBlockNumber = 0
  market.blockTimestamp = 0
  market.borrowIndex = zeroBD
  market.reserveFactor = BigInt.fromI32(0)
  market.underlyingPriceUSD = zeroBD

  return market
}

export function updateMarket(
  marketAddress: Address,
  blockNumber: i32,
  blockTimestamp: i32,
): Market {
  let marketID = marketAddress.toHexString()
  let market = Market.load(marketID)
  if (market == null) {
    market = createMarket(marketID)
  }

  // Only updateMarket if it has not been updated this block
  if (market.accrualBlockNumber != blockNumber) {
    let contractAddress = Address.fromString(market.id)
    let contract = CToken.bind(contractAddress)
    let usdPriceInEth = getUSDCpriceETH(blockNumber)

    // if cETH, we only update USD price
    if (market.id == cETHAddress) {
      market.underlyingPriceUSD = market.underlyingPrice
        .div(usdPriceInEth)
        .truncate(market.underlyingDecimals)
    } else {
      let tokenPriceEth = getTokenPrice(
        blockNumber,
        contractAddress,
        market.underlyingAddress as Address,
        market.underlyingDecimals,
      )
      market.underlyingPrice = tokenPriceEth.truncate(market.underlyingDecimals)
      // if USDC, we only update ETH price
      if (market.id != cUSDCAddress) {
        market.underlyingPriceUSD = market.underlyingPrice
          .div(usdPriceInEth)
          .truncate(market.underlyingDecimals)
      }
    }

    market.accrualBlockNumber = contract.try_accrualBlockNumber().value.toI32()
    market.blockTimestamp = blockTimestamp
    market.totalSupply = contract
      .totalSupply()
      .toBigDecimal()
      .div(cTokenDecimalsBD)

    /* Exchange rate explanation
       In Practice
        - If you call the cDAI contract on etherscan it comes back (2.0 * 10^26)
        - If you call the cUSDC contract on etherscan it comes back (2.0 * 10^14)
        - The real value is ~0.02. So cDAI is off by 10^28, and cUSDC 10^16
       How to calculate for tokens with different decimals
        - Must div by tokenDecimals, 10^market.underlyingDecimals
        - Must multiply by ctokenDecimals, 10^8
        - Must div by mantissa, 10^18
     */
    market.exchangeRate = contract
      .exchangeRateStored()
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals))
      .times(cTokenDecimalsBD)
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)
    market.borrowIndex = contract
      .borrowIndex()
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)

    market.reserves = contract
      .totalReserves()
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals))
      .truncate(market.underlyingDecimals)
    market.totalBorrows = contract
      .totalBorrows()
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals))
      .truncate(market.underlyingDecimals)
    market.cash = contract
      .getCash()
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals))
      .truncate(market.underlyingDecimals)

    // Must convert to BigDecimal, and remove 10^18 that is used for Exp in Compound Solidity
    market.supplyRate = contract
      .borrowRatePerBlock()
      .toBigDecimal()
      .times(BigDecimal.fromString('2102400'))
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)

    // This fails on only the first call to cZRX. It is unclear why, but otherwise it works.
    // So we handle it like this.
    let supplyRatePerBlock = contract.try_supplyRatePerBlock()
    if (supplyRatePerBlock.reverted) {
      log.info('***CALL FAILED*** : cERC20 supplyRatePerBlock() reverted', [])
      market.borrowRate = zeroBD
    } else {
      market.borrowRate = supplyRatePerBlock.value
        .toBigDecimal()
        .times(BigDecimal.fromString('2102400'))
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)
    }
    market.save()
  }
  return market as Market
}
