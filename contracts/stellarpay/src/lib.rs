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
    pub fn create_plan(
        env: Env,
        merchant: Address,
        asset: Address,
        amount: i128,
        interval: u32,
    ) -> u64 {
        merchant.require_auth();

        let plan_id: u64 = env.storage().instance().get(&DataKey::PlanCount).unwrap();

        let plan = Plan {
            id: plan_id,
            merchant: merchant.clone(),
            asset,
            amount,
            interval,
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
    /// Runs the first charge immediately. Returns the subscription ID.
    pub fn subscribe(env: Env, subscriber: Address, plan_id: u64) -> u64 {
        subscriber.require_auth();

        let plan: Plan = env
            .storage()
            .persistent()
            .get(&DataKey::Plan(plan_id))
            .expect("plan not found");
        assert!(plan.active, "plan not active");

        let sub_id: u64 = env.storage().instance().get(&DataKey::SubCount).unwrap();
        let now = env.ledger().sequence();

        // next_charge starts at now; _charge will advance it by interval
        let mut sub = Subscription {
            id: sub_id,
            plan_id,
            subscriber: subscriber.clone(),
            status: Status::Active,
            next_charge: now,
            created_at: now,
        };

        Self::_charge(&env, &plan, &mut sub);

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

    /// Pull one billing cycle. Caller must be the plan merchant or the admin.
    /// Subscriber does NOT sign — funds are pulled via the pre-approved SAC allowance.
    /// On transfer failure the subscription moves to PastDue instead of panicking.
    pub fn charge(env: Env, invoker: Address, sub_id: u64) {
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
        assert!(
            env.ledger().sequence() >= sub.next_charge,
            "charge not due yet"
        );


        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(
            invoker == plan.merchant || invoker == admin,
            "not authorized"
        );

        Self::_charge(&env, &plan, &mut sub);

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

    fn _charge(env: &Env, plan: &Plan, sub: &mut Subscription) {
        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap();
        let platform: Address = env.storage().instance().get(&DataKey::Platform).unwrap();

        let fee = plan.amount * fee_bps as i128 / 10000;
        let merchant_amount = plan.amount - fee;

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
                sub.next_charge += plan.interval;
                env.events()
                    .publish((symbol_short!("charge"),), (sub.id, plan.amount));
            }
            Err(_) => {
                sub.status = Status::PastDue;
                env.events()
                    .publish((symbol_short!("pastdue"),), (sub.id,));
            }
        }
    }
}
