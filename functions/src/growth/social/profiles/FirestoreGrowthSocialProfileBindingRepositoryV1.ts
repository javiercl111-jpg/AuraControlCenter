import {
  GROWTH_SOCIAL_PROFILE_BINDING_COLLECTION_V1,
  createGrowthSocialProfileBindingV1,
  type GrowthSocialProfileBindingKeyV1,
  type GrowthSocialProfileBindingListQueryV1,
  type GrowthSocialProfileBindingRepositoryV1,
  type GrowthSocialProfileBindingV1,
} from '@aura/intelligence-os/server';


export interface GrowthSocialProfileBindingDocumentSnapshotV1 {

  readonly exists:
    boolean;

  data():
    unknown;

}


export interface GrowthSocialProfileBindingQueryDocumentSnapshotV1 {

  data():
    unknown;

}


export interface GrowthSocialProfileBindingQuerySnapshotV1 {

  readonly docs:
    readonly GrowthSocialProfileBindingQueryDocumentSnapshotV1[];

}


export interface GrowthSocialProfileBindingDocumentReferenceV1 {

  get():
    Promise<GrowthSocialProfileBindingDocumentSnapshotV1>;

  set(
    value:
      Readonly<Record<string, unknown>>,
  ):
    Promise<unknown>;

}


export interface GrowthSocialProfileBindingQueryV1 {

  where(
    field:
      string,
    operator:
      '==',
    value:
      unknown,
  ):
    GrowthSocialProfileBindingQueryV1;

  get():
    Promise<GrowthSocialProfileBindingQuerySnapshotV1>;

}


export interface GrowthSocialProfileBindingCollectionReferenceV1
  extends GrowthSocialProfileBindingQueryV1 {

  doc(
    documentId:
      string,
  ):
    GrowthSocialProfileBindingDocumentReferenceV1;

}


export interface GrowthSocialProfileBindingFirestoreV1 {

  collection(
    name:
      string,
  ):
    GrowthSocialProfileBindingCollectionReferenceV1;

}


export interface FirestoreGrowthSocialProfileBindingRepositoryDependenciesV1 {

  readonly firestore:
    GrowthSocialProfileBindingFirestoreV1;

}


const requireNonEmptyKeyV1 =
  (
    value:
      unknown,
    errorCode:
      string,
  ):
    string => {

    if (
      typeof value !== 'string' ||
      value.trim().length === 0
    ) {
      throw new Error(errorCode);
    }

    return value.trim();

  };


const createDocumentIdV1 =
  (
    tenantId:
      string,
    bindingId:
      string,
  ):
    string =>
      `${encodeURIComponent(tenantId)}__${encodeURIComponent(bindingId)}`;


const parseBindingV1 =
  (
    value:
      unknown,
  ):
    GrowthSocialProfileBindingV1 => {

    if (
      value === null ||
      typeof value !== 'object'
    ) {
      throw new Error(
        'GROWTH_SOCIAL_PROFILE_BINDING_DOCUMENT_INVALID',
      );
    }

    return createGrowthSocialProfileBindingV1(
      value as GrowthSocialProfileBindingV1,
    );

  };


export class FirestoreGrowthSocialProfileBindingRepositoryV1
  implements GrowthSocialProfileBindingRepositoryV1 {

  private readonly firestore:
    GrowthSocialProfileBindingFirestoreV1;


  constructor(
    dependencies:
      FirestoreGrowthSocialProfileBindingRepositoryDependenciesV1,
  ) {

    if (
      dependencies === null ||
      typeof dependencies !== 'object' ||
      dependencies.firestore === null ||
      typeof dependencies.firestore !== 'object'
    ) {
      throw new Error(
        'GROWTH_SOCIAL_PROFILE_BINDING_FIRESTORE_REQUIRED',
      );
    }

    this.firestore =
      dependencies.firestore;

  }


  async getById(
    key:
      GrowthSocialProfileBindingKeyV1,
  ):
    Promise<GrowthSocialProfileBindingV1 | null> {

    const tenantId =
      requireNonEmptyKeyV1(
        key.tenantId,
        'GROWTH_SOCIAL_PROFILE_BINDING_TENANT_ID_REQUIRED',
      );

    const bindingId =
      requireNonEmptyKeyV1(
        key.bindingId,
        'GROWTH_SOCIAL_PROFILE_BINDING_ID_REQUIRED',
      );

    const snapshot =
      await this
        .collection()
        .doc(
          createDocumentIdV1(
            tenantId,
            bindingId,
          ),
        )
        .get();

    if (!snapshot.exists) {
      return null;
    }

    const binding =
      parseBindingV1(
        snapshot.data(),
      );

    if (
      binding.tenantId !== tenantId ||
      binding.bindingId !== bindingId
    ) {
      throw new Error(
        'GROWTH_SOCIAL_PROFILE_BINDING_DOCUMENT_IDENTITY_MISMATCH',
      );
    }

    return binding;

  }


  async listByTenant(
    query:
      GrowthSocialProfileBindingListQueryV1,
  ):
    Promise<readonly GrowthSocialProfileBindingV1[]> {

    const tenantId =
      requireNonEmptyKeyV1(
        query.tenantId,
        'GROWTH_SOCIAL_PROFILE_BINDING_TENANT_ID_REQUIRED',
      );

    let firestoreQuery:
      GrowthSocialProfileBindingQueryV1 =
        this
          .collection()
          .where(
            'tenantId',
            '==',
            tenantId,
          );

    if (typeof query.provider !== 'undefined') {

      firestoreQuery =
        firestoreQuery.where(
          'provider',
          '==',
          query.provider,
        );

    }

    if (query.activeOnly === true) {

      firestoreQuery =
        firestoreQuery.where(
          'isActive',
          '==',
          true,
        );

    }

    const snapshot =
      await firestoreQuery.get();

    return Object.freeze(
      snapshot.docs.map(
        (document) => {

          const binding =
            parseBindingV1(
              document.data(),
            );

          if (binding.tenantId !== tenantId) {
            throw new Error(
              'GROWTH_SOCIAL_PROFILE_BINDING_TENANT_SCOPE_MISMATCH',
            );
          }

          return binding;

        },
      ),
    );

  }


  async save(
    binding:
      GrowthSocialProfileBindingV1,
  ):
    Promise<void> {

    const validated =
      createGrowthSocialProfileBindingV1(
        binding,
      );

    const documentId =
      createDocumentIdV1(
        validated.tenantId,
        validated.bindingId,
      );

    await this
      .collection()
      .doc(documentId)
      .set({
        ...validated,
      });

  }


  private collection():
    GrowthSocialProfileBindingCollectionReferenceV1 {

    return this.firestore.collection(
      GROWTH_SOCIAL_PROFILE_BINDING_COLLECTION_V1,
    );

  }

}