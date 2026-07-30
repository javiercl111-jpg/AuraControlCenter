# Authority Dark Composition

Authority Dark Composition proves that the certified Firestore authority
repository can be assembled server-side without creating a production
execution surface.

The composition is closed by default:

- `DISABLED` returns an inert composition with no repository.
- `TEST_ONLY` requires an injected Firestore Admin instance, deterministic
  clock, loopback emulator host, `demo-*` project, and an internal
  non-serializable capability.

This is not a production feature flag. The factory does not read environment
variables, initialize Admin SDK, register handlers, receive traffic, execute
commands, or expose Firestore, Admin apps, credentials, or the concrete
repository class.

The capability constructor lives in a direct internal module and is not
exported by this directory's public index. Serialized payloads, booleans,
headers, query parameters, remote configuration, and Firestore documents
cannot activate `TEST_ONLY`.

Do not import this composition from `functions/src/index.ts`. It does not
authorize production use, shadow writes, migrations, outbox delivery, or any
other runtime integration. Connecting a caller or execution surface requires a
new architecture and security audit.
