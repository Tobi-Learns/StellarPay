use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub struct Plan {
    pub id: u64,
    pub merchant: Address,
    pub asset: Address,
    pub amount: i128,
    pub interval: u32, // in ledgers
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
    pub next_charge: u32, // ledger sequence when next charge is due
    pub created_at: u32,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Platform,
    FeeBps,
    PlanCount,
    SubCount,
    Plan(u64),
    Sub(u64),
}
