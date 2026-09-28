#!/bin/bash
# Builds OPIIUS.apk from app/web/index.html without the Android SDK.
# Tools come from Maven Central and PyPI: aapt2 (PyPI "aapt2"), the framework
# resources in Robolectric's android-all jar, dx for the dex file, and
# Google's apksig library to sign with the v2 scheme.
set -e
cd "$(dirname "$0")"
T=.tools; M=https://repo.maven.apache.org/maven2
mkdir -p $T
AJ=$T/android-all-10.jar
[ -f $AJ ] || curl -sfL -o $AJ $M/org/robolectric/android-all/10-robolectric-5803371/android-all-10-robolectric-5803371.jar
[ -f $T/dx.jar ] || curl -sfL -o $T/dx.jar $M/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar
[ -f $T/apksig.jar ] || curl -sfL -o $T/apksig.jar $M/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar
if [ ! -x $T/aapt2 ]; then
  pip download -q --no-deps aapt2==0.2.1 -d $T/py
  unzip -q -o -j $T/py/aapt2-0.2.1-py3-none-any.whl 'aapt2/bin/Linux/aapt2' -d $T && chmod +x $T/aapt2
fi
O=$T/out; rm -rf $O; mkdir -p $O/classes $O/signer $O/assets
cp web/index.html $O/assets/index.html
$T/aapt2 compile --dir android/res -o $O/res.zip
$T/aapt2 link -I $AJ --manifest android/AndroidManifest.xml --min-sdk-version 24 --target-sdk-version 34 \
  --version-code ${VC:-1} --version-name ${VN:-1.0} --replace-version -A $O/assets -o $O/base.apk $O/res.zip
javac -nowarn --release 8 -cp $AJ -d $O/classes $(find android/src -name '*.java') 2>&1 | grep -v 'warning: \[options\]' || true
java -cp $T/dx.jar com.android.dx.command.Main --dex --min-sdk-version=24 --output=$O/classes.dex $O/classes
cp $O/base.apk $O/unsigned.apk && (cd $O && zip -q unsigned.apk classes.dex)
python3 tools/zipalign.py $O/unsigned.apk $O/aligned.apk
# Signing key: keep the same keystore between builds so phones accept updates.
KS=${KEYSTORE:-$T/opiius.p12}; KP=${KEYPASS:-opiius-demo}
[ -f $KS ] || keytool -genkeypair -keystore $KS -storetype PKCS12 -storepass $KP -keypass $KP -alias opiius \
  -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=OPIIUS, O=OPIIUS, L=Guwahati, C=IN" 2>/dev/null
javac -nowarn -cp $T/apksig.jar -d $O/signer tools/Sign.java
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED \
  --add-exports java.base/sun.security.util=ALL-UNNAMED -cp $T/apksig.jar:$O/signer Sign $O/aligned.apk OPIIUS.apk $KS $KP
ls -la OPIIUS.apk
