import { Event, State, Workflow } from '@melonade/melonade-declaration';
import ioredis from 'ioredis';
import * as uuid from 'uuid/v4';
import { prefix } from '../../config';
import { IWorkflowInstanceStore, taskInstanceStore } from '../../store';
import { RedisStore } from '../redis';

export class WorkflowInstanceRedisStore extends RedisStore
  implements IWorkflowInstanceStore {
  constructor(redisOptions: ioredis.RedisOptions) {
    super(redisOptions);
  }

  create = async (
    workflowData: Workflow.IWorkflow,
    oldWorkflowId?: string,
  ): Promise<Workflow.IWorkflow> => {
    const workflow = {
      ...workflowData,
      workflowId: uuid(),
    };

    const pipeline = this.client
      .pipeline()
      .setnx(
        `${prefix}.workflow.${workflow.workflowId}`,
        JSON.stringify(workflow),
      )
      .sadd(
        `${prefix}.transaction-workflow.${workflow.transactionId}`,
        workflow.workflowId,
      );

    if (oldWorkflowId)
      pipeline.srem(
        `${prefix}.transaction-workflow.${workflow.transactionId}`,
        oldWorkflowId,
      );

    const results = await pipeline.exec();

    if (results[0][1] !== 1) {
      // if cannot set recurrsively create
      console.log('recreate');
      return this.create(workflowData, workflow.workflowId);
    }

    return workflow;
  };

  update = async (
    workflowUpdate: Event.IWorkflowUpdate,
  ): Promise<Workflow.IWorkflow> => {
    const key = `${prefix}.workflow.${workflowUpdate.workflowId}`;
    const workflowString = await this.client.get(key);
    if (!workflowString) {
      throw new Error(`Workflow "${workflowUpdate.workflowId}" not found`);
    }

    const workflow = JSON.parse(workflowString);
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

    await this.client.set(key, JSON.stringify(updatedWorkflow));

    return updatedWorkflow;
  };

  get = async (workflowId: string): Promise<Workflow.IWorkflow> => {
    const workflowString = await this.client.get(
      `${prefix}.workflow.${workflowId}`,
    );

    if (workflowString) return JSON.parse(workflowString);
    return undefined;
  };

  getByTransactionId = async (
    transactionId: string,
  ): Promise<Workflow.IWorkflow> => {
    const workflowKeys = await this.client.smembers(
      `${prefix}.transaction-workflow.${transactionId}`,
    );
    const workflowString = await this.client.get(
      `${prefix}.workflow.${workflowKeys[0]}`,
    );

    if (workflowString) return JSON.parse(workflowString);
    return undefined;
  };

  delete(workflowId: string): Promise<any> {
    return this.client.del(`${prefix}.workflow.${workflowId}`);
  }

  deleteAll = async (transactionId: string): Promise<void> => {
    const key = `${prefix}.transaction-workflow.${transactionId}`;
    const workflowKeys = await this.client.smembers(key);
    await Promise.all([
      this.client.del(
        ...workflowKeys.map(workflowId => `${prefix}.workflow.${workflowId}`),
        key,
      ),
      ...workflowKeys.map(workflowId =>
        taskInstanceStore.deleteAll(workflowId),
      ),
    ]);
  };
}
