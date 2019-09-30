import * as mongoose from 'mongoose';
import * as mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { MongooseStore } from '../mongoose';
import { ITaskInstanceStore } from '../../store';
import { ITask } from '../../task';
import { ITaskUpdate } from '../../state';
import {
  TaskPrevStates,
  SystemTaskPrevStates,
  TaskStates,
} from '../../constants/task';

const taskSchema = new mongoose.Schema(
  {
    taskName: String,
    taskReferenceName: String,
    workflowId: {
      type: String,
      index: true,
    },
    transactionId: {
      index: true,
      type: String,
    },
    status: {
      type: String,
      index: true,
    },
    retries: Number,
    isRetried: Boolean,
    input: mongoose.Schema.Types.Mixed,
    output: mongoose.Schema.Types.Mixed,
    createTime: Number, // time that push into Kafka
    startTime: Number, // time that worker ack
    endTime: Number, // time that task finish/failed/cancel
    logs: [String],
    type: String,
    parallelTasks: mongoose.Schema.Types.Mixed,
    workflow: {
      name: String,
      rev: String,
    },
    decisions: mongoose.Schema.Types.Mixed,
    defaultDecision: [mongoose.Schema.Types.Mixed],
    retryDelay: Number,
    ackTimeout: Number,
    timeout: Number,
  },
  {
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
  },
);

taskSchema
  .virtual('taskId')
  .get(function() {
    return this._id;
  })
  .set(function() {
    return this._id;
  });

taskSchema.plugin(mongooseLeanVirtuals);

export class TaskInstanceMongooseStore extends MongooseStore
  implements ITaskInstanceStore {
  constructor(uri: string, mongoOption: mongoose.ConnectionOptions) {
    super(uri, mongoOption, 'task-instance', taskSchema);
  }

  create = async (taskData: ITask): Promise<ITask> => {
    const task = (await this.model.create(taskData)).toObject();
    return {
      ...taskData,
      ...task,
    };
  };
  update = async (taskUpdate: ITaskUpdate): Promise<ITask> => {
    const task = await this.model
      .findOneAndUpdate(
        {
          _id: taskUpdate.taskId,
          status: taskUpdate.isSystem
            ? SystemTaskPrevStates[taskUpdate.status]
            : TaskPrevStates[taskUpdate.status],
        },
        {
          output: taskUpdate.output,
          status: taskUpdate.status,
          ...(taskUpdate.logs
            ? {
                $push: {
                  logs: taskUpdate.logs,
                },
              }
            : {}),
          endTime: [
            TaskStates.Completed,
            TaskStates.Failed,
            TaskStates.Timeout,
          ].includes(taskUpdate.status)
            ? Date.now()
            : null,
        },
        {
          new: true,
        },
      )
      .lean({ virtuals: true })
      .exec();

    if (task) return task;
    throw new Error(
      `Task not match: ${taskUpdate.taskId} with status: ${
        TaskPrevStates[taskUpdate.status]
      }`,
    );
  };

  get = async (taskId: string): Promise<ITask> => {
    const taskData = await this.model
      .findOne({ _id: taskId })
      .lean({ virtuals: true })
      .exec();

    if (taskData) return taskData;
    return null;
  };

  getAll = (workflowId: string): Promise<ITask[]> => {
    return this.model
      .find({ workflowId })
      .lean({ virtuals: true })
      .exec();
  };

  delete(taskId: string): Promise<any> {
    return this.model
      .deleteOne({ _id: taskId })
      .lean({ virtuals: true })
      .exec();
  }

  deleteAll(workflowId: string): Promise<any> {
    return this.model
      .deleteMany({ workflowId })
      .lean({ virtuals: true })
      .exec();
  }
}
