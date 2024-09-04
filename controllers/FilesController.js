/* eslint-disable import/named */
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { ObjectId } from 'mongodb';
import { contentType } from 'mime-types';
import Bull from 'bull';
import { promisify } from 'util';
import { getUserId } from '../utils/utils';

import dbClient from '../utils/db';

const fileImageQueue = new Bull('fileQueue');

const ROOT_PARENT_ID = 0;

class FilesController {
  static async postUpload(req, res) {
    const { user } = req;

    const userId = user.id;
    const { name, type, data } = req.body;
    const parentId = req.body.parentId || ROOT_PARENT_ID;
    const isPublic = req.body.isPublic || false;
    const localPath = process.env.FOLDER_PATH || '/tmp/files_manager/';

    const validFileTypes = ['folder', 'file', 'image'];

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !validFileTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    try {
      if (parentId !== ROOT_PARENT_ID) {
        const file = await dbClient.getFileByIdAndUserId(parentId, userId);

        if (!file) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (file.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      const newFile = {
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId: parentId !== ROOT_PARENT_ID ? ObjectId(parentId) : parentId,
      };

      if (type !== 'folder') {
        const fileName = uuidv4();
        const filePath = !localPath.endsWith('/')
          ? `${localPath}/${fileName}`
          : `${localPath}${fileName}`;
        newFile.localPath = filePath;
        const decodedData = Buffer.from(data, 'base64').toString('utf-8');

        const directory = path.dirname(filePath);
        if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory, { recursive: true });
        }

        fs.writeFile(filePath, decodedData, (err) => {
          if (err) throw err;
        });
      }

      const createdFile = await dbClient.addFile(newFile);

      if (createdFile.type === 'image') {
        await fileImageQueue.add({
          userId,
          fileId: createdFile.id,
        });
      }

      return res.status(201).json({
        id: createdFile.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId: parentId === ROOT_PARENT_ID ? 0 : parentId,
      });
    } catch (error) {
      return res.status(500).send('Internal server error');
    }
  }

  static async getShow(req, res) {
    const { user } = req;

    const { id } = req.params;
    const userId = user.id;

    try {
      const file = await dbClient.getFileByIdAndUserId(id, userId);

      if (!file) {
        return res.status(400).json({ error: 'Not found' });
      }

      return res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId:
          file.parentId === ROOT_PARENT_ID ? 0 : file.parentId.toString(),
      });
    } catch (error) {
      return res.status(500).send('Internal server error');
    }
  }

  static async getIndex(req, res) {
    const { user } = req;

    const userId = user.id;
    const parentId = req.query.parentId || ROOT_PARENT_ID;
    const page = parseInt(req.query.page, 10) || 0;

    try {
      const files = await dbClient.getPaginatedFiles(userId, parentId, page);

      const modifiedData = files.map((file) => ({
        id: file._id.toString(),
        userId: file.userId.toString(),
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId:
          file.parentId === ROOT_PARENT_ID ? 0 : file.parentId.toString(),
      }));

      return res.status(200).json(modifiedData);
    } catch (error) {
      return res.status(500).send('Internal server error');
    }
  }

  static async putFilePublish(req, res) {
    const { user, isPublic } = req;
    const userId = user.id;
    const { id } = req.params;

    try {
      const file = await dbClient.updateFileIsPublic(id, userId, isPublic);
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      console.log(file);

      return res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId:
          file.parentId === ROOT_PARENT_ID
            ? ROOT_PARENT_ID
            : file.parentId.toString(),
      });
    } catch (error) {
      return res.status(500).send('Internal server error');
    }
  }

  static async putPublish(req, res, next) {
    req.isPublic = true;
    return next();
  }

  static async putUnpublish(req, res, next) {
    req.isPublic = false;
    return next();
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const tokenFromHeaders = req.headers['x-token'];
    const { size } = req.query;

    try {
      const file = await dbClient.getFileById(fileId);
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      const userId = await getUserId(tokenFromHeaders);
      if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      const fileLocalPath =
        size && file.type === 'image'
          ? `${file.localPath}_${size}`
          : file.localPath;

      if (!fs.existsSync(fileLocalPath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      const fileMimeType =
        contentType(file.name) || 'text/plain; charset=utf-8';

      const readFileAsync = promisify(fs.readFile);
      const data = await readFileAsync(fileLocalPath);

      res.setHeader('Content-Type', fileMimeType);
      return res.status(200).send(data);
    } catch (err) {
      console.error(err);
      return res.status(500).send('Internal server error');
    }
  }
}

export default FilesController;
