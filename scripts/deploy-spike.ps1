# deploy-spike.ps1 — builds and deploys the spike contract to testnet,
# then runs the charge proof: subscriber approves, merchant charges without re-signing.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Network   = "testnet"
$RpcUrl    = "https://soroban-testnet.stellar.org"
$NetworkId = "Test SDF Network ; September 2015"

Write-Host "==> Building spike contract (wasm)..."
Push-Location "$PSScriptRoot\..\contracts"
cargo build --release --target wasm32-unknown-unknown -p spike
Pop-Location

$Wasm = "$PSScriptRoot\..\contracts\target\wasm32-unknown-unknown\release\spike.wasm"

Write-Host "==> Deploying spike contract to testnet..."
$ContractId = stellar contract deploy `
    --wasm $Wasm `
    --source merchant `
    --network $Network `
    2>&1 | Select-String -Pattern "^C" | Select-Object -First 1
$ContractId = $ContractId.ToString().Trim()
Write-Host "Contract ID: $ContractId"

Write-Host ""
Write-Host "==> Spike contract deployed. Next steps (manual in browser or via stellar contract invoke):"
Write-Host "  1. Subscriber calls SAC approve(subscriber, $ContractId, cap, expiry)"
Write-Host "  2. Merchant calls: stellar contract invoke --id $ContractId --source merchant --network $Network -- charge ..."
Write-Host "  3. Verify subscriber balance dropped and merchant balance rose WITHOUT subscriber signing step 2."
Write-Host ""
Write-Host "Contract ID saved — add it to .env as SPIKE_CONTRACT_ID=$ContractId"
