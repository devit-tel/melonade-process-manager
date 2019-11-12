// Serializer for 2 layer node (${root}/${workflowName}/${workflowRev})
import { WorkflowDefinition } from '@melonade/melonade-declaration';
import * as R from 'ramda';
import { IWorkflowDefinitionStore } from '~/store';
import { MemoryStore } from '~/store/memory';

export class WorkflowDefinitionMemoryStore extends MemoryStore
  implements IWorkflowDefinitionStore {
  constructor() {
    super();
  }

  get(
    name: string,
    rev: string,
  ): Promise<WorkflowDefinition.IWorkflowDefinition> {
    return R.pathOr(null, [name, rev], this.localStore);
  }

  create = async (
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
  ): Promise<WorkflowDefinition.IWorkflowDefinition> => {
    const isWorkflowExists = R.path(
      [workflowDefinition.name, workflowDefinition.rev],
      this.localStore,
    );

    if (isWorkflowExists)
      throw new Error(
        `Workflow: ${workflowDefinition.name}${workflowDefinition.rev} already exists`,
      );

    this.localStore[workflowDefinition.name] = R.set(
      R.lensPath([workflowDefinition.rev]),
      workflowDefinition,
      this.localStore[workflowDefinition.name],
    );

    return workflowDefinition;
  };

  list(): Promise<{
    [name: string]: { [rev: string]: WorkflowDefinition.IWorkflowDefinition };
  }> {
    return Promise.resolve(this.localStore);
  }

  update(
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
  ): Promise<WorkflowDefinition.IWorkflowDefinition> {
    this.localStore[workflowDefinition.name] = R.set(
      R.lensPath([workflowDefinition.rev]),
      workflowDefinition,
      this.localStore[workflowDefinition.name],
    );

    return Promise.resolve(workflowDefinition);
  }
}
