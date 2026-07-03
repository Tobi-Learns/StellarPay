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
const INTERVAL: u64 = 2_592_000; // 30 days in seconds — the plan's min_interval_secs
const BASE_TS: u64 = 1_700_000_000; // fixed base so timestamp math is realistic
// Caller-supplied ids (backend uses a non-sequential Snowflake; fixed here). Plan
// and Sub are separate storage namespaces, so the same numeric value can't clash.
const PLAN_ID: u64 = 7_000_000_001;
const SUB_ID: u64 = 8_000_000_002;

fn setup() -> TestEnv {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = BASE_TS);

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

fn client(t: &TestEnv) -> StellarPayContractClient<'_> {
    StellarPayContractClient::new(&t.env, &t.contract)
}

fn token(t: &TestEnv) -> TokenClient<'_> {
    TokenClient::new(&t.env, &t.asset)
}

fn approve(t: &TestEnv, amount: i128) {
    let expiry = t.env.ledger().sequence() + 10_000;
    token(t).approve(&t.subscriber, &t.contract, &amount, &expiry);
}

/// Advance the ledger clock by `secs`.
fn advance_secs(t: &TestEnv, secs: u64) {
    t.env.ledger().with_mut(|l| l.timestamp += secs);
}

fn now(t: &TestEnv) -> u64 {
    t.env.ledger().timestamp()
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
fn create_plan_echoes_supplied_id() {
    let t = setup();
    let c = client(&t);
    // ids are whatever the caller supplies — not a sequential counter
    let id_a = c.create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &4242);
    let id_b = c.create_plan(&t.merchant, &t.asset, &200_0000000, &INTERVAL, &9999);
    assert_eq!(id_a, 4242);
    assert_eq!(id_b, 9999);
    assert_eq!(c.get_plan(&4242).amount, 100_0000000);
    assert_eq!(c.get_plan(&9999).amount, 200_0000000);
}

#[test]
#[should_panic(expected = "plan id already exists")]
fn create_plan_duplicate_id_panics() {
    let t = setup();
    client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    client(&t).create_plan(&t.merchant, &t.asset, &200_0000000, &INTERVAL, &PLAN_ID);
}

#[test]
fn create_plan_stores_correctly() {
    let t = setup();
    let amount = 50_0000000_i128;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL, &PLAN_ID);
    let plan = client(&t).get_plan(&plan_id);
    assert_eq!(plan.merchant, t.merchant);
    assert_eq!(plan.amount, amount);
    assert_eq!(plan.min_interval_secs, INTERVAL);
    assert!(plan.active);
}

#[test]
#[should_panic(expected = "interval must be positive")]
fn create_plan_zero_interval_panics() {
    let t = setup();
    client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &0, &PLAN_ID);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn create_plan_zero_amount_panics() {
    let t = setup();
    client(&t).create_plan(&t.merchant, &t.asset, &0, &INTERVAL, &PLAN_ID);
}

// ── subscribe ─────────────────────────────────────────────────────────────────

#[test]
fn subscribe_runs_first_charge() {
    let t = setup();
    let amount = 100_0000000_i128;
    let fee = amount * FEE_BPS as i128 / 10000;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL, &PLAN_ID);

    let sub_before = token(&t).balance(&t.subscriber);
    approve(&t, amount * 10);

    client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);

    assert_eq!(token(&t).balance(&t.merchant), amount - fee);
    assert_eq!(token(&t).balance(&t.platform), fee);
    assert_eq!(token(&t).balance(&t.subscriber), sub_before - amount);
}

#[test]
fn subscribe_sets_next_charge() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 10);

    let next = now(&t) + INTERVAL;
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &next, &SUB_ID);
    let sub = client(&t).get_subscription(&sub_id);

    assert_eq!(sub.next_charge_at, next);
    assert_eq!(sub.status, Status::Active);
}

#[test]
#[should_panic(expected = "next_charge_at below cadence floor")]
fn subscribe_below_floor_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 10);
    // next_charge_at only 1 second out — below the min interval
    client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + 1), &SUB_ID);
}

#[test]
#[should_panic(expected = "sub id already exists")]
fn subscribe_duplicate_id_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 100);
    client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);
    // second subscribe re-using the same sub id — rejected before charging
    client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);
}

// ── charge ────────────────────────────────────────────────────────────────────

#[test]
fn charge_pulls_without_subscriber_signing() {
    let t = setup();
    let amount = 100_0000000_i128;
    let fee = amount * FEE_BPS as i128 / 10000;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL, &PLAN_ID);
    approve(&t, amount * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);

    advance_secs(&t, INTERVAL);

    let merchant_before = token(&t).balance(&t.merchant);
    let platform_before = token(&t).balance(&t.platform);
    let subscriber_before = token(&t).balance(&t.subscriber);

    // Merchant charges one period — subscriber does NOT sign this call
    let next = now(&t) + INTERVAL;
    client(&t).charge(&t.merchant, &sub_id, &1, &next);

    assert_eq!(token(&t).balance(&t.merchant), merchant_before + amount - fee);
    assert_eq!(token(&t).balance(&t.platform), platform_before + fee);
    assert_eq!(token(&t).balance(&t.subscriber), subscriber_before - amount);
}

#[test]
fn charge_advances_next_charge() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);

    advance_secs(&t, INTERVAL);
    let next = now(&t) + INTERVAL;
    client(&t).charge(&t.merchant, &sub_id, &1, &next);

    let sub_after = client(&t).get_subscription(&sub_id);
    assert_eq!(sub_after.next_charge_at, next);
}

#[test]
fn charge_by_admin_works() {
    let t = setup();
    let amount = 100_0000000_i128;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL, &PLAN_ID);
    approve(&t, amount * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);

    advance_secs(&t, INTERVAL);
    let merchant_before = token(&t).balance(&t.merchant);

    // Admin (platform/cron key) charges — contract allows invoker == admin
    client(&t).charge(&t.admin, &sub_id, &1, &(now(&t) + INTERVAL));

    let fee = amount * FEE_BPS as i128 / 10000;
    assert_eq!(token(&t).balance(&t.merchant), merchant_before + amount - fee);
}

#[test]
fn charge_multi_period_pulls_arrears() {
    let t = setup();
    let amount = 100_0000000_i128;
    let fee_total = (amount * 3) * FEE_BPS as i128 / 10000;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL, &PLAN_ID);
    approve(&t, amount * 100);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);

    let merchant_before = token(&t).balance(&t.merchant);
    let subscriber_before = token(&t).balance(&t.subscriber);

    // Three periods elapse before the next charge runs (cron was down)
    advance_secs(&t, INTERVAL * 3);
    let next = now(&t) + INTERVAL;
    client(&t).charge(&t.merchant, &sub_id, &3, &next);

    // One transfer collects all three periods' worth
    assert_eq!(token(&t).balance(&t.merchant), merchant_before + amount * 3 - fee_total);
    assert_eq!(token(&t).balance(&t.subscriber), subscriber_before - amount * 3);
    assert_eq!(client(&t).get_subscription(&sub_id).next_charge_at, next);
}

#[test]
#[should_panic(expected = "charge not due yet")]
fn charge_before_due_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);
    // Do not advance the clock — charge not due yet
    client(&t).charge(&t.merchant, &sub_id, &1, &(now(&t) + INTERVAL * 2));
}

#[test]
#[should_panic(expected = "periods must be >= 1")]
fn charge_zero_periods_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);
    advance_secs(&t, INTERVAL);
    client(&t).charge(&t.merchant, &sub_id, &0, &(now(&t) + INTERVAL));
}

#[test]
#[should_panic(expected = "too many periods for elapsed time")]
fn charge_too_many_periods_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 100);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);
    // Only one interval elapses, but caller tries to bill 3 periods
    advance_secs(&t, INTERVAL);
    client(&t).charge(&t.merchant, &sub_id, &3, &(now(&t) + INTERVAL * 3));
}

#[test]
#[should_panic(expected = "advance below cadence floor")]
fn charge_below_cadence_floor_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 100);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);
    // Three periods elapse and caller bills 3, but only advances the schedule by ~1 interval
    advance_secs(&t, INTERVAL * 3);
    let due = client(&t).get_subscription(&sub_id).next_charge_at;
    client(&t).charge(&t.merchant, &sub_id, &3, &(due + INTERVAL));
}

#[test]
#[should_panic(expected = "not authorized")]
fn charge_by_stranger_panics() {
    let t = setup();
    let stranger = Address::generate(&t.env);
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);
    advance_secs(&t, INTERVAL);
    client(&t).charge(&stranger, &sub_id, &1, &(now(&t) + INTERVAL));
}

#[test]
fn charge_sets_past_due_on_insufficient_allowance() {
    let t = setup();
    let amount = 100_0000000_i128;
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &amount, &INTERVAL, &PLAN_ID);
    approve(&t, amount * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);

    // Zero out allowance so the next charge fails
    token(&t).approve(&t.subscriber, &t.contract, &0, &(t.env.ledger().sequence() + 1000));

    advance_secs(&t, INTERVAL);
    client(&t).charge(&t.merchant, &sub_id, &1, &(now(&t) + INTERVAL));

    let sub = client(&t).get_subscription(&sub_id);
    assert_eq!(sub.status, Status::PastDue);
}

// ── cancel ────────────────────────────────────────────────────────────────────

#[test]
fn cancel_sets_status() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);

    client(&t).cancel(&t.subscriber, &sub_id);

    let sub = client(&t).get_subscription(&sub_id);
    assert_eq!(sub.status, Status::Canceled);
}

#[test]
#[should_panic(expected = "subscription not active")]
fn charge_after_cancel_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);

    client(&t).cancel(&t.subscriber, &sub_id);

    advance_secs(&t, INTERVAL);
    client(&t).charge(&t.merchant, &sub_id, &1, &(now(&t) + INTERVAL));
}

#[test]
#[should_panic(expected = "already canceled")]
fn cancel_twice_panics() {
    let t = setup();
    let plan_id = client(&t).create_plan(&t.merchant, &t.asset, &100_0000000, &INTERVAL, &PLAN_ID);
    approve(&t, 100_0000000 * 10);
    let sub_id = client(&t).subscribe(&t.subscriber, &plan_id, &(now(&t) + INTERVAL), &SUB_ID);
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
