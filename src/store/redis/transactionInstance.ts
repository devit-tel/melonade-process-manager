import { Event, State, Transaction } from '@melonade/melonade-declaration';
import ioredis from 'ioredis';
import { prefix } from '../../config';
import { ITransactionInstanceStore, workflowInstanceStore } from '../../store';
import { RedisStore } from '../redis';

export class TransactionInstanceRedisStore extends RedisStore
  implements ITransactionInstanceStore {
  constructor(redisOptions: ioredis.RedisOptions) {
    super(redisOptions);
  }

  create = async (
    transaction: Transaction.ITransaction,
  ): Promise<Transaction.ITransaction> => {
    const isSet = await this.client.setnx(
      `${prefix}.transaction.${transaction.transactionId}`,
      JSON.stringify(transaction),
    );
    if (isSet !== 1) {
      throw new Error(
        `Transaction "${transaction.transactionId}" already exists`,
      );
    }

    return transaction;
  };

  update = async (
    transactionUpdate: Event.ITransactionUpdate,
  ): Promise<Transaction.ITransaction> => {
    const key = `${prefix}.transaction.${transactionUpdate.transactionId}`;
    const transactionString = await this.client.get(key);
    if (!transactionString) {
      throw new Error(
        `Transaction "${transactionUpdate.transactionId}" not found`,
      );
    }

    const transaction: Transaction.ITransaction = JSON.parse(transactionString);
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
      await Promise.all([
        this.client.del(key),
        workflowInstanceStore.deleteAll(transaction.transactionId),
      ]);
    } else {
      await this.client.set(key, JSON.stringify(updatedTransaction));
    }

    return updatedTransaction;
  };

  get = async (transactionId: string): Promise<Transaction.ITransaction> => {
    const TransactionString = await this.client.get(
      `${prefix}.transaction.${transactionId}`,
    );

    if (TransactionString) return JSON.parse(TransactionString);
    return null;
  };

  delete(transactionId: string): Promise<any> {
    return this.client.del(`${prefix}.transaction.${transactionId}`);
  }
}
