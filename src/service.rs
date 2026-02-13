#![cfg_attr(target_arch = "wasm32", no_main)]

use linera_edge::state::{EdgeState, AppInfo};
use async_graphql::{Object, Request, Response, Schema, SimpleObject, Subscription};
use linera_sdk::{Service, ServiceRuntime};
use linera_sdk::abi::WithServiceAbi;
use linera_sdk::linera_base_types::{AccountOwner, Timestamp, Amount};
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



pub struct QueryRoot {
    state: Arc<Mutex<EdgeState>>,
    runtime: Arc<ServiceRuntime<EdgeService>>,
}

#[derive(Clone, Serialize, Deserialize, Debug, SimpleObject)]
pub struct UserBet {
    pub app_id: String,
    pub amount: Amount,
    pub timestamp: Timestamp,
}

#[derive(Clone, Serialize, Deserialize, Debug, SimpleObject)]
pub struct AppRanking {
    pub app_id: String,
    pub name: String,
    pub total_bet: Amount,
    pub pool_contribution: Amount,
    pub rank: u32,
    pub supporters: u32,
}

#[derive(Clone, Serialize, Deserialize, Debug, SimpleObject)]
pub struct UserRanking {
    pub user: AccountOwner,
    pub earnings: Amount,
    pub rank: u32,
}

#[derive(Clone, Serialize, Deserialize, Debug, SimpleObject)]
pub struct UserEarningsData {
    pub daily: Amount,
    pub weekly: Amount,
    pub monthly: Amount,
}

#[Object]
impl QueryRoot {
    async fn get_balance(&self, owner: Option<AccountOwner>) -> async_graphql::Result<Amount> {
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

    async fn get_app_total_bet(&self, app_id: String) -> async_graphql::Result<Amount> {
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
        let totals_map: std::collections::HashMap<String, Amount> = app_totals.into_iter().collect();
        
        let mut app_rankings = Vec::new();
        for (app_id, app_info) in all_apps {
            let total_bet = totals_map.get(&app_id).copied().unwrap_or(Amount::ZERO);
            app_rankings.push((app_id, app_info, total_bet));
        }
        
        app_rankings.sort_by(|a, b| b.2.cmp(&a.2));
        
        let mut rankings = Vec::new();
        for (rank, (app_id, app_info, total_bet)) in app_rankings.into_iter().take(limit as usize).enumerate() {
            let pool_contribution = state.get_app_pool_contribution(&app_id).await.unwrap_or(Amount::ZERO);
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

    async fn get_pool_amount(&self) -> async_graphql::Result<Amount> {
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
        
        let totals_map: std::collections::HashMap<String, Amount> = app_totals.into_iter().collect();
        
        let mut rankings = Vec::new();
        for (app_id, app_info) in all_apps {
            let total_bet = totals_map.get(&app_id).copied().unwrap_or(Amount::ZERO);
            let pool_contribution = state.get_app_pool_contribution(&app_id).await.unwrap_or(Amount::ZERO);
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
        amount: Amount,
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
        amount: Amount,
    ) -> async_graphql::Result<Amount> {
        
        let operation = linera_edge::EdgeOperation::Redeem {
            caller,
            app_id,
            amount,
        };
        
        self.runtime.schedule_operation(&operation);
        
        Ok(Amount::ZERO)
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
        amount: Amount,
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