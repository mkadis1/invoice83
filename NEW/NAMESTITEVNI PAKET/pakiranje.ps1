$src = Get-Location
$zipPath = Join-Path $src 'Invoice83_tester.zip'

# Pobrisemo stari ZIP ce obstaja
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Datoteke za vkljucitev v koren ZIPa
$rootFiles = @(
    'NAMESTITEV.bat',
    'ZAGON.bat',
    'README.txt',
    'main.py',
    'database.py',
    'pdf_parser.py',
    'requirements.txt',
    'DejaVuSans.ttf',
    'DejaVuSans-Bold.ttf'
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')

# Dodamo posamezne datoteke v koren
foreach ($file in $rootFiles) {
    $fullPath = Join-Path $src $file
    if (Test-Path $fullPath) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $fullPath, $file, 'Optimal') | Out-Null
        Write-Host "  + $file"
    } else {
        Write-Host "  ! MANJKA: $file" -ForegroundColor Yellow
    }
}

# Dodamo celotno static/ mapo (brez static/uploads/logo.*)
Get-ChildItem -Path (Join-Path $src 'static') -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length + 1)
    # Izpustimo logotipe
    if ($rel -notmatch 'static\\uploads\\logo\.') {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, 'Optimal') | Out-Null
        Write-Host "  + $rel"
    }
}

# Dodamo prazno uploads/ mapo (placeholder datoteka)
$zip.CreateEntry('uploads/.gitkeep') | Out-Null
Write-Host '  + uploads/ (prazna mapa)'

$zip.Dispose()

$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "ZIP uspesno ustvarjen: $zipPath" -ForegroundColor Green
Write-Host "Velikost: $zipSize MB" -ForegroundColor Green
