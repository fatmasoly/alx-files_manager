import crypto from 'crypto';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const existingUser = await dbClient.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const sha1Password = crypto
      .createHash('sha1')
      .update(password)
      .digest('hex');

    const newUser = await dbClient.createUser({
      email,
      password: sha1Password,
    });

    return res.status(201).json({ id: newUser.insertedId, email });
  }
}

export default UsersController;
