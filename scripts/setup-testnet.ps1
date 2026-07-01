# setup-testnet.ps1 — documents the three identities and their testnet addresses.
# Identities were already generated and funded during Phase 1.1a.
# Re-run this to print current addresses and XLM balances.

$Network = "testnet"

$identities = @("merchant", "subscriber", "platform")

Write-Host "==> StellarPay testnet identities"
Write-Host ""

foreach ($id in $identities) {
    $address = stellar keys address $id 2>&1
    Write-Host "${id}: $address"
}

Write-Host ""
Write-Host "Identities:  merchant / subscriber / platform"
Write-Host "Network:     $Network (Test SDF Network ; September 2015)"
Write-Host "Funded via:  Friendbot"
Write-Host ""
Write-Host "merchant  = GCCTHPUA2FAAX6WIS7GN4H2TAX4WTO3CI4PQWOIMWPHXE3MKEH2OG47L"
Write-Host "subscriber= GAAIVQZ7LLG3FH3U5ZAJVUIZQUGUR7CPJKKWTKYMBIDAMQUA5CDOIUI6"
Write-Host "platform  = GAUK4F5RUHGD2SSEBS4EVB7FJSFWU65ITJBV5PYPQNVNTYB2BWCFICEY"
