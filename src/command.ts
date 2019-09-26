import { commandConsumerClient, poll } from './kafka';
import { workflowDefinitionStore, transactionInstanceStore } from './store';

enum CommandTypes {
  StartTransaction = 'START_TRANSACTION',
  CancelTransaction = 'CANCEL_TRANSACTION',
  PauseTransaction = 'PAUSE_TRANSACTION',
  ResumeTransaction = 'RESUME_TRANSACTION',
}

interface ICommand {
  transactionId: string;
}

interface IStartTransactionCommand extends ICommand {
  type: CommandTypes.StartTransaction;
  workflow: {
    name: string;
    rev: string;
  };
  input: any;
}

interface ICancelTransactionCommand extends ICommand {
  type: CommandTypes.CancelTransaction;
  reason: string;
}

interface IPauseTransactionCommand extends ICommand {
  type: CommandTypes.PauseTransaction;
}

interface IResumeTransactionCommand extends ICommand {
  type: CommandTypes.ResumeTransaction;
}

type AllCommand =
  | IStartTransactionCommand
  | ICancelTransactionCommand
  | IPauseTransactionCommand
  | IResumeTransactionCommand;

const processStartTransactionCommand = async (
  command: IStartTransactionCommand,
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

const processCommands = async (commands: AllCommand[]): Promise<void> => {
  for (const command of commands) {
    try {
      if (!command.transactionId) throw new Error('TransactionId is required');
      switch (command.type) {
        case CommandTypes.StartTransaction:
          return processStartTransactionCommand(command);

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
    const commands: AllCommand[] = await poll(commandConsumerClient);
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
