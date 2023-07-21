/* eslint-disable prefer-const */ // to satisfy AS compiler

// For each division by 10, add one to exponent to truncate one significant figure
import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts/index'
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

let cUSDCAddress = '0x7749f9f3206A49d4c47b60db05716409dC3A4149'
let cETHAddress = '0xF635fdF9B36b557bD281aa02fdfaeBEc04CD084A'
let cETHAddressArchived = '0xe7a52262C1934951207c5fc7A944A82D283C83e5'
let daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

// Used for all cERC20 contracts
function getTokenPrice(
  blockNumber: i32,
  eventAddress: Address,
  underlyingAddress: Address,
  underlyingDecimals: i32,
): BigDecimal {
  let comptroller = Comptroller.load('1')

  if (comptroller !== null) {
    let oracleAddress = changetype<Address>(comptroller.priceOracle)
    let underlyingPrice: BigDecimal
    let priceOracle1Address = Address.fromString(
      '0xEbdC2D2a203c17895Be0daCdf539eeFC710eaFd8',
    )

    let mantissaDecimalFactor = 18 - underlyingDecimals + 18
    let bdFactor = exponentToBigDecimal(mantissaDecimalFactor)
    let oracle2 = PriceOracle2.bind(oracleAddress)
    underlyingPrice = oracle2
      .getUnderlyingPrice(eventAddress)
      .toBigDecimal()
      .div(bdFactor)
    return underlyingPrice
  } else {
    throw new Error('Comptroller does not exist.')
  }
}

// Returns the price of USDC in eth. i.e. 0.005 would mean ETH is $200
function getUSDCpriceETH(blockNumber: i32): BigDecimal {
  let comptroller = Comptroller.load('1')

  if (comptroller !== null) {
    let oracleAddress = changetype<Address>(comptroller.priceOracle)
    let priceOracle1Address = Address.fromString(
      '0xEbdC2D2a203c17895Be0daCdf539eeFC710eaFd8',
    )
    let USDCAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    let usdPrice: BigDecimal

    // See notes on block number if statement in getTokenPrices()
    if (blockNumber > 7715908) {
      let oracle2 = PriceOracle2.bind(oracleAddress)
      let mantissaDecimalFactorUSDC = 18 - 6 + 18
      let bdFactorUSDC = exponentToBigDecimal(mantissaDecimalFactorUSDC)
      usdPrice = oracle2
        .getUnderlyingPrice(Address.fromString(cUSDCAddress))
        .toBigDecimal()
        .div(bdFactorUSDC)
    } else {
      let oracle1 = PriceOracle.bind(priceOracle1Address)
      usdPrice = oracle1
        .getUnderlyingPrice(Address.fromString(USDCAddress))
        .toBigDecimal()
        .div(mantissaFactorBD)
    }
    return usdPrice
  } else {
    throw new Error('Comptroller does not exist.')
  }
}

export function createMarket(marketAddress: string): Market {
  let market: Market
  let contract = CToken.bind(Address.fromString(marketAddress))

  // It is CETH, which has a slightly different interface
  if (marketAddress == cETHAddress || marketAddress == cETHAddressArchived) {
    market = new Market(marketAddress)
    market.underlyingAddress = Address.fromString(
      '0x0000000000000000000000000000000000000000',
    )
    market.underlyingDecimals = 18
    market.underlyingPrice = BigDecimal.fromString('1')
    market.underlyingName = 'Ether'
    market.underlyingSymbol = 'ETH'

    // It is all other CERC20 contracts
  } else {
    market = new Market(marketAddress)
    let underlyingAddress = contract.try_underlying()
    if (underlyingAddress.reverted) {
      log.info('***CALL FAILED*** : contract.try_underlying', [])
    } else {
      market.underlyingAddress = underlyingAddress.value
      let underlyingContract = ERC20.bind(changetype<Address>(market.underlyingAddress))
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
    }
  }

  market.borrowRate = zeroBD
  market.cash = zeroBD
  market.collateralFactor = zeroBD
  market.exchangeRate = zeroBD
  market.interestRateModelAddress = Address.fromString(
    '0x0000000000000000000000000000000000000000',
  )
  let name = contract.try_name()
  if (name.reverted) {
    log.info('***CALL FAILED*** : market.name', [])
  } else {
    market.name = name.value
  }
  market.numberOfBorrowers = 0
  market.numberOfSuppliers = 0
  market.reserves = zeroBD
  market.supplyRate = zeroBD
  let symbol = contract.try_symbol()
  if (symbol.reverted) {
    log.info('***CALL FAILED*** : market.name', [])
  } else {
    market.symbol = symbol.value
  }
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
    if (market.id == cETHAddress || market.id == cETHAddressArchived) {
      market.underlyingPriceUSD = market.underlyingPrice
        .div(usdPriceInEth)
        .truncate(market.underlyingDecimals)
    } else {
      let tokenPriceEth = getTokenPrice(
        blockNumber,
        contractAddress,
        changetype<Address>(market.underlyingAddress),
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

    let accrualBlockNumber = contract.try_accrualBlockNumber()
    if (accrualBlockNumber.reverted) {
      log.info('***CALL FAILED*** market.name', [])
    } else {
      market.accrualBlockNumber = accrualBlockNumber.value.toI32()
    }  
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
    } else {
      market.borrowRate = contract
        .try_supplyRatePerBlock()
        .value.toBigDecimal()
        .times(BigDecimal.fromString('2102400'))
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)
    }
    market.save()
  }
  return changetype<Market>(market)
}
