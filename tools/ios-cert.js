/* A distribution certificate that lives for one build.

     node tools/ios-cert.js create <dir>     needs <dir>/csr.pem
     node tools/ios-cert.js revoke <dir>

   WHY THIS EXISTS. The first uploads from .github/workflows/ios.yml were
   signed with the certificate Apple keeps on its own side ("cloud
   signing"), and App Store Connect refused every one of them: error
   90035, "code failed to satisfy specified code requirement(s)", for all
   five binaries, although each verified on the machine that signed it.

   The fourth run (tag ios-7, 4 Oct 2026) printed why. The certificate's
   common name is "Apple Distribution: Emre Ömer Yldz (894Y9VXD2N)" with
   the Ö as one character, bytes C3 96. The requirement Xcode writes into
   a cloud-signed binary spells the same name with the Ö taken apart, an
   O followed by a combining diaeresis, bytes 4F CC 88. The signature
   asks for a certificate whose name it does not match, byte for byte,
   and Apple's server compares bytes. A requirement set by hand before
   the export is thrown away by it; that was tried in the same run.

   A binary signed by codesign with a key that is actually on the
   machine carries no written-out requirement at all, so there is nothing
   to mismatch. That needs a private key on the runner, and a runner is
   thrown away after every build. So the key is made on the runner, the
   App Store Connect API is asked for a certificate and an App Store
   profile for it, and both are revoked when the build ends, whether it
   passed or not. Nothing secret is kept anywhere, and an upload that is
   already with Apple does not need the certificate that signed it to
   still exist.

   Reads ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8 from the environment.
   Prints ids and names, never key material. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUNDLE = 'com.pawtika.game';
const TEAM = '894Y9VXD2N';
const API = 'https://api.appstoreconnect.apple.com/v1';
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function token() {
  const { ASC_KEY_ID: kid, ASC_ISSUER_ID: iss, ASC_KEY_P8: p8 } = process.env;
  if (!kid || !iss || !p8) throw new Error('ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8 must be set');
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: p8, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}

async function call(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    method,
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) {
    let why = text.slice(0, 600);
    try { why = JSON.parse(text).errors.map(e => e.status + ' ' + e.code + ': ' + e.detail).join(' | '); } catch (e) { }
    throw new Error(method + ' ' + url.replace(API, '') + ' -> ' + why);
  }
  return text ? JSON.parse(text) : null;
}

async function create(dir) {
  const csr = fs.readFileSync(path.join(dir, 'csr.pem'), 'utf8');
  const state = {};
  const save = () => fs.writeFileSync(path.join(dir, 'signing.json'), JSON.stringify(state, null, 1));

  /* how many are there already: Apple allows a team only a few */
  const have = await call('GET', '/certificates?filter[certificateType]=DISTRIBUTION&limit=50');
  console.log('distribution certificates on the team before this run: ' + have.data.length);
  have.data.forEach(c => console.log('  ' + c.id + '  ' + c.attributes.name + '  expires ' + (c.attributes.expirationDate || '').slice(0, 10)));

  const cert = await call('POST', '/certificates', {
    data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: csr } }
  });
  state.certId = cert.data.id; save();
  fs.writeFileSync(path.join(dir, 'cert.cer'), Buffer.from(cert.data.attributes.certificateContent, 'base64'));
  console.log('certificate ' + cert.data.id + '  ' + cert.data.attributes.name + '  serial ' + cert.data.attributes.serialNumber);

  const ids = await call('GET', '/bundleIds?filter[identifier]=' + BUNDLE + '&limit=50');
  const bundle = ids.data.find(b => b.attributes.identifier === BUNDLE);
  if (!bundle) throw new Error('no bundle id ' + BUNDLE + ' on the team');

  const name = 'Pawtika CI ' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const prof = await call('POST', '/profiles', {
    data: {
      type: 'profiles',
      attributes: { name, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundle.id } },
        certificates: { data: [{ type: 'certificates', id: cert.data.id }] }
      }
    }
  });
  state.profileId = prof.data.id; state.profileName = name; state.profileUuid = prof.data.attributes.uuid; save();
  fs.writeFileSync(path.join(dir, 'profile.mobileprovision'), Buffer.from(prof.data.attributes.profileContent, 'base64'));
  console.log('profile ' + prof.data.id + '  "' + name + '"  ' + prof.data.attributes.uuid);

  fs.writeFileSync(path.join(dir, 'exportOptions.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>export</string>
	<key>teamID</key>
	<string>${TEAM}</string>
	<key>signingStyle</key>
	<string>manual</string>
	<key>signingCertificate</key>
	<string>Apple Distribution</string>
	<key>provisioningProfiles</key>
	<dict>
		<key>${BUNDLE}</key>
		<string>${name}</string>
	</dict>
	<key>manageAppVersionAndBuildNumber</key>
	<false/>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
`);
}

async function revoke(dir) {
  const file = path.join(dir, 'signing.json');
  if (!fs.existsSync(file)) { console.log('nothing was created, nothing to revoke'); return; }
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [what, url] of [['profile', state.profileId && '/profiles/' + state.profileId], ['certificate', state.certId && '/certificates/' + state.certId]]) {
    if (!url) continue;
    try { await call('DELETE', url); console.log(what + ' revoked'); }
    catch (e) { console.log(what + ' NOT revoked: ' + e.message); process.exitCode = 1; }
  }
}

const [mode, dir] = process.argv.slice(2);
(mode === 'create' ? create : mode === 'revoke' ? revoke : () => Promise.reject(new Error('create <dir> | revoke <dir>')))(dir)
  .catch(e => { console.error(String(e.message || e)); process.exit(1); });
