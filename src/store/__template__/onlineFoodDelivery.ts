import {
  State,
  Task,
  TaskDefinition,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';

export const TASKS: TaskDefinition.ITaskDefinition[] = [
  {
    name: 'find_driver',
  },
  {
    name: 'send_order_to_store',
  },
  {
    name: 'store_preparing_food',
  },
  {
    name: 'driver_on_the_way_to_store',
  },
  {
    name: 'wait_for_driver_recived_cash_from_customer',
  },
  {
    name: 'take_money_from_credit_card',
  },
  {
    name: 'take_money_from_app_wallet',
  },
];

export const WORKFLOW: WorkflowDefinition.IWorkflowDefinition = {
  name: 'online_food_delivery',
  rev: 'beta-1',
  description: 'Sample workflow',
  tasks: [
    {
      name: 'find_driver',
      taskReferenceName: 'find_driver',
      type: Task.TaskTypes.Task,
      inputParameters: {
        pickupLocation: '${workflow.input.pickupLocation}',
        deliveryLocation: '${workflow.input.deliveryLocation}',
        cost: '${workflow.input.payment.driverCost}',
      },
      ackTimeout: 300,
      timeout: 30000,
    },
    {
      taskReferenceName: 'p1',
      type: Task.TaskTypes.Parallel,
      inputParameters: {},
      parallelTasks: [
        [
          {
            name: 'send_order_to_store',
            taskReferenceName: 'send_order_to_store',
            type: Task.TaskTypes.Task,
            inputParameters: {
              orders: '${workflow.input.foods}',
              driver: '${find_driver.output.driver}',
            },
            ackTimeout: 10000,
            timeout: 60000,
            retry: {
              limit: 3,
              delay: 10000,
            },
          },
          {
            name: 'store_preparing_food',
            taskReferenceName: 'store_preparing_food',
            type: Task.TaskTypes.Task,
            inputParameters: {},
            ackTimeout: 0,
            timeout: 0,
          },
        ],
        [
          {
            name: 'driver_on_the_way_to_store',
            taskReferenceName: 'driver_on_the_way_to_store',
            type: Task.TaskTypes.Task,
            inputParameters: {},
            ackTimeout: 0,
            timeout: 0,
          },
        ],
      ],
    },
    {
      name: 'driver_on_the_way_to_customer',
      taskReferenceName: 'driver_on_the_way_to_customer',
      type: Task.TaskTypes.Task,
      inputParameters: {},
      ackTimeout: 0,
      timeout: 0,
    },
    {
      taskReferenceName: 'd1',
      type: Task.TaskTypes.Decision,
      inputParameters: {
        case: '$workflow.input.payment.type',
      },
      defaultDecision: [
        {
          name: 'wait_for_driver_recived_cash_from_customer',
          taskReferenceName: 'wait_for_driver_recived_cash_from_customer',
          type: Task.TaskTypes.Task,
          inputParameters: {
            number: '${workflow.input.payment.price}',
          },
        },
      ],
      decisions: {
        CREDIT_CARD: [
          {
            name: 'take_money_from_credit_card',
            taskReferenceName: 'take_money_from_credit_card',
            type: Task.TaskTypes.Task,
            inputParameters: {
              number: '${workflow.input.payment.price}',
              userId: '${workflow.input.user._id}',
              cardIndex: '${workflow.input.payment.cardIndex}',
            },
            ackTimeout: 1000,
            timeout: 60000,
          },
        ],
        APP_WALLET: [
          {
            name: 'take_money_from_app_wallet',
            taskReferenceName: 'take_money_from_app_wallet',
            type: Task.TaskTypes.Task,
            inputParameters: {
              number: '${workflow.input.payment.price}',
              userId: '${workflow.input.user._id}',
            },
            ackTimeout: 1000,
            timeout: 60000,
          },
        ],
      },
    },
  ],
  failureStrategy: State.WorkflowFailureStrategies.Compensate,
  outputParameters: {},
};
