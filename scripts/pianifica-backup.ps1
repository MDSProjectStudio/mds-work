<#
  MDS Work · Fase 1 · M6 — backup cifrato PIANIFICATO (Utilità di pianificazione di Windows)

  PER IMPOSTAZIONE PREDEFINITA NON CAMBIA NULLA: mostra soltanto l'attività che verrebbe creata.
  Attivazione SOLO con consenso del titolare:   powershell -ExecutionPolicy Bypass -File scripts\pianifica-backup.ps1 -Attiva
  Rimozione:                                     powershell -ExecutionPolicy Bypass -File scripts\pianifica-backup.ps1 -Rimuovi
  Stato attuale:                                 powershell -ExecutionPolicy Bypass -File scripts\pianifica-backup.ps1 -Stato

  Cosa fa l'attività: "node scripts\backup.mjs --pianificato --conserva N" nella cartella di MDS Work.
  - Gira come l'utente corrente e SOLO quando è connesso: la chiave dei backup è custodita con DPAPI
    dell'utente, quindi nessuna password viene salvata nell'attività.
  - Legge Supabase in SOLA LETTURA; scrive in %USERPROFILE%\MDS-Backups\pianificati; non crea chiavi nuove;
    verifica il file appena scritto e solo dopo rimuove i più vecchi di QUELLA sottocartella.
  - Nessun servizio installato, nessuna impostazione di Windows cambiata oltre all'attività stessa.
#>
param(
  [switch]$Attiva,
  [switch]$Rimuovi,
  [switch]$Stato,
  [ValidateSet("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")]
  [string]$Giorno = "Sunday",
  [ValidatePattern("^([01]\d|2[0-3]):[0-5]\d$")]
  [string]$Ora = "21:00",
  [ValidateRange(2, 52)]
  [int]$Conserva = 8
)

$ErrorActionPreference = "Stop"
$NomeAttivita = "MDS Work - backup cifrato settimanale"
$Repo = Split-Path -Parent $PSScriptRoot
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) { throw "Node.js non trovato nel PATH" }
$Argomenti = "scripts\backup.mjs --pianificato --conserva $Conserva"

if ($Stato) {
  $t = Get-ScheduledTask -TaskName $NomeAttivita -ErrorAction SilentlyContinue
  if ($t) { $t | Get-ScheduledTaskInfo | Select-Object TaskName, LastRunTime, LastTaskResult, NextRunTime | Format-List }
  else { Write-Output "Nessuna attività '$NomeAttivita' presente." }
  return
}

if ($Rimuovi) {
  if (Get-ScheduledTask -TaskName $NomeAttivita -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $NomeAttivita -Confirm:$false
    Write-Output "Attività rimossa. I backup già scritti restano dove sono."
  } else { Write-Output "Nessuna attività da rimuovere." }
  return
}

Write-Output "Attività: $NomeAttivita"
Write-Output "  Quando:      ogni $Giorno alle $Ora (solo con l'utente connesso; se il PC era spento, appena possibile)"
Write-Output "  Comando:     `"$Node`" $Argomenti"
Write-Output "  Cartella:    $Repo"
Write-Output "  Utente:      $env:USERDOMAIN\$env:USERNAME (nessuna password salvata)"
Write-Output "  Conserva:    gli ultimi $Conserva backup in $env:USERPROFILE\MDS-Backups\pianificati"

if (-not $Attiva) {
  Write-Output ""
  Write-Output "NESSUNA MODIFICA FATTA. Per creare l'attività (con il consenso del titolare) aggiungi -Attiva."
  return
}

$azione = New-ScheduledTaskAction -Execute $Node -Argument $Argomenti -WorkingDirectory $Repo
$quando = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Giorno -At $Ora
$chi = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$come = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $NomeAttivita -Action $azione -Trigger $quando -Principal $chi -Settings $come -Description "Backup cifrato di MDS Work (sola lettura su Supabase). Creato da scripts\pianifica-backup.ps1" | Out-Null
Write-Output "Attività creata. Prova subito:  Start-ScheduledTask -TaskName '$NomeAttivita'  e poi  -Stato"
