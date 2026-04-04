$ShortcutPath = "$([Environment]::GetFolderPath('Desktop'))\DOT System.lnk"
$TargetFile = "e:\The Ultimate Dev\Tally-Inventory\index.html"
$IconPath = "e:\The Ultimate Dev\Tally-Inventory\app-icon.png"
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $ChromePath
$Shortcut.Arguments = "--app=""file:///$TargetFile"""
$Shortcut.IconLocation = $IconPath
$Shortcut.Save()

Write-Host "Desktop Shortcut Created Successfully!"
