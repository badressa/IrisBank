/**
 * Test : cas d'erreurs auth + accès admin
 * Usage : node test-auth.js
 */

const BASE = 'http://localhost:3000';

// Helper fetch avec gestion des cookies de session
const https = require('https');
const http = require('http');
const { URL } = require('url');

let sessionCookie = '';

async function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      }
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        // Sauvegarder le cookie de session
        if (res.headers['set-cookie']) {
          sessionCookie = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        }
        let json;
        try { json = JSON.parse(raw); } catch { json = raw; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function ok(label, cond) {
  const icon = cond ? '✅' : '❌';
  console.log(`  ${icon} ${label}`);
  return cond;
}

async function run() {
  console.log('='.repeat(55));
  console.log('  IRISBANK — Tests Auth & Admin');
  console.log('='.repeat(55));

  let pass = 0, fail = 0;
  const check = (label, cond) => { ok(label, cond) ? pass++ : fail++; };

  // ───────────────────────────────────────────────────
  // 1. CONNEXION — cas d'erreurs
  // ───────────────────────────────────────────────────
  console.log('\n[1] Login — cas d\'erreurs\n');

  // 1a. Champs vides
  let r = await request('POST', '/api/auth/login', {});
  check(`Champs vides → 400 ou 422 (got ${r.status})`, r.status === 400 || r.status === 422);

  // 1b. Email inexistant
  r = await request('POST', '/api/auth/login', { email: 'inconnu@test.com', password: 'n\'importe' });
  check(`Email inexistant → 401 (got ${r.status})`, r.status === 401 || r.status === 400);

  // 1c. Mauvais mot de passe
  r = await request('POST', '/api/auth/login', { email: 'rajo@gmail.com', password: 'mauvaismdp' });
  check(`Mauvais mot de passe → 401 (got ${r.status})`, r.status === 401);
  if (r.status === 401) console.log(`     Message : "${r.body?.error}"`);

  // 1d. Email malformé
  r = await request('POST', '/api/auth/login', { email: 'pasunemail', password: '123' });
  check(`Email malformé → 400/422 (got ${r.status})`, r.status === 400 || r.status === 422);

  // ───────────────────────────────────────────────────
  // 2. ACCÈS PROTÉGÉ — sans session
  // ───────────────────────────────────────────────────
  console.log('\n[2] Routes protégées — sans session\n');
  sessionCookie = ''; // reset

  r = await request('GET', '/api/admin/stats', null);
  check(`GET /api/admin/stats sans session → 401 (got ${r.status})`, r.status === 401);

  r = await request('GET', '/api/admin/clients', null);
  check(`GET /api/admin/clients sans session → 401 (got ${r.status})`, r.status === 401);

  r = await request('GET', '/api/transactions', null);
  check(`GET /api/transactions sans session → 401 (got ${r.status})`, r.status === 401);

  // ───────────────────────────────────────────────────
  // 3. CONNEXION ADMIN — rajo@gmail.com
  // ───────────────────────────────────────────────────
  console.log('\n[3] Connexion compte ADMIN\n');

  console.log('  ℹ️  Email admin : rajo@gmail.com');
  console.log('  ℹ️  Si la connexion échoue, entrez le bon mdp dans ce script (ligne ~95)\n');

  const ADMIN_PASSWORD = 'rajit'; // ← à modifier si différent
  r = await request('POST', '/api/auth/login', { email: 'rajo@gmail.com', password: ADMIN_PASSWORD });
  const adminLoggedIn = r.status === 200;
  check(`Login admin → 200 (got ${r.status})`, adminLoggedIn);
  if (!adminLoggedIn) {
    console.log(`     Erreur : ${r.body?.error || JSON.stringify(r.body)}`);
    console.log('     ⚠️  Modifiez ADMIN_PASSWORD dans ce fichier et relancez.');
  } else {
    const u = r.body?.user;
    check(`Session contient role=ADMIN`, u?.role === 'ADMIN');
    check(`Session contient is_admin=1`, u?.is_admin === 1);
  }

  // ───────────────────────────────────────────────────
  // 4. ACCÈS ADMIN — avec session admin
  // ───────────────────────────────────────────────────
  if (adminLoggedIn) {
    console.log('\n[4] Routes admin — avec session admin\n');

    r = await request('GET', '/api/admin/stats', null);
    check(`GET /api/admin/stats → 200 (got ${r.status})`, r.status === 200);
    if (r.status === 200) {
      const s = r.body;
      console.log(`     Clients: ${s.totalClients}, Comptes: ${s.totalAccounts}, Transactions: ${s.totalTransactions}`);
    }

    r = await request('GET', '/api/admin/clients', null);
    check(`GET /api/admin/clients → 200 (got ${r.status})`, r.status === 200);
    if (r.status === 200) {
      console.log(`     ${Array.isArray(r.body) ? r.body.length : '?'} clients retournés`);
    }

    r = await request('GET', '/api/admin/accounts', null);
    check(`GET /api/admin/accounts → 200 (got ${r.status})`, r.status === 200);

    r = await request('GET', '/api/admin/transactions', null);
    check(`GET /api/admin/transactions → 200 (got ${r.status})`, r.status === 200);
  }

  // ───────────────────────────────────────────────────
  // 5. CLIENT NORMAL — accès admin refusé
  // ───────────────────────────────────────────────────
  console.log('\n[5] Route admin — accessible avec compte CLIENT ?\n');
  sessionCookie = '';

  // Trouver un compte client dans la DB via l'API d'inscription (on ne crée pas)
  // On teste juste qu'un accès à /api/admin/* sans admin donne 401/403
  r = await request('GET', '/api/admin/stats', null);
  check(`GET /api/admin/stats sans auth → 401 (got ${r.status})`, r.status === 401);

  // ───────────────────────────────────────────────────
  // Résumé
  // ───────────────────────────────────────────────────
  console.log('\n' + '='.repeat(55));
  console.log(`  Résultat : ${pass} ✅ passés  /  ${fail} ❌ échoués`);
  console.log('='.repeat(55) + '\n');
  if (fail > 0) process.exit(1);
}

run().catch(err => {
  console.error('\n❌ Erreur de connexion au serveur :', err.message);
  console.error('   → Assurez-vous que le serveur tourne : npm run dev\n');
  process.exit(1);
});
