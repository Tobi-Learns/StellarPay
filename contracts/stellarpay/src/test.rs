#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// ── helpers ──────────────────────────────────────────────────────────────────

struct TestEnv {
    env: Env,
    contract: Address,
    asset: Address,
    admin: Address,
    platform: Address,
    merchant: Address,
    subscriber: Address,
}

const FEE_BPS: u32 = 100; // 1%
const INTERVAL: u32 = 100; // ledgers

fn setup() -> TestEnv {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let merchant = Address::generate(&env);
    let subscriber = Address::generate(&env);

    // Deploy test SAC
    let asset_addr = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();

    // Fund subscriber with 100 000 tokens
    StellarAssetClient::new(&env, &asset_addr).mint(&subscriber, &100_000_0000000);

    // Deploy and initialize the StellarPay contract
    let contract = env.register(StellarPayContract, ());
    StellarPayContractClient::new(&env, &contract).initialize(&admin, &platform, &FEE_BPS);

    TestEnv {
        env,
        contract,
        asset: asset_addr,
        admin,
        platform,
        merchant,
        subscriber,
    }
}

fn client(t: &TestEnv) -> StellarPayContractClient {
    StellarPayContractClient::new(&t.env, &t.contract)
}

fn token(t: &TestEnv) -> TokenClient {
    TokenClient::new(&t.env, &t.asset)
}

fn approve(t: &TestEnv, amount: i128) {
    let expiry = t.env.ledger().sequence() + 10_000;
    token(t).approve(&t.subscriber, &t.contract, &amount, &expiry);
}

// ── pay ───────────────────────────────────────────────────────────────────────

#[test]
fn pay_splits_fee_correctly() {
    let t = setup();
    let amount = 1000_0000000_i128;
    let expected_fee = amount * FEE_BPS as i128 / 10000; // 10 tokens
    let expected_merchant = amount - expected_fee;

    client(&t).pay(&t.subscriber, &t.merchant, &t.asset, &amount, &0);

    assert_eq!(token(&t).balance(&t.merchant), expected_merchant);
    assert_eq!(token(&t).balance(&t.platform), expected_fee);
}

#[test]
fn pay_zero_fee_works() {
    // Re-init with 0 bps
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    let asset_addr = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    StellarAssetClient::new(&env, &asset_addr).mint(&payer, &1000_0000000);
    let contract = env.register(StellarPayContract, ());
    let c = StellarPayContractClient::new(&env, &contract);
    c.initialize(&admin, &platform, &0);
    let amount = 500_0000000_i128;
    c.pay(&payer, &merchant, &asset_addr, &amount, &42);
    assert_eq!(TokenClient::new(&env, &asset_addr).balance(&merchant), amount);
    assert_eq!(TokenClient::new(&env, &asset_addr).balance(&platform), 0);
}

// ── create_plan ───────────────────────────────────────────────────────────────

#[test]
fn create_plan_returns_sequential_ids() {
    let t = setup();
    let c = client(&t);
    let id0 = c.create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL);
    let id1 = c.create_plan(&t.merchant, &t.asset, &200_0000000, &INTERVAL);
    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
}

#[test]
fn create_plan_stores_correctly() {
    let t = setup();
    let amount = 50_0000000_i128;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL);
    let plan = client(&t).get_plan(&plan_id);
    assert_eq!(plan.merchant, t.merchant);
    assert_eq!(plan.amount, amount);
    assert_eq!(plan.interval, INTERVAL);
    assert!(plan.active);
}

// ── subscribe ─────────────────────────────────────────────────────────────────

#[test]
fn subscribe_runs_first_charge() {
    let t = setup();
    let amount = 100_0000000_i128;
    let fee = amount * FEE_BPS as i128 / 10000;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL);

    let sub_before = token(&t).balance(&t.subscriber);
    approve(&t, amount * 10);

    client(&t).subscribe(&t.subscriber, &plan_id);

    assert_eq!(token(&t).balance(&t.merchant), amount - fee);
    assert_eq!(token(&t).balance(&t.platform), fee);
    assert_eq!(token(&t).balance(&t.subscriber), sub_before - amount);
}

#[test]
fn subscribe_sets_next_charge() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL);
    approve(&t, 100_0000000 * 10);

    let now = t.env.ledger().sequence();
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id);
    let sub = client(&t).get_subscription(&sub_id);

    assert_eq!(sub.next_charge, now + INTERVAL);
    assert_eq!(sub.status, Status::Active);
}

// ── charge ────────────────────────────────────────────────────────────────────

#[test]
fn charge_pulls_without_subscriber_signing() {
    let t = setup();
    let amount = 100_0000000_i128;
    let fee = amount * FEE_BPS as i128 / 10000;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL);
    approve(&t, amount * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id);

    // Advance ledger past next_charge
    t.env.ledger().with_mut(|l| l.sequence_number += INTERVAL);

    let merchant_before = token(&t).balance(&t.merchant);
    let platform_before = token(&t).balance(&t.platform);
    let subscriber_before = token(&t).balance(&t.subscriber);

    // Merchant charges — subscriber does NOT sign this call
    client(&t).charge(&t.merchant, &sub_id);

    assert_eq!(token(&t).balance(&t.merchant), merchant_before + amount - fee);
    assert_eq!(token(&t).balance(&t.platform), platform_before + fee);
    assert_eq!(token(&t).balance(&t.subscriber), subscriber_before - amount);
}

#[test]
fn charge_advances_next_charge() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id);

    let sub_before = client(&t).get_subscription(&sub_id);
    t.env.ledger().with_mut(|l| l.sequence_number += INTERVAL);

    client(&t).charge(&t.merchant, &sub_id);

    let sub_after = client(&t).get_subscription(&sub_id);
    assert_eq!(sub_after.next_charge, sub_before.next_charge + INTERVAL);
}

#[test]
#[should_panic(expected = "charge not due yet")]
fn charge_before_due_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id);
    // Do not advance ledger — charge not due yet
    client(&t).charge(&t.merchant, &sub_id);
}

#[test]
fn charge_sets_past_due_on_insufficient_allowance() {
    let t = setup();
    let amount = 100_0000000_i128;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL);
    approve(&t, amount * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id);

    // Zero out allowance so the next charge fails
    token(&t).approve(&t.subscriber, &t.contract, &0, &(t.env.ledger().sequence() + 1000));

    t.env.ledger().with_mut(|l| l.sequence_number += INTERVAL);
    client(&t).charge(&t.merchant, &sub_id);

    let sub = client(&t).get_subscription(&sub_id);
    assert_eq!(sub.status, Status::PastDue);
}

// ── cancel ────────────────────────────────────────────────────────────────────

#[test]
fn cancel_sets_status() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id);

    client(&t).cancel(&t.subscriber, &sub_id);

    let sub = client(&t).get_subscription(&sub_id);
    assert_eq!(sub.status, Status::Canceled);
}

#[test]
#[should_panic(expected = "subscription not active")]
fn charge_after_cancel_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id);

    client(&t).cancel(&t.subscriber, &sub_id);

    t.env.ledger().with_mut(|l| l.sequence_number += INTERVAL);
    client(&t).charge(&t.merchant, &sub_id);
}

#[test]
#[should_panic(expected = "already canceled")]
fn cancel_twice_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id);
    client(&t).cancel(&t.subscriber, &sub_id);
    client(&t).cancel(&t.subscriber, &sub_id);
}

// ── fee math ──────────────────────────────────────────────────────────────────

#[test]
fn fee_math_rounds_down() {
    let t = setup();
    // 1 token at 1% fee = 0.01 tokens fee — rounds to 0 (integer division)
    let amount = 1_0000000_i128;
    client(&t).pay(&t.subscriber, &t.merchant, &t.asset, &amount, &0);
    let fee = amount * FEE_BPS as i128 / 10000;
    assert_eq!(token(&t).balance(&t.merchant), amount - fee);
}
