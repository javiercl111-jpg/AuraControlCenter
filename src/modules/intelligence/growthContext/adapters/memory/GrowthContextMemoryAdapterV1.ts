import type {
  GrowthWorkspaceContextV1,
} from '../../domain/GrowthWorkspaceContextV1';

import type {
  GrowthContextRepositoryPortV1,
} from '../../ports/GrowthContextRepositoryPortV1';


export class GrowthContextMemoryAdapterV1
implements GrowthContextRepositoryPortV1 {

  private readonly store =
    new Map<string, GrowthWorkspaceContextV1>();


  async save(
    context: GrowthWorkspaceContextV1,
  ): Promise<void> {

    this.store.set(
      context.workspaceId,
      context,
    );
  }


  async get(
    workspaceId: string,
  ): Promise<GrowthWorkspaceContextV1 | null> {

    return (
      this.store.get(workspaceId)
      ?? null
    );
  }


  async exists(
    workspaceId: string,
  ): Promise<boolean> {

    return this.store.has(
      workspaceId,
    );
  }
}