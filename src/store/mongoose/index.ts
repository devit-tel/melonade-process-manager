import * as mongoose from 'mongoose';
import { IStore } from '../../store';

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

  setValue(key: string, value: any) {
    return this.model
      .findByIdAndUpdate({ _id: key }, value, { upsert: true })
      .lean(true);
  }

  unsetValue(key: string): any {
    return this.model.deleteOne({ _id: key });
  }

  getValue(key: string): any {
    return this.model.findById(key);
  }

  listValue(limit: number = Number.MAX_SAFE_INTEGER, offset: number = 0): any {
    return this.model.find({}, null, { limit, skip: offset });
  }
}
