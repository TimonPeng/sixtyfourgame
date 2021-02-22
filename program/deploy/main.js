/**
 * Solanaroll Deploy
 *
 * @flow
 */

import {
  establishConnection,
  establishOwner,
  loadProgram,
} from './deploy';

async function main() {

  // Establish connection to the cluster
  await establishConnection();

  console.log('Establishing owner');

  // Obtain owner for all accounts
  await establishOwner();

  console.log('Loading Program');

  // Load the program if not already loaded
  await loadProgram();

  console.log('Success');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit());
