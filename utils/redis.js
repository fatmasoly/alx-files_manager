import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (error) => {
      console.log(`Redis client not connected to the server: ${error.message}`);
    });
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    const getAsync = promisify(this.client.get).bind(this.client);
    const value = await getAsync(key);
    return value;
  }

  async set(key, value, duration) {
    const setAsync = promisify(this.client.set).bind(this.client);
    this.client.set(key, value);
    this.client.expire(key, duration);
  }

  async del(key) {
    const delAsync = promisify(this.client.del).bind(this.client);
    this.client.del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
