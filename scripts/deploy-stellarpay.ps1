# deploy-stellarpay.ps1
# Builds, deploys, and initializes the StellarPay contract on testnet.
# Platform fee account = lp identity (NOT the USDC issuer).
# Run from the repo root.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$Network    = "testnet"
$FeeBps     = 100  # 1%

$AdminAddr    = (stellar keys public-key platform 2>&1).Trim()
$PlatformAddr = (stellar keys public-key stellarpay 2>&1).Trim()   # fee recipient — NOT the USDC issuer
$UsdcSac      = "CAKBCKBUE3ZRSNH6CDYAB62ZFWL7U7OX6NBZ6EUDFID22PRLICFJXHGS"

Write-Host "admin:    $AdminAddr"
Write-Host "platform: $PlatformAddr"
Write-Host ""

# 1. Build
Write-Host "==> Building stellarpay contract..."
Push-Location "$PSScriptRoot\..\contracts"
cargo build --release --target wasm32-unknown-unknown -p stellarpay
Pop-Location

$Wasm = "$PSScriptRoot\..\contracts\target\wasm32-unknown-unknown\release\stellarpay.wasm"

# 2. Deploy
Write-Host "==> Deploying to testnet..."
$deployOut = stellar contract deploy `
    --wasm $Wasm `
    --source platform `
    --network $Network 2>&1
$ContractId = ($deployOut | Where-Object { $_ -match "^C[A-Z2-7]{55}$" } | Select-Object -First 1).ToString().Trim()
if (-not $ContractId) {
    # fallback: last non-empty line
    $ContractId = ($deployOut | Where-Object { "$_".Trim() -ne "" } | Select-Object -Last 1).ToString().Trim()
}
Write-Host "Contract ID: $ContractId"

# 3. Initialize
Write-Host "==> Initializing contract..."
stellar contract invoke `
    --id $ContractId `
    --source platform `
    --network $Network `
    -- initialize `
    --admin $AdminAddr `
    --platform $PlatformAddr `
    --fee_bps $FeeBps 2>&1

Write-Host ""
Write-Host "Done. Update .env:"
Write-Host "  NEXT_PUBLIC_STELLARPAY_CONTRACT_ID=$ContractId"
Write-Host "  NEXT_PUBLIC_PLATFORM_ADDRESS=$PlatformAddr"
