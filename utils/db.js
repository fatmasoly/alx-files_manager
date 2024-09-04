import { MongoClient, ObjectId } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '27017';
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.db = null;

    this.connect(database);
  }

  async connect(database) {
    try {
      await this.client.connect();
      this.db = this.client.db(database);
      console.log('Connected to database');
    } catch (err) {
      console.error('Failed to connect to the database', err);
      process.exit(1);
    }
  }

  isAlive() {
    return this.client && this.client.isConnected() && this.db !== null;
  }

  async nbUsers() {
    const users = this.db.collection('users');
    return users.countDocuments();
  }

  async nbFiles() {
    const files = this.db.collection('files');
    return files.countDocuments();
  }

  async findUser(user) {
    const users = this.db.collection('users');
    return users.findOne(user);
  }

  async createUser(user) {
    const users = this.db.collection('users');
    return users.insertOne(user);
  }

  async getUserByEmail(email) {
    const users = this.db.collection('users');
    return users.findOne({ email });
  }

  async findFile(file) {
    const files = this.db.collection('files');
    return files.findOne(file);
  }

  async createFile(file) {
    const files = this.db.collection('files');
    return files.insertOne(file);
  }

  async allFiles() {
    const files = this.db.collection('files');
    return files.find().toArray();
  }

  async readFile(fileId) {
    const files = this.db.collection('files');
    return files.findOne({ _id: new ObjectId(fileId) });
  }

  async deleteFile(fileId) {
    const files = this.db.collection('files');
    return files.deleteOne({ _id: new ObjectId(fileId) });
  }

  async saveFile(file) {
    const files = this.db.collection('files');
    return files.insertOne(file);
  }
}

const dbClient = new DBClient();
export default dbClient;
