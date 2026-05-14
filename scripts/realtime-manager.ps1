param(
  [int]$IntervalSeconds = 3
)

$ErrorActionPreference = "SilentlyContinue"

function Test-Endpoint {
  param(
    [string]$Url,
    [int]$TimeoutSec = 3
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing
    return "UP ($($response.StatusCode))"
  } catch {
    return "DOWN"
  }
}

function Get-GitSummary {
  $branch = git branch --show-current 2>$null
  if (-not $branch) {
    return "No git repo"
  }

  $status = git status --short 2>$null
  $changes = if ($status) { ($status | Measure-Object -Line).Lines } else { 0 }
  return "Branch: $branch | Pending changes: $changes"
}

function Get-RepoActivity {
  $repo = "hamzzaahhhhh-spec/promptforge"

  $issues = gh issue list --repo $repo --state open --limit 100 --json number 2>$null
  $prs = gh pr list --repo $repo --state open --limit 100 --json number 2>$null

  $issueCount = 0
  $prCount = 0

  if ($issues) {
    $issueCount = ($issues | ConvertFrom-Json | Measure-Object).Count
  }

  if ($prs) {
    $prCount = ($prs | ConvertFrom-Json | Measure-Object).Count
  }

  return "Open issues: $issueCount | Open PRs: $prCount"
}

while ($true) {
  Clear-Host
  $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

  $nextStatus = Test-Endpoint -Url "https://promptforge-virid-gamma.vercel.app/"
  $ollamaStatus = Test-Endpoint -Url "http://localhost:11434/api/tags"
  $gitSummary = Get-GitSummary
  $repoActivity = Get-RepoActivity

  Write-Host "PromptForge Real-Time Manager" -ForegroundColor Cyan
  Write-Host "Time: $now"
  Write-Host "App: $nextStatus"
  Write-Host "Ollama: $ollamaStatus"
  Write-Host $gitSummary
  Write-Host $repoActivity
  Write-Host "Press Ctrl+C to stop. Refresh interval: ${IntervalSeconds}s"

  Start-Sleep -Seconds $IntervalSeconds
}
