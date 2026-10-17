#!/bin/bash
# ============================================================
# Compila l'APK senza Android Studio e senza Gradle.
# Usa solo gli strumenti dell'SDK: aapt2, javac, d8, zipalign, apksigner.
#
#   ./build.sh                 versione 1.0.0 (code 1)
#   VERSIONE=1.0.1 CODE=2 ./build.sh
#
# Firma: la chiave sta fuori dal repository (mai committarla). Se non esiste
# viene creata la prima volta; va conservata, altrimenti gli aggiornamenti
# installati sopra non vengono accettati da Android (firma diversa).
# ============================================================
set -e

APP="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_SDK:-/c/Users/boh/android-sdk}"
BT="${BUILD_TOOLS:-$SDK/build-tools/35.0.0}"
PLATFORM="${ANDROID_JAR:-$SDK/platforms/android-35/android.jar}"
JDK="${JAVA_HOME:-/c/Users/boh/tools/jdk-17.0.20.1+1}"
KEYSTORE="${KEYSTORE:-$HOME/.uvsf7-release.jks}"
ALIAS="${ALIAS:-uvsf7}"
PASS="${KS_PASS:-uvsf7-release}"
VERSIONE="${VERSIONE:-1.0.0}"
CODE="${CODE:-1}"
NOME_APK="${NOME_APK:-uvsf7-v$VERSIONE.apk}"

export PATH="$JDK/bin:$PATH"
OUT="$APP/build"

echo "== strumenti"
for f in "$BT/aapt2.exe" "$BT/d8.bat" "$BT/zipalign.exe" "$BT/apksigner.bat" "$PLATFORM"; do
    [ -e "$f" ] || { echo "MANCA: $f"; exit 1; }
done
echo "   ok  aapt2 / d8 / zipalign / apksigner / android.jar"

rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

echo "== risorse"
"$BT/aapt2.exe" compile --dir "$APP/res" -o "$OUT/res.zip"
"$BT/aapt2.exe" link \
    -o "$OUT/base.apk" \
    -I "$PLATFORM" \
    --manifest "$APP/AndroidManifest.xml" \
    -R "$OUT/res.zip" \
    --java "$OUT/gen" \
    --min-sdk-version 24 \
    --target-sdk-version 35 \
    --version-code "$CODE" \
    --version-name "$VERSIONE" \
    --auto-add-overlay

echo "== compilazione java"
FONTI=$(find "$APP/src" "$OUT/gen" -name "*.java")
javac -source 1.8 -target 1.8 -nowarn -bootclasspath "$PLATFORM" -d "$OUT/classes" $FONTI 2>&1 | grep -v "^Note:" || true
[ -f "$OUT/classes/it/uvsf7/app/MainActivity.class" ] || { echo "compilazione FALLITA"; exit 1; }

echo "== dex"
CLASSI=$(find "$OUT/classes" -name "*.class")
cmd //c "$(cygpath -w "$BT/d8.bat") --lib $(cygpath -w "$PLATFORM") --min-api 24 --output $(cygpath -w "$OUT/dex") $(echo $CLASSI | sed 's|/c/|C:/|g')" > /dev/null

echo "== impacchetto"
python - "$OUT/base.apk" "$OUT/dex/classes.dex" <<'PY'
import sys, zipfile, shutil
apk, dex = sys.argv[1], sys.argv[2]
tmp = apk + ".tmp"
with zipfile.ZipFile(apk) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for voce in zin.infolist():
        zout.writestr(voce, zin.read(voce.filename))
    zout.write(dex, "classes.dex")
shutil.move(tmp, apk)
print("   classes.dex aggiunto")
PY

"$BT/zipalign.exe" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"

echo "== firma"
if [ ! -f "$KEYSTORE" ]; then
    echo "   creo la chiave $KEYSTORE (conservala!)"
    keytool -genkeypair -v -keystore "$KEYSTORE" -alias "$ALIAS" \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass "$PASS" -keypass "$PASS" \
        -dname "CN=UVSF7, OU=Game, O=UVSF7, L=Capriate, C=IT" > /dev/null
fi
cmd //c "$(cygpath -w "$BT/apksigner.bat") sign --ks $(cygpath -w "$KEYSTORE") --ks-key-alias $ALIAS --ks-pass pass:$PASS --key-pass pass:$PASS --out $(cygpath -w "$OUT/$NOME_APK") $(cygpath -w "$OUT/aligned.apk")"
cmd //c "$(cygpath -w "$BT/apksigner.bat") verify --print-certs $(cygpath -w "$OUT/$NOME_APK")" | head -4

echo
echo "APK pronto: $OUT/$NOME_APK"
ls -la "$OUT/$NOME_APK"
