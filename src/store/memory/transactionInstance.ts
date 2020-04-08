import {
  Event,
  State,
  Store,
  Transaction,
} from '@melonade/melonade-declaration';
import * as R from 'ramda';
import { MemoryStore } from '.';
import { ITransactionInstanceStore, workflowInstanceStore } from '..';

export class TransactionInstanceMemoryStore extends MemoryStore
  implements ITransactionInstanceStore {
  constructor() {
    super();
  }

  create = async (
    transaction: Transaction.ITransaction,
  ): Promise<Transaction.ITransaction> => {
    if (this.localStore[transaction.transactionId]) {
      throw new Error(
        `Transaction "${transaction.transactionId}" already exists`,
      );
    }

    this.setValue(transaction.transactionId, transaction);

    return transaction;
  };

  update = async (
    transactionUpdate: Event.ITransactionUpdate,
  ): Promise<Transaction.ITransaction> => {
    const transaction = await this.getValue(transactionUpdate.transactionId);
    if (!transaction) {
      throw new Error(
        `Transaction "${transactionUpdate.transactionId}" not found`,
      );
    }

    if (
      !State.TransactionNextStates[transaction.status].includes(
        transactionUpdate.status,
      )
    ) {
      throw new Error(
        `Cannot change status of "${transaction.transactionId}" from ${transaction.status} to ${transactionUpdate.status}`,
      );
    }

    const updatedTransaction = {
      ...transaction,
      status: transactionUpdate.status,
      output: transactionUpdate.output,
      endTime: [
        State.TransactionStates.Completed,
        State.TransactionStates.Failed,
      ].includes(transactionUpdate.status)
        ? Date.now()
        : null,
    };

    // In case of redis I dont want to keep completed transaction
    if (
      [
        State.TransactionStates.Completed,
        State.TransactionStates.Failed,
        State.TransactionStates.Cancelled,
        State.TransactionStates.Compensated,
      ].includes(transactionUpdate.status)
    ) {
      this.unsetValue(transaction.transactionId);
      await Promise.all([
        workflowInstanceStore.deleteAll(transaction.transactionId),
      ]);
    } else {
      this.setValue(transaction.transactionId, updatedTransaction);
    }

    return updatedTransaction;
  };

  get = async (transactionId: string): Promise<Transaction.ITransaction> => {
    return this.getValue(transactionId);
  };

  delete(transactionId: string): Promise<any> {
    return this.unsetValue(transactionId);
  }

  list = async (
    from: number = 0,
    size: number = 50,
  ): Promise<Store.ITransactionPaginate> => {
    return {
      // This is bad performance we should use Map instread of object since we have to know number of keys
      total: Object.keys(this.localStore).length,
      transactions: R.slice(
        from,
        size,
        R.values(this.localStore),
      ) as Transaction.ITransaction[],
    };
  };

  changeParent = async (
    transactionId: string,
    parent: Transaction.ITransaction['parent'],
  ) => {
    const transaction = await this.getValue(transactionId);
    if (!transaction) {
      throw new Error(`Transaction "${transactionId}" not found`);
    }

    this.setValue(transaction.transactionId, {
      ...transaction,
      parent,
    });
  };
}
