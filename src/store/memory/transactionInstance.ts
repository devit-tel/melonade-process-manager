import { Transaction, Event, State } from '@melonade/melonade-declaration';
import { ITransactionInstanceStore, workflowInstanceStore } from '../../store';
import { MemoryStore } from '../memory';

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
}
