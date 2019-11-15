// Serializer for 2 layer node (${root}/${workflowName}/${workflowRev})
import { WorkflowDefinition } from '@melonade/melonade-declaration';
import * as nodeZookeeperClient from 'node-zookeeper-client';
import * as R from 'ramda';
import { ZookeeperStore } from '.';
import { IWorkflowDefinitionStore } from '..';
import { melonade } from '../../config';
import { jsonTryParse } from '../../utils/common';
import { workflow as exampleWorkflow } from '../__template__';

export class WorkflowDefinitionZookeeperStore extends ZookeeperStore
  implements IWorkflowDefinitionStore {
  constructor(
    root: string,
    connectionString: string,
    options?: nodeZookeeperClient.Option,
  ) {
    super(root, connectionString, options);

    this.client.mkdirp(
      this.root,
      null,
      null,
      nodeZookeeperClient.CreateMode.PERSISTENT,
      (error: Error) => {
        if (!error) {
          this.getAndWatchWorkflows();
        }
      },
    );

    if (melonade.example) {
      for (const workflowDefinition of exampleWorkflow) {
        this.create(workflowDefinition);
      }
    }
  }

  get(
    name: string,
    rev: string,
  ): Promise<WorkflowDefinition.IWorkflowDefinition> {
    return R.path([name, rev], this.localStore);
  }

  create = async (
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
  ): Promise<WorkflowDefinition.IWorkflowDefinition> => {
    const isWorkflowExists = await this.isExists(
      `${this.root}/${workflowDefinition.name}/${workflowDefinition.rev}`,
    );
    if (isWorkflowExists)
      throw new Error(
        `Workflow: ${workflowDefinition.name}${workflowDefinition.rev} already exists`,
      );

    return new Promise((resolve: Function, reject: Function) =>
      this.client.mkdirp(
        `${this.root}/${workflowDefinition.name}/${workflowDefinition.rev}`,
        Buffer.from(JSON.stringify(workflowDefinition)),
        null,
        nodeZookeeperClient.CreateMode.PERSISTENT,
        (error: Error) => {
          if (error) return reject(error);
          resolve(workflowDefinition);
        },
      ),
    );
  };

  list(): Promise<{
    [name: string]: { [rev: string]: WorkflowDefinition.IWorkflowDefinition };
  }> {
    return Promise.resolve(this.localStore);
  }

  update(
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
  ): Promise<WorkflowDefinition.IWorkflowDefinition> {
    return new Promise((resolve: Function, reject: Function) =>
      this.client.setData(
        `${this.root}/${workflowDefinition.name}/${workflowDefinition.rev}`,
        Buffer.from(JSON.stringify(workflowDefinition)),
        -1,
        (error: Error) => {
          if (error) return reject(error);
          resolve(workflowDefinition);
        },
      ),
    );
  }

  private getAndWatchWorkflows = () => {
    this.client.getChildren(
      this.root,
      (event: nodeZookeeperClient.Event) => {
        switch (event.type) {
          case nodeZookeeperClient.Event.NODE_CHILDREN_CHANGED:
            this.getAndWatchWorkflows();
            break;
          default:
            break;
        }
      },
      (error: Error, workflows: string[]) => {
        if (!error) {
          workflows.map(this.getAndWatchRevs);
        }
      },
    );
  };

  private getAndWatchRevs = (workflow: string) => {
    this.client.getChildren(
      `${this.root}/${workflow}`,
      (event: nodeZookeeperClient.Event) => {
        switch (event.type) {
          case nodeZookeeperClient.Event.NODE_CHILDREN_CHANGED:
            // When add new ref, this is also fire when ref are deleted, but did not work at this time
            this.getAndWatchRevs(workflow);
            break;
          default:
            break;
        }
        return true;
      },
      (workflowError: Error, revs: string[]) => {
        if (!workflowError) {
          for (const rev of revs) {
            this.getAndWatchRef(workflow, rev);
          }
        }
      },
    );
  };

  private getAndWatchRef = (workflow: string, rev: string) => {
    this.client.getData(
      `${this.root}/${workflow}/${rev}`,
      (event: nodeZookeeperClient.Event) => {
        switch (event.type) {
          case nodeZookeeperClient.Event.NODE_DATA_CHANGED:
            // When rev's data change
            this.getAndWatchRef(workflow, rev);
            break;
          default:
            break;
        }
        return true;
      },
      (dataError: Error, data: Buffer) => {
        if (!dataError) {
          try {
            this.localStore = R.set(
              R.lensPath([workflow, rev]),
              new WorkflowDefinition.WorkflowDefinition(
                jsonTryParse(data.toString()),
              ),
              this.localStore,
            );
          } catch (error) {
            console.error(error);
          }
        }
      },
    );
  };
}
