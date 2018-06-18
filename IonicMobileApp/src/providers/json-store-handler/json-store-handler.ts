/**
 * Copyright 2017 IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/// <reference path="../../../plugins/cordova-plugin-mfp-jsonstore/typings/jsonstore.d.ts" />

import { Injectable } from '@angular/core';
import { Network } from '@ionic-native/network';

import { MyWardDataProvider } from '../my-ward-data/my-ward-data';

@Injectable()
export class JsonStoreHandlerProvider {
  isCollectionInitialized = {};
  onSyncSuccessCallback = null;
  onSyncFailureCallback = null;
  objectStorageAccess = null;

  constructor(private network: Network, public myWardDataProvider: MyWardDataProvider) {
    console.log('--> JsonStoreHandler constructor() called');
    this.network.onConnect().subscribe(() => {
      console.log('--> JsonStoreHandlerProvider: Network connected!');
      // We just got a connection but we need to wait briefly
      // before we determine the connection type. Might need to wait.
      // prior to doing any api requests as well.
      setTimeout(() => {
        if (this.network.type != 'none') {
          this.initUpstreamSync();
        }
      }, 3000);
    });
  }

  userCredentialsCollectionName = 'userCredentials';
  myWardCollectionName = 'myward';
  newProblemsCollectionName = 'newproblems';
  objectStorageDetailsCollectionName = 'objectStorageDetails';

  myCollections = {
    userCredentials: {
      searchFields: { username: 'string' }
    },
    myward: {
      searchFields: { reportedBy: 'string' },
      sync: {
        syncPolicy: 0,
        syncAdapterPath: 'JSONStoreCloudantSync',
        onSyncSuccess: this.onSyncSuccess.bind(this),
        onSyncFailure: this.onSyncFailure.bind(this),
      }
    },
    newproblems: {
      searchFields: { problemDescription: 'string' },
      sync: {
        syncPolicy: 1,
        syncAdapterPath: 'JSONStoreCloudantSync',
        onSyncSuccess: this.onUpstreamSyncSuccess.bind(this),
        onSyncFailure: this.onUpstreamSyncFailure.bind(this),
      }
    },
    objectStorageDetails: {
      searchFields: { baseUrl: 'string' },
    }
  }

  // https://www.ibm.com/support/knowledgecenter/en/SSHS8R_8.0.0/com.ibm.worklight.apiref.doc/html/refjavascript-client/html/WL.JSONStore.html
  initCollections(username, password, isOnline:boolean) {
    return new Promise( (resolve, reject) => {
      if (username in this.isCollectionInitialized) {
        // console.log('--> JsonStoreHandler: collections have already been initialized for username: ' + username);
        return resolve();
      }
      let timeBegin = performance.now();
      console.log('--> JsonStoreHandler: initCollections called');
      let encodedUsername = this.convertToJsonStoreCompatibleUsername(username);
      console.log('--> JsonStoreHandler: username after encoding: ' + encodedUsername);

      let options = {
        username: encodedUsername,
        password: password,
        localKeyGen: true
      }
      WL.JSONStore.closeAll({});
      WL.JSONStore.init(this.myCollections, options).then((success) => {
        let timeEnd = performance.now();
        console.log('--> JsonStoreHandler: successfully initialized JSONStore collections. Time spent = ' + (timeEnd - timeBegin) + ' ms.');
        this.isCollectionInitialized[username] = true;
        if (isOnline) {
          this.initCollectionForOfflineLogin();
          this.loadObjectStorageAccess.bind(this)();
        }
        resolve();
      }, (failure) => {
        if (isOnline) {
          console.log('--> JsonStoreHandler: password change detected for user: ' + username + ' . Destroying old JSONStore so as to recreate it.\n', JSON.stringify(failure));
          WL.JSONStore.destroy(encodedUsername).then(() => {
            return resolve(this.initCollections(username, password, isOnline));
          });
        } else {
          console.log('--> JsonStoreHandler: failed to initialize \'' + this.userCredentialsCollectionName + '\' JSONStore collection.\n' + JSON.stringify(failure));
          reject({collectionName: this.userCredentialsCollectionName, failure: failure});
        }
      });
    });
  }

  initCollectionForOfflineLogin() {
    let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.userCredentialsCollectionName);
    collectionInstance.count({}, {}).then((countResult) => {
      if (countResult == 0) {
        collectionInstance.add({ name: this.userCredentialsCollectionName }, {});
        console.log('--> JsonStoreHandler: \'' + this.userCredentialsCollectionName + '\' JSONStore collection has been initialized for offlineLogin');
      }
    })
  }

  previousLoginExists() {
    return new Promise( (resolve, reject) => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.userCredentialsCollectionName);
      collectionInstance.count({}, {}).then((countResult) => {
        if (countResult == 0) {
          reject();
        } else {
          resolve();
        }
      })
    });
  }

  destroyCollections(username) {
    WL.JSONStore.destroy(username);
  }

 // JSONStore username must be an alphanumeric string ([a-z, A-Z, 0-9]) and start with a letter
  convertToJsonStoreCompatibleUsername(str: String) {
    // https://stackoverflow.com/questions/21647928/javascript-unicode-string-to-hex
    let result = "U"; // start with a letter
    for (let i=0; i<str.length; i++) {
      let hex = str.charCodeAt(i).toString(16);
      result += ("0"+hex).slice(-4); // if you want to support Unicode text, then use ("000"+hex)
    }
    return result
  }

  getData() {
    return new Promise( (resolve, reject) => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.myWardCollectionName);
      collectionInstance.findAll('{}').then((data) => {
        console.log('--> JsonStoreHandler: data fetched from JSONStore = \n', data);
        resolve(data);
      });
    });
  }

  getUnSyncedData() {
    return new Promise( (resolve, reject) => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.newProblemsCollectionName);
      if (collectionInstance != null) {
        collectionInstance.getAllDirty('{}').then((data) => {
          if (data.length > 0) {
            console.log('--> JsonStoreHandler: Data that is not yet synced with Cloudant = \n', data);
          }
          resolve(data);
        });
      } else {
        resolve({});
      }
    });
  }

  onSyncSuccess(msg) {
    // Following check is a workaround for a bug in JSONStore sync where
    // onSyncSuccess is called for both myward and newproblems collections
    if (msg.includes('for collection ' + this.myWardCollectionName)) {
      console.log('--> JsonStoreHandler onSyncSuccess: ' + msg);
      if (this.onSyncSuccessCallback != null) {
        this.onSyncSuccessCallback();
      } else {
        console.log('--> JsonStoreHandler: onSyncSuccessCallback not set!');
      }
    }
  }

  onSyncFailure(msg) {
    console.log('--> JsonStoreHandler: sync failed\n', msg);
    if (this.onSyncFailureCallback != null) {
      this.onSyncFailureCallback(msg);
    } else {
      console.log('--> JsonStoreHandler: onSyncFailureCallback not set!');
    }
  }

  setOnSyncSuccessCallback(onSyncSuccess) {
    this.onSyncSuccessCallback = onSyncSuccess;
  }

  setOnSyncFailureCallback(onSyncFailure) {
    this.onSyncFailureCallback = onSyncFailure;
  }

  onUpstreamSyncSuccess(msg) {
    // Following check is a workaround for a bug in JSONStore sync where
    // onSyncSuccess is called for both myward and newproblems collections
    if (msg.includes('for collection ' + this.newProblemsCollectionName)) {
      console.log('--> JsonStoreHandler onUpstreamSyncSuccess: ' + msg);
      this.syncMyWardData();
    }
  }

  onUpstreamSyncFailure(error) {
    console.log('--> JsonStoreHandler: upstream sync failed\n', error);
  }

  syncMyWardData() {
    let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.myWardCollectionName);
    if (collectionInstance != null) {
      collectionInstance.sync().then(() => {
        console.log('--> JsonStoreHandler downstream sync initiated');
      }, (failure) => {
        console.log('--> JsonStoreHandler Failed to initiate downstream sync\n' + failure);
      });
    } else {
      console.log('--> JsonStoreHandler Failed to initiate downstream sync\n' + 'Collection ' + this.myWardCollectionName + ' not yet initialized');
    }
  }

  initUpstreamSync() {
    let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.newProblemsCollectionName);
    if (collectionInstance != null) {
      collectionInstance.sync().then(() => {
        console.log('--> JsonStoreHandler upstream sync initiated');
      }, (failure) => {
        console.log('--> JsonStoreHandler Failed to initiate upstream sync\n' + failure);
      });
    } else {
      console.log('--> JsonStoreHandler Failed to initiate upstream sync\n' + 'Collection ' + this.newProblemsCollectionName + ' not yet initialized');
    }
  }

  loadObjectStorageAccess() {
    this.myWardDataProvider.getObjectStorageAccess().then(objectStorageAccess => {
      this.hasObjectStorageAccessChanged(objectStorageAccess).then((hasChanged) => {
        if (hasChanged) {
          this.objectStorageAccess = objectStorageAccess;
          let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.objectStorageDetailsCollectionName);
          collectionInstance.clear({}).then(() => {
            collectionInstance.add(objectStorageAccess, {}).then((noOfDocs) => {
              console.log('--> JsonStoreHandler objectStorageAccess successfully updated.');
              if (this.onSyncSuccessCallback != null) {
                this.onSyncSuccessCallback();
              } else {
                console.log('--> JsonStoreHandler loadObjectStorageAccess(): onSyncSuccessCallback not set!');
              }
            }, (failure) => {
              console.log('--> JsonStoreHandler loadObjectStorageAccess(): add to JSONStore failed\n', failure);
            });
          });
        } else {
          console.log('--> JsonStoreHandler: objectStorageAccess has not changed.');
        }
      });
    });
  }

  hasObjectStorageAccessChanged(newObjectStorageAccess) {
    return new Promise( (resolve, reject) => {
      this.getObjectStorageAccess().then((oldObjectStorageAccess: any) => {
        if (oldObjectStorageAccess != null && oldObjectStorageAccess.baseUrl == newObjectStorageAccess.baseUrl &&
          oldObjectStorageAccess.authorizationHeader == newObjectStorageAccess.authorizationHeader) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  getObjectStorageAccess() {
    return new Promise( (resolve, reject) => {
      if (this.objectStorageAccess) {
        // already loaded data
        return resolve(this.objectStorageAccess);
      }
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.objectStorageDetailsCollectionName);
      if (collectionInstance != null) {
        collectionInstance.findAll({}).then((results) => {
          if (results.length > 0) {
            this.objectStorageAccess = results[0].json;
            resolve(results[0].json);
          } else {
            resolve(null);
          }
        }, (failure) => {
          console.log('--> JsonStoreHandler: getObjectStorageAccess failed\n', failure);
          reject(failure);
        });
      } else {
        resolve(null);
      }
    });
  }

  addNewGrievance(grievance) {
    return new Promise( (resolve, reject) => {
      console.log('--> JsonStoreHandler: adding following new grievance to JSONStore ...\n' + JSON.stringify(grievance));
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.newProblemsCollectionName);
      collectionInstance.add(grievance, {}).then((noOfDocs) => {
        console.log('--> JsonStoreHandler added new grievance.');
        resolve();
      }, (failure) => {
        console.log('--> JsonStoreHandler addNewGrievance failed\n', failure);
        reject(failure);
      });
    });
  }

}
