$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $Root "android-webview-shell"
$OutputDir = Join-Path $Root "output\apk"
$Toolchain = Join-Path $Root "cache\android-toolchain"
$JdkDir = Join-Path $Toolchain "jdk17"
$SdkRoot = Join-Path $Toolchain "android-sdk"
$BuildTools = Join-Path $SdkRoot "build-tools\35.0.0"
$AndroidJar = Join-Path $SdkRoot "platforms\android-35\android.jar"

$RequiredFiles = @(
  (Join-Path $JdkDir "bin\javac.exe"),
  (Join-Path $JdkDir "bin\jar.exe"),
  (Join-Path $JdkDir "bin\keytool.exe"),
  (Join-Path $BuildTools "aapt2.exe"),
  (Join-Path $BuildTools "d8.bat"),
  (Join-Path $BuildTools "zipalign.exe"),
  (Join-Path $BuildTools "apksigner.bat"),
  $AndroidJar,
  (Join-Path $AppDir "icon-source.png")
)

foreach ($File in $RequiredFiles) {
  if (-not (Test-Path $File)) {
    throw "Required file missing: $File"
  }
}

$env:JAVA_HOME = $JdkDir
$env:ANDROID_SDK_ROOT = $SdkRoot
$env:PATH = "$JdkDir\bin;$SdkRoot\platform-tools;$BuildTools;$env:PATH"

$BuildDir = Join-Path $AppDir "build"
$CompiledRes = Join-Path $BuildDir "compiled-res.zip"
$GeneratedDir = Join-Path $BuildDir "generated"
$ClassesDir = Join-Path $BuildDir "classes"
$DexDir = Join-Path $BuildDir "dex"
$UnsignedApk = Join-Path $BuildDir "unsigned.apk"
$AlignedApk = Join-Path $BuildDir "aligned.apk"
$FinalApk = Join-Path $OutputDir "sdust-navigation-webview.apk"
$Keystore = Join-Path $BuildDir "debug.keystore"

if (Test-Path $BuildDir) {
  Remove-Item -LiteralPath $BuildDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $BuildDir, $GeneratedDir, $ClassesDir, $DexDir, $OutputDir | Out-Null

$IconScript = @"
from pathlib import Path
from PIL import Image, ImageOps

root = Path(r"$AppDir")
source = root / "icon-source.png"
sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

image = Image.open(source).convert("RGBA")
image = ImageOps.fit(image, (1024, 1024), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))

for folder, size in sizes.items():
    target_dir = root / "res" / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(target_dir / "ic_launcher.png")
    resized.save(target_dir / "ic_launcher_round.png")
"@
$IconScript | python -X utf8 -

$Aapt2 = Join-Path $BuildTools "aapt2.exe"
$D8 = Join-Path $BuildTools "d8.bat"
$ZipAlign = Join-Path $BuildTools "zipalign.exe"
$ApkSigner = Join-Path $BuildTools "apksigner.bat"
$Javac = Join-Path $JdkDir "bin\javac.exe"
$Jar = Join-Path $JdkDir "bin\jar.exe"
$Keytool = Join-Path $JdkDir "bin\keytool.exe"

& $Aapt2 compile --dir (Join-Path $AppDir "res") -o $CompiledRes
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

& $Aapt2 link `
  -o $UnsignedApk `
  -I $AndroidJar `
  --manifest (Join-Path $AppDir "AndroidManifest.xml") `
  -R $CompiledRes `
  --java $GeneratedDir `
  --auto-add-overlay `
  --min-sdk-version 23 `
  --target-sdk-version 35
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

$JavaSources = @()
$JavaSources += Get-ChildItem -LiteralPath (Join-Path $AppDir "src") -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }
$JavaSources += Get-ChildItem -LiteralPath $GeneratedDir -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }

& $Javac -encoding UTF-8 -source 8 -target 8 -bootclasspath $AndroidJar -d $ClassesDir $JavaSources
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

$ClassFiles = Get-ChildItem -LiteralPath $ClassesDir -Recurse -Filter "*.class" | ForEach-Object { $_.FullName }
& $D8 --release --min-api 23 --lib $AndroidJar --output $DexDir $ClassFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

& $Jar uf $UnsignedApk -C $DexDir "classes.dex"
if ($LASTEXITCODE -ne 0) { throw "jar failed while adding classes.dex" }

& $ZipAlign -f 4 $UnsignedApk $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

& $Keytool -genkeypair `
  -keystore $Keystore `
  -storepass android `
  -keypass android `
  -alias androiddebugkey `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -dname "CN=Android Debug,O=SDUST,C=CN" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "keytool failed" }

& $ApkSigner sign `
  --ks $Keystore `
  --ks-pass pass:android `
  --key-pass pass:android `
  --out $FinalApk `
  $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner sign failed" }

& $ApkSigner verify --verbose $FinalApk
if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed" }

Write-Output "APK generated: $FinalApk"
