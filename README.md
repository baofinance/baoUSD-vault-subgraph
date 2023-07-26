# baoUSD Vault Subgraph
Subgraph for [baoUSD Vault](https://app.baofinance.io/).

This is a fork of the [Compound V2 Subgraph](https://github.com/compound-finance/compound-v2-subgraph) with updated addresses and ABIs.

## Deployments

| Network | URL                                                                        |
|---------|----------------------------------------------------------------------------|
| Mainnet | https://thegraph.com/hosted-service/subgraph/baofinance/baousd-vault-subgraph	       |

You can also run this subgraph locally, if you wish. Instructions for that can be found in [The Graph Documentation](https://thegraph.com/docs/quick-start).

## Querying Liquidable Positions

The following subgraph query will return all users that have interacted with the protocol as well as the markets that the users have interacted with.

```
{
    accounts{
      id
      tokens{
        id
        enteredMarket
        cTokenBalance
        storedBorrowBalance
      }
    }
    markets{
      id
      underlyingAddress
      underlyingDecimals
    }
  }
```
A bot can utilize the resulting list to query the accounts health with the comptroller method `getAccountLiquidity()`. 
For those interested in creating their own App/Bot, using the Bao Markets subgraph, we recommend the following resources:

An examplary implementation of a [liquidation Bot](https://github.com/baofinance/bao-liquidator-bot).

TheGraph documentation [Querying from an Application](https://thegraph.com/docs/en/developer/querying-from-your-app/).
