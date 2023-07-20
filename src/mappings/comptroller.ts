/* eslint-disable prefer-const */ // to satisfy AS compiler

import {
  MarketEntered,
  MarketExited,
  NewCloseFactor,
  NewCollateralFactor,
  NewLiquidationIncentive,
  NewMaxAssets,
  NewPriceOracle,
} from '../types/Comptroller/Comptroller'

import { Market, Comptroller } from '../types/schema'
import { mantissaFactorBD, updateCommonCTokenStats } from './helpers'

export function handleMarketEntered(event: MarketEntered): void {
  let market = Market.load(event.params.cToken.toHexString())
  if (market === null) {
    // handle the case when market is null
    // for example, you can log an error or throw an exception
    throw new Error('Market not found')
  }

  let accountID = event.params.account.toHex()
  let cTokenStats = updateCommonCTokenStats(
    market.id,
    market.symbol,
    accountID,
    event.transaction.hash,
    event.block.timestamp.toI32(),
    event.block.number.toI32(),
  )
  if (cTokenStats === null) {
    // handle the case when cTokenStats is null
    // for example, you can log an error or throw an exception
    throw new Error('CTokenStats not found')
  }

  cTokenStats.enteredMarket = true
  cTokenStats.save()
}

export function handleMarketExited(event: MarketExited): void {
  let market = Market.load(event.params.cToken.toHexString())
  if (market === null) {
    // handle the case when market is null
    // for example, you can log an error or throw an exception
    throw new Error('Market not found')
  }

  let accountID = event.params.account.toHex()
  let cTokenStats = updateCommonCTokenStats(
    market.id,
    market.symbol,
    accountID,
    event.transaction.hash,
    event.block.timestamp.toI32(),
    event.block.number.toI32(),
  )

  if (cTokenStats === null) {
    // handle the case when cTokenStats is null
    // for example, you can log an error or throw an exception
    throw new Error('CTokenStats not found')
  }

  cTokenStats.enteredMarket = false
  cTokenStats.save()
}

export function handleNewCloseFactor(event: NewCloseFactor): void {
  let comptroller = Comptroller.load('1')

  if (comptroller !== null) {
    comptroller.closeFactor = event.params.newCloseFactorMantissa
    comptroller.save()
  } else {
    // handle the case when comptroller is null
    // for example, you can log an error or throw an exception
    throw new Error('Comptroller not found')
  }
}

export function handleNewCollateralFactor(event: NewCollateralFactor): void {
  let market = Market.load(event.params.cToken.toHexString())
  if (market !== null) {
    market.collateralFactor = event.params.newCollateralFactorMantissa
      .toBigDecimal()
      .div(mantissaFactorBD)
    market.save()
  } else {
    // handle the case when market is null
    // for example, you can log an error or throw an exception
    throw new Error('Market not found')
  }
}

// This should be the first event acccording to etherscan but it isn't.... price oracle is. weird
export function handleNewLiquidationIncentive(event: NewLiquidationIncentive): void {
  let comptroller = Comptroller.load('1')

  if (comptroller !== null) {
    comptroller.liquidationIncentive = event.params.newLiquidationIncentiveMantissa
    comptroller.save()
  } else {
    // handle the case when comptroller is null
    // for example, you can log an error or throw an exception
    throw new Error('Comptroller not found')
  }
}

export function handleNewMaxAssets(event: NewMaxAssets): void {
  let comptroller = Comptroller.load('1')
  if (comptroller === null) {
    // handle the case when comptroller is null
    // for example, you can log an error or throw an exception
    throw new Error('Comptroller not found')
  }

  comptroller.maxAssets = event.params.newMaxAssets
  comptroller.save()
}

export function handleNewPriceOracle(event: NewPriceOracle): void {
  let comptroller = Comptroller.load('1')
  if (comptroller === null) {
    comptroller = new Comptroller('1')
  }

  if (event.params.newPriceOracle === null) {
    // handle the case when newPriceOracle is null
    // for example, you can log an error or throw an exception
    throw new Error('New Price Oracle is null')
  }

  comptroller.priceOracle = event.params.newPriceOracle
  comptroller.save()
}
