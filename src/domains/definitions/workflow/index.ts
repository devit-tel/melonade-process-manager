import { WorkflowDefinition } from '@melonade/melonade-declaration';
import { workflowDefinitionStore } from '../../../store';

export const createWorkflowDefinition = (
  workflowDefinitionData: WorkflowDefinition.WorkflowDefinition,
): Promise<any> => {
  return workflowDefinitionStore.create(
    new WorkflowDefinition.WorkflowDefinition(workflowDefinitionData),
  );
};

export const getWorkflowDefinition = async (
  workflowName: string,
  workflowRev: string,
): Promise<WorkflowDefinition.IWorkflowDefinition> => {
  return workflowDefinitionStore.get(workflowName, workflowRev);
};

export const listWorkflowDefinition = async (): Promise<any[]> => {
  return workflowDefinitionStore.list();
};

export const updateWorkflowDefinition = (
  workflowDefinitionData: WorkflowDefinition.WorkflowDefinition,
): Promise<any> => {
  return workflowDefinitionStore.update(
    new WorkflowDefinition.WorkflowDefinition(workflowDefinitionData),
  );
};
