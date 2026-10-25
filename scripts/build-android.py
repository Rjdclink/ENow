"""Build a small standalone Android WebView application; never commit the signing key."""
import os,pathlib,subprocess,shutil,secrets,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
sdk=pathlib.Path(os.environ.get('ENOW_ANDROID_SDK','/tmp/paper-doll-android'))
tools=sdk/'android-15';platform=sdk/'android-35'/'android.jar'
ecj=pathlib.Path(os.environ.get('ENOW_ECJ',str(sdk/'ecj.jar')))
sign=pathlib.Path(os.environ.get('ENOW_SIGNING_DIR',str(root.parent/'enow-signing')))
build=root/'native/android/build';build.mkdir(parents=True,exist_ok=True)
res=build/'res/drawable';res.mkdir(parents=True,exist_ok=True)
shutil.copy(root/'public/icon192.png',res/'icon.png')
for name in ['aapt2','zipalign']: (tools/name).chmod(0o755)
def run(*args):subprocess.run([str(x) for x in args],cwd=build,check=True)
run(tools/'aapt2','compile','--dir',build/'res','-o',build/'resources.zip')
run(tools/'aapt2','link','-o',build/'unsigned.apk','-I',platform,'--manifest',root/'native/android/AndroidManifest.xml','--auto-add-overlay',build/'resources.zip')
classes=build/'classes';classes.mkdir(exist_ok=True)
run('java','-jar',ecj,'-source','1.8','-target','1.8','-proc:none','-classpath',platform,'-d',classes,root/'native/android/MainActivity.java')
dex=build/'dex';dex.mkdir(exist_ok=True)
run('java','-cp',tools/'lib/d8.jar','com.android.tools.r8.D8','--min-api','26','--lib',platform,'--output',dex,*classes.rglob('*.class'))
with zipfile.ZipFile(build/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:z.write(dex/'classes.dex','classes.dex')
run(tools/'zipalign','-f','-p','4',build/'unsigned.apk',build/'aligned.apk')
sign.mkdir(parents=True,exist_ok=True);sign.chmod(0o700)
password=sign/'password.txt';key=sign/'enow.jks'
if not password.exists():password.write_text(secrets.token_urlsafe(32));password.chmod(0o600)
if not key.exists():run('keytool','-genkeypair','-keystore',key,'-storepass:file',password,'-keypass:file',password,'-alias','enow','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Robert Clinkenbeard, OU=ENow, O=ENow, C=US')
out=root.parent/'e-verse.apk'
run('java','-jar',tools/'lib/apksigner.jar','sign','--ks',key,'--ks-pass','file:'+str(password),'--out',out,build/'aligned.apk')
run('java','-jar',tools/'lib/apksigner.jar','verify','--verbose',out)
print('Built',out,'bytes',out.stat().st_size)

import json,hashlib
cert=subprocess.check_output(['keytool','-exportcert','-keystore',str(key),'-storepass:file',str(password),'-alias','enow'])
fingerprint=':'.join(f'{b:02X}' for b in hashlib.sha256(cert).digest())
well=root/'public/.well-known';well.mkdir(parents=True,exist_ok=True)
(well/'assetlinks.json').write_text(json.dumps([{'relation':['delegate_permission/common.handle_all_urls'],'target':{'namespace':'android_app','package_name':'app.enow.shopping','sha256_cert_fingerprints':[fingerprint]}}]))
downloads=root/'public/downloads';downloads.mkdir(exist_ok=True);shutil.copy(out,downloads/'e-verse.apk')
# Retain previously shared download URLs as compatibility aliases.
shutil.copy(out,downloads/'ENow.apk')
print('App-link certificate:',fingerprint)
