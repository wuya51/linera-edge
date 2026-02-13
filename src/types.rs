use linera_sdk::linera_base_types::{AccountOwner, Timestamp};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UserBet {
    pub app_id: String,
    pub amount: u64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AppRanking {
    pub app_id: String,
    pub total_bet: u64,
    pub rank: u32,
}

// 结算奖励权重
pub const REWARD_WEIGHTS: [u32; 10] = [25, 18, 14, 10, 8, 7, 6, 5, 4, 3];
pub const INITIAL_BALANCE: u64 = 100;
pub const MAX_BET_PER_APP: u64 = 100;
pub const REDEEM_FEE_PERCENT: u64 = 1; // 1% 手续费
pub const POOL_DISTRIBUTION_PERCENT: u64 = 80; // 80% 用于分配