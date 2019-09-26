// Serializer for 2 layer node (${root}/${workflowName}/${workflowRev})
import * as R from 'ramda';
import {
  ZookeeperStore,
  IZookeeperOptions,
  IZookeeperEvent,
  ZookeeperEvents,
} from '../zookeeper';
import { IWorkflowDefinitionStore } from '../../store';
import {
  WorkflowDefinition,
  IWorkflowDefinition,
} from '../../workflowDefinition';
import { jsonTryParse } from '../../utils/common';
import { BadRequest } from '../../errors';

export class WorkflowDefinitionZookeeperStore extends ZookeeperStore
  implements IWorkflowDefinitionStore {
  constructor(
    root: string,
    connectionString: string,
    options?: IZookeeperOptions,
  ) {
    super(root, connectionString, options);

    this.client.mkdirp(this.root, null, null, null, (error: Error) => {
      if (!error) {
        this.getAndWatchWorkflows();
      }
    });
  }

  get(name: string, rev: string): Promise<IWorkflowDefinition> {
    return R.path([name, rev], this.localStore);
  }

  create = async (
    workflowDefinition: IWorkflowDefinition,
  ): Promise<IWorkflowDefinition> => {
    const isWorkflowExists = await this.isExists(
      `${this.root}/${workflowDefinition.name}/${workflowDefinition.rev}`,
    );
    if (isWorkflowExists)
      throw new BadRequest(
        `Workflow: ${workflowDefinition.name}${workflowDefinition.rev} already exists`,
      );

    return new Promise((resolve: Function, reject: Function) =>
      this.client.mkdirp(
        `${this.root}/${workflowDefinition.name}/${workflowDefinition.rev}`,
        Buffer.from(JSON.stringify(workflowDefinition)),
        null,
        'PERSISTENT',
        (error: Error) => {
          if (error) return reject(error);
          resolve(workflowDefinition);
        },
      ),
    );
  };

  list(): Promise<IWorkflowDefinition[]> {
    return Promise.resolve(super.listValue(undefined, 0));
  }

  update(
    workflowDefinition: IWorkflowDefinition,
  ): Promise<IWorkflowDefinition> {
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
      (event: IZookeeperEvent) => {
        switch (event.name) {
          case ZookeeperEvents.NODE_CHILDREN_CHANGED:
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
      (event: IZookeeperEvent) => {
        switch (event.name) {
          case ZookeeperEvents.NODE_CHILDREN_CHANGED:
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
      (event: IZookeeperEvent) => {
        switch (event.name) {
          case ZookeeperEvents.NODE_DATA_CHANGED:
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
            const workflowDefinition = new WorkflowDefinition(
              jsonTryParse(data.toString()),
            );
            this.localStore = R.set(
              R.lensPath([workflow, rev]),
              workflowDefinition.toObject(),
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
