#![cfg_attr(target_arch = "wasm32", no_main)]

use linera_edge::state::{EdgeState, AppInfo};
use async_graphql::{Object, Request, Response, Schema, SimpleObject, Subscription};
use linera_sdk::{Service, ServiceRuntime};
use linera_sdk::abi::WithServiceAbi;
use linera_sdk::linera_base_types::{AccountOwner, Timestamp};
use linera_sdk::views::RootView;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};

linera_sdk::service!(EdgeService);
impl WithServiceAbi for EdgeService {
    type Abi = linera_edge::EdgeAbi;
}

pub struct EdgeService {
    state: Arc<Mutex<EdgeState>>,
    runtime: Arc<ServiceRuntime<Self>>,
}

impl Service for EdgeService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let context = runtime.root_view_storage_context();
        let state = match EdgeState::load(context.clone()).await {
            Ok(state) => state,
            Err(_) => EdgeState::create_empty(context),
        };
        Self {
            state: Arc::new(Mutex::new(state)),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: Request) -> Response {
        let schema = Schema::build(
            QueryRoot {
                state: Arc::clone(&self.state),
                runtime: Arc::clone(&self.runtime),
            },
            MutationRoot {
                runtime: Arc::clone(&self.runtime),
            },
            SubscriptionRoot {},
        )
        .finish();
        schema.execute(request).await
    }
}

impl EdgeService {
    async fn check_and_execute_automatic_settlement(&self) {
        let mut state = self.state.lock().await;
        let current_time = self.runtime.system_time();
        
        let last_settle_time = match state.get_last_settle_time().await {
            Ok(time) => time,
            Err(_) => return,
        };
        
        let one_minute_micros: u64 = 60_000_000;
        if current_time.micros() - last_settle_time.micros() >= one_minute_micros {
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
                        let mut eligible_bettors = Vec::new();
                        
                        for (bettor, amount) in bettors {
                            match state.user_bets.get(&bettor).await {
                                Ok(Some(user_bets)) => {
                                    let has_eligible_bet = user_bets
                                        .iter()
                                        .any(|bet| {
                                            bet.app_id == *app_id && 
                                            current_time.micros() - bet.timestamp.micros() >= one_minute_micros
                                        });
                                    
                                    if has_eligible_bet {
                                        eligible_bettors.push((bettor, amount));
                                        has_eligible_bettors = true;
                                    }
                                },
                                _ => continue,
                            }
                        }
                        
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
                                    let bettor_address = bettor;
                                    let current_balance = state.get_user_balance(&bettor_address).await.unwrap_or(0);
                                    let _ = state.update_user_balance(&bettor_address, current_balance + reward_share).await;
                                    let _ = state.update_user_earnings(&bettor_address, reward_share).await;
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
        }
    }
}

pub struct QueryRoot {
    state: Arc<Mutex<EdgeState>>,
    runtime: Arc<ServiceRuntime<EdgeService>>,
}

#[derive(Clone, Serialize, Deserialize, Debug, SimpleObject)]
pub struct UserBet {
    pub app_id: String,
    pub amount: i64,
    pub timestamp: Timestamp,
}

#[derive(Clone, Serialize, Deserialize, Debug, SimpleObject)]
pub struct AppRanking {
    pub app_id: String,
    pub name: String,
    pub total_bet: u64,
    pub pool_contribution: u64,
    pub rank: u32,
    pub supporters: u32,
}

#[derive(Clone, Serialize, Deserialize, Debug, SimpleObject)]
pub struct UserRanking {
    pub user: AccountOwner,
    pub earnings: u64,
    pub rank: u32,
}

#[derive(Clone, Serialize, Deserialize, Debug, SimpleObject)]
pub struct UserEarningsData {
    pub daily: u64,
    pub weekly: u64,
    pub monthly: u64,
}

#[Object]
impl QueryRoot {
    async fn get_balance(&self, owner: Option<AccountOwner>) -> async_graphql::Result<u64> {
        let mut state = self.state.lock().await;
        let owner = match owner {
            Some(owner) => owner,
            None => return Err(async_graphql::Error::new("Owner must be specified")),
        };
        let balance = state.get_user_balance_with_initialization(&owner).await?;
        Ok(balance)
    }

    async fn get_user_bets(&self, owner: Option<AccountOwner>) -> async_graphql::Result<Vec<UserBet>> {
        let state = self.state.lock().await;
        let owner = match owner {
            Some(owner) => owner,
            None => return Err(async_graphql::Error::new("Owner must be specified")),
        };
        let bets = state.get_all_user_bets(&owner).await?;
        
        let mut user_bets = Vec::new();
        for bet in bets {
            user_bets.push(UserBet {
                app_id: bet.app_id,
                amount: bet.amount,
                timestamp: bet.timestamp,
            });
        }
        
        Ok(user_bets)
    }

    async fn get_app_total_bet(&self, app_id: String) -> async_graphql::Result<u64> {
        let state = self.state.lock().await;
        let total_bet = state.get_app_total_bet(&app_id).await?;
        Ok(total_bet)
    }

    async fn get_top_apps(&self, limit: Option<u32>) -> async_graphql::Result<Vec<AppRanking>> {
        let state = self.state.lock().await;
        let limit = limit.unwrap_or(10);
        
        let mut all_apps = Vec::new();
        state.app_info
            .for_each_index_value(|app_id, app_info| {
                all_apps.push((app_id.clone(), app_info.clone()));
                Ok(())
            })
            .await?;
        
        let app_totals = state.get_all_app_totals().await?;
        let totals_map: std::collections::HashMap<String, u64> = app_totals.into_iter().collect();
        
        let mut app_rankings = Vec::new();
        for (app_id, app_info) in all_apps {
            let total_bet = totals_map.get(&app_id).copied().unwrap_or(0);
            app_rankings.push((app_id, app_info, total_bet));
        }
        
        app_rankings.sort_by(|a, b| b.2.cmp(&a.2));
        
        let mut rankings = Vec::new();
        for (rank, (app_id, app_info, total_bet)) in app_rankings.into_iter().take(limit as usize).enumerate() {
            let pool_contribution = state.get_app_pool_contribution(&app_id).await.unwrap_or(0);
            let supporters = state.get_app_supporters_count(&app_id).await.unwrap_or(0);
            
            rankings.push(AppRanking {
                app_id,
                name: app_info.name.clone(),
                total_bet,
                pool_contribution,
                rank: (rank + 1) as u32,
                supporters,
            });
        }
        
        Ok(rankings)
    }

    async fn get_pool_amount(&self) -> async_graphql::Result<u64> {
        let state = self.state.lock().await;
        let pool_amount = state.get_pool_amount().await?;
        Ok(pool_amount)
    }

    async fn get_active_users_count(&self) -> async_graphql::Result<u64> {
        let state = self.state.lock().await;
        let count = state.get_active_users_count().await?;
        Ok(count)
    }

    async fn get_owner(&self) -> async_graphql::Result<Option<AccountOwner>> {
        let state = self.state.lock().await;
        let owner = state.get_owner().await?;
        match owner {
            Some(owner) => Ok(Some(owner)),
            None => Ok(None),
        }
    }

    async fn get_last_settle_time(&self) -> async_graphql::Result<Timestamp> {
        let state = self.state.lock().await;
        let last_settle_time = state.get_last_settle_time().await?;
        Ok(last_settle_time)
    }

    async fn is_whitelisted(&self, _ctx: &async_graphql::Context<'_>, address: AccountOwner) -> async_graphql::Result<bool> {
        let state = self.state.lock().await;
        let is_whitelisted = state.is_whitelisted(&address).await?;
        Ok(is_whitelisted)
    }

    async fn get_app_info(&self, app_id: String) -> async_graphql::Result<Option<AppInfo>> {
        let state = self.state.lock().await;
        let app_info = state.get_app_info(&app_id).await?;
        Ok(app_info)
    }

    async fn get_all_apps(&self) -> async_graphql::Result<Vec<AppInfo>> {
        let state = self.state.lock().await;
        
        let mut all_apps = Vec::new();
        
        match state.app_info.for_each_index_value(|_app_id, app_info| {
            all_apps.push(app_info.clone().into_owned());
            Ok(())
        }).await {
            Ok(_) => {
                if all_apps.is_empty() {
                    return Ok(vec![
                        AppInfo {
                            app_id: "system-empty".to_string(),
                            name: "System Message".to_string(),
                            description: "No application data found. Please add your first application.".to_string(),
                            added_at: self.runtime.system_time(),
                            is_active: false,
                        }
                    ]);
                }
                Ok(all_apps)
            },
            Err(e) => {
                let error_app = AppInfo {
                    app_id: "system-error".to_string(),
                    name: "Query Error".to_string(),
                    description: format!("Error querying application list: {:?}", e),
                    added_at: self.runtime.system_time(),
                    is_active: false,
                };
                Ok(vec![error_app])
            }
        }
    }

    async fn get_all_apps_for_betting(&self) -> async_graphql::Result<Vec<AppRanking>> {
        let state = self.state.lock().await;
        
        let mut all_apps = Vec::new();
        state.app_info
            .for_each_index_value(|app_id, app_info| {
                all_apps.push((app_id.clone(), app_info.clone().into_owned()));
                Ok(())
            })
            .await?;
        
        let app_totals = state.get_all_app_totals().await?;
        
        let totals_map: std::collections::HashMap<String, u64> = app_totals.into_iter().collect();
        
        let mut rankings = Vec::new();
        for (app_id, app_info) in all_apps {
            let total_bet = totals_map.get(&app_id).copied().unwrap_or(0);
            let pool_contribution = state.get_app_pool_contribution(&app_id).await.unwrap_or(0);
            let supporters = state.get_app_supporters_count(&app_id).await.unwrap_or(0);
            
            rankings.push(AppRanking {
                app_id,
                name: app_info.name.clone(),
                total_bet,
                pool_contribution,
                rank: 0,
                supporters,
            });
        }
        
        rankings.sort_by(|a, b| b.total_bet.cmp(&a.total_bet));
        
        
        for (rank, app) in rankings.iter_mut().enumerate() {
            app.rank = (rank + 1) as u32;
        }
        
        Ok(rankings)
    }

    async fn get_daily_leaderboard(&self, limit: Option<u32>) -> async_graphql::Result<Vec<UserRanking>> {
        let state = self.state.lock().await;
        let limit = limit.unwrap_or(10) as usize;
        
        let leaderboard = state.get_daily_leaderboard(limit).await?;
        
        let mut rankings = Vec::new();
        for (rank, (user, earnings)) in leaderboard.into_iter().enumerate() {
            rankings.push(UserRanking {
                user,
                earnings,
                rank: (rank + 1) as u32,
            });
        }
        
        Ok(rankings)
    }

    async fn get_weekly_leaderboard(&self, limit: Option<u32>) -> async_graphql::Result<Vec<UserRanking>> {
        let state = self.state.lock().await;
        let limit = limit.unwrap_or(10) as usize;
        
        let leaderboard = state.get_weekly_leaderboard(limit).await?;
        
        let mut rankings = Vec::new();
        for (rank, (user, earnings)) in leaderboard.into_iter().enumerate() {
            rankings.push(UserRanking {
                user,
                earnings,
                rank: (rank + 1) as u32,
            });
        }
        
        Ok(rankings)
    }

    async fn get_monthly_leaderboard(&self, limit: Option<u32>) -> async_graphql::Result<Vec<UserRanking>> {
        let state = self.state.lock().await;
        let limit = limit.unwrap_or(10) as usize;
        
        let leaderboard = state.get_monthly_leaderboard(limit).await?;
        
        let mut rankings = Vec::new();
        for (rank, (user, earnings)) in leaderboard.into_iter().enumerate() {
            rankings.push(UserRanking {
                user,
                earnings,
                rank: (rank + 1) as u32,
            });
        }
        
        Ok(rankings)
    }

    async fn get_user_earnings(&self, user: Option<AccountOwner>) -> async_graphql::Result<UserEarningsData> {
        let state = self.state.lock().await;
        let user = match user {
            Some(user) => user,
            None => return Err(async_graphql::Error::new("User must be specified")),
        };
        
        let daily = state.get_user_daily_earnings(&user).await?;
        let weekly = state.get_user_weekly_earnings(&user).await?;
        let monthly = state.get_user_monthly_earnings(&user).await?;
        
        Ok(UserEarningsData {
            daily,
            weekly,
            monthly
        })
    }
}

pub struct MutationRoot {
    runtime: Arc<ServiceRuntime<EdgeService>>,
}

pub struct SubscriptionRoot {
}

#[Object]
impl MutationRoot {
    async fn dummy_mutation(&self) -> async_graphql::Result<bool> {
        Ok(true)
    }

    async fn add_application(
        &self,
        _ctx: &async_graphql::Context<'_>,
        caller: AccountOwner,
        app_id: String,
        name: String,
        description: String,
    ) -> async_graphql::Result<String> {
        
        let operation = linera_edge::EdgeOperation::AddApplication {
            caller,
            app_id,
            name,
            description,
        };
        
        self.runtime.schedule_operation(&operation);
        
        Ok("Operation scheduled successfully".to_string())
    }

    async fn remove_application(
        &self,
        _ctx: &async_graphql::Context<'_>,
        caller: AccountOwner,
        app_id: String,
    ) -> async_graphql::Result<String> {
        
        let operation = linera_edge::EdgeOperation::RemoveApplication {
            caller,
            app_id,
        };
        
        self.runtime.schedule_operation(&operation);
        
        Ok("Operation scheduled successfully".to_string())
    }

    async fn place_bet(
        &self,
        _ctx: &async_graphql::Context<'_>,
        caller: AccountOwner,
        app_id: String,
        amount: u64,
    ) -> async_graphql::Result<bool> {
        
        let operation = linera_edge::EdgeOperation::Bet {
            caller,
            app_id,
            amount,
        };
        
        self.runtime.schedule_operation(&operation);
        
        Ok(true)
    }

    async fn redeem_bet(
        &self,
        _ctx: &async_graphql::Context<'_>,
        caller: AccountOwner,
        app_id: String,
        amount: u64,
    ) -> async_graphql::Result<u64> {
        
        let operation = linera_edge::EdgeOperation::Redeem {
            caller,
            app_id,
            amount,
        };
        
        self.runtime.schedule_operation(&operation);
        
        Ok(0)
    }

    async fn settle(
        &self,
        _ctx: &async_graphql::Context<'_>,
        caller: AccountOwner,
    ) -> async_graphql::Result<bool> {
        
        let operation = linera_edge::EdgeOperation::Settle {
            caller,
        };
        
        self.runtime.schedule_operation(&operation);
        
        Ok(true)
    }

    async fn inject_pool(
        &self,
        _ctx: &async_graphql::Context<'_>,
        caller: AccountOwner,
        amount: u64,
    ) -> async_graphql::Result<bool> {
        
        let operation = linera_edge::EdgeOperation::InjectPool {
            caller,
            amount,
        };
        
        self.runtime.schedule_operation(&operation);
        
        Ok(true)
    }
}

#[Subscription]
impl SubscriptionRoot {
    async fn dummy_subscription(&self) -> impl futures::Stream<Item = async_graphql::Result<String>> {
        use async_graphql::futures_util::stream;
        
        stream::once(async { Ok("Subscription is working".to_string()) })
    }
}