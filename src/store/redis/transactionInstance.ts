import {
  Event,
  State,
  Store,
  Transaction,
} from '@melonade/melonade-declaration';
import ioredis from 'ioredis';
import * as R from 'ramda';
import { RedisStore } from '.';
import { ITransactionInstanceStore } from '..';
import { prefix } from '../../config';
import { jsonTryParse } from '../../utils/common';

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

    await this.client.set(key, JSON.stringify(updatedTransaction));

    return updatedTransaction;
  };

  get = async (transactionId: string): Promise<Transaction.ITransaction> => {
    const TransactionString = await this.client.get(
      `${prefix}.transaction.${transactionId}`,
    );

    if (TransactionString) return JSON.parse(TransactionString);
    return null;
  };

  delete = async (transactionId: string): Promise<void> => {
    await this.client.del(`${prefix}.transaction.${transactionId}`);
  };

  list = async (
    from: number = 0,
    size: number = 50,
  ): Promise<Store.ITransactionPaginate> => {
    const results = await this.client
      .pipeline()
      // DBSIZE return all keys from DB so this not always corrects number of transaction if there are other data in current DB
      .dbsize()
      // We should change "from" to "cursor", to make the paging works
      .scan(from, 'match', `${prefix}.transaction.*`, 'count', size)
      .exec();

    const keys = R.pathOr([], [1, 1, 1], results);

    const transactionStrings = await Promise.all(
      keys.map((key: string) => this.client.get(key)),
    );

    return {
      total: R.pathOr(0, [0, 1], results),
      transactions: transactionStrings.map(
        jsonTryParse,
      ) as Transaction.ITransaction[],
    };
  };

  changeParent = async (
    transactionId: string,
    parent: Transaction.ITransaction['parent'],
  ) => {
    const key = `${prefix}.transaction.${transactionId}`;

    const transactionString = await this.client.get(key);
    if (!transactionString) {
      throw new Error(`Transaction "${transactionId}" not found`);
    }

    // Change parent to conpensate parent
    const transaction: Transaction.ITransaction = JSON.parse(transactionString);
    await this.client.set(
      key,
      JSON.stringify({
        ...transaction,
        parent,
      }),
    );
  };
}
