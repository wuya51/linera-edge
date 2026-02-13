use linera_sdk::linera_base_types::{AccountOwner, Timestamp, Amount};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UserBet {
    pub app_id: String,
    pub amount: Amount,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AppRanking {
    pub app_id: String,
    pub total_bet: Amount,
    pub rank: u32,
}

pub const REWARD_WEIGHTS: [u32; 10] = [25, 18, 14, 10, 8, 7, 6, 5, 4, 3];
pub const INITIAL_BALANCE: u64 = 100;
pub const MAX_BET_PER_APP: u64 = 100;
pub const REDEEM_FEE_PERCENT: u64 = 1;
pub const POOL_DISTRIBUTION_PERCENT: u64 = 80;