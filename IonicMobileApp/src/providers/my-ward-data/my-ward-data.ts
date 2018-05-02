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

/// <reference path="../../../plugins/cordova-plugin-mfp/typings/worklight.d.ts" />

import { Injectable } from '@angular/core';
import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { Network } from '@ionic-native/network';

@Injectable()
export class MyWardDataProvider {
  data: any = null;
  objectStorageAccess: any = null;

  constructor(private transfer: FileTransfer, private file: File, private network: Network) {
    console.log('--> MyWardDataProvider constructor() called');
    this.createOfflineImagesDirIfNotExists();
  }

  load() {
    console.log('--> MyWardDataProvider loading data from adapter ...');
    return new Promise((resolve, reject) => {
      if (this.data) {
        // already loaded data
        return resolve(this.data);
      }
      // don't have the data yet
      let dataRequest = new WLResourceRequest("/adapters/MyWardData", WLResourceRequest.GET);
      dataRequest.send().then(
        (response) => {
          console.log('--> MyWardDataProvider loaded data from adapter\n', response);
          this.data = response.responseJSON;
          resolve(this.data);
        }, (failure) => {
          console.log('--> MyWardDataProvider failed to load data\n', JSON.stringify(failure));
          reject(failure);
        })
    });
  }

  getObjectStorageAccess() {
    // console.log('--> MyWardDataProvider getting Object Storage AuthToken from adapter ...');
    return new Promise((resolve, reject) => {
      if (this.objectStorageAccess) {
        // already loaded data
        return resolve(this.objectStorageAccess);
      }
      // don't have the data yet
      let dataRequest = new WLResourceRequest("/adapters/MyWardData/objectStorage", WLResourceRequest.GET);
      dataRequest.send().then(
        (response) => {
          // console.log('--> MyWardDataProvider got Object Storage AuthToken from adapter ', response);
          this.objectStorageAccess = response.responseJSON;
          resolve(this.objectStorageAccess);
        }, (failure) => {
          console.log('--> MyWardDataProvider failed to get Object Storage AuthToken from adapter\n', JSON.stringify(failure));
          reject(failure);
        })
    });
  }

  uploadNewGrievance(grievance) {
    return new Promise( (resolve, reject) => {
      console.log('--> MyWardDataProvider: Uploading following new grievance to server ...\n' + JSON.stringify(grievance));
      let dataRequest = new WLResourceRequest("/adapters/MyWardData", WLResourceRequest.POST);
      dataRequest.setHeader("Content-Type","application/json");
      dataRequest.send(grievance).then(
        (response) => {
          console.log('--> MyWardDataProvider: Upload successful:\n', response);
          resolve(response)
        }, (failure) => {
          console.log('--> MyWardDataProvider: Upload failed:\n', JSON.stringify(failure));
          reject(failure)
        }
      );
    });
  }

  hasNetworkConnection() {
    // https://ionicframework.com/docs/native/network/
    return this.network.type !== 'none';
  }

  offlineImagesDir : string = 'offlineImagesDir';
  offlineImagesDirEntry = null;

  createOfflineImagesDirIfNotExists() {
    this.file.checkDir(this.file.dataDirectory, this.offlineImagesDir).then(_ => {
      console.log('--> MyWardDataProvider: Directory ' + this.offlineImagesDir + ' exists');
      this.file.resolveDirectoryUrl(this.file.dataDirectory).then((baseDirEntry) => {
        this.file.getDirectory(baseDirEntry, this.offlineImagesDir, {}).then((dirEntry) => {
          this.offlineImagesDirEntry = dirEntry;
          console.log('--> MyWardDataProvider: Successfully resolved directory ' + this.offlineImagesDir);
        }).catch((err) => {
          console.log('--> MyWardDataProvider: Error getting directory ' + this.offlineImagesDir + ':\n' + JSON.stringify(err));
        });
      }).catch((err) => {
        console.log('--> MyWardDataProvider: Error resolving directory URL ' + this.file.dataDirectory + ':\n' + JSON.stringify(err));
      });
    }).catch(err => {
      console.log('--> MyWardDataProvider: Creating directory ' + this.offlineImagesDir + ' ...');
      this.file.createDir(this.file.dataDirectory, this.offlineImagesDir, false).then((dirEntry) => {
        this.offlineImagesDirEntry = dirEntry;
        console.log('--> MyWardDataProvider: Successfully created directory ' + this.offlineImagesDir);
      }).catch(err => {
        console.log('--> MyWardDataProvider: Error creating directory ' + this.offlineImagesDir + ':\n' + JSON.stringify(err));
      });
    });
  }

  saveImageInOfflineDir(fileName, filePath) {
    return new Promise( (resolve, reject) => {
      (window as any).resolveLocalFileSystemURL(filePath, (entry) => {
        console.log('--> MyWardDataProvider: Copying ' + entry.nativeURL + ' to ' + this.file.dataDirectory + this.offlineImagesDir + '/' + fileName + ' ...');
        entry.copyTo(this.offlineImagesDirEntry, fileName, (newEntry) => {
          console.log('--> MyWardDataProvider: Successfully copied file to path {{' + newEntry.filesystem.name + '}}/' + newEntry.fullPath);
          resolve("");
        }, (err) => {
          console.log('--> MyWardDataProvider: copyTo failed: ' + JSON.stringify(err));
          reject(err);
        });
      }, (err) => {
        console.log('--> MyWardDataProvider: Error during resolveLocalFileSystemURL: ' + JSON.stringify(err));
        reject(err);
      });
    });
  }

  uploadOfflineImages() {
    if (!this.hasNetworkConnection()) {
      return;
    }
    console.log('--> MyWardDataProvider: Listing images to be uploaded in  ' + this.offlineImagesDir+ ' ...');
    this.file.listDir(this.file.dataDirectory, this.offlineImagesDir).then((entries) => {
      entries.forEach((entry) => {
        console.log('--> MyWardDataProvider: Uploading image ' + entry.name + ' ...');
        this.uploadImage(entry.name, entry.nativeURL).then(() => {
          console.log('--> MyWardDataProvider: Removing cached file ' + entry.nativeURL + ' ...');
          entry.remove(() => {
            console.log('--> MyWardDataProvider: Successfully removed cached file ' + entry.nativeURL);
          }, (err) => {
            console.log('--> MyWardDataProvider: Error removing cached file:\n' + JSON.stringify(err));
          });
        });
      });
    }).catch((err) => {
      console.log('--> MyWardDataProvider: Error listing files in uploadOfflineImages: ' + JSON.stringify(err));
    });
  }

  uploadImage(fileName, filePath) {
    if (!this.hasNetworkConnection()) {
      console.log('--> MyWardDataProvider: Device offline. Saving image on local file system for later upload to Cloud Object Storage');
      return this.saveImageInOfflineDir(fileName, filePath);
    } else {
    return new Promise( (resolve, reject) => {
      let serverUrl = this.objectStorageAccess.baseUrl + fileName;
      console.log('--> MyWardDataProvider: Uploading image (' + filePath + ') to server (' + serverUrl + ') ...');
      let options: FileUploadOptions = {
        fileKey: 'file',
        fileName: fileName,
        httpMethod: 'PUT',
        headers: {
          'Authorization': this.objectStorageAccess.authorizationHeader,
          'Content-Type': 'image/jpeg'
        }
      }
      let fileTransfer: FileTransferObject = this.transfer.create();
      fileTransfer.upload(filePath, serverUrl, options) .then((data) => {
        // success
        console.log('--> MyWardDataProvider: Image upload successful:\n', data);
        resolve(data);
      }, (err) => {
        // error
        console.log('--> MyWardDataProvider: Image upload failed:\n', JSON.stringify(err));
        reject(err);
      })
    });
  }
  }
}
