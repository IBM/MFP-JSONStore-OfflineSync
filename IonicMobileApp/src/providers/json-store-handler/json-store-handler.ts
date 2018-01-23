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
import { MyWardDataProvider } from '../my-ward-data/my-ward-data';

@Injectable()
export class JsonStoreHandlerProvider {
  isCollectionInitialized = {};
  onSyncSuccessCallback = null;
  onSyncFailureCallback = null;

  constructor(public myWardDataProvider: MyWardDataProvider) {
    console.log('--> JsonStoreHandler constructor() called');
  }

  userCredentialsCollectionName = 'userCredentials';
  userCredentialsCollections = {
    userCredentials: {
      searchFields: { username: 'string' }
    }
  }

  myWardCollectionName = 'myward';
  myWardCollections = {
    myward: {
      searchFields: { reportedBy: 'string' }
    }
  };
  myWardCollectionOptions = {
    syncPolicy: 0,
    syncAdapterPath: '/adapters/JSONStoreCloudantSync/',
    onSyncSuccess: this.onSyncSuccess.bind(this),
    onSyncFailure: this.onSyncFailure.bind(this),
    username: null,
    password: null,
    localKeyGen: true
  };

  objectStorageDetailsCollectionName = 'objectStorageDetails';
  objectStorageDetailsCollections = {
    objectStorageDetails: {
      searchFields: { baseUrl: 'string' },
    }
  };

  // https://www.ibm.com/support/knowledgecenter/en/SSHS8R_8.0.0/com.ibm.worklight.apiref.doc/html/refjavascript-client/html/WL.JSONStore.html
  initCollections(username, password, isOnline:boolean) {
    console.log('--> JsonStoreHandler: initCollections called');
    return new Promise( (resolve, reject) => {
      if (username in this.isCollectionInitialized) {
        console.log('--> JsonStoreHandler: collections have already been initialized for username: ' + username);
        return resolve();
      }
      let encodedUsername = this.convertToJsonStoreCompatibleUsername(username);
      console.log('--> JsonStoreHandler: username after encoding: ' + encodedUsername);

      let options = {
        username: encodedUsername,
        password: password,
        localKeyGen: true
      }
      WL.JSONStore.closeAll({});
      WL.JSONStore.init(this.userCredentialsCollections, options).then((success) => {
        console.log('--> JsonStoreHandler: successfully initialized \'' + this.userCredentialsCollectionName + '\' JSONStore collection.');
        this.isCollectionInitialized[username] = true;
        if (isOnline) {
          this.initCollectionForOfflineLogin();
        }

        this.myWardCollectionOptions.username = encodedUsername;
        this.myWardCollectionOptions.password = password;
        WL.JSONStore.init(this.myWardCollections, this.myWardCollectionOptions).then((success) => {
          console.log('--> JsonStoreHandler: successfully initialized \'' + this.myWardCollectionName + '\' JSONStore collection.');

          WL.JSONStore.init(this.objectStorageDetailsCollections, options).then((success) => {
            console.log('--> JsonStoreHandler: successfully initialized \'' + this.objectStorageDetailsCollectionName + '\' JSONStore collection.');
            if (isOnline) {
              this.loadObjectStorageAccess.bind(this)();
            }
              resolve();
          }, (failure) => {
            console.log('--> JsonStoreHandler: failed to initialize \'' + this.objectStorageDetailsCollectionName + '\' JSONStore collection.\n' + JSON.stringify(failure));
            reject({collectionName: this.objectStorageDetailsCollectionName, failure: failure});
          });

        }, (failure) => {
          console.log('--> JsonStoreHandler: failed to initialize \'' + this.myWardCollectionName + '\' JSONStore collection.\n' + JSON.stringify(failure));
          reject({collectionName: this.myWardCollectionName, failure: failure});
        });

      }, (failure) => {
        if (isOnline) {
          console.log('--> JsonStoreHandler: password change detected for user: ' + username + ' . Destroying old JSONStore so as to recreate it.\n', JSON.stringify(failure));
          WL.JSONStore.destroy(encodedUsername).then(() => {
            this.initCollections(username, password, isOnline);
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
        console.log('--> JsonStoreHandler: data returned from JSONStore = \n', data);
        resolve(data);
      });
    });
  }

  onSyncSuccess(data) {
    console.log('--> JsonStoreHandler: data received from sync = \n', data);
    if (this.onSyncSuccessCallback != null) {
      this.onSyncSuccessCallback();
    } else {
      console.log('--> JsonStoreHandler: onSyncSuccessCallback not set!');
    }
  }

  onSyncFailure(error) {
    console.log('--> JsonStoreHandler: sync failed\n', error);
    if (this.onSyncFailureCallback != null) {
      this.onSyncFailureCallback(error);
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

  syncMyWardData() {
    let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.myWardCollectionName);
    // collectionInstance.sync();
  }

  loadObjectStorageAccess() {
    this.myWardDataProvider.getObjectStorageAccess().then(objectStorageAccess => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.objectStorageDetailsCollectionName);
      collectionInstance.clear({}).then(() => {
        collectionInstance.add(objectStorageAccess, {}).then((noOfDocs) => {
          console.log('--> JsonStoreHandler: loadObjectStorageAccess successful.');
          if (this.onSyncSuccessCallback != null) {
            this.onSyncSuccessCallback();
          } else {
            console.log('--> JsonStoreHandler loadObjectStorageAccess(): onSyncSuccessCallback not set!');
          }
        }, (failure) => {
          console.log('--> JsonStoreHandler: loadObjectStorageAccess failed\n', failure);
        });
      });
    }, (failure) => {
      // console.log('--> JsonStoreHandler: loadObjectStorageAccess failed\n', failure);
    });
  }

  getObjectStorageAccess() {
    return new Promise( (resolve, reject) => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.objectStorageDetailsCollectionName);
      collectionInstance.findAll({}).then((results) => {
        if (results.length > 0) {
          resolve(results[0].json);
        } else {
          resolve({baseUrl: '', authorizationHeader: ''});
          // reject('Did not find document containing objectStorageAccess.');
        }
      }, (failure) => {
        reject(failure);
      });
    });
  }
}
