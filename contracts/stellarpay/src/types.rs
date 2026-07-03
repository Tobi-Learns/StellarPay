use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub struct Plan {
    pub id: u64,
    pub merchant: Address,
    pub asset: Address,
    pub amount: i128,
    /// Minimum seconds between charges. This is the on-chain cadence floor, not
    /// the exact interval — the backend computes exact calendar dates and the
    /// contract only enforces that charges never advance the schedule faster
    /// than this. Set to the shortest possible duration of one billing period
    /// (e.g. 28 days for a monthly plan) so a legitimate charge is never rejected.
    pub min_interval_secs: u64,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum Status {
    Active,
    PastDue,
    Canceled,
}

#[contracttype]
#[derive(Clone)]
pub struct Subscription {
    pub id: u64,
    pub plan_id: u64,
    pub subscriber: Address,
    pub status: Status,
    /// UTC unix timestamp (seconds) when the next charge is due.
    pub next_charge_at: u64,
    /// UTC unix timestamp (seconds) when the subscription was created.
    pub created_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Platform,
    FeeBps,
    Plan(u64),
    Sub(u64),
}
