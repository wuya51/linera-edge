#!/usr/bin/env bash

set -eu

# Get script directory and linera-protocol directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "脚本目录: $SCRIPT_DIR"
LINERA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "Linera协议目录: $LINERA_DIR"

# Get application name (current directory name)
APP_NAME=$(basename "$SCRIPT_DIR")
echo "应用名称: $APP_NAME"

# Check and add application to examples/Cargo.toml workspace
EXAMPLES_CARGO_TOML="$LINERA_DIR/examples/Cargo.toml"
if [ -f "$EXAMPLES_CARGO_TOML" ]; then
    # Check if application is already in workspace members list
    if ! grep -q "\"$APP_NAME\"" "$EXAMPLES_CARGO_TOML"; then
        echo "添加应用 $APP_NAME 到 workspace members 列表..."
        # Add application name to members list, after the last entry
        sed -i '/^members = \[/,/^]$/ s/^]$/    "'"$APP_NAME"'",\n]/' "$EXAMPLES_CARGO_TOML"
        echo "已添加 $APP_NAME 到 workspace members 列表"
        
        # Check if application is already in workspace.dependencies
        if ! grep -q "linera_edge = { path" "$EXAMPLES_CARGO_TOML"; then
            # Add application dependency to workspace.dependencies section
            echo "添加 linera_edge 到 workspace dependencies..."
            # Find the last workspace dependency and add after it
            LAST_DEP=$(grep -n "= { path = \"\.\/" "$EXAMPLES_CARGO_TOML" | tail -1 | cut -d: -f1)
            if [ -n "$LAST_DEP" ]; then
                sed -i "${LAST_DEP}a linera_edge = { path = \"./${APP_NAME}\" }" "$EXAMPLES_CARGO_TOML"
            else
                # If no other dependencies found, add after [workspace.dependencies]
                sed -i '/^\[workspace.dependencies\]/a linera_edge = { path = "./"'"$APP_NAME"'" }' "$EXAMPLES_CARGO_TOML"
            fi
            echo "已添加 linera_edge 到 workspace dependencies"
        else
            echo "应用 linera_edge 已在 workspace dependencies 中，跳过"
        fi
    else
        echo "应用 $APP_NAME 已在 workspace members 列表中"
    fi
else
    echo "警告: examples/Cargo.toml 文件未找到"
fi

# Set up directories and environment variables (使用Linera新默认目录)
DIR=$HOME/.config/linera
mkdir -p $DIR

# 导出环境变量
export LINERA_WALLET="$DIR/wallet.json"
export LINERA_KEYSTORE="$DIR/keystore.json"
export LINERA_STORAGE="rocksdb:$DIR/wallet.db"

# Switch to linera-protocol directory to execute Linera commands
cd "$LINERA_DIR"

# 检查并停止可能存在的Linera服务
echo "检查并停止可能存在的Linera服务..."
pkill -f "linera service" || true
sleep 2

# 跳过数据库锁定检查以避免权限问题
echo "跳过数据库锁定检查（新目录结构不需要）..."

# Check if wallet exists, initialize if it doesn't
if [ ! -f "$LINERA_WALLET" ]; then
    echo "钱包不存在，正在初始化..."
    linera wallet init --faucet https://faucet.testnet-conway.linera.net
    
    # 导出私钥信息用于开发测试
    echo "导出钱包信息用于开发测试..."
    WALLET_INFO_FILE="$SCRIPT_DIR/wallet-info.txt"
    echo "=== Linera Edge 钱包信息 ===" > "$WALLET_INFO_FILE"
    echo "生成时间: $(date)" >> "$WALLET_INFO_FILE"
    echo "钱包文件: $LINERA_WALLET" >> "$WALLET_INFO_FILE"
    echo "" >> "$WALLET_INFO_FILE"
    
    # 显示钱包信息并保存
    linera wallet show >> "$WALLET_INFO_FILE" 2>&1
    echo "钱包信息已保存到: $WALLET_INFO_FILE"
else
    echo "钱包已存在，跳过初始化"
fi

# Request a new chain and capture output (CHAIN and OWNER)
CHAIN_OWNER=($(linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net))
CHAIN="${CHAIN_OWNER[0]}"
OWNER="${CHAIN_OWNER[1]}"

# Verification (optional): Display chain information in wallet
echo "钱包信息:"
linera wallet show

# Switch back to Linera-edge directory to build WASM modules
cd "$SCRIPT_DIR"
# Use standalone Cargo command to build, avoiding workspace conflicts
echo "构建WASM模块..."
CARGO_MANIFEST_DIR="$SCRIPT_DIR" cargo build --release --target wasm32-unknown-unknown --manifest-path "$SCRIPT_DIR/Cargo.toml"

# Switch back to linera-protocol directory to publish modules
cd "$LINERA_DIR"
echo "当前目录: $(pwd)"
echo "发布模块..."
MODULE_ID=$(linera publish-module \
    examples/target/wasm32-unknown-unknown/release/linera_edge_{contract,service}.wasm)

# Create application on specified chain
APP_ID=$(linera create-application "$MODULE_ID" "$CHAIN")

# Save CHAIN_ID and APP_ID to .env file for frontend use
ENV_FILE="$SCRIPT_DIR/web-frontend/.env"
echo "VITE_CHAIN_ID=$CHAIN" > "$ENV_FILE"
echo "VITE_APP_ID=$APP_ID" >> "$ENV_FILE"
echo "VITE_OWNER_ID=$OWNER" >> "$ENV_FILE"
echo "VITE_PORT=8080" >> "$ENV_FILE"
echo "VITE_HOST=localhost" >> "$ENV_FILE"
echo "环境变量已保存到: $ENV_FILE"

# Install frontend dependencies and start development server
cd "$SCRIPT_DIR/web-frontend"
echo "安装前端依赖..."
npm install

echo "安装GraphQL依赖..."
npm install @apollo/client@^3.7.10 graphql@^16.6.0

# Create log directory
mkdir -p "$SCRIPT_DIR/logs"

# Start Linera service in background with logging
echo "启动Linera后端服务在端口8080..."
cd "$LINERA_DIR"
linera service --port 8080 > "$SCRIPT_DIR/logs/backend.log" 2>&1 &
LINERA_SERVICE_PID=$!
echo "Linera后端服务已启动，PID: $LINERA_SERVICE_PID"

# Wait for services to start up
echo "等待服务启动..."
sleep 5

# Start frontend development server with logging
echo "启动前端开发服务器..."
cd "$SCRIPT_DIR/web-frontend"
npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "前端开发服务器已启动，PID: $FRONTEND_PID"

# Start settlement service in background with logging
echo "启动结算服务（每分钟运行一次）..."
cd "$SCRIPT_DIR/web-frontend"
npm run settlement > "$SCRIPT_DIR/logs/settlement.log" 2>&1 &
SETTLEMENT_PID=$!
echo "结算服务已启动，PID: $SETTLEMENT_PID"

# Save PIDs to file for cleanup
echo "$LINERA_SERVICE_PID" > "$SCRIPT_DIR/.linera_service.pid"
echo "$FRONTEND_PID" > "$SCRIPT_DIR/.frontend.pid"
echo "$SETTLEMENT_PID" > "$SCRIPT_DIR/.settlement.pid"

# Wait for frontend to start
sleep 3

echo ""
echo "=========================================="
echo "Linera Edge 应用安装完成！"
echo "=========================================="
echo "应用ID: $APP_ID"
echo "链ID: $CHAIN"
echo "所有者ID: $OWNER"
echo ""
echo "访问地址:"
echo "前端应用: http://localhost:3000/$CHAIN?app=$APP_ID&owner=$OWNER&port=8080"
echo "GraphQL API: http://localhost:8080/chains/$CHAIN/applications/$APP_ID"
echo ""
echo "日志查看命令:"
echo "前端日志: tail -f $SCRIPT_DIR/logs/frontend.log"
echo "后端日志: tail -f $SCRIPT_DIR/logs/backend.log"
echo "结算服务日志: tail -f $SCRIPT_DIR/logs/settlement.log"
echo ""
echo "服务管理命令:"
echo "停止所有服务: pkill -f 'linera service' && pkill -f 'npm run dev' && pkill -f 'npm run settlement'"
echo "或使用PID文件: kill \$(cat $SCRIPT_DIR/.linera_service.pid) && kill \$(cat $SCRIPT_DIR/.frontend.pid) && kill \$(cat $SCRIPT_DIR/.settlement.pid)"
echo "重启后端: kill \$(cat $SCRIPT_DIR/.linera_service.pid) && cd $LINERA_DIR && linera service --port 8080 > $SCRIPT_DIR/logs/backend.log 2>&1 &"
echo "重启前端: kill \$(cat $SCRIPT_DIR/.frontend.pid) && cd $SCRIPT_DIR/web-frontend && npm run dev > $SCRIPT_DIR/logs/frontend.log 2>&1 &"
echo "重启结算服务: kill \$(cat $SCRIPT_DIR/.settlement.pid) && cd $SCRIPT_DIR/web-frontend && npm run settlement > $SCRIPT_DIR/logs/settlement.log 2>&1 &"
echo "==========================================="
echo ""

# Wait for user interrupt
echo "按 Ctrl+C 停止所有服务"
trap "echo '正在停止服务...'; kill $LINERA_SERVICE_PID $FRONTEND_PID $SETTLEMENT_PID; rm -f $SCRIPT_DIR/.linera_service.pid $SCRIPT_DIR/.frontend.pid $SCRIPT_DIR/.settlement.pid; echo '服务已停止'; exit" INT

# Keep script running and wait for background processes
wait