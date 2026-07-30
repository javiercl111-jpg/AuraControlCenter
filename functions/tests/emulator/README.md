# Firestore authority emulator certification

This directory is test-only. It never reads the repository's production
Firebase project selection, Firestore rules, or indexes.

Run the certification from the repository root under Node 20:

```sh
npm run test:firestore-authority-emulator
```

The script stages the private Aura Intelligence OS package and invokes the
exact `firebase-tools@15.25.0` CLI through `npx` and `emulators:exec`. It
starts only Firestore on a loopback port and always selects
`demo-aura-intelligence-os-authority`.

Before Admin SDK initialization, the harness requires
`FIRESTORE_EMULATOR_HOST`, `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, and
`FIREBASE_CONFIG` to agree on the demo project. It rejects
`GOOGLE_APPLICATION_CREDENTIALS`, non-loopback emulator hosts, missing
configuration, and every non-demo project ID.

The Admin app has a unique test-only name. Each test clears only the selected
emulator database through the emulator REST endpoint, and the suite terminates
the Firestore client and deletes the app when it finishes. The test-only rules
deny all client access; Admin SDK bypasses rules. No indexes are configured
because the adapter performs exact document reads and no queries.

Admin initialization uses an emulator-only certificate generated in memory for
the demo project. It never loads application default credentials, a credential
file, or a persisted private key.
