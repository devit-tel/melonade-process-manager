import { Event, State, Workflow } from '@melonade/melonade-declaration';
import * as uuid from 'uuid/v4';
import { IWorkflowInstanceStore, taskInstanceStore } from '../../store';
import { MemoryStore } from '../memory';

export class WorkflowInstanceMemoryStore extends MemoryStore
  implements IWorkflowInstanceStore {
  constructor() {
    super();
  }

  create = async (
    workflowData: Workflow.IWorkflow,
  ): Promise<Workflow.IWorkflow> => {
    const workflow = {
      ...workflowData,
      workflowId: uuid(),
    };

    this.setValue(workflow.workflowId, workflow);

    return workflow;
  };

  update = async (
    workflowUpdate: Event.IWorkflowUpdate,
  ): Promise<Workflow.IWorkflow> => {
    const workflow = await this.getValue(workflowUpdate.workflowId);
    if (!workflow) {
      throw new Error(`Workflow "${workflowUpdate.workflowId}" not found`);
    }

    if (
      !State.WorkflowNextStates[workflow.status].includes(workflowUpdate.status)
    ) {
      throw new Error(
        `Cannot change status of "${workflow.workflowId}" from ${workflow.status} to ${workflowUpdate.status}`,
      );
    }

    const updatedWorkflow = {
      ...workflow,
      status: workflowUpdate.status,
      output: workflowUpdate.output,
      endTime: [
        State.WorkflowStates.Completed,
        State.WorkflowStates.Failed,
        State.WorkflowStates.Timeout,
        State.WorkflowStates.Cancelled,
      ].includes(workflowUpdate.status)
        ? Date.now()
        : null,
    };

    this.setValue(workflowUpdate.workflowId, updatedWorkflow);

    return updatedWorkflow;
  };

  get = async (workflowId: string): Promise<Workflow.IWorkflow> => {
    return this.getValue(workflowId);
  };

  getByTransactionId = async (
    transactionId: string,
  ): Promise<Workflow.IWorkflow> => {
    return this.listValue().find(
      (workflow: Workflow.IWorkflow) =>
        workflow.transactionId === transactionId &&
        workflow.type === Workflow.WorkflowTypes.Workflow,
    );
  };

  delete(workflowId: string): Promise<any> {
    return this.unsetValue(workflowId);
  }

  deleteAll = async (transactionId: string): Promise<void> => {
    const transactionWorkflows = await this.listValue().filter(
      (workflow: Workflow.IWorkflow) =>
        workflow.transactionId === transactionId,
    );

    for (const workflow of transactionWorkflows) {
      this.unsetValue(workflow.workflowId);
      await taskInstanceStore.deleteAll(workflow.workflowId);
    }
  };
}
