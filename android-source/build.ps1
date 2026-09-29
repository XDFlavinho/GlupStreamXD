param(
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$SdkRoot = $env:ANDROID_HOME,
    [string]$BuildTools,
    [string]$PlatformJar,
    [string]$KeyStore = (Join-Path $PSScriptRoot 'signing/debug.keystore')
)
$ErrorActionPreference = 'Stop'
# Build sem Gradle: ferramentas oficiais do SDK, sem dependências nativas externas.
if (!$JavaHome) { throw 'Informe -JavaHome (JDK 17+) ou defina JAVA_HOME.' }
if (!$BuildTools) { $BuildTools = Join-Path $SdkRoot 'build-tools/36.0.0' }
if (!$PlatformJar) { $PlatformJar = Join-Path $SdkRoot 'platforms/android-36/android.jar' }
foreach ($file in @((Join-Path $JavaHome 'bin/javac.exe'), (Join-Path $BuildTools 'aapt2.exe'), $PlatformJar)) { if (!(Test-Path -LiteralPath $file)) { throw "Ferramenta não encontrada: $file" } }
$env:JAVA_HOME = $JavaHome
$env:PATH = (Join-Path $JavaHome 'bin') + [IO.Path]::PathSeparator + $env:PATH
$source = Join-Path $PSScriptRoot 'app/src/main'
$build = Join-Path $PSScriptRoot ('build/run-' + [Guid]::NewGuid().ToString('N'))
$output = Join-Path $PSScriptRoot 'dist'
foreach ($dir in @($build, "$build/generated", "$build/classes", "$build/dex", $output, (Split-Path $KeyStore))) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
function Check-Step([string]$step) { if ($LASTEXITCODE -ne 0) { throw "Falha em $step (exit $LASTEXITCODE)." } }
& (Join-Path $BuildTools 'aapt2.exe') compile --dir "$source/res" -o "$build/resources.zip"
Check-Step 'compilar recursos'
& (Join-Path $BuildTools 'aapt2.exe') link -o "$build/base.apk" --manifest "$source/AndroidManifest.xml" -I $PlatformJar --java "$build/generated" "$build/resources.zip"
Check-Step 'empacotar recursos'
$javaFiles = @(Get-ChildItem "$source/java","$build/generated" -Recurse -Filter '*.java' | ForEach-Object FullName)
$bootClasspath = $PlatformJar + [IO.Path]::PathSeparator + (Join-Path $BuildTools 'core-lambda-stubs.jar')
& (Join-Path $JavaHome 'bin/javac.exe') -encoding UTF-8 -source 8 -target 8 -bootclasspath $bootClasspath -d "$build/classes" @javaFiles
Check-Step 'compilar Java'
& (Join-Path $JavaHome 'bin/jar.exe') cf "$build/classes.jar" -C "$build/classes" .
Check-Step 'empacotar classes'
& (Join-Path $BuildTools 'd8.bat') --lib $PlatformJar --min-api 26 --output "$build/dex" "$build/classes.jar"
Check-Step 'gerar DEX'
Add-Type -AssemblyName System.IO.Compression
$archive = [IO.Compression.ZipFile]::Open("$build/base.apk", [IO.Compression.ZipArchiveMode]::Update)
try {
    Get-ChildItem "$build/dex" -Filter '*.dex' | ForEach-Object { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $_.Name) | Out-Null }
    # Normalização explícita: assets Android usam '/', inclusive ao compilar no Windows.
    $assetsRoot = Join-Path $source 'assets'
    Get-ChildItem -LiteralPath $assetsRoot -Recurse -File | ForEach-Object {
        $entryName = 'assets/' + [IO.Path]::GetRelativePath($assetsRoot, $_.FullName).Replace('\','/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entryName) | Out-Null
    }
}
finally { $archive.Dispose() }
& (Join-Path $BuildTools 'zipalign.exe') -f -p 4 "$build/base.apk" "$build/aligned.apk"
Check-Step 'alinhar APK'
if (!(Test-Path -LiteralPath $KeyStore)) {
    # Chave de desenvolvimento para instalação direta; preserve-a para atualizar.
    & (Join-Path $JavaHome 'bin/keytool.exe') -genkeypair -keystore $KeyStore -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=GlupStreamXD,C=BR' -noprompt
    Check-Step 'gerar chave de desenvolvimento'
}
$apk = Join-Path $output 'GlupStreamXD-Android-2.0.1.apk'
& (Join-Path $BuildTools 'apksigner.bat') sign --ks $KeyStore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $apk "$build/aligned.apk"
Check-Step 'assinar APK'
& (Join-Path $BuildTools 'apksigner.bat') verify --verbose $apk
Check-Step 'verificar assinatura'
& (Join-Path $BuildTools 'zipalign.exe') -c -p 4 $apk
Check-Step 'verificar alinhamento'
Write-Output "APK pronto: $apk"

