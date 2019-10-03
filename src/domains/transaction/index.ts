import * as uuid from 'uuid/v4';
import {
  WorkflowDefinition,
  Transaction,
} from '@melonade/melonade-declaration';
import { workflowDefinitionStore, transactionInstanceStore } from '../../store';

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
