import { Event, State, Transaction } from '@melonade/melonade-declaration';
import * as mongoose from 'mongoose';
import { ITransactionInstanceStore, workflowInstanceStore } from '~/store';
import { MongooseStore } from '~/store/mongoose';

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
      .exec();
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
    const updatedTransaction = await this.model
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

    if (
      [
        State.TransactionStates.Completed,
        State.TransactionStates.Failed,
        State.TransactionStates.Cancelled,
        State.TransactionStates.Compensated,
      ].includes(transactionUpdate.status)
    ) {
      await Promise.all([
        this.model.deleteOne({
          transactionId: transactionUpdate.transactionId,
        }),
        workflowInstanceStore.deleteAll(transactionUpdate.transactionId),
      ]);
    }

    return updatedTransaction;
  };
}
