const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ projectId: 'aura-control-center-debb3' });
const db = getFirestore();
async function create() {
  const linkRef = db.collection('market_discovery_links').doc();
  await linkRef.set({
    companyName: 'Test Corp',
    contactName: 'John Doe',
    email: 'john@test.com',
    status: 'pending',
    tokenHash: require('crypto').createHash('sha256').update('test_token').digest('hex'),
    createdAt: new Date()
  });
  console.log('http://localhost:5173/discover/' + linkRef.id + '?access=test_token');
}
create().catch(console.error);
