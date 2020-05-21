import {
  Event,
  State,
  Store,
  Transaction,
} from '@melonade/melonade-declaration';
import * as mongoose from 'mongoose';
import { MongooseStore } from '.';
import { ITransactionInstanceStore } from '..';

const transacationSchema = new mongoose.Schema(
  {
    transactionId: {
      index: true,
      unique: true,
      type: String,
    },
    status: {
      type: String,
      index: true,
    },
    input: mongoose.Schema.Types.Mixed,
    output: mongoose.Schema.Types.Mixed,
    createTime: Number,
    endTime: Number,
    workflowDefinition: mongoose.Schema.Types.Mixed,
    tags: [String],
    parent: {
      transactionId: String,
      taskId: String,
      taskType: String,
      depth: Number,
    },
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

export class TransactionInstanceMongooseStore extends MongooseStore
  implements ITransactionInstanceStore {
  constructor(uri: string, mongoOption: mongoose.ConnectionOptions) {
    super(uri, mongoOption, 'transaction-instance', transacationSchema);
  }

  get = async (transactionId: string): Promise<Transaction.ITransaction> => {
    return this.model
      .findOne({ transactionId })
      .lean({ virtuals: true })
      .exec() as Promise<Transaction.ITransaction>;
  };

  create = async (
    transactionData: Transaction.ITransaction,
  ): Promise<Transaction.ITransaction> => {
    return {
      ...transactionData,
      ...(await this.model.create(transactionData)).toObject(),
    };
  };

  update = async (
    transactionUpdate: Event.ITransactionUpdate,
  ): Promise<Transaction.ITransaction> => {
    const transaction = await this.get(transactionUpdate.transactionId);
    const parentTransactionId = transaction.parent?.transactionId;
    const parentTaskId = transaction.parent?.taskId;

    if (parentTransactionId && parentTaskId) {
      const updatedTransaction = <Transaction.ITransaction>await this.model
        .findOneAndUpdate(
          {
            transactionId: transactionUpdate.transactionId,
            status: State.SubTransactionPrevStates[transactionUpdate.status],
          },
          {
            status: transactionUpdate.status,
            output: transactionUpdate.output,
            endTime: [
              State.TransactionStates.Completed,
              State.TransactionStates.Failed,
            ].includes(transactionUpdate.status)
              ? Date.now()
              : null,
          },
          {
            new: true,
          },
        )
        .lean({ virtuals: true })
        .exec();

      return updatedTransaction;
    } else {
      const updatedTransaction = <Transaction.ITransaction>await this.model
        .findOneAndUpdate(
          {
            transactionId: transactionUpdate.transactionId,
            status: State.TransactionPrevStates[transactionUpdate.status],
          },
          {
            status: transactionUpdate.status,
            output: transactionUpdate.output,
            endTime: [
              State.TransactionStates.Completed,
              State.TransactionStates.Failed,
            ].includes(transactionUpdate.status)
              ? Date.now()
              : null,
          },
          {
            new: true,
          },
        )
        .lean({ virtuals: true })
        .exec();

      return updatedTransaction;
    }
  };

  delete = async (transactionId: string): Promise<void> => {
    await this.model.deleteOne({
      transactionId: transactionId,
    });
  };

  list = async (
    from: number = 0,
    size: number = 50,
  ): Promise<Store.ITransactionPaginate> => {
    const [total, transactions] = await Promise.all([
      this.model.count({}).lean().exec(),
      this.model.find({}).limit(size).skip(from).lean().exec(),
    ]);

    return {
      total: total as number,
      transactions: transactions as Transaction.ITransaction[],
    };
  };

  changeParent = async (
    transactionId: string,
    parent: Transaction.ITransaction['parent'],
  ) => {
    await this.model.updateOne(
      {
        transactionId,
      },
      {
        parent,
      },
    );
  };
}
