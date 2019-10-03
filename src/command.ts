import { Command } from '@melonade/melonade-declaration';
import { commandConsumerClient, poll } from './kafka';
import { workflowDefinitionStore, transactionInstanceStore } from './store';

const processStartTransactionCommand = async (
  command: Command.IStartTransactionCommand,
): Promise<void> => {
  const workflowDefinition = await workflowDefinitionStore.get(
    command.workflow.name,
    command.workflow.rev,
  );
  if (!workflowDefinition)
    throw new Error(
      `Workflow definition "${command.workflow.name}:${command.workflow.rev}" is not exists`,
    );

  await transactionInstanceStore.create(
    command.transactionId,
    workflowDefinition,
    command.input,
  );
};

const processCommands = async (
  commands: Command.AllCommand[],
): Promise<void> => {
  for (const command of commands) {
    try {
      if (!command.transactionId) throw new Error('TransactionId is required');
      switch (command.type) {
        case Command.CommandTypes.StartTransaction:
          await processStartTransactionCommand(command);
          break;

        default:
          throw new Error(`Command type "${command.type}" is invalid`);
      }
    } catch (error) {
      // Add some logger or send to event store
      console.log(error);
    }
  }
};

export const executor = async () => {
  try {
    const commands: Command.AllCommand[] = await poll(commandConsumerClient);
    if (commands.length) {
      await processCommands(commands);
      commandConsumerClient.commit();
    }
  } catch (error) {
    // Handle error here
    console.log(error);
  }
  setImmediate(executor);
};
