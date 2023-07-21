/* eslint-disable prefer-const */ // to satisfy AS compiler

import { BigDecimal } from '@graphprotocol/graph-ts'
import {
  MarketEntered,
  MarketExited,
  NewCloseFactor,
  NewCollateralFactor,
  NewLiquidationIncentive,
  NewMaxAssets,
  NewPriceOracle,
} from '../types/Comptroller/Comptroller'

import { Comptroller, Market } from '../types/schema'
import { mantissaFactorBD, updateCommonCTokenStats } from './helpers'

export function handleMarketEntered(event: MarketEntered): void {
  let market = Market.load(event.params.cToken.toHexString())

  if (market !== null) {
    let accountID = event.params.account.toHex()
    let cTokenStats = updateCommonCTokenStats(
      market.id,
      market.symbol,
      accountID,
      event.transaction.hash,
      event.block.timestamp.toI32(),
      event.block.number.toI32(),
    )
    cTokenStats.enteredMarket = true
    cTokenStats.save()
  } else {
    market = new Market(event.params.cToken.toHexString()) // Create a new market entity
    market.save()
  }
}

export function handleMarketExited(event: MarketExited): void {
  let market = Market.load(event.params.cToken.toHexString())

  if (market !== null) {
    let accountID = event.params.account.toHex()
    let cTokenStats = updateCommonCTokenStats(
      market.id,
      market.symbol,
      accountID,
      event.transaction.hash,
      event.block.timestamp.toI32(),
      event.block.number.toI32(),
    )
    cTokenStats.enteredMarket = false
    cTokenStats.save()
  } else {
    throw new Error('Market not found')
  }
}

export function handleNewCloseFactor(event: NewCloseFactor): void {
  let comptroller = Comptroller.load('1')

  if (comptroller !== null) {
    comptroller.closeFactor = event.params.newCloseFactorMantissa
    comptroller.save()
  } else {
    throw new Error('Comptroller does not exist.')
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
    throw new Error('Market does not exist.')
  }
}

// This should be the first event acccording to etherscan but it isn't.... price oracle is. weird
export function handleNewLiquidationIncentive(event: NewLiquidationIncentive): void {
  let comptroller = Comptroller.load('1')

  if (comptroller !== null) {
    comptroller.liquidationIncentive = event.params.newLiquidationIncentiveMantissa
    comptroller.save()
  } else {
    throw new Error('Comptroller does not exist.')
  }
}

export function handleNewMaxAssets(event: NewMaxAssets): void {
  let comptroller = Comptroller.load('1')

  if (comptroller !== null) {
    comptroller.maxAssets = event.params.newMaxAssets
    comptroller.save()
  } else {
    throw new Error('Comptroller does not exist.')
  }
}

export function handleNewPriceOracle(event: NewPriceOracle): void {
  let comptroller = Comptroller.load('1')

  // This is the first event used in this mapping, so we use it to create the entity
  if (comptroller !== null) {
    comptroller.priceOracle = event.params.newPriceOracle
    comptroller.save()
  } else {
    comptroller = new Comptroller('1')
  }
}
