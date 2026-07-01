#![no_std]

use soroban_sdk::{contract, contractimpl, token, Address, Env};

/// Spike contract — proves the SAC allowance pull pattern.
///
/// Flow:
///   1. Subscriber calls SAC `approve(subscriber, THIS_CONTRACT, cap, expiry)`.
///   2. Invoker (merchant) calls `charge` — no new subscriber signature required.
///   3. Contract calls `transfer_from(this, subscriber, merchant, amount)` as the
///      authorized spender; the SAC enforces the cap.
///
/// If this test passes on testnet, the StellarPay subscription model works.
#[contract]
pub struct SpikeContract;

#[contractimpl]
impl SpikeContract {
    /// Pull `amount` from `subscriber` → `merchant` using the pre-approved SAC allowance.
    /// `invoker` must be the merchant (or any trusted caller); subscriber does NOT sign.
    pub fn charge(
        env: Env,
        invoker: Address,
        asset: Address,
        subscriber: Address,
        merchant: Address,
        amount: i128,
    ) {
        invoker.require_auth();

        let token = token::Client::new(&env, &asset);

        // This call succeeds because subscriber previously approved this contract as spender.
        // The SAC deducts `amount` from the allowance; no subscriber auth required here.
        token.transfer_from(
            &env.current_contract_address(),
            &subscriber,
            &merchant,
            &amount,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env,
    };

    fn setup() -> (Env, Address, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);
        let subscriber = Address::generate(&env);
        let invoker = merchant.clone();

        // Deploy a test SAC (Stellar Asset Contract)
        let asset = env.register_stellar_asset_contract_v2(admin.clone());
        let asset_address = asset.address();

        // Mint tokens to subscriber
        let sac = StellarAssetClient::new(&env, &asset_address);
        sac.mint(&subscriber, &1_000_0000000_i128);

        (env, asset_address, admin, merchant, subscriber, invoker)
    }

    #[test]
    fn charge_pulls_without_subscriber_signing() {
        let (env, asset, _admin, merchant, subscriber, invoker) = setup();

        let contract_id = env.register(SpikeContract, ());
        let token = TokenClient::new(&env, &asset);

        let charge_amount = 100_0000000_i128;
        let cap = 500_0000000_i128;

        // Subscriber approves the spike contract as spender, up to cap
        token.approve(&subscriber, &contract_id, &cap, &(env.ledger().sequence() + 100));

        let sub_balance_before = token.balance(&subscriber);
        let merchant_balance_before = token.balance(&merchant);

        // Merchant invokes charge — subscriber does NOT sign this call
        let client = SpikeContractClient::new(&env, &contract_id);
        client.charge(&invoker, &asset, &subscriber, &merchant, &charge_amount);

        assert_eq!(token.balance(&subscriber), sub_balance_before - charge_amount);
        assert_eq!(token.balance(&merchant), merchant_balance_before + charge_amount);

        // Allowance reduced by exactly charge_amount
        assert_eq!(token.allowance(&subscriber, &contract_id), cap - charge_amount);
    }

    #[test]
    #[should_panic]
    fn charge_respects_cap() {
        let (env, asset, _admin, merchant, subscriber, invoker) = setup();

        let contract_id = env.register(SpikeContract, ());
        let token = TokenClient::new(&env, &asset);

        let cap = 50_0000000_i128;

        token.approve(&subscriber, &contract_id, &cap, &(env.ledger().sequence() + 100));

        // Attempt to charge more than the approved cap — SAC must reject
        let client = SpikeContractClient::new(&env, &contract_id);
        client.charge(&invoker, &asset, &subscriber, &merchant, &(cap + 1));
    }
}
