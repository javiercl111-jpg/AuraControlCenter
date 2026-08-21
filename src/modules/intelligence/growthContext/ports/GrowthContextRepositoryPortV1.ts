import type {
  GrowthWorkspaceContextV1,
} from '../domain/GrowthWorkspaceContextV1';


export interface GrowthContextRepositoryPortV1 {

  save(
    context: GrowthWorkspaceContextV1,
  ): Promise<void>;


  get(
    workspaceId: string,
  ): Promise<GrowthWorkspaceContextV1 | null>;


  exists(
    workspaceId: string,
  ): Promise<boolean>;

}