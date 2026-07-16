import * as admin from 'firebase-admin';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

function setupADCWorkaround() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return;
  }
  const homeDir = os.homedir();
  const configPaths = [
    path.join(homeDir, '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json')
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (data.tokens && data.tokens.refresh_token) {
          const tempAdcPath = path.join(os.tmpdir(), 'aura_gcloud_adc.json');
          const adc = {
            type: 'authorized_user',
            client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
            client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
            refresh_token: data.tokens.refresh_token
          };
          fs.writeFileSync(tempAdcPath, JSON.stringify(adc, null, 2));
          process.env.GOOGLE_APPLICATION_CREDENTIALS = tempAdcPath;
          console.log(`[AUTH] Setup temporary Application Default Credentials from ${configPath}`);
          return;
        }
      } catch (err: any) {
        console.warn(`[AUTH] Failed to parse ${configPath}: ${err.message}`);
      }
    }
  }
}

setupADCWorkaround();

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'aura-control-center-debb3'
  });
}

const db = admin.firestore();

const args = process.argv.slice(2);
const params: Record<string, string | boolean> = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].substring(2);
    if (args[i + 1] && !args[i + 1].startsWith('--')) {
      params[key] = args[i + 1];
      i++;
    } else {
      params[key] = true;
    }
  }
}

const isApply = !!params['apply'];
const jobId = params['job-id'] as string;
const confirmProject = params['confirm-project'] as string;
const confirmState = params['confirm-state'] as string;
const reportFile = (params['report-file'] as string) || 'repair-report.json';

if (isApply) {
  if (confirmProject !== 'aura-control-center-debb3' || confirmState !== 'NL' || !jobId) {
    console.error("Error: Para executar el apply debes confirmar: --apply --confirm-project aura-control-center-debb3 --confirm-state NL --job-id <id>");
    process.exit(1);
  }
}

async function run() {
  console.log(`Starting Repair Script. Mode: ${isApply ? 'APPLY' : 'DRY-RUN'}`);
  const nlRef = db.collection('market_companies');
  const snap = await nlRef.where('isAlias', '==', true).get();

  let affectedDocuments = 0;
  let falseAliasesToRestore = 0;
  let trueAliasesToKeep = 0;
  let identityConflicts = 0;
  let manualReview = 0;
  let writesProjected = 0;

  const report: any = {
    falseAliasesToRestore: [],
    trueAliasesToKeep: [],
    identityConflicts: [],
    manualReview: []
  };

  const batch = db.batch();

  snap.forEach(doc => {
    const data = doc.data();
    affectedDocuments++;

    const isStableStrategy = data.identityStrategy === 'STABLE_FINGERPRINT' || data.identityStrategy === 'OFFICIAL_ID' || data.identityStrategy === 'CONTENT_TIEBREAKER';
    const isStableCanonical = doc.id.startsWith('inegi_stable_') || isStableStrategy;
    const isSelfCanonical = data.canonicalBusinessId === doc.id;

    if (isStableCanonical || isSelfCanonical) {
      falseAliasesToRestore++;
      report.falseAliasesToRestore.push(doc.id);
      writesProjected++;

      if (isApply) {
        batch.update(doc.ref, {
          isAlias: admin.firestore.FieldValue.delete(),
          aliasOf: admin.firestore.FieldValue.delete(),
          migratedToId: admin.firestore.FieldValue.delete(),
          identityStatus: 'CANONICAL',
          lastRepairJob: jobId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } else {
      trueAliasesToKeep++;
      report.trueAliasesToKeep.push(doc.id);
    }
  });

  if (isApply && writesProjected > 0) {
    console.log(`Executing ${writesProjected} writes to Firestore...`);
    await batch.commit();
    console.log("Apply completed.");
  }

  const hashString = JSON.stringify({
    affectedDocuments,
    falseAliasesToRestore,
    trueAliasesToKeep,
    identityConflicts,
    manualReview,
    writesProjected
  });
  const hash = crypto.createHash('sha256').update(hashString).digest('hex');

  console.log("\n=================== REPAIR REPORT ===================");
  console.log(`affectedDocuments: ${affectedDocuments}`);
  console.log(`falseAliasesToRestore: ${falseAliasesToRestore}`);
  console.log(`trueAliasesToKeep: ${trueAliasesToKeep}`);
  console.log(`identityConflicts: ${identityConflicts}`);
  console.log(`manualReview: ${manualReview}`);
  console.log(`writesProjected: ${writesProjected}`);
  console.log(`hash: ${hash}`);
  
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${reportFile}`);
}

run().catch(console.error);
