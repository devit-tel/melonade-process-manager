import * as mongoose from 'mongoose';
import { IStore } from '~/store';

export class MongooseStore implements IStore {
  model: mongoose.Model<mongoose.Document, {}>;
  connection: mongoose.Connection;

  constructor(
    uri: string,
    mongoOption: mongoose.ConnectionOptions,
    name: string,
    schema: mongoose.Schema,
  ) {
    this.connection = mongoose.createConnection(uri, mongoOption);
    this.model = this.connection.model(name, schema);
  }

  isHealthy(): boolean {
    return this.connection.readyState === 1;
  }
}
