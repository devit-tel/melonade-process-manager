import {
  Transaction,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import * as uuid from 'uuid/v4';
import { transactionInstanceStore, workflowDefinitionStore } from '../../store';

export const startTransaction = async (
  workflowName: string,
  workflowRef: string,
  input: any,
  transactionId?: string,
): Promise<Transaction.ITransaction> => {
  const workflowDefinition: WorkflowDefinition.IWorkflowDefinition = await workflowDefinitionStore.get(
    workflowName,
    workflowRef,
  );
  if (!workflowDefinition) {
    throw new Error('Workflow not found');
  }
  return transactionInstanceStore.create(
    transactionId || uuid(),
    workflowDefinition,
    input,
  );
};
