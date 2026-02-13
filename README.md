# Linera Edge - dApp 排名预测与积分投注应用

一个基于 Linera 区块链的去中心化 dApp 排名预测和积分投注平台，支持中英文国际化界面。

## 🌟 项目概述

**Linera Edge** 允许用户对 Linera 生态中的 dApp 进行积分投注，预测其排名，并通过竞争性奖励机制获得收益。平台采用前后端分离架构，提供流畅的用户体验。

### 核心功能
- **积分系统**: 每个用户首次交互获得 100 积分
- **投注机制**: 对任意 dApp 进行积分投注
- **赎回功能**: 随时赎回投注本金（扣除 1% 手续费，向上取整，最低 1 积分）
- **自动结算**: 每分钟自动分配奖励给前 10 名 dApp 的支持者
- **实时排行**: 实时查看 dApp 排名和投注数据
- **用户排行榜**: 查看用户收益排行榜
- **国际化支持**: 中英文界面切换
- **权限管理**: 只有白名单用户可以管理应用

## 📋 功能特性

### 1. 积分系统
- 首次交互自动获得 100 积分
- 积分用于投注，不能直接提现
- 单个 dApp 投注上限 100 积分

### 2. 投注功能
- 对任意 Linera 生态 dApp 进行投注
- 实时更新 dApp 总投注额和用户个人记录
- 投注金额必须为正整数 ≥1

### 3. 赎回功能
- 随时部分/全部赎回投注本金
- 1% 手续费进入平台奖池（向上取整，最低 1 积分）
- 赎回金额扣除手续费后返还用户余额
- 赎回金额必须为正整数 ≥1

### 4. 结算机制
- 每分钟自动结算一次（由定时脚本触发）
- 前 10 名 dApp 的支持者获得奖励
- 平台奖池 10% 用于分配
- 固定权重比例：15%, 14%, 13%, 12%, 11%, 10%, 9%, 8%, 7%, 6%
- 支持人数 bonus 机制：每增加一名支持者，奖励增加 10%，最高 100%
- 增长 bonus 机制：排名 5-10 的应用额外获得 5-25% 奖励
- 新应用 bonus 机制：上线 7 天内的应用额外获得 20% 奖励

### 5. 查询功能
- 用户余额查询
- 用户投注记录查询
- dApp 总投注额查询
- 前 N 名 dApp 排行查询
- 平台奖池金额查询

## 🏗️ 技术架构

### 技术栈
- **后端**: Rust + Linera SDK + GraphQL
- **前端**: React + TypeScript + Tailwind CSS + Apollo Client
- **状态管理**: Linera Views (MapView, RegisterView) + React Context
- **查询接口**: GraphQL API
- **存储**: 链上状态存储
- **国际化**: react-i18next

### 核心组件
- **后端**:
  - `contract.rs`: 智能合约实现
  - `service.rs`: GraphQL 服务实现
  - `state.rs`: 状态管理
  - `types.rs`: 数据类型定义
- **前端**:
  - `src/pages/`: React 页面组件
  - `src/components/`: 通用 UI 组件
  - `src/services/`: GraphQL 客户端和业务逻辑
  - `src/context/`: React Context 状态管理
  - `src/i18n.ts`: 国际化配置
  - `run_settlement.js`: 自动结算脚本

## 🚀 快速开始

### 推荐方式：使用一键安装脚本
```bash
cd examples/Linera-edge
chmod +x install.sh
./install.sh
```

**脚本会自动完成以下操作：**
- 构建后端 WASM 模块
- 发布模块到 Linera 网络
- 创建应用
- 配置前端环境变量
- 安装前端依赖
- 启动 GraphQL 服务（端口 8080）
- 启动前端开发服务器（端口 3000）
- 启动自动结算脚本（每分钟运行一次）

**安装完成后，脚本会显示：**
- 应用 ID
- 链 ID
- 前端访问地址
- GraphQL API 端点

### 手动方式（高级用户）

#### 1. 构建后端应用
```bash
cd examples/Linera-edge
cargo build --release --target wasm32-unknown-unknown
```

#### 2. 部署后端应用
```bash
# 发布模块
linera publish-module target/wasm32-unknown-unknown/release/linera_edge_{contract,service}.wasm

# 创建应用
linera create-application <MODULE_ID> <CHAIN_ID> --json-argument "{}"
```

#### 3. 启动 GraphQL 服务
```bash
linera service --port 8080
```

#### 4. 配置前端环境
```bash
cd examples/Linera-edge/web-frontend
cp .env.example .env
# 编辑 .env 文件，填写相关配置
```

#### 5. 安装前端依赖
```bash
cd examples/Linera-edge/web-frontend
npm install
```

#### 6. 启动前端开发服务器
```bash
cd examples/Linera-edge/web-frontend
npm run dev
```

#### 7. 启动自动结算脚本
```bash
cd examples/Linera-edge/web-frontend
npm run settlement
```

## 📊 GraphQL API

### 查询接口
```graphql
# 查询用户余额
query GetBalance($owner: AccountOwner) {
  getBalance(owner: $owner)
}

# 查询用户投注记录
query GetUserBets($owner: AccountOwner) {
  getUserBets(owner: $owner) {
    appId
    amount
    timestamp
  }
}

# 查询 dApp 总投注额
query GetAppTotalBet($appId: String!) {
  getAppTotalBet(appId: $appId)
}

# 查询前 N 名 dApp
query GetTopApps($limit: Int) {
  getTopApps(limit: $limit) {
    appId
    name
    totalBet
    rank
    supporters
  }
}

# 查询平台奖池
query GetPoolAmount {
  getPoolAmount
}

# 查询活跃用户数
query GetActiveUsersCount {
  getActiveUsersCount
}

# 查询最后结算时间
query GetLastSettleTime {
  getLastSettleTime
}

# 查询所有可投注 dApp
query GetAllAppsForBetting {
  getAllAppsForBetting {
    appId
    name
    totalBet
    rank
    supporters
  }
}

# 查询用户是否在白名单中
query IsWhitelisted($address: AccountOwner!) {
  isWhitelisted(address: $address)
}

# 查询每日排行榜
query GetDailyLeaderboard($limit: Int) {
  getDailyLeaderboard(limit: $limit) {
    user
    earnings
    rank
  }
}

# 查询每周排行榜
query GetWeeklyLeaderboard($limit: Int) {
  getWeeklyLeaderboard(limit: $limit) {
    user
    earnings
    rank
  }
}

# 查询每月排行榜
query GetMonthlyLeaderboard($limit: Int) {
  getMonthlyLeaderboard(limit: $limit) {
    user
    earnings
    rank
  }
}
```

### 操作接口
```graphql
# 投注操作
mutation PlaceBet($caller: AccountOwner!, $appId: String!, $amount: Int!) {
  placeBet(caller: $caller, appId: $appId, amount: $amount)
}

# 赎回操作  
mutation RedeemBet($caller: AccountOwner!, $appId: String!, $amount: Int!) {
  redeemBet(caller: $caller, appId: $appId, amount: $amount)
}

# 结算操作（仅白名单用户）
mutation Settle($caller: AccountOwner!) {
  settle(caller: $caller)
}

# 添加应用（仅白名单用户）
mutation AddApplication($caller: AccountOwner!, $appId: String!, $name: String!, $description: String!) {
  addApplication(caller: $caller, appId: $appId, name: $name, description: $description)
}

# 移除应用（仅白名单用户）
mutation RemoveApplication($caller: AccountOwner!, $appId: String!) {
  removeApplication(caller: $caller, appId: $appId)
}
```

## 🔒 权限与安全

- **白名单用户**: 只有白名单中的用户可以管理应用和触发结算
- **用户权限**: 所有用户可投注和赎回自己的积分
- **安全验证**: 所有操作都经过链上验证
- **地址格式**: 支持带 0x 前缀和不带前缀的地址格式
- **输入验证**: 所有金额必须为正整数 ≥1

## 🔮 未来扩展

- 使用真实 ApplicationId 替换 String app_id
- 添加多市场支持
- 实时推送通知
- 自动 oracle 结算
- 个人排名系统
- 添加更多语言支持
- 实现移动端适配
- 添加社交分享功能
- 集成更多钱包类型
- 实现更复杂的奖励机制

## 📞 技术支持

如有问题，请参考 Linera 官方文档或提交 issue。