$body = @{
    amount        = 100000
    content       = "Thanh toan don hang 001"
    referenceCode = "DH001"
    phone         = "0987654321"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/webhook/vietqr" -Method Post -Body $body -ContentType "application/json"