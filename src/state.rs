use linera_sdk::views::{linera_views, MapView, RegisterView, RootView, View, ViewError};
use linera_sdk::ViewStorageContext;
use linera_sdk::views::linera_views::context::Context;
use linera_sdk::linera_base_types::{AccountOwner, Timestamp};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone, async_graphql::SimpleObject)]
pub struct AppInfo {
    pub app_id: String,
    pub name: String,
    pub description: String,
    pub added_at: Timestamp,
    pub is_active: bool,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct UserBet {
    pub app_id: String,
    pub amount: i64,
    pub timestamp: Timestamp,
}

#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct EdgeState {
    pub user_balances: MapView<AccountOwner, u64>,
    pub user_bets: MapView<AccountOwner, Vec<UserBet>>,
    pub app_total_bets: MapView<String, u64>,
    pub app_pool_contributions: MapView<String, u64>,
    pub pool_amount: RegisterView<u64>,
    pub last_settle_time: RegisterView<Timestamp>,
    pub owner: RegisterView<Option<AccountOwner>>,
    pub app_info: MapView<String, AppInfo>,
    pub user_daily_earnings: MapView<AccountOwner, u64>,
    pub user_weekly_earnings: MapView<AccountOwner, u64>,
    pub user_monthly_earnings: MapView<AccountOwner, u64>,
    pub last_daily_reset: RegisterView<Timestamp>,
    pub last_weekly_reset: RegisterView<Timestamp>,
    pub last_monthly_reset: RegisterView<Timestamp>,
    pub whitelist: MapView<AccountOwner, bool>,
}

impl EdgeState {
    pub fn create_empty(context: ViewStorageContext) -> Self {
        Self {
            user_balances: MapView::new(context.clone()).expect("Failed to create user_balances map"),
            user_bets: MapView::new(context.clone()).expect("Failed to create user_bets map"),
            app_total_bets: MapView::new(context.clone()).expect("Failed to create app_total_bets map"),
            app_pool_contributions: MapView::new(context.clone()).expect("Failed to create app_pool_contributions map"),
            pool_amount: RegisterView::new(context.clone()).expect("Failed to create pool_amount register"),
            last_settle_time: RegisterView::new(context.clone()).expect("Failed to create last_settle_time register"),
            owner: RegisterView::new(context.clone()).expect("Failed to create owner register"),
            app_info: MapView::new(context.clone()).expect("Failed to create app_info map"),
            user_daily_earnings: MapView::new(context.clone()).expect("Failed to create user_daily_earnings map"),
            user_weekly_earnings: MapView::new(context.clone()).expect("Failed to create user_weekly_earnings map"),
            user_monthly_earnings: MapView::new(context.clone()).expect("Failed to create user_monthly_earnings map"),
            last_daily_reset: RegisterView::new(context.clone()).expect("Failed to create last_daily_reset register"),
            last_weekly_reset: RegisterView::new(context.clone()).expect("Failed to create last_weekly_reset register"),
            last_monthly_reset: RegisterView::new(context.clone()).expect("Failed to create last_monthly_reset register"),
            whitelist: MapView::new(context.clone()).expect("Failed to create whitelist map"),
        }
    }

    pub async fn load(context: ViewStorageContext) -> Result<Self, ViewError> {
        let user_balances_context = context.clone_with_base_key(b"edge_user_balances".to_vec());
        let user_bets_context = context.clone_with_base_key(b"edge_user_bets".to_vec());
        let app_total_bets_context = context.clone_with_base_key(b"edge_app_total_bets".to_vec());
        let app_pool_contributions_context = context.clone_with_base_key(b"edge_app_pool_contributions".to_vec());
        let pool_amount_context = context.clone_with_base_key(b"edge_pool_amount".to_vec());
        let last_settle_time_context = context.clone_with_base_key(b"edge_last_settle_time".to_vec());
        let owner_context = context.clone_with_base_key(b"edge_owner".to_vec());
        let app_info_context = context.clone_with_base_key(b"edge_app_info".to_vec());
        let user_daily_earnings_context = context.clone_with_base_key(b"edge_user_daily_earnings".to_vec());
        let user_weekly_earnings_context = context.clone_with_base_key(b"edge_user_weekly_earnings".to_vec());
        let user_monthly_earnings_context = context.clone_with_base_key(b"edge_user_monthly_earnings".to_vec());
        let last_daily_reset_context = context.clone_with_base_key(b"edge_last_daily_reset".to_vec());
        let last_weekly_reset_context = context.clone_with_base_key(b"edge_last_weekly_reset".to_vec());
        let last_monthly_reset_context = context.clone_with_base_key(b"edge_last_monthly_reset".to_vec());
        let whitelist_context = context.clone_with_base_key(b"edge_whitelist".to_vec());

        let user_balances = MapView::load(user_balances_context).await?;
        let user_bets = MapView::load(user_bets_context).await?;
        let app_total_bets = MapView::load(app_total_bets_context).await?;
        let app_pool_contributions = MapView::load(app_pool_contributions_context).await?;
        let pool_amount = RegisterView::load(pool_amount_context).await?;
        let last_settle_time = RegisterView::load(last_settle_time_context).await?;
        let owner = RegisterView::load(owner_context).await?;
        let app_info = MapView::load(app_info_context).await?;
        let user_daily_earnings = MapView::load(user_daily_earnings_context).await?;
        let user_weekly_earnings = MapView::load(user_weekly_earnings_context).await?;
        let user_monthly_earnings = MapView::load(user_monthly_earnings_context).await?;
        let last_daily_reset = RegisterView::load(last_daily_reset_context).await?;
        let last_weekly_reset = RegisterView::load(last_weekly_reset_context).await?;
        let last_monthly_reset = RegisterView::load(last_monthly_reset_context).await?;
        let whitelist = MapView::load(whitelist_context).await?;

        Ok(Self {
            user_balances,
            user_bets,
            app_total_bets,
            app_pool_contributions,
            pool_amount,
            last_settle_time,
            owner,
            app_info,
            user_daily_earnings,
            user_weekly_earnings,
            user_monthly_earnings,
            last_daily_reset,
            last_weekly_reset,
            last_monthly_reset,
            whitelist,
        })
    }

    pub async fn initialize_user_balance(&mut self, owner: &AccountOwner) -> Result<(), ViewError> {
        if !self.user_balances.contains_key(owner).await? {
            self.user_balances.insert(owner, 50)?;
        }
        Ok(())
    }
    
    pub async fn is_whitelisted(&self, address: &AccountOwner) -> Result<bool, ViewError> {
        let address_lowercase: AccountOwner = address.to_string().to_lowercase().parse()
            .map_err(|_| ViewError::NotFound("Failed to parse address for whitelist check".to_string()))?;
        let is_whitelisted = self.whitelist.get(&address_lowercase).await?.unwrap_or(false);
        Ok(is_whitelisted)
    }

    pub async fn get_user_balance(&self, owner: &AccountOwner) -> Result<u64, ViewError> {
        match self.user_balances.get(owner).await? {
            Some(balance) => Ok(balance),
            None => Ok(0),
        }
    }

    pub async fn get_user_balance_with_initialization(&mut self, owner: &AccountOwner) -> Result<u64, ViewError> {
        let balance = self.user_balances.get(owner).await?;
        match balance {
            Some(balance) => Ok(balance),
            None => {
                self.user_balances.insert(owner, 50)?;
                match self.user_balances.get(owner).await? {
                    Some(balance) => Ok(balance),
                    None => {
                        Ok(50)
                    }
                }
            }
        }
    }

    pub async fn update_user_balance(&mut self, owner: &AccountOwner, amount: u64) -> Result<(), ViewError> {
        self.user_balances.insert(owner, amount)?;
        Ok(())
    }

    pub async fn get_user_app_bet(&self, owner: &AccountOwner, app_id: &str) -> Result<u64, ViewError> {
        match self.user_bets.get(owner).await? {
            Some(user_bets) => {
                let total_amount: i64 = user_bets.iter()
                    .filter(|bet| bet.app_id == app_id)
                    .map(|bet| bet.amount)
                    .sum();
                Ok(total_amount.max(0) as u64)
            },
            None => Ok(0),
        }
    }

    pub async fn get_all_user_bets(&self, owner: &AccountOwner) -> Result<Vec<UserBet>, ViewError> {
        match self.user_bets.get(owner).await? {
            Some(user_bets) => {
                Ok(user_bets.clone())
            }
            None => Ok(Vec::new()),
        }
    }

    pub async fn update_user_bet(&mut self, owner: &AccountOwner, app_id: String, amount: i64, timestamp: Timestamp) -> Result<(), ViewError> {
        let mut user_bets = match self.user_bets.get(owner).await? {
            Some(bets) => bets.clone(),
            None => Vec::new(),
        };
        
        if let Some(existing_bet) = user_bets.iter_mut().find(|bet| bet.app_id == app_id) {
            existing_bet.amount = amount;
        } else {
            user_bets.push(UserBet {
                app_id,
                amount,
                timestamp
            });
        }
        
        self.user_bets.insert(owner, user_bets)?;
        
        Ok(())
    }

    pub async fn get_app_total_bet(&self, app_id: &str) -> Result<u64, ViewError> {
        match self.app_total_bets.get(app_id).await? {
            Some(amount) => Ok(amount),
            None => Ok(0),
        }
    }

    pub async fn update_app_total_bet(&mut self, app_id: String, amount: u64) -> Result<(), ViewError> {
        self.app_total_bets.insert(&app_id, amount)?;
        Ok(())
    }

    pub async fn get_app_pool_contribution(&self, app_id: &str) -> Result<u64, ViewError> {
        match self.app_pool_contributions.get(app_id).await? {
            Some(amount) => Ok(amount),
            None => Ok(0),
        }
    }

    pub async fn update_app_pool_contribution(&mut self, app_id: String, amount: u64) -> Result<(), ViewError> {
        self.app_pool_contributions.insert(&app_id, amount)?;
        Ok(())
    }

    pub async fn get_pool_amount(&self) -> Result<u64, ViewError> {
        Ok(*self.pool_amount.get())
    }

    pub async fn update_pool_amount(&mut self, amount: u64) -> Result<(), ViewError> {
        self.pool_amount.set(amount);
        Ok(())
    }

    pub async fn get_last_settle_time(&self) -> Result<Timestamp, ViewError> {
        Ok(self.last_settle_time.get().clone())
    }

    pub async fn update_last_settle_time(&mut self, timestamp: Timestamp) -> Result<(), ViewError> {
        self.last_settle_time.set(timestamp);
        Ok(())
    }

    pub async fn get_owner(&self) -> Result<Option<AccountOwner>, ViewError> {
        Ok(self.owner.get().clone())
    }

    pub async fn set_owner(&mut self, owner: AccountOwner) -> Result<(), ViewError> {
        self.owner.set(Some(owner.clone()));

        let owner_lowercase = owner.to_string().to_lowercase().parse()
            .map_err(|_| ViewError::NotFound("Failed to parse owner address".to_string()))?;
        self.whitelist.insert(&owner_lowercase, true)?;

        let user_address = "0xa0916f957038344afff8c117b0a568562f73f0f2";
        let user_address_lowercase = user_address.to_lowercase().parse()
            .map_err(|_| ViewError::NotFound("Failed to parse user address".to_string()))?;
        self.whitelist.insert(&user_address_lowercase, true)?;

        self.save().await?;
        Ok(())
    }

    pub async fn get_all_app_totals(&self) -> Result<Vec<(String, u64)>, ViewError> {
        let mut apps = Vec::new();
        self.app_total_bets
            .for_each_index_value(|app_id, total_bet| {
                apps.push((app_id.clone(), *total_bet));
                Ok(())
            })
            .await?;
        Ok(apps)
    }

    pub async fn get_user_points(&self, owner: &AccountOwner) -> Result<u64, ViewError> {
        Ok(self.user_balances.get(owner).await?.unwrap_or(0))
    }

    pub async fn get_app_info(&self, app_id: &str) -> Result<Option<AppInfo>, ViewError> {
        Ok(self.app_info.get(app_id).await?)
    }

    pub async fn add_app_info(&mut self, app_id: String, app_info: AppInfo) -> Result<(), ViewError> {
        self.app_info.insert(&app_id, app_info)?;
        Ok(())
    }

    pub async fn remove_app_info(&mut self, app_id: &str) -> Result<(), ViewError> {
        self.app_info.remove(app_id)?;
        Ok(())
    }

    pub async fn get_app_bettors(&self, app_id: &str) -> Result<Vec<(AccountOwner, u64)>, ViewError> {
        let mut bettors = Vec::new();
        
        self.user_bets
            .for_each_index_value(|owner, user_bets| {
                let total_amount: i64 = user_bets.iter()
                    .filter(|bet| bet.app_id == app_id)
                    .map(|bet| bet.amount)
                    .sum();
                
                if total_amount > 0 {
                    bettors.push((owner.clone(), total_amount as u64));
                }
                Ok(())
            })
            .await?;
        
        Ok(bettors)
    }
    
    pub async fn get_active_users_count(&self) -> Result<u64, ViewError> {
        let mut count: u64 = 0;
        self.user_bets
            .for_each_index_value(|_owner, bets| {
                if !bets.is_empty() {
                    count += 1;
                }
                Ok(())
            })
            .await?;
        Ok(count)
    }
    
    pub async fn get_app_supporters_count(&self, app_id: &str) -> Result<u32, ViewError> {
        let mut count: u32 = 0;
        self.user_bets
            .for_each_index_value(|_owner, bets| {
                if bets.iter().any(|bet| bet.app_id == app_id && bet.amount > 0) {
                    count += 1;
                }
                Ok(())
            })
            .await?;
        Ok(count)
    }

    pub async fn record_user_bet(&mut self, owner: &AccountOwner, app_id: &str, amount: i64, timestamp: Timestamp) -> Result<(), ViewError> {
        let mut bets = self.user_bets.get(owner).await?.unwrap_or_default();
        
        bets.push(UserBet {
            app_id: app_id.to_string(),
            amount,
            timestamp,
        });
        
        self.user_bets.insert(owner, bets)?;
        Ok(())
    }

    pub async fn clear_user_bets_for_app(&mut self, owner: &AccountOwner, app_id: &str) -> Result<(), ViewError> {
        let mut bets = self.user_bets.get(owner).await?.unwrap_or_default();
        
        bets.retain(|bet| bet.app_id != app_id);
        
        if bets.is_empty() {
            self.user_bets.remove(owner)?;
        } else {
            self.user_bets.insert(owner, bets)?;
        }
        
        Ok(())
    }

    pub async fn update_user_points(&mut self, owner: &AccountOwner, points: u64) -> Result<(), ViewError> {
        self.user_balances.insert(owner, points)?;
        Ok(())
    }

    pub async fn get_user_daily_earnings(&self, owner: &AccountOwner) -> Result<u64, ViewError> {
        Ok(self.user_daily_earnings.get(owner).await?.unwrap_or(0))
    }

    pub async fn get_user_weekly_earnings(&self, owner: &AccountOwner) -> Result<u64, ViewError> {
        Ok(self.user_weekly_earnings.get(owner).await?.unwrap_or(0))
    }

    pub async fn get_user_monthly_earnings(&self, owner: &AccountOwner) -> Result<u64, ViewError> {
        Ok(self.user_monthly_earnings.get(owner).await?.unwrap_or(0))
    }

    pub async fn update_user_earnings(&mut self, owner: &AccountOwner, amount: u64) -> Result<(), ViewError> {
        let daily_earnings = self.get_user_daily_earnings(owner).await?;
        self.user_daily_earnings.insert(owner, daily_earnings + amount)?;
        
        let weekly_earnings = self.get_user_weekly_earnings(owner).await?;
        self.user_weekly_earnings.insert(owner, weekly_earnings + amount)?;
        
        let monthly_earnings = self.get_user_monthly_earnings(owner).await?;
        self.user_monthly_earnings.insert(owner, monthly_earnings + amount)?;
        
        Ok(())
    }

    pub async fn get_last_daily_reset(&self) -> Result<Timestamp, ViewError> {
        Ok(self.last_daily_reset.get().clone())
    }

    pub async fn get_last_weekly_reset(&self) -> Result<Timestamp, ViewError> {
        Ok(self.last_weekly_reset.get().clone())
    }

    pub async fn get_last_monthly_reset(&self) -> Result<Timestamp, ViewError> {
        Ok(self.last_monthly_reset.get().clone())
    }

    pub async fn update_last_daily_reset(&mut self, timestamp: Timestamp) -> Result<(), ViewError> {
        self.last_daily_reset.set(timestamp);
        Ok(())
    }

    pub async fn update_last_weekly_reset(&mut self, timestamp: Timestamp) -> Result<(), ViewError> {
        self.last_weekly_reset.set(timestamp);
        Ok(())
    }

    pub async fn update_last_monthly_reset(&mut self, timestamp: Timestamp) -> Result<(), ViewError> {
        self.last_monthly_reset.set(timestamp);
        Ok(())
    }

    pub async fn check_and_perform_resets(&mut self, current_time: Timestamp) -> Result<(), ViewError> {
        let last_daily = self.get_last_daily_reset().await?;
        let twenty_four_hours = 24 * 60 * 60 * 1_000_000;
        if current_time.micros() - last_daily.micros() >= twenty_four_hours {
            self.reset_daily_earnings().await?;
            self.update_last_daily_reset(current_time).await?;
        }
        
        let last_weekly = self.get_last_weekly_reset().await?;
        let seven_days = 7 * 24 * 60 * 60 * 1_000_000;
        if current_time.micros() - last_weekly.micros() >= seven_days {
            self.reset_weekly_earnings().await?;
            self.update_last_weekly_reset(current_time).await?;
        }
        
        let last_monthly = self.get_last_monthly_reset().await?;
        let thirty_days = 30 * 24 * 60 * 60 * 1_000_000;
        if current_time.micros() - last_monthly.micros() >= thirty_days {
            self.reset_monthly_earnings().await?;
            self.update_last_monthly_reset(current_time).await?;
        }
        
        Ok(())
    }

    pub async fn reset_daily_earnings(&mut self) -> Result<(), ViewError> {
        let mut users = Vec::new();
        self.user_daily_earnings.for_each_index(|user| {
            users.push(user.clone());
            Ok(())
        }).await?;
        
        for user in users {
            self.user_daily_earnings.remove(&user)?;
        }
        
        Ok(())
    }

    pub async fn reset_weekly_earnings(&mut self) -> Result<(), ViewError> {
        let mut users = Vec::new();
        self.user_weekly_earnings.for_each_index(|user| {
            users.push(user.clone());
            Ok(())
        }).await?;
        
        for user in users {
            self.user_weekly_earnings.remove(&user)?;
        }
        
        Ok(())
    }

    pub async fn reset_monthly_earnings(&mut self) -> Result<(), ViewError> {
        let mut users = Vec::new();
        self.user_monthly_earnings.for_each_index(|user| {
            users.push(user.clone());
            Ok(())
        }).await?;
        
        for user in users {
            self.user_monthly_earnings.remove(&user)?;
        }
        
        Ok(())
    }

    pub async fn get_daily_leaderboard(&self, limit: usize) -> Result<Vec<(AccountOwner, u64)>, ViewError> {
        let mut leaderboard = Vec::new();
        
        self.user_daily_earnings.for_each_index_value(|user, earnings| {
            leaderboard.push((user.clone(), *earnings));
            Ok(())
        }).await?;
        
        leaderboard.sort_by(|a, b| b.1.cmp(&a.1));
        
        Ok(leaderboard.into_iter().take(limit).collect())
    }

    pub async fn get_weekly_leaderboard(&self, limit: usize) -> Result<Vec<(AccountOwner, u64)>, ViewError> {
        let mut leaderboard = Vec::new();
        
        self.user_weekly_earnings.for_each_index_value(|user, earnings| {
            leaderboard.push((user.clone(), *earnings));
            Ok(())
        }).await?;
        
        leaderboard.sort_by(|a, b| b.1.cmp(&a.1));
        
        Ok(leaderboard.into_iter().take(limit).collect())
    }

    pub async fn get_monthly_leaderboard(&self, limit: usize) -> Result<Vec<(AccountOwner, u64)>, ViewError> {
        let mut leaderboard = Vec::new();
        
        self.user_monthly_earnings.for_each_index_value(|user, earnings| {
            leaderboard.push((user.clone(), *earnings));
            Ok(())
        }).await?;
        
        leaderboard.sort_by(|a, b| b.1.cmp(&a.1));
        
        Ok(leaderboard.into_iter().take(limit).collect())
    }
}