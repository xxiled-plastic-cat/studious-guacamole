import type { Account, gtxn, uint64 } from '@algorandfoundation/algorand-typescript'
import {
  abimethod,
  assertMatch,
  Asset,
  contract,
  Contract,
  Global,
  GlobalState,
  itxn,
} from '@algorandfoundation/algorand-typescript'
import { StaticArray } from '@algorandfoundation/algorand-typescript/arc4/encoded-types'

@contract({ name: 'weLend', avmVersion: 11 })
export class WeLend extends Contract {
  // The main lending token of this contract - used for deposit and borrowing
  base_token_id = GlobalState<Asset>({ initialValue: Asset() })

  // The collateral token of this contract - used for collateral
  collateral_token_ids = GlobalState<StaticArray<Asset, 100>>()

  // LST token of this contract - used for borrowing - generated in the contract at creation time
  lst_token_id = GlobalState<Asset>({ initialValue: Asset() })

  //Admin account
  admin_account = GlobalState<Account>()

  ltv_bps = GlobalState<uint64>()

  liq_threshold_bps = GlobalState<uint64>()

  interest_bps = GlobalState<uint64>()

  origination_fee_bps = GlobalState<uint64>()

  @abimethod({ allowActions: 'NoOp', onCreate: 'require' })
  public createApplication(admin: Account, baseTokenId: Asset, collateralTokenIds: StaticArray<Asset, 100>): void {
    this.admin_account.value = admin
    this.base_token_id.value = baseTokenId
    this.collateral_token_ids.value = collateralTokenIds
  }

  @abimethod({ allowActions: 'NoOp' })
  public initApplication(
    mbrTxn: gtxn.PaymentTxn,
    ltv_bps: uint64,
    liq_threshold_bps: uint64,
    interest_bps: uint64,
    origination_fee_bps: uint64,
  ): void {
    assertMatch(mbrTxn, {
      sender: this.admin_account.value,
      amount: 1000 + this.collateral_token_ids.value.length * 11000 + 30000,
    })

    this.ltv_bps.value = ltv_bps
    this.liq_threshold_bps.value = liq_threshold_bps
    this.interest_bps.value = interest_bps
    this.origination_fee_bps.value = origination_fee_bps

    /// Submit opt-in transaction: 0 asset transfer to self§
    itxn
      .assetTransfer({
        assetReceiver: Global.currentApplicationAddress,
        xferAsset: this.base_token_id.value,
        assetAmount: 0,
      })
      .submit()

    //opt into collateral tokens
    for (let i = 0; i < this.collateral_token_ids.value.length; i++) {
      itxn
        .assetTransfer({
          assetReceiver: Global.currentApplicationAddress,
          xferAsset: this.collateral_token_ids.value[i],
          assetAmount: 0,
        })
        .submit()
    }

    const result = itxn
      .assetConfig({
        sender: Global.currentApplicationAddress,
        total: this.base_token_id.value.total,
        decimals: this.base_token_id.value.decimals,
        defaultFrozen: false,
        manager: Global.currentApplicationAddress,
        unitName: 'c' + this.base_token_id.value.unitName,
      })
      .submit()
    this.lst_token_id.value = result.configAsset
  }
}
