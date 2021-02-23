/**
 * Simple file-based datastore
 *
 * @flow
 */

import path from 'path';
import fs from 'mz/fs';
import mkdirp from 'mkdirp-promise';

export class Store {
  dir = path.join(__dirname, '../../store');

  async load(uri: string): Promise<Object> {
    const filename = path.join(this.dir, uri);
    const data = await fs.readFile(filename, 'utf8');
    const config = JSON.parse(data);
    return config;
  }

  async save(uri: string, config: Object): Promise<void> {
    try {
      // mkdirp not working locally
      // await mkdirp(this.dir);
      // console.log('dir made');
      const filename = path.join(this.dir, uri);
      await fs.writeFile(filename, JSON.stringify(config), 'utf8');
    } catch (err) {
      console.log(err);
    }
  }
}
