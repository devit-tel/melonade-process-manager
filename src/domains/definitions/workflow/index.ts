import {
  WorkflowDefinition,
  IWorkflowDefinition,
} from '../../../workflowDefinition';
import { workflowDefinitionStore } from '../../../store';

export const createWorkflowDefinition = (
  workflowDefinitionData: WorkflowDefinition,
): Promise<any> => {
  const workflowDefinition = new WorkflowDefinition(workflowDefinitionData);
  return workflowDefinitionStore.create(workflowDefinition.toObject());
};

export const getWorkflowDefinition = async (
  workflowName: string,
  workflowRev: string,
): Promise<IWorkflowDefinition> => {
  return workflowDefinitionStore.get(workflowName, workflowRev);
};

export const listWorkflowDefinition = async (): Promise<any[]> => {
  return workflowDefinitionStore.list();
};

export const updateWorkflowDefinition = (
  workflowDefinitionData: WorkflowDefinition,
): Promise<any> => {
  const workflowDefinition = new WorkflowDefinition(workflowDefinitionData);
  return workflowDefinitionStore.update(workflowDefinition.toObject());
};
