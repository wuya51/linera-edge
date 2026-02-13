#![cfg_attr(target_arch = "wasm32", no_main)]

pub mod state;

use serde::{Deserialize, Serialize};
use linera_sdk::abi::{ContractAbi, ServiceAbi};
use linera_sdk::linera_base_types::{AccountOwner, Amount};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum EdgeOperation {
    Bet { caller: AccountOwner, app_id: String, amount: Amount },
    Redeem { caller: AccountOwner, app_id: String, amount: Amount },
    Settle { caller: AccountOwner },
    AddApplication { caller: AccountOwner, app_id: String, name: String, description: String },
    RemoveApplication { caller: AccountOwner, app_id: String },
    InjectPool { caller: AccountOwner, amount: Amount },
}

pub struct EdgeAbi;

impl ContractAbi for EdgeAbi {
    type Operation = EdgeOperation;
    type Response = ();
}

impl ServiceAbi for EdgeAbi {
    type Query = async_graphql::Request;
    type QueryResponse = async_graphql::Response;
}