import * as onlineFoodDelivery from './onlineFoodDelivery';
import * as simple from './simple';

export const tasks = [...simple.TASKS, ...onlineFoodDelivery.TASKS];

export const workflow = [simple.WORKFLOW, onlineFoodDelivery.WORKFLOW];
