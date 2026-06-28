$base = "f:\SSD PROJECT\project_goods\frontend\src\widgets\dashboard\ui"
$lines = Get-Content "$base\OrderDetailCard.tsx"
$trimmed = $lines[0..1682]
Set-Content -Path "$base\OrderDetailCard.tsx" -Value $trimmed -Encoding UTF8
Write-Output "Trimmed OrderDetailCard.tsx to $($trimmed.Count) lines"