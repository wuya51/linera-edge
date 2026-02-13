#![cfg_attr(target_arch = "wasm32", no_main)]

use linera_edge::state::{EdgeState, AppInfo};
use linera_sdk::{Contract, ContractRuntime};
use linera_sdk::abi::WithContractAbi;
use linera_sdk::linera_base_types::{AccountOwner, Timestamp, StreamName};
use linera_sdk::views::RootView;

use std::sync::Arc;
use tokio::sync::Mutex;

linera_sdk::contract!(EdgeContract);

pub struct EdgeContract {
    state: Arc<Mutex<EdgeState>>,
    runtime: ContractRuntime<Self>,
}

impl Contract for EdgeContract {
    type Message = ();
    type Parameters = ();
    type InstantiationArgument = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let context = runtime.root_view_storage_context();
        let state = match EdgeState::load(context.clone()).await {
            Ok(state) => state,
            Err(_) => {
                EdgeState::create_empty(context)
            }
        };
        Self {
            state: Arc::new(Mutex::new(state)),
            runtime,
        }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        let mut state = self.state.lock().await;
        if state.owner.get().is_some() {
            return;
        }

        let contract_address: AccountOwner = self.runtime.application_id().into();
        let _ = state.set_owner(contract_address).await;
        
        let current_time = self.runtime.system_time();
        let _ = state.update_last_settle_time(current_time).await;
        
        let _ = state.update_pool_amount(10000).await;
        
        let chain_id = self.runtime.chain_id();
        let application_id = self.runtime.application_id().forget_abi();
        let stream_name = StreamName::from("edge_events");
        
        self.runtime.subscribe_to_events(chain_id, application_id, stream_name);
        
        let _ = state.save().await;
    }

    async fn execute_operation(&mut self, operation: Self::Operation) {
        match operation {
            linera_edge::EdgeOperation::Bet { caller, app_id, amount } => {
                self.handle_bet(caller, app_id, amount).await;
            }
            linera_edge::EdgeOperation::Redeem { caller, app_id, amount } => {
                self.handle_redeem(caller, app_id, amount).await;
            }
            linera_edge::EdgeOperation::Settle { caller } => {
                self.handle_settle(caller).await;
            }
            linera_edge::EdgeOperation::AddApplication { caller, app_id, name, description } => {
                self.handle_add_application(caller, app_id, name, description).await;
            }
            linera_edge::EdgeOperation::RemoveApplication { caller, app_id } => {
                self.handle_remove_application(caller, app_id).await;
            }
            linera_edge::EdgeOperation::InjectPool { caller, amount } => {
                self.handle_inject_pool(caller, amount).await;
            }
        }
    }

    async fn execute_message(&mut self, _message: Self::Message) {}

    async fn store(self) {
        let mut state = self.state.lock().await;
        let _ = state.save().await;
    }
}

impl EdgeContract {
    async fn handle_bet(&mut self, owner: AccountOwner, app_id: String, amount: u64) {
        let mut state = self.state.lock().await;
        
        if amount < 1 {
            return;
        }
        
        let _ = state.initialize_user_balance(&owner).await;
        
        let current_balance = match state.get_user_balance(&owner).await {
            Ok(balance) => balance,
            Err(_) => return,
        };
        
        if current_balance < amount {
            return;
        }
        
        let current_bet = match state.get_user_app_bet(&owner, &app_id).await {
            Ok(bet) => bet,
            Err(_) => return,
        };
        
        if current_bet + amount > 100 {
            return;
        }
        
        let new_balance = current_balance - amount;
        let _ = state.update_user_balance(&owner, new_balance).await;
        
        let new_bet = current_bet + amount;
        let current_time = self.runtime.system_time();
        let _ = state.update_user_bet(&owner, app_id.clone(), new_bet as i64, current_time).await;
        
        let current_total = match state.get_app_total_bet(&app_id).await {
            Ok(total) => total,
            Err(_) => return,
        };
        let new_total = current_total + amount;
        let _ = state.update_app_total_bet(app_id.clone(), new_total).await;
        
        let current_app_contribution = match state.get_app_pool_contribution(&app_id).await {
            Ok(contribution) => contribution,
            Err(_) => 0,
        };
        let new_app_contribution = current_app_contribution + amount;
        let _ = state.update_app_pool_contribution(app_id, new_app_contribution).await;
        
        let current_pool = match state.get_pool_amount().await {
            Ok(pool) => pool,
            Err(_) => 0,
        };
        let new_pool = current_pool + amount;
        let _ = state.update_pool_amount(new_pool).await;
        
        let _ = state.save().await;
    }

    async fn handle_redeem(&mut self, owner: AccountOwner, app_id: String, amount: u64) {
        let mut state = self.state.lock().await;
        
        if amount < 1 {
            return;
        }
        
        let current_bet = match state.get_user_app_bet(&owner, &app_id).await {
            Ok(bet) => bet,
            Err(_) => return,
        };
        
        if amount > current_bet {
            return;
        }
        
        let fee = if amount <= 100 {
            1
        } else {
            (amount * 1 + 99) / 100
        };
        let return_amount = amount - fee;
        
        let new_bet = current_bet - amount;
        let current_time = self.runtime.system_time();
        let _ = state.update_user_bet(&owner, app_id.clone(), new_bet as i64, current_time).await;
        
        let current_balance = match state.get_user_balance(&owner).await {
            Ok(balance) => balance,
            Err(_) => return,
        };
        let new_balance = current_balance + return_amount;
        let _ = state.update_user_balance(&owner, new_balance).await;
        
        let current_total = match state.get_app_total_bet(&app_id).await {
            Ok(total) => total,
            Err(_) => return,
        };
        let new_total = current_total - amount;
        let _ = state.update_app_total_bet(app_id, new_total).await;
        
        let current_pool = match state.get_pool_amount().await {
            Ok(pool) => pool,
            Err(_) => return,
        };
        let new_pool = current_pool + fee;
        let _ = state.update_pool_amount(new_pool).await;
        
        let _ = state.save().await;
    }

    async fn handle_add_application(&mut self, caller: AccountOwner, app_id: String, name: String, description: String) {
        let mut state = self.state.lock().await;
        
        let is_whitelisted = match state.is_whitelisted(&caller).await {
            Ok(is_whitelisted) => is_whitelisted,
            Err(_) => return,
        };
        
        if !is_whitelisted {
            return;
        }
        
        if let Ok(Some(_)) = state.get_app_info(&app_id).await {
            return;
        }
        
        let app_info = AppInfo {
            app_id: app_id.clone(),
            name,
            description,
            added_at: self.runtime.system_time(),
            is_active: true,
        };
        
        if let Err(_) = state.add_app_info(app_id.clone(), app_info).await {
            return;
        }
        
        let _ = state.update_app_total_bet(app_id, 0).await;
        
        let _ = state.save().await;
    }

    async fn handle_settle(&mut self, caller: AccountOwner) {
        let mut state = self.state.lock().await;
        
        let is_whitelisted = match state.is_whitelisted(&caller).await {
            Ok(is_whitelisted) => is_whitelisted,
            Err(_) => return,
        };
        
        if !is_whitelisted {
            return;
        }
        
        let current_time = self.runtime.system_time();
        let last_settle_time = match state.get_last_settle_time().await {
            Ok(time) => time,
            Err(_) => return,
        };
        
        let one_minute_micros: u64 = 60_000_000;
        if current_time.micros() - last_settle_time.micros() < one_minute_micros {
            return;
        }
        
        Self::execute_settlement_logic(&mut state, current_time).await;
        
        let _ = state.save().await;
    }

    async fn execute_settlement_logic(state: &mut EdgeState, current_time: Timestamp) {
        let _ = state.check_and_perform_resets(current_time).await;
        
        let pool_amount = match state.get_pool_amount().await {
            Ok(amount) => amount,
            Err(_) => return,
        };
        
        if pool_amount == 0 {
            return;
        }
        
        let app_totals = match state.get_all_app_totals().await {
            Ok(totals) => totals,
            Err(_) => return,
        };
        
        let mut top_apps: Vec<(String, u64)> = app_totals.into_iter().collect();
        top_apps.sort_by(|a, b| b.1.cmp(&a.1));
        let top_apps: Vec<(String, u64)> = top_apps.into_iter().take(10).collect();
        
        let reward_weights = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6];
        
        let total_bets: u64 = top_apps.iter().map(|(_, amount)| amount).sum();
        let distribution_amount = if total_bets > 0 {
            (total_bets * 10) / 100
        } else {
            0
        };
        
        let mut has_eligible_bettors = false;
        
        if distribution_amount > 0 {
            for (rank, (app_id, _)) in top_apps.iter().enumerate() {
                if rank >= reward_weights.len() {
                    break;
                }
                
                let bettors = match state.get_app_bettors(app_id).await {
                    Ok(bettors) => bettors,
                    Err(_) => continue,
                };
                
                let total_bet_for_app = match state.get_app_total_bet(app_id).await {
                    Ok(total) => total,
                    Err(_) => continue,
                };
                
                if total_bet_for_app > 0 {
                    let eligible_bettors = bettors;
                    has_eligible_bettors = !eligible_bettors.is_empty();
                    
                    if eligible_bettors.len() > 0 {
                        let weight = reward_weights[rank];
                        let base_reward = (distribution_amount * weight as u64) / 100;
                        
                        let supporters_count = match state.get_app_supporters_count(app_id).await {
                            Ok(count) => count,
                            Err(_) => 1,
                        };
                        
                        let app_info = match state.get_app_info(app_id).await {
                            Ok(Some(info)) => info,
                            _ => continue,
                        };
                        
                        let days_since_added = (current_time.micros() - app_info.added_at.micros()) / (24 * 3600_000_000);
                        
                        let supporter_bonus = std::cmp::min((supporters_count as u64) * 10, 100);
                        
                        let mut growth_bonus: u64 = 0;
                        if rank >= 5 {
                            growth_bonus = ((10 - rank) * 5) as u64;
                        }
                        
                        let mut new_app_bonus: u64 = 0;
                        if days_since_added < 7 {
                            new_app_bonus = 20;
                        }
                        
                        let total_bonus = supporter_bonus + growth_bonus + new_app_bonus;
                        let total_reward = base_reward * (100 + total_bonus) / 100;
                        
                        let eligible_total_bet: u64 = eligible_bettors.iter().map(|(_, amount)| amount).sum();
                        
                        if eligible_total_bet > 0 {
                            for (bettor, bet_amount) in eligible_bettors {
                                let reward_share = (total_reward * bet_amount) / eligible_total_bet;
                                
                                let current_balance = state.get_user_balance(&bettor).await.unwrap_or(0);
                                let _ = state.update_user_balance(&bettor, current_balance + reward_share).await;
                                
                                let _ = state.update_user_earnings(&bettor, reward_share).await;
                            }
                        }
                    }
                }
            }
            
            if has_eligible_bettors && distribution_amount <= pool_amount {
                let new_pool = pool_amount - distribution_amount;
                let _ = state.update_pool_amount(new_pool).await;
            }
        }
        
        let _ = state.update_last_settle_time(current_time).await;
        
        let _ = state.save().await;
    }

    async fn handle_remove_application(&mut self, caller: AccountOwner, app_id: String) {
        let mut state = self.state.lock().await;
        
        let is_whitelisted = match state.is_whitelisted(&caller).await {
            Ok(is_whitelisted) => is_whitelisted,
            Err(_) => return,
        };
        
        if !is_whitelisted {
            return;
        }
        
        let _ = state.remove_app_info(&app_id).await;
        
        let _ = state.save().await;
    }

    async fn handle_inject_pool(&mut self, caller: AccountOwner, amount: u64) {
        let mut state = self.state.lock().await;
        
        // 检查调用者是否在白名单中
        let is_whitelisted = match state.is_whitelisted(&caller).await {
            Ok(is_whitelisted) => is_whitelisted,
            Err(_) => return,
        };
        
        if !is_whitelisted {
            return;
        }
        
        // 检查注入金额是否大于0
        if amount < 1 {
            return;
        }
        
        // 获取当前奖池金额
        let current_pool = match state.get_pool_amount().await {
            Ok(pool) => pool,
            Err(_) => return,
        };
        
        // 计算新的奖池金额
        let new_pool = current_pool + amount;
        
        // 更新奖池金额
        let _ = state.update_pool_amount(new_pool).await;
        
        // 保存状态
        let _ = state.save().await;
    }
}

impl WithContractAbi for EdgeContract {
    type Abi = linera_edge::EdgeAbi;
}