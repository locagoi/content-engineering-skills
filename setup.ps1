param(
    [ValidateSet('hardlink', 'symlink', 'copy')]
    [string]$Mode = 'hardlink'
)

# hardlink (Default): funktioniert ohne Admin auf NTFS, edits in repo sofort in ~/.claude/commands sichtbar
# symlink: braucht Admin oder Windows Developer Mode
# copy: Fallback, fuehrt zu Drift wenn Skills bearbeitet werden

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillsDir = Join-Path $repoRoot 'skills'
$targetDir = Join-Path $env:USERPROFILE '.claude\commands'

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$skills = Get-ChildItem -Path $skillsDir -Filter '*.md'

foreach ($skill in $skills) {
    $targetPath = Join-Path $targetDir $skill.Name

    if (Test-Path $targetPath) {
        $existing = Get-Item $targetPath -Force
        $isReparse = $existing.Attributes -band [IO.FileAttributes]::ReparsePoint
        if ($isReparse) {
            Remove-Item $targetPath -Force
        } else {
            $backup = "$targetPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Move-Item -Path $targetPath -Destination $backup -Force
            Write-Host "Backed up existing $($skill.Name) -> $(Split-Path $backup -Leaf)"
        }
    }

    if ($Mode -eq 'hardlink') {
        # cmd mklink /H — works on NTFS without admin, two paths to one inode
        $result = cmd /c mklink /H "$targetPath" "$($skill.FullName)" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Hardlink: $($skill.Name)"
        } else {
            Write-Warning "Hardlink failed for $($skill.Name) ($result) — fallback to copy."
            Copy-Item -Path $skill.FullName -Destination $targetPath -Force
        }
    } elseif ($Mode -eq 'symlink') {
        try {
            New-Item -ItemType SymbolicLink -Path $targetPath -Target $skill.FullName | Out-Null
            Write-Host "Symlink: $($skill.Name)"
        } catch {
            Write-Warning "Symlink failed for $($skill.Name) - fallback to copy. (Run as admin or enable Developer Mode.)"
            Copy-Item -Path $skill.FullName -Destination $targetPath -Force
        }
    } else {
        Copy-Item -Path $skill.FullName -Destination $targetPath -Force
        Write-Host "Copied: $($skill.Name)"
    }
}

Write-Host ""
Write-Host "Done. $($skills.Count) skills installed in $targetDir (mode: $Mode)."
Write-Host "Next: run /content selftest in Claude Code to verify."
