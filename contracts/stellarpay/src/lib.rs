#![no_std]

mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Env};
use types::{DataKey, Plan, Status, Subscription};

#[contract]
pub struct StellarPayContract;

#[contractimpl]
impl StellarPayContract {
    /// One-time setup. `platform` receives the fee share on every payment and charge.
    pub fn initialize(env: Env, admin: Address, platform: Address, fee_bps: u32) {
        assert!(
            !env.storage().instance().has(&DataKey::Admin),
            "already initialized"
        );
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Platform, &platform);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::PlanCount, &0u64);
        env.storage().instance().set(&DataKey::SubCount, &0u64);
    }

    /// One-time payment: payer signs once, merchant gets amount − fee, platform gets fee.
    pub fn pay(
        env: Env,
        payer: Address,
        merchant: Address,
        asset: Address,
        amount: i128,
        link_id: u64,
    ) {
        payer.require_auth();

        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap();
        let platform: Address = env.storage().instance().get(&DataKey::Platform).unwrap();

        let fee = amount * fee_bps as i128 / 10000;
        let merchant_amount = amount - fee;

        let token = token::Client::new(&env, &asset);
        token.transfer(&payer, &merchant, &merchant_amount);
        if fee > 0 {
            token.transfer(&payer, &platform, &fee);
        }

        env.events()
            .publish((symbol_short!("pay"),), (payer, merchant, asset, amount, link_id));
    }

    /// Create a recurring billing plan. Returns the plan ID.
    /// `min_interval_secs` is the on-chain cadence floor (see `Plan`).
    pub fn create_plan(
        env: Env,
        merchant: Address,
        asset: Address,
        amount: i128,
        min_interval_secs: u64,
    ) -> u64 {
        merchant.require_auth();

        assert!(min_interval_secs > 0, "interval must be positive");
        assert!(amount > 0, "amount must be positive");

        let plan_id: u64 = env.storage().instance().get(&DataKey::PlanCount).unwrap();

        let plan = Plan {
            id: plan_id,
            merchant: merchant.clone(),
            asset,
            amount,
            min_interval_secs,
            active: true,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Plan(plan_id), &plan);
        env.storage()
            .instance()
            .set(&DataKey::PlanCount, &(plan_id + 1));

        env.events()
            .publish((symbol_short!("plan"),), (merchant, plan_id));

        plan_id
    }

    /// Subscribe to a plan. Assumes subscriber already called SAC approve(this_contract, cap).
    /// Runs the first charge (one period) immediately and sets the next due date to
    /// `next_charge_at`, a UTC unix timestamp computed by the backend's calendar math.
    /// The contract enforces `next_charge_at >= now + min_interval_secs` so the first
    /// advance can't be shorter than the cadence floor. Returns the subscription ID.
    pub fn subscribe(env: Env, subscriber: Address, plan_id: u64, next_charge_at: u64) -> u64 {
        subscriber.require_auth();

        let plan: Plan = env
            .storage()
            .persistent()
            .get(&DataKey::Plan(plan_id))
            .expect("plan not found");
        assert!(plan.active, "plan not active");

        let now = env.ledger().timestamp();
        assert!(
            next_charge_at >= now + plan.min_interval_secs,
            "next_charge_at below cadence floor"
        );

        let sub_id: u64 = env.storage().instance().get(&DataKey::SubCount).unwrap();

        let mut sub = Subscription {
            id: sub_id,
            plan_id,
            subscriber: subscriber.clone(),
            status: Status::Active,
            next_charge_at: now,
            created_at: now,
        };

        // First charge: one period now, schedule advances to the backend-computed date.
        Self::_pull(&env, &plan, &mut sub, plan.amount, next_charge_at);

        env.storage()
            .persistent()
            .set(&DataKey::Sub(sub_id), &sub);
        env.storage()
            .instance()
            .set(&DataKey::SubCount, &(sub_id + 1));

        env.events()
            .publish((symbol_short!("subscribe"),), (subscriber, plan_id, sub_id));

        sub_id
    }

    /// Pull `periods` billing cycles in one transfer and advance the schedule to
    /// `new_next_charge_at` (a UTC unix timestamp from the backend's calendar math).
    /// Caller must be the plan merchant or the admin; the subscriber does NOT sign —
    /// funds are pulled via the pre-approved SAC allowance. On transfer failure the
    /// subscription moves to PastDue instead of panicking.
    ///
    /// Safety envelope (backend owns exact dates, contract owns the bounds):
    /// - `periods >= 1` and the charge must be due (`now >= next_charge_at`).
    /// - Upper bound: `periods` cannot exceed the number of periods that could have
    ///   elapsed since `next_charge_at` at the `min_interval_secs` floor — the contract
    ///   can't be told to bill the future.
    /// - Lower bound: `new_next_charge_at >= next_charge_at + periods * min_interval_secs`
    ///   — the money pulled (`amount * periods`) is chained to how far the schedule
    ///   advances, so average extraction can never exceed one period per interval.
    pub fn charge(env: Env, invoker: Address, sub_id: u64, periods: u32, new_next_charge_at: u64) {
        invoker.require_auth();

        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&DataKey::Sub(sub_id))
            .expect("subscription not found");
        let plan: Plan = env
            .storage()
            .persistent()
            .get(&DataKey::Plan(sub.plan_id))
            .expect("plan not found");

        assert!(sub.status == Status::Active, "subscription not active");
        assert!(periods >= 1, "periods must be >= 1");

        let now = env.ledger().timestamp();
        assert!(now >= sub.next_charge_at, "charge not due yet");

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(
            invoker == plan.merchant || invoker == admin,
            "not authorized"
        );

        // Upper bound: can't bill more periods than could have elapsed at the floor rate.
        let max_periods = (now - sub.next_charge_at) / plan.min_interval_secs + 1;
        assert!(periods as u64 <= max_periods, "too many periods for elapsed time");

        // Lower bound: schedule must advance at least one floor-interval per period charged.
        let min_advance = sub.next_charge_at + periods as u64 * plan.min_interval_secs;
        assert!(
            new_next_charge_at >= min_advance,
            "advance below cadence floor"
        );

        let total = plan.amount * periods as i128;
        Self::_pull(&env, &plan, &mut sub, total, new_next_charge_at);

        env.storage()
            .persistent()
            .set(&DataKey::Sub(sub_id), &sub);
    }

    /// Subscriber cancels their subscription on-chain. Stops future charges.
    pub fn cancel(env: Env, subscriber: Address, sub_id: u64) {
        subscriber.require_auth();

        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&DataKey::Sub(sub_id))
            .expect("subscription not found");

        assert!(sub.subscriber == subscriber, "not subscriber");
        assert!(sub.status != Status::Canceled, "already canceled");

        sub.status = Status::Canceled;
        env.storage()
            .persistent()
            .set(&DataKey::Sub(sub_id), &sub);

        env.events()
            .publish((symbol_short!("cancel"),), (subscriber, sub_id));
    }

    pub fn get_plan(env: Env, plan_id: u64) -> Plan {
        env.storage()
            .persistent()
            .get(&DataKey::Plan(plan_id))
            .expect("plan not found")
    }

    pub fn get_subscription(env: Env, sub_id: u64) -> Subscription {
        env.storage()
            .persistent()
            .get(&DataKey::Sub(sub_id))
            .expect("subscription not found")
    }

    // ── internal ──────────────────────────────────────────────────────────────

    /// Pull `total_amount` (fee split included) from the subscriber via the SAC
    /// allowance. On success, advance the schedule to `new_next_charge_at`. On
    /// failure (insufficient allowance/balance), set PastDue without panicking.
    fn _pull(env: &Env, plan: &Plan, sub: &mut Subscription, total_amount: i128, new_next_charge_at: u64) {
        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap();
        let platform: Address = env.storage().instance().get(&DataKey::Platform).unwrap();

        let fee = total_amount * fee_bps as i128 / 10000;
        let merchant_amount = total_amount - fee;

        let token = token::Client::new(env, &plan.asset);

        // try_transfer_from returns Err on insufficient allowance or balance → PastDue.
        match token.try_transfer_from(
            &env.current_contract_address(),
            &sub.subscriber,
            &plan.merchant,
            &merchant_amount,
        ) {
            Ok(_) => {
                if fee > 0 {
                    token.transfer_from(
                        &env.current_contract_address(),
                        &sub.subscriber,
                        &platform,
                        &fee,
                    );
                }
                sub.next_charge_at = new_next_charge_at;
                env.events()
                    .publish((symbol_short!("charge"),), (sub.id, total_amount));
            }
            Err(_) => {
                sub.status = Status::PastDue;
                env.events()
                    .publish((symbol_short!("pastdue"),), (sub.id,));
            }
        }
    }
}
